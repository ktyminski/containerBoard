import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getCurrentUserFromRequest } from "@/lib/auth-user";
import {
  ensureContainerListingsIndexes,
  getContainerInquiriesCollection,
  getContainerListingsCollection,
  mapContainerListingToItem,
} from "@/lib/container-listings";
import { getContainerShortLabel, LISTING_STATUS } from "@/lib/container-listing-types";
import { enforceRateLimitOrResponse } from "@/lib/request-rate-limit";
import { sendContainerInquiryEmail } from "@/lib/mailer";
import { getAbsoluteUrl } from "@/lib/seo";
import { logError } from "@/lib/server-logger";
import { CONTACT_ACTIVITY_TYPE, recordContactActivity } from "@/lib/contact-activity";
import { getRequestIp, isTurnstileEnabled, verifyTurnstileToken } from "@/lib/turnstile";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const inquirySchema = z.object({
  buyerName: z.string().trim().min(2).max(120),
  buyerEmail: z.email().trim().max(160),
  buyerPhone: z.string().trim().max(40).optional(),
  message: z.string().trim().max(2_000).optional(),
  requestedQuantity: z.coerce.number().int().min(1).max(100_000).optional(),
  offeredPrice: z.string().trim().max(100).optional(),
  turnstileToken: z.string().trim().optional().default(""),
});

function normalizeOptional(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    await ensureContainerListingsIndexes();

    const rateLimitResponse = await enforceRateLimitOrResponse({
      request,
      scope: "containers:inquiry:ip",
      limit: 25,
      windowMs: 60_000,
      onError: "block",
    });
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const { id } = await context.params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid listing id" }, { status: 400 });
    }

    const parsed = inquirySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          issues: parsed.error.issues.map((issue) => issue.message),
        },
        { status: 400 },
      );
    }

    const listings = await getContainerListingsCollection();
    const listingId = new ObjectId(id);
    const listing = await listings.findOne(
      {
        _id: listingId,
        status: LISTING_STATUS.ACTIVE,
        expiresAt: { $gt: new Date() },
      },
    );

    if (!listing?._id) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    const inquiry = parsed.data;
    const buyerPhone = normalizeOptional(inquiry.buyerPhone);
    const inquiryMessage = normalizeOptional(inquiry.message);
    const offeredPrice = normalizeOptional(inquiry.offeredPrice);
    const currentUser = await getCurrentUserFromRequest(request);
    const isGuest = !currentUser?._id;
    const turnstileEnabled = isTurnstileEnabled();
    if (isGuest && turnstileEnabled && !inquiry.turnstileToken) {
      return NextResponse.json({ error: "TURNSTILE_REQUIRED" }, { status: 400 });
    }
    if (isGuest && turnstileEnabled) {
      const turnstileResult = await verifyTurnstileToken({
        token: inquiry.turnstileToken,
        remoteIp: getRequestIp(request.headers),
      });
      if (!turnstileResult.ok) {
        return NextResponse.json({ error: "TURNSTILE_FAILED" }, { status: 400 });
      }
    }
    const now = new Date();

    const inquiries = await getContainerInquiriesCollection();
    await inquiries.insertOne({
      _id: new ObjectId(),
      listingId,
      buyerName: inquiry.buyerName.trim(),
      buyerEmail: inquiry.buyerEmail.trim(),
      buyerPhone,
      message: inquiryMessage ?? "",
      requestedQuantity: inquiry.requestedQuantity,
      offeredPrice,
      createdByUserId: currentUser?._id,
      createdAt: now,
    });

    const listingItem = mapContainerListingToItem(listing);
    const containerLabel = getContainerShortLabel(listingItem.container);
    const summaryLine = `${containerLabel} | ${listing.type} | ${listing.locationCity}, ${listing.locationCountry}`;
    const listingUrl = getAbsoluteUrl(`/containers/${listingId.toHexString()}`);
    const sendResult = await sendContainerInquiryEmail({
      to: listing.contactEmail,
      containerLabel,
      summaryLine,
      companyName: listing.companyName,
      listingQuantity: listing.quantity,
      listingUrl,
      buyerName: inquiry.buyerName,
      buyerEmail: inquiry.buyerEmail,
      buyerPhone,
      inquiryMessage,
      requestedQuantity: inquiry.requestedQuantity,
      offeredPrice,
    });

    if (!sendResult.ok) {
      logError("Failed to send container inquiry email", {
        listingId: listingId.toHexString(),
        error: sendResult.error,
        status: sendResult.status,
      });
    }

    try {
      await recordContactActivity({
        type: CONTACT_ACTIVITY_TYPE.INQUIRY_SENT,
        listingId,
        listingType: listing.type,
        listingSummary: summaryLine,
        listingCompanyName: listing.companyName,
        actorUserId: currentUser?._id,
        actorIsGuest: isGuest,
        actorName: inquiry.buyerName.trim(),
        actorEmail: inquiry.buyerEmail.trim(),
        actorPhone: buyerPhone,
        actorAccountName: currentUser?.name?.trim() || undefined,
        actorAccountEmail: currentUser?.email?.trim() || undefined,
        actorIp: getRequestIp(request.headers),
        actorUserAgent: request.headers.get("user-agent")?.trim() || undefined,
        recipientUserId: listing.createdByUserId,
        recipientCompanyName: listing.companyName,
        recipientEmail: listing.contactEmail,
        recipientPhone: listing.contactPhone?.trim() || undefined,
        inquiryMessage,
        requestedQuantity: inquiry.requestedQuantity,
        offeredPrice,
      });
    } catch (activityError) {
      logError("Failed to record contact activity for inquiry", {
        route: "/api/containers/[id]/inquiry",
        listingId: listingId.toHexString(),
        error: activityError,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    logError("Unhandled API error", { route: "/api/containers/[id]/inquiry", error });
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown inquiry error",
      },
      { status: 500 },
    );
  }
}

