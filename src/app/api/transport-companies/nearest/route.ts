import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { enforceRateLimitOrResponse } from "@/lib/request-rate-limit";
import { searchGeocode } from "@/lib/geocode-search";
import {
  ensureTransportCompaniesIndexes,
  getTransportCompaniesCollection,
  mapTransportCompanyToPublicItem,
} from "@/lib/transport-companies";
import { logError } from "@/lib/server-logger";

export const runtime = "nodejs";

const coordinateSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  label: z.string().trim().max(250).optional(),
});

const nearestRequestSchema = z.object({
  pickup: coordinateSchema.optional(),
  pickupQuery: z.string().trim().min(3).max(250).optional(),
  delivery: coordinateSchema.optional(),
  deliveryQuery: z.string().trim().min(3).max(250).optional(),
  locale: z.string().trim().min(2).max(5).optional(),
});

async function resolvePoint(input: {
  point?: z.infer<typeof coordinateSchema>;
  query?: string;
  locale?: string;
}): Promise<{ lat: number; lng: number; label?: string } | null> {
  if (input.point) {
    return input.point;
  }
  if (!input.query) {
    return null;
  }

  const [result] = await searchGeocode({
    query: input.query,
    lang: input.locale,
    limit: 1,
  });
  if (!result) {
    return null;
  }

  return {
    lat: result.lat,
    lng: result.lng,
    label: result.shortLabel || result.label,
  };
}

export async function POST(request: NextRequest) {
  const rateLimitResponse = await enforceRateLimitOrResponse({
    request,
    scope: "transport-companies:nearest:ip",
    limit: 60,
    windowMs: 60_000,
  });
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const parsed = nearestRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const [pickup, delivery] = await Promise.all([
      resolvePoint({
        point: parsed.data.pickup,
        query: parsed.data.pickupQuery,
        locale: parsed.data.locale,
      }),
      resolvePoint({
        point: parsed.data.delivery,
        query: parsed.data.deliveryQuery,
        locale: parsed.data.locale,
      }),
    ]);

    if (!pickup || !delivery) {
      return NextResponse.json(
        { error: "Pickup and delivery locations are required" },
        { status: 400 },
      );
    }

    await ensureTransportCompaniesIndexes();
    const collection = await getTransportCompaniesCollection();
    const companies = await collection
      .find({
        isActive: true,
        $or: [
          { "services.transport": true },
          { "services.unloading": true },
        ],
      })
      .limit(500)
      .toArray();

    const items = companies
      .map((company) =>
        mapTransportCompanyToPublicItem(company, {
          pickup,
          delivery,
        }),
      )
      .sort((left, right) => {
        const leftDistance = left.totalRouteDistanceKm ?? Number.POSITIVE_INFINITY;
        const rightDistance = right.totalRouteDistanceKm ?? Number.POSITIVE_INFINITY;
        return leftDistance - rightDistance;
      })
      .slice(0, 3)
      .map((item) => ({
        ...item,
        distanceKm:
          typeof item.distanceKm === "number"
            ? Math.round(item.distanceKm * 10) / 10
            : null,
        pickupDistanceKm:
          typeof item.pickupDistanceKm === "number"
            ? Math.round(item.pickupDistanceKm * 10) / 10
            : null,
        deliveryDistanceKm:
          typeof item.deliveryDistanceKm === "number"
            ? Math.round(item.deliveryDistanceKm * 10) / 10
            : null,
        totalRouteDistanceKm:
          typeof item.totalRouteDistanceKm === "number"
            ? Math.round(item.totalRouteDistanceKm * 10) / 10
            : null,
      }));

    return NextResponse.json({
      items,
      pickup,
      delivery,
    });
  } catch (error) {
    logError("Unhandled API error", {
      route: "/api/transport-companies/nearest",
      error,
    });
    return NextResponse.json({ error: "Transport company search failed" }, { status: 500 });
  }
}
