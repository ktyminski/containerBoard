import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { searchGeocode } from "@/lib/geocode-search";
import { enforceRateLimitOrResponse } from "@/lib/request-rate-limit";
import { logError } from "@/lib/server-logger";

export const runtime = "nodejs";

const querySchema = z.object({
  q: z.string().trim().min(3).max(250),
  lang: z.string().trim().min(2).max(5).optional(),
  limit: z.coerce.number().int().min(1).max(10).optional().default(1),
});

export async function GET(request: NextRequest) {
  const rateLimitResponse = await enforceRateLimitOrResponse({
    request,
    scope: "geocode:search:ip",
    limit: 90,
    windowMs: 60_000,
  });
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const parsed = querySchema.safeParse({
    q: request.nextUrl.searchParams.get("q"),
    lang: request.nextUrl.searchParams.get("lang") ?? undefined,
    limit: request.nextUrl.searchParams.get("limit") ?? undefined,
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

  const { q, lang, limit } = parsed.data;

  try {
    const items = await searchGeocode({
      query: q,
      lang,
      limit,
    });
    const firstItem = items[0] ?? null;

    return NextResponse.json({
      item: firstItem,
      items,
    });
  } catch (error) {
    logError("Unhandled API error", { route: "/api/geocode", error });
    return NextResponse.json({ error: "Geocoding failed" }, { status: 502 });
  }
}
