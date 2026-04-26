import { ObjectId } from "mongodb";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/auth-user";
import {
  ensureContainerListingsIndexes,
  getContainerListingsCollection,
} from "@/lib/container-listings";
import { enforceRateLimitOrResponse } from "@/lib/request-rate-limit";
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
