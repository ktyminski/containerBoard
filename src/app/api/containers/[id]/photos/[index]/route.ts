import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { downloadBlobToBufferWithAccessFallback } from "@/lib/blob-storage";
import { getMediaCacheControl } from "@/lib/company-media";
import { getContainerListingsCollection } from "@/lib/container-listings";
import { logError } from "@/lib/server-logger";

export const runtime = "nodejs";

const THUMBNAIL_WIDTHS = [64, 96, 160, 320] as const;
const THUMBNAIL_WEBP_QUALITY = 62;

type SharpLike = typeof import("sharp");

type RouteContext = {
  params: Promise<{
    id: string;
    index: string;
  }>;
};

function toBytes(value: unknown): Uint8Array | null {
  if (Buffer.isBuffer(value)) {
    return new Uint8Array(value);
  }
  if (value instanceof Uint8Array) {
    return value;
  }
  if (typeof value === "object" && value !== null && "buffer" in value) {
    const nested = (value as { buffer?: unknown }).buffer;
    if (Buffer.isBuffer(nested)) {
      return new Uint8Array(nested);
    }
    if (nested instanceof Uint8Array) {
      return nested;
    }
  }
  return null;
}

function parseThumbnailWidth(request: NextRequest): number | null {
  const widthParam = request.nextUrl.searchParams.get("w");
  if (!widthParam) {
    return null;
  }

  const requestedWidth = Number(widthParam);
  if (!Number.isFinite(requestedWidth) || requestedWidth <= 0) {
    return null;
  }

  return (
    THUMBNAIL_WIDTHS.find((width) => requestedWidth <= width) ??
    THUMBNAIL_WIDTHS[THUMBNAIL_WIDTHS.length - 1]
  );
}

async function resizeToThumbnailWebp(
  bytes: Uint8Array,
  width: number,
): Promise<Buffer> {
  const sharpModule = await import("sharp");
  const sharp = (sharpModule.default ?? sharpModule) as unknown as SharpLike;
  return sharp(Buffer.from(bytes), { failOn: "none" })
    .rotate()
    .resize({
      width,
      height: width,
      fit: "cover",
      position: "attention",
      withoutEnlargement: true,
    })
    .webp({
      quality: THUMBNAIL_WEBP_QUALITY,
      effort: 1,
    })
    .toBuffer();
}

function buildImageResponse(input: {
  bytes: Uint8Array;
  contentType: string;
  cacheControl: string;
}): NextResponse {
  const safeBytes = new Uint8Array(input.bytes.byteLength);
  safeBytes.set(input.bytes);
  const blob = new Blob([safeBytes.buffer], { type: input.contentType });

  return new NextResponse(blob, {
    status: 200,
    headers: {
      "Content-Type": input.contentType,
      "Content-Length": String(input.bytes.byteLength),
      "Cache-Control": input.cacheControl,
    },
  });
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id, index } = await context.params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid listing id" }, { status: 400 });
    }

    const numericIndex = Number(index);
    if (!Number.isInteger(numericIndex) || numericIndex < 0) {
      return NextResponse.json({ error: "Invalid photo index" }, { status: 400 });
    }

    const thumbnailWidth = parseThumbnailWidth(request);
    const cacheControl = getMediaCacheControl(request.nextUrl.searchParams.has("v"));

    const listings = await getContainerListingsCollection();
    const listing = await listings.findOne(
      { _id: new ObjectId(id) },
      { projection: { photos: 1 } },
    );

    const photo = listing?.photos?.[numericIndex];
    if (photo?.blobUrl) {
      const downloaded = await downloadBlobToBufferWithAccessFallback({
        urlOrPathname: photo.blobUrl,
      });
      if (downloaded) {
        const contentType = photo.contentType || downloaded.contentType || "application/octet-stream";
        if (thumbnailWidth) {
          const thumbnail = await resizeToThumbnailWebp(
            new Uint8Array(downloaded.buffer),
            thumbnailWidth,
          );
          return buildImageResponse({
            bytes: new Uint8Array(thumbnail),
            contentType: "image/webp",
            cacheControl,
          });
        }

        return buildImageResponse({
          bytes: new Uint8Array(downloaded.buffer),
          contentType,
          cacheControl,
        });
      }

      const redirect = NextResponse.redirect(photo.blobUrl, 307);
      redirect.headers.set(
        "Cache-Control",
        cacheControl,
      );
      return redirect;
    }

    if (!photo?.data) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    const bytes = toBytes(photo.data);
    if (!bytes || bytes.byteLength === 0) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    const contentType = photo.contentType || "application/octet-stream";
    const safeBytes = new Uint8Array(bytes.byteLength);
    safeBytes.set(bytes);
    if (thumbnailWidth) {
      const thumbnail = await resizeToThumbnailWebp(safeBytes, thumbnailWidth);
      return buildImageResponse({
        bytes: new Uint8Array(thumbnail),
        contentType: "image/webp",
        cacheControl,
      });
    }

    const blob = new Blob([safeBytes.buffer], { type: contentType });

    return new NextResponse(blob, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(safeBytes.byteLength),
        "Cache-Control": cacheControl,
      },
    });
  } catch (error) {
    logError("Unhandled API error", { route: "/api/containers/[id]/photos/[index]", error });
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown container photo error",
      },
      { status: 500 },
    );
  }
}
