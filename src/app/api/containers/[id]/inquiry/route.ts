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
import { sendMail } from "@/lib/mailer";
import { logError } from "@/lib/server-logger";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const inquirySchema = z.object({
  buyerName: z.string().trim().min(2).max(120),
  buyerEmail: z.email().trim().max(160),
  message: z.string().trim().min(10).max(2_000),
  requestedQuantity: z.coerce.number().int().min(1).max(100_000).optional(),
  offeredPrice: z.string().trim().max(100).optional(),
});

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

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
    const currentUser = await getCurrentUserFromRequest(request);
    const now = new Date();

    const inquiries = await getContainerInquiriesCollection();
    await inquiries.insertOne({
      _id: new ObjectId(),
      listingId,
      buyerName: inquiry.buyerName.trim(),
      buyerEmail: inquiry.buyerEmail.trim(),
      message: inquiry.message.trim(),
      requestedQuantity: inquiry.requestedQuantity,
      offeredPrice: normalizeOptional(inquiry.offeredPrice),
      createdByUserId: currentUser?._id,
      createdAt: now,
    });

    const listingItem = mapContainerListingToItem(listing);
    const containerLabel = getContainerShortLabel(listingItem.container);
    const summaryLine = `${containerLabel} | ${listing.type} | ${listing.locationCity}, ${listing.locationCountry}`;
    const textMessage = [
      `Otrzymales nowe zapytanie do kontenera (${summaryLine}).`,
      "",
      `Firma/ogloszenie: ${listing.companyName}`,
      `Ilosc w ogloszeniu: ${listing.quantity}`,
      "",
      "Dane osoby pytajacej:",
      `Imie i nazwisko: ${inquiry.buyerName}`,
      `Email: ${inquiry.buyerEmail}`,
      `Wiadomosc: ${inquiry.message}`,
      inquiry.requestedQuantity ? `Oczekiwana ilosc: ${inquiry.requestedQuantity}` : "",
      inquiry.offeredPrice?.trim() ? `Proponowana cena: ${inquiry.offeredPrice.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const htmlMessage = `
      <p>Otrzymales nowe zapytanie do kontenera <strong>${escapeHtml(summaryLine)}</strong>.</p>
      <p><strong>Firma/ogloszenie:</strong> ${escapeHtml(listing.companyName)}<br/>
      <strong>Ilosc w ogloszeniu:</strong> ${listing.quantity}</p>
      <p><strong>Dane osoby pytajacej:</strong><br/>
      <strong>Imie i nazwisko:</strong> ${escapeHtml(inquiry.buyerName)}<br/>
      <strong>Email:</strong> ${escapeHtml(inquiry.buyerEmail)}<br/>
      <strong>Wiadomosc:</strong><br/>${escapeHtml(inquiry.message).replaceAll("\n", "<br/>")}<br/>
      ${inquiry.requestedQuantity ? `<strong>Oczekiwana ilosc:</strong> ${inquiry.requestedQuantity}<br/>` : ""}
      ${inquiry.offeredPrice?.trim() ? `<strong>Proponowana cena:</strong> ${escapeHtml(inquiry.offeredPrice.trim())}` : ""}
      </p>
    `;

    const sendResult = await sendMail({
      to: listing.contactEmail,
      subject: `Nowe zapytanie o kontener - ${containerLabel}`,
      text: textMessage,
      html: htmlMessage,
    });

    if (!sendResult.ok) {
      logError("Failed to send container inquiry email", {
        listingId: listingId.toHexString(),
        error: sendResult.error,
        status: sendResult.status,
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

