import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getCurrentUserFromRequest } from "@/lib/auth-user";
import {
  ensureContainerListingsIndexes,
  getContainerListingFavoritesCollection,
  getContainerListingsCollection,
} from "@/lib/container-listings";
import { LISTING_STATUS } from "@/lib/container-listing-types";
import { logError } from "@/lib/server-logger";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    await ensureContainerListingsIndexes();

    const user = await getCurrentUserFromRequest(request);
    if (!user?._id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid listing id" }, { status: 400 });
    }

    const listingId = new ObjectId(id);
    const listing = await (await getContainerListingsCollection()).findOne(
      {
        _id: listingId,
        status: LISTING_STATUS.ACTIVE,
        expiresAt: { $gt: new Date() },
      },
      {
        projection: {
          _id: 1,
        },
      },
    );

    if (!listing?._id) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    await (await getContainerListingFavoritesCollection()).updateOne(
      {
        userId: user._id,
        listingId,
      },
      {
        $setOnInsert: {
          _id: new ObjectId(),
          userId: user._id,
          listingId,
          createdAt: new Date(),
        },
      },
      {
        upsert: true,
      },
    );

    return NextResponse.json({ isFavorite: true });
  } catch (error) {
    logError("Unhandled API error", { route: "/api/containers/[id]/favorite", error });
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown favorite error",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    await ensureContainerListingsIndexes();

    const user = await getCurrentUserFromRequest(request);
    if (!user?._id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid listing id" }, { status: 400 });
    }

    const listingId = new ObjectId(id);
    await (await getContainerListingFavoritesCollection()).deleteOne({
      userId: user._id,
      listingId,
    });

    return NextResponse.json({ isFavorite: false });
  } catch (error) {
    logError("Unhandled API error", { route: "/api/containers/[id]/favorite", error });
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown unfavorite error",
      },
      { status: 500 },
    );
  }
}
