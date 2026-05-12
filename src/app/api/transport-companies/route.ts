import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { enforceRateLimitOrResponse } from "@/lib/request-rate-limit";
import { searchGeocode } from "@/lib/geocode-search";
import { getPublicTransportCompanies } from "@/lib/transport-companies-public";
import { logError } from "@/lib/server-logger";

export const runtime = "nodejs";

const searchSchema = z.object({
  location: z.string().trim().min(2).max(250).optional(),
  locale: z.string().trim().min(2).max(5).optional(),
});

export async function GET(request: NextRequest) {
  const rateLimitResponse = await enforceRateLimitOrResponse({
    request,
    scope: "transport-companies:public-list:ip",
    limit: 120,
    windowMs: 60_000,
  });
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const parsed = searchSchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
    }

    let location: { lat: number; lng: number; label: string } | null = null;
    if (parsed.data.location) {
      const [result] = await searchGeocode({
        query: parsed.data.location,
        lang: parsed.data.locale,
        limit: 1,
      });
      if (!result) {
        return NextResponse.json(
          { error: "LOCATION_NOT_FOUND" },
          { status: 404 },
        );
      }
      location = {
        lat: result.lat,
        lng: result.lng,
        label: result.shortLabel || result.label,
      };
    }

    return NextResponse.json({
      items: await getPublicTransportCompanies({ location }),
      location,
    });
  } catch (error) {
    logError("Unhandled API error", {
      route: "/api/transport-companies",
      error,
    });
    return NextResponse.json(
      { error: "Transport companies search failed" },
      { status: 500 },
    );
  }
}
