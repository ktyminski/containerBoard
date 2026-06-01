import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/auth-user";
import { logError } from "@/lib/server-logger";

export const runtime = "nodejs";

const MAX_LISTING_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
const UPLOAD_PATH_PREFIX = "containers/uploads/";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const user = await getCurrentUserFromRequest(request);
        if (!user?._id || user.isBlocked === true) {
          throw new Error("Unauthorized");
        }

        if (!pathname.startsWith(UPLOAD_PATH_PREFIX)) {
          throw new Error("Invalid upload path");
        }

        return {
          allowedContentTypes: [...ALLOWED_IMAGE_CONTENT_TYPES],
          maximumSizeInBytes: MAX_LISTING_PHOTO_BYTES,
          addRandomSuffix: true,
          cacheControlMaxAge: 31536000,
          tokenPayload: JSON.stringify({
            userId: user._id.toHexString(),
          }),
          validUntil: Date.now() + 15 * 60 * 1000,
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    logError("Container direct upload error", {
      route: "/api/containers/uploads",
      error,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 },
    );
  }
}
