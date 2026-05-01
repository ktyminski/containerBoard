import { ObjectId } from "mongodb";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/auth-user";
import {
  ensureContainerListingsIndexes,
  getContainerListingsCollection,
} from "@/lib/container-listings";
import { logError } from "@/lib/server-logger";
import { USER_ROLE } from "@/lib/user-roles";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function normalizeDetailsViewCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(1, Math.trunc(value))
    : 1;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
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
          detailsViewCount: 1,
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
        count: normalizeDetailsViewCount(listing.detailsViewCount),
        incremented: false,
      });
    }

    const result = await listings.findOneAndUpdate(
      { _id: listingId },
      {
        $inc: { detailsViewCount: 1 },
      },
      {
        returnDocument: "after",
        projection: {
          detailsViewCount: 1,
        },
      },
    );

    return NextResponse.json({
      ok: true,
      count: normalizeDetailsViewCount(result?.detailsViewCount),
      incremented: true,
    });
  } catch (error) {
    logError("Unhandled API error", {
      route: "/api/containers/[id]/view",
      error,
    });
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown container view error",
      },
      { status: 500 },
    );
  }
}
