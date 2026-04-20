import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/auth-user";
import { getContainerListingFavoritesCollection, getContainerListingsCollection } from "@/lib/container-listings";
import { enforceAuthenticatedRateLimitOrResponse } from "@/lib/app-rate-limit";
import { logError } from "@/lib/server-logger";

export const runtime = "nodejs";

function isTruthyFlag(value: string | null): boolean {
  if (!value) {
    return false;
  }

  return value === "1" || value.toLowerCase() === "true";
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user?._id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimitResponse = await enforceAuthenticatedRateLimitOrResponse({
      request,
      scope: "containers:favorites-summary",
      userId: user._id.toHexString(),
      ipLimit: 180,
      userLimit: 90,
    });
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const mineOnly = isTruthyFlag(request.nextUrl.searchParams.get("mine"));
    const favorites = await getContainerListingFavoritesCollection();

    if (!mineOnly) {
      const total = await favorites.countDocuments({ userId: user._id });
      return NextResponse.json({ total, hasAny: total > 0 });
    }

    const listings = await getContainerListingsCollection();
    const [summary] = await favorites
      .aggregate<{ total: number }>([
        { $match: { userId: user._id } },
        {
          $lookup: {
            from: listings.collectionName,
            localField: "listingId",
            foreignField: "_id",
            as: "listing",
          },
        },
        { $unwind: "$listing" },
        { $match: { "listing.createdByUserId": user._id } },
        { $count: "total" },
      ])
      .toArray();

    const total = summary?.total ?? 0;
    return NextResponse.json({ total, hasAny: total > 0 });
  } catch (error) {
    logError("GET /api/containers/favorites/summary failed", { error });
    return NextResponse.json(
      { error: "Failed to load favorites summary" },
      { status: 500 },
    );
  }
}
