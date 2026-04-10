import { MongoServerError, ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/auth-user";
import { getAnnouncementsCollection } from "@/lib/announcements";
import {
  ensureAnnouncementFavoritesIndexes,
  getAnnouncementFavoritesCollection,
} from "@/lib/announcement-favorites";
import { logError } from "@/lib/server-logger";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid announcement id" }, { status: 400 });
    }

    const user = await getCurrentUserFromRequest(request);
    if (!user?._id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const announcementId = new ObjectId(id);
    const announcements = await getAnnouncementsCollection();
    const exists = await announcements.findOne(
      { _id: announcementId, isPublished: true },
      { projection: { _id: 1 } },
    );
    if (!exists?._id) {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
    }

    await ensureAnnouncementFavoritesIndexes();
    const favorites = await getAnnouncementFavoritesCollection();
    try {
      await favorites.insertOne({
        _id: new ObjectId(),
        userId: user._id,
        announcementId,
        createdAt: new Date(),
      });
    } catch (error) {
    logError("Unhandled API error", { route: "/api/announcements/[id]/favorite", error });
      if (
        error instanceof MongoServerError &&
        error.code === 11000
      ) {
        return NextResponse.json({ ok: true, isFavorite: true });
      }
      throw error;
    }

    return NextResponse.json({ ok: true, isFavorite: true });
  } catch (error) {
    logError("Unhandled API error", { route: "/api/announcements/[id]/favorite", error });
    return NextResponse.json(
      {
        error: "Internal server error",
        message:
          error instanceof Error
            ? error.message
            : "Unknown announcement favorite error",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid announcement id" }, { status: 400 });
    }

    const user = await getCurrentUserFromRequest(request);
    if (!user?._id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensureAnnouncementFavoritesIndexes();
    const favorites = await getAnnouncementFavoritesCollection();
    await favorites.deleteOne({
      userId: user._id,
      announcementId: new ObjectId(id),
    });

    return NextResponse.json({ ok: true, isFavorite: false });
  } catch (error) {
    logError("Unhandled API error", { route: "/api/announcements/[id]/favorite", error });
    return NextResponse.json(
      {
        error: "Internal server error",
        message:
          error instanceof Error
            ? error.message
            : "Unknown announcement unfavorite error",
      },
      { status: 500 },
    );
  }
}
