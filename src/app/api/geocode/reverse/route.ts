import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  buildGeocodeAddressParts,
  buildShortAddressLabel,
  type NominatimAddress,
} from "@/lib/geocode-address";
import { enforceRateLimitOrResponse } from "@/lib/request-rate-limit";
import { logError } from "@/lib/server-logger";

export const runtime = "nodejs";

const querySchema = z.object({
  lat: z.coerce.number().finite().min(-90).max(90),
  lng: z.coerce.number().finite().min(-180).max(180),
  lang: z.string().trim().min(2).max(5).optional(),
});

type NominatimReverseResult = {
  display_name?: string;
  address?: NominatimAddress;
};

export async function GET(request: NextRequest) {
  const rateLimitResponse = await enforceRateLimitOrResponse({
    request,
    scope: "geocode:reverse:ip",
    limit: 120,
    windowMs: 60_000,
  });
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const parsed = querySchema.safeParse({
    lat: request.nextUrl.searchParams.get("lat"),
    lng: request.nextUrl.searchParams.get("lng"),
    lang: request.nextUrl.searchParams.get("lang") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid query parameters",
        issues: parsed.error.issues.map((issue) => issue.message),
      },
      { status: 400 },
    );
  }

  const { lat, lng, lang } = parsed.data;

  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lng));
    url.searchParams.set("zoom", "18");
    url.searchParams.set("addressdetails", "1");

    const response = await fetch(url, {
      headers: {
        "Accept-Language": lang ?? "pl",
        "User-Agent": "ContainerBoard/1.0 (contact: support@containerboard.local)",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Reverse geocoding failed" }, { status: 502 });
    }

    const row = (await response.json()) as NominatimReverseResult;
    const label = row.display_name?.trim();
    if (!label) {
      return NextResponse.json({ item: null });
    }

    return NextResponse.json({
      item: {
        label,
        shortLabel: buildShortAddressLabel({
          address: row.address,
          fallbackLabel: label,
        }),
        addressParts: buildGeocodeAddressParts(row.address) ?? null,
      },
    });
  } catch (error) {
    logError("Unhandled API error", { route: "/api/geocode/reverse", error });
    return NextResponse.json({ error: "Reverse geocoding failed" }, { status: 502 });
  }
}
