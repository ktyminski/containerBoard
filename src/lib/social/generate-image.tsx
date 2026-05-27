import { ImageResponse } from "next/og";
import {
  buildBlobPath,
  downloadBlobToBufferWithAccessFallback,
  uploadBlobFromBuffer,
} from "@/lib/blob-storage";
import {
  mapContainerListingToItem,
  type ContainerListingDocument,
  type ContainerListingImageAsset,
} from "@/lib/container-listings";
import { getContainerShortLabel } from "@/lib/container-listing-types";

const IMAGE_WIDTH = 1080;
const IMAGE_HEIGHT = 1350;
const BACKGROUND_QUALITY = 76;
const OUTPUT_QUALITY = 82;

type SharpLike = typeof import("sharp");

type GeneratedSocialImage = {
  url: string;
  pathname: string;
};

async function getSharp(): Promise<SharpLike> {
  const sharpModule = await import("sharp");
  return (sharpModule.default ?? sharpModule) as unknown as SharpLike;
}

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

async function resizePhotoForSocial(bytes: Uint8Array): Promise<Uint8Array> {
  const sharp = await getSharp();
  const resized = await sharp(Buffer.from(bytes), { failOn: "none" })
    .rotate()
    .resize({
      width: IMAGE_WIDTH,
      height: IMAGE_HEIGHT,
      fit: "cover",
      position: "attention",
      withoutEnlargement: false,
    })
    .jpeg({
      quality: BACKGROUND_QUALITY,
      mozjpeg: true,
    })
    .toBuffer();

  return new Uint8Array(resized);
}

async function getPhotoDataUri(
  photo: ContainerListingImageAsset | undefined,
): Promise<string | null> {
  if (!photo) {
    return null;
  }

  let bytes: Uint8Array | null = null;
  if (photo.blobUrl) {
    const downloaded = await downloadBlobToBufferWithAccessFallback({
      urlOrPathname: photo.blobUrl,
    });
    if (downloaded) {
      bytes = new Uint8Array(downloaded.buffer);
    }
  }

  if (!bytes) {
    bytes = toBytes(photo.data);
  }

  if (!bytes || bytes.byteLength === 0) {
    return null;
  }

  const resizedBytes = await resizePhotoForSocial(bytes);
  return `data:image/jpeg;base64,${Buffer.from(resizedBytes).toString("base64")}`;
}

function getConditionLabel(condition: string): string {
  const labels: Record<string, string> = {
    new: "New",
    one_trip: "One Trip",
    cargo_worthy: "Cargo Worthy",
    wind_water_tight: "Wind & Water Tight",
    as_is: "As-is",
  };
  return labels[condition] ?? condition;
}

export async function generateSocialImageForListing(input: {
  listing: ContainerListingDocument;
  dateKey: string;
}): Promise<GeneratedSocialImage> {
  const item = mapContainerListingToItem(input.listing);
  const photoDataUri = await getPhotoDataUri(
    input.listing.photos?.find((photo) => Boolean(photo?.blobUrl || photo?.data)),
  );
  const containerLabel = getContainerShortLabel(item.container);
  const location = [item.locationCity, item.locationCountry].filter(Boolean).join(", ");
  const condition = getConditionLabel(item.container.condition);
  const transportLabel = item.logisticsTransportAvailable
    ? "Transport available"
    : item.logisticsUnloadingAvailable
      ? "Unloading available"
      : "Container listing";

  const response = new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "#111827",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        {photoDataUri ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoDataUri}
            alt=""
            width={IMAGE_WIDTH}
            height={IMAGE_HEIGHT}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, #111827 0%, #334155 100%)",
              color: "#dbeafe",
              fontSize: 94,
              fontWeight: 900,
            }}
          >
            ContainerBoard
          </div>
        )}

        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(2,6,23,0.08) 0%, rgba(2,6,23,0.34) 46%, rgba(2,6,23,0.92) 100%)",
          }}
        />

        <div
          style={{
            position: "absolute",
            top: 52,
            left: 52,
            right: 52,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              color: "#ffffff",
              fontSize: 30,
              fontWeight: 800,
            }}
          >
            <div
              style={{
                width: 46,
                height: 46,
                display: "flex",
                borderRadius: 8,
                background: "#38bdf8",
              }}
            />
            ContainerBoard.eu
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            left: 58,
            right: 58,
            bottom: 66,
            display: "flex",
            flexDirection: "column",
            color: "#ffffff",
          }}
        >
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              borderRadius: 14,
              background: "rgba(14, 165, 233, 0.94)",
              padding: "14px 22px",
              color: "#f8fafc",
              fontSize: 34,
              fontWeight: 900,
              lineHeight: 1,
            }}
          >
            {item.type === "rent" ? "For rent" : "For sale"}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 24,
              fontSize: 86,
              fontWeight: 900,
              lineHeight: 0.98,
              letterSpacing: 0,
            }}
          >
            {containerLabel}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 20,
              fontSize: 48,
              fontWeight: 800,
              color: "#e0f2fe",
            }}
          >
            {location || "Container listing"}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 28,
              gap: 14,
              flexWrap: "wrap",
            }}
          >
            {[condition, transportLabel].map((label) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  borderRadius: 12,
                  background: "rgba(15, 23, 42, 0.78)",
                  border: "1px solid rgba(226, 232, 240, 0.28)",
                  padding: "13px 18px",
                  color: "#f8fafc",
                  fontSize: 30,
                  fontWeight: 800,
                }}
              >
                {label}
              </div>
            ))}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 34,
              color: "#bae6fd",
              fontSize: 32,
              fontWeight: 800,
            }}
          >
            ContainerBoard.eu
          </div>
        </div>
      </div>
    ),
    {
      width: IMAGE_WIDTH,
      height: IMAGE_HEIGHT,
    },
  );

  const sharp = await getSharp();
  const pngBuffer = Buffer.from(await response.arrayBuffer());
  const jpegBuffer = await sharp(pngBuffer, { failOn: "none" })
    .jpeg({
      quality: OUTPUT_QUALITY,
      mozjpeg: true,
    })
    .toBuffer();
  const pathname = buildBlobPath({
    segments: ["social-post-drafts", input.dateKey, input.listing._id.toHexString()],
    filenameBase: "containerboard-social",
    contentType: "image/jpeg",
  });

  return uploadBlobFromBuffer({
    pathname,
    contentType: "image/jpeg",
    access: "public",
    buffer: jpegBuffer,
    cacheControlMaxAge: 60 * 60 * 24 * 30,
  });
}

