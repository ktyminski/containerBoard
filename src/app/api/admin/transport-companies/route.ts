import { ObjectId, type Filter } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { enforceAuthenticatedRateLimitOrResponse } from "@/lib/app-rate-limit";
import { getCurrentUserFromRequest } from "@/lib/auth-user";
import {
  ensureTransportCompaniesIndexes,
  getTransportCompaniesCollection,
  mapTransportCompanyToAdminItem,
  type TransportCompanyDocument,
} from "@/lib/transport-companies";
import { USER_ROLE } from "@/lib/user-roles";
import { logError } from "@/lib/server-logger";

export const runtime = "nodejs";

async function requireAdmin(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user || user.role !== USER_ROLE.ADMIN) {
    return null;
  }
  return user;
}

const locationSchema = z.object({
  label: z.string().trim().min(2).max(250),
  city: z.string().trim().max(120).optional(),
  country: z.string().trim().max(120).optional(),
  countryCode: z.string().trim().length(2).optional(),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

const transportCompanyPayloadSchema = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(600).default(""),
  services: z.object({
    transport: z.boolean().default(true),
    unloading: z.boolean().default(false),
  }),
  terms: z.string().trim().max(800).default(""),
  transportPrice: z.string().trim().max(240).default(""),
  location: locationSchema,
  phone: z.string().trim().max(80).default(""),
  email: z.string().trim().email().max(180),
  isActive: z.boolean().default(true),
});

const updateTransportCompanyPayloadSchema = transportCompanyPayloadSchema.extend({
  id: z.string().trim().regex(/^[a-f0-9]{24}$/i),
});

const deleteTransportCompanySchema = z.object({
  id: z.string().trim().regex(/^[a-f0-9]{24}$/i),
});

const querySchema = z.object({
  q: z.string().trim().max(120).optional(),
  active: z.enum(["all", "active", "inactive"]).default("all"),
});

function escapeRegexPattern(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeLocation(
  location: z.infer<typeof locationSchema>,
): TransportCompanyDocument["location"] {
  return {
    label: location.label,
    ...(location.city ? { city: location.city } : {}),
    ...(location.country ? { country: location.country } : {}),
    ...(location.countryCode ? { countryCode: location.countryCode.toUpperCase() } : {}),
    lat: location.lat,
    lng: location.lng,
  };
}

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin?._id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rateLimitResponse = await enforceAuthenticatedRateLimitOrResponse({
      request,
      scope: "admin:transport-companies:read",
      userId: admin._id.toHexString(),
      ipLimit: 240,
      userLimit: 120,
    });
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    await ensureTransportCompaniesIndexes();
    const parsedQuery = querySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );
    if (!parsedQuery.success) {
      return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
    }

    const filters: Filter<TransportCompanyDocument>[] = [];
    if (parsedQuery.data.q) {
      const pattern = new RegExp(escapeRegexPattern(parsedQuery.data.q), "i");
      filters.push({
        $or: [
          { name: pattern },
          { description: pattern },
          { "location.label": pattern },
          { "location.city": pattern },
        ],
      });
    }
    if (parsedQuery.data.active === "active") {
      filters.push({ isActive: true });
    } else if (parsedQuery.data.active === "inactive") {
      filters.push({ isActive: { $ne: true } });
    }

    const collection = await getTransportCompaniesCollection();
    const rows = await collection
      .find(filters.length > 0 ? { $and: filters } : {})
      .sort({ updatedAt: -1, name: 1 })
      .limit(200)
      .toArray();

    return NextResponse.json({ items: rows.map(mapTransportCompanyToAdminItem) });
  } catch (error) {
    logError("Unhandled API error", { route: "/api/admin/transport-companies", error });
    return NextResponse.json({ error: "Unknown transport companies error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin?._id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rateLimitResponse = await enforceAuthenticatedRateLimitOrResponse({
      request,
      scope: "admin:transport-companies:write",
      userId: admin._id.toHexString(),
      ipLimit: 120,
      userLimit: 80,
    });
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const parsed = transportCompanyPayloadSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    await ensureTransportCompaniesIndexes();
    const collection = await getTransportCompaniesCollection();
    const now = new Date();
    const document: TransportCompanyDocument = {
      _id: new ObjectId(),
      name: parsed.data.name,
      description: parsed.data.description,
      services: parsed.data.services,
      terms: parsed.data.terms,
      transportPrice: parsed.data.transportPrice,
      location: normalizeLocation(parsed.data.location),
      phone: parsed.data.phone,
      email: parsed.data.email,
      isActive: parsed.data.isActive,
      detailsViewCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    await collection.insertOne(document);
    return NextResponse.json({ item: mapTransportCompanyToAdminItem(document) }, { status: 201 });
  } catch (error) {
    logError("Unhandled API error", {
      route: "/api/admin/transport-companies",
      method: "POST",
      error,
    });
    return NextResponse.json({ error: "Unknown transport company create error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin?._id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rateLimitResponse = await enforceAuthenticatedRateLimitOrResponse({
      request,
      scope: "admin:transport-companies:write",
      userId: admin._id.toHexString(),
      ipLimit: 120,
      userLimit: 80,
    });
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const parsed = updateTransportCompanyPayloadSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    await ensureTransportCompaniesIndexes();
    const collection = await getTransportCompaniesCollection();
    const id = new ObjectId(parsed.data.id);
    const update = {
      name: parsed.data.name,
      description: parsed.data.description,
      services: parsed.data.services,
      terms: parsed.data.terms,
      transportPrice: parsed.data.transportPrice,
      location: normalizeLocation(parsed.data.location),
      phone: parsed.data.phone,
      email: parsed.data.email,
      isActive: parsed.data.isActive,
      updatedAt: new Date(),
    };
    const result = await collection.findOneAndUpdate(
      { _id: id },
      { $set: update },
      { returnDocument: "after" },
    );

    if (!result) {
      return NextResponse.json({ error: "Transport company not found" }, { status: 404 });
    }

    return NextResponse.json({ item: mapTransportCompanyToAdminItem(result) });
  } catch (error) {
    logError("Unhandled API error", {
      route: "/api/admin/transport-companies",
      method: "PATCH",
      error,
    });
    return NextResponse.json({ error: "Unknown transport company update error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin?._id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rateLimitResponse = await enforceAuthenticatedRateLimitOrResponse({
      request,
      scope: "admin:transport-companies:write",
      userId: admin._id.toHexString(),
      ipLimit: 120,
      userLimit: 80,
    });
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const parsed = deleteTransportCompanySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    await ensureTransportCompaniesIndexes();
    const collection = await getTransportCompaniesCollection();
    const result = await collection.deleteOne({ _id: new ObjectId(parsed.data.id) });
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Transport company not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    logError("Unhandled API error", {
      route: "/api/admin/transport-companies",
      method: "DELETE",
      error,
    });
    return NextResponse.json({ error: "Unknown transport company delete error" }, { status: 500 });
  }
}
