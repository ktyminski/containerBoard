import { ObjectId } from "mongodb";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/auth-user";
import {
  ensureContainerListingsIndexes,
  getContainerListingsCollection,
} from "@/lib/container-listings";
import { CONTACT_ACTIVITY_TYPE, recordContactActivity } from "@/lib/contact-activity";
import { enforceRateLimitOrResponse } from "@/lib/request-rate-limit";
import { logError } from "@/lib/server-logger";
import { getRequestIp } from "@/lib/turnstile";
import { USER_ROLE } from "@/lib/user-roles";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const rateLimitResponse = await enforceRateLimitOrResponse({
    request,
    scope: "container-contact-reveal:ip",
    limit: 30,
    windowMs: 60_000,
  });
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  await ensureContainerListingsIndexes();

  const { id } = await context.params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid listing id" }, { status: 400 });
  }

  const listings = await getContainerListingsCollection();
  const listingId = new ObjectId(id);
  const listing = await listings.findOne(
    { _id: listingId },
    {
      projection: {
        _id: 1,
        type: 1,
        companyName: 1,
        locationCity: 1,
        locationCountry: 1,
        contactEmail: 1,
        contactPhone: 1,
        createdByUserId: 1,
        contactRevealCount: 1,
      },
    },
  );

  if (!listing?._id) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  const currentUser = await getCurrentUserFromRequest(request);
  const isOwner =
    currentUser?._id?.toHexString() === listing.createdByUserId.toHexString();
  const isAdmin = currentUser?.role === USER_ROLE.ADMIN;

  if (isOwner || isAdmin) {
    return NextResponse.json({
      ok: true,
      count:
        typeof listing.contactRevealCount === "number" &&
        Number.isFinite(listing.contactRevealCount)
          ? Math.max(0, Math.trunc(listing.contactRevealCount))
          : 0,
      incremented: false,
    });
  }

  const result = await listings.findOneAndUpdate(
    { _id: listingId },
    {
      $inc: { contactRevealCount: 1 },
    },
    {
      returnDocument: "after",
      projection: {
        contactRevealCount: 1,
      },
    },
  );

  try {
    await recordContactActivity({
      type: CONTACT_ACTIVITY_TYPE.CONTACT_REVEALED,
      listingId,
      listingType: listing.type,
      listingSummary: [
        listing.companyName?.trim(),
        listing.type,
        [listing.locationCity?.trim(), listing.locationCountry?.trim()].filter(Boolean).join(", "),
      ]
        .filter(Boolean)
        .join(" | "),
      listingCompanyName: listing.companyName?.trim() || undefined,
      actorUserId: currentUser?._id,
      actorIsGuest: !currentUser?._id,
      actorName: currentUser?.name?.trim() || undefined,
      actorEmail: currentUser?.email?.trim() || undefined,
      actorPhone: currentUser?.phone?.trim() || undefined,
      actorAccountName: currentUser?.name?.trim() || undefined,
      actorAccountEmail: currentUser?.email?.trim() || undefined,
      actorIp: getRequestIp(request.headers),
      actorUserAgent: request.headers.get("user-agent")?.trim() || undefined,
      recipientUserId: listing.createdByUserId,
      recipientCompanyName: listing.companyName?.trim() || undefined,
      recipientEmail: listing.contactEmail?.trim() || undefined,
      recipientPhone: listing.contactPhone?.trim() || undefined,
    });
  } catch (activityError) {
    logError("Failed to record contact activity for reveal", {
      route: "/api/containers/[id]/contact-reveal",
      listingId: listingId.toHexString(),
      error: activityError,
    });
  }

  return NextResponse.json({
    ok: true,
    count:
      typeof result?.contactRevealCount === "number" &&
      Number.isFinite(result.contactRevealCount)
        ? Math.max(0, Math.trunc(result.contactRevealCount))
        : 1,
    incremented: true,
  });
}
