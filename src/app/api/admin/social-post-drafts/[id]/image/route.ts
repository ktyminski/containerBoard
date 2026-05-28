import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { enforceAuthenticatedRateLimitOrResponse } from "@/lib/app-rate-limit";
import { getCurrentUserFromRequest } from "@/lib/auth-user";
import { downloadBlobToBufferWithAccessFallback } from "@/lib/blob-storage";
import {
  ensureSocialPostDraftIndexes,
  getSocialPostDraftsCollection,
} from "@/lib/social-post-drafts";
import { USER_ROLE } from "@/lib/user-roles";
import { logError } from "@/lib/server-logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user?._id || user.role !== USER_ROLE.ADMIN) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rateLimitResponse = await enforceAuthenticatedRateLimitOrResponse({
      request,
      scope: "admin:social-post-drafts:image",
      userId: user._id.toHexString(),
      ipLimit: 240,
      userLimit: 180,
    });
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const { id } = await context.params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid draft id" }, { status: 400 });
    }

    await ensureSocialPostDraftIndexes();
    const drafts = await getSocialPostDraftsCollection();
    const draft = await drafts.findOne(
      { _id: new ObjectId(id) },
      { projection: { imagePathname: 1, imageUrl: 1, updatedAt: 1 } },
    );
    if (!draft?.imageUrl && !draft?.imagePathname) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    const downloaded = await downloadBlobToBufferWithAccessFallback({
      urlOrPathname: draft.imagePathname || draft.imageUrl,
      useCache: true,
    });
    if (!downloaded) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    const contentType = downloaded.contentType || "image/jpeg";
    const bytes = new Uint8Array(downloaded.buffer);
    const blob = new Blob([bytes.buffer], { type: contentType });

    return new NextResponse(blob, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    logError("Unhandled API error", {
      route: "/api/admin/social-post-drafts/[id]/image",
      error,
    });
    return NextResponse.json(
      {
        error: "Internal server error",
        message:
          error instanceof Error
            ? error.message
            : "Unknown admin social draft image error",
      },
      { status: 500 },
    );
  }
}

