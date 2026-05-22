import { ImageResponse } from "next/og";
import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import {
  expireContainerListingsIfNeeded,
  getContainerListingsCollection,
  mapContainerListingToItem,
} from "@/lib/container-listings";
import {
  getContainerListingOgOverlay,
  getContainerListingSeoHeading,
} from "@/lib/container-listing-seo";
import { LISTING_STATUS } from "@/lib/container-listing-types";
import { resolveLocale } from "@/lib/i18n";
import { getAbsoluteUrl } from "@/lib/seo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const IMAGE_WIDTH = 1200;
const IMAGE_HEIGHT = 630;

function getAbsolutePhotoUrl(src: string | undefined): string | null {
  const value = src?.trim();
  if (!value) {
    return null;
  }
  if (/^https?:\/\//i.test(value)) {
    return value;
  }
  if (value.startsWith("/")) {
    return getAbsoluteUrl(value);
  }
  return null;
}

function getFallbackResponse(status = 404) {
  return NextResponse.json(
    { error: "OG image not available" },
    {
      status,
      headers: {
        "Cache-Control": "public, max-age=60",
      },
    },
  );
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  if (!ObjectId.isValid(id)) {
    return getFallbackResponse(400);
  }

  await expireContainerListingsIfNeeded();

  const listings = await getContainerListingsCollection();
  const listing = await listings.findOne({ _id: new ObjectId(id) });
  if (!listing?._id || listing.status === LISTING_STATUS.CLOSED) {
    return getFallbackResponse();
  }

  const item = mapContainerListingToItem(listing);
  const locale = resolveLocale(request.nextUrl.searchParams.get("lang"));
  const overlay = getContainerListingOgOverlay(item, locale);
  const heading = getContainerListingSeoHeading(item, locale);
  const photoUrl = getAbsolutePhotoUrl(item.photoUrls?.[0]);
  const priceLabel = overlay.priceLabel ?? (locale === "pl" ? "Cena na zapytanie" : "Price on request");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "#172033",
          overflow: "hidden",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt=""
            width={IMAGE_WIDTH}
            height={IMAGE_HEIGHT}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, #111827 0%, #334155 100%)",
              color: "#dbeafe",
              fontSize: 120,
              fontWeight: 800,
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
              "linear-gradient(180deg, rgba(2,6,23,0.10) 0%, rgba(2,6,23,0.25) 42%, rgba(2,6,23,0.88) 100%)",
          }}
        />

        <div
          style={{
            position: "absolute",
            left: 54,
            right: 54,
            bottom: 44,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 32,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              minWidth: 0,
              maxWidth: 760,
              color: "#fff",
            }}
          >
            <div
              style={{
                display: "flex",
                borderRadius: 14,
                background: "rgba(14, 165, 233, 0.92)",
                color: "#f8fafc",
                padding: "10px 18px",
                fontSize: 32,
                fontWeight: 800,
                lineHeight: 1,
              }}
            >
              {overlay.containerLabel}
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 18,
                fontSize: 54,
                fontWeight: 900,
                lineHeight: 1.05,
                letterSpacing: 0,
              }}
            >
              {heading}
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 14,
                fontSize: 26,
                fontWeight: 700,
                color: "#dbeafe",
              }}
            >
              {item.companyName}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              flexShrink: 0,
              color: "#fff",
            }}
          >
            <div
              style={{
                display: "flex",
                borderRadius: 18,
                background: "rgba(255, 255, 255, 0.94)",
                color: "#082f49",
                padding: "16px 22px",
                fontSize: 44,
                fontWeight: 900,
                lineHeight: 1,
              }}
            >
              {priceLabel}
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 18,
                fontSize: 25,
                fontWeight: 800,
                color: "#f8fafc",
              }}
            >
              ContainerBoard
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: IMAGE_WIDTH,
      height: IMAGE_HEIGHT,
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
      },
    },
  );
}
