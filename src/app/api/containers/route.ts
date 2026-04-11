import { NextRequest, NextResponse } from "next/server";
import { ObjectId, type Filter } from "mongodb";
import { z } from "zod";
import { getCurrentUserFromRequest } from "@/lib/auth-user";
import { normalizeGeocodeAddressParts } from "@/lib/geocode-address";
import {
  buildContainerListingsFilter,
  ensureContainerListingsIndexes,
  expireContainerListingsIfNeeded,
  getContainerListingsCollection,
  getDefaultListingExpiration,
  mapContainerListingToMapPoint,
  mapContainerListingToItem,
  type ContainerListingDocument,
} from "@/lib/container-listings";
import {
  CONTAINER_CONDITIONS,
  CONTAINER_FEATURES,
  CONTAINER_HEIGHTS,
  CONTAINER_SIZES,
  CONTAINER_TYPES,
  DEAL_TYPES,
  LISTING_STATUSES,
  LISTING_TYPES,
  LISTING_STATUS,
  type ContainerSize,
  type ListingStatus,
} from "@/lib/container-listing-types";
import { enforceRateLimitOrResponse } from "@/lib/request-rate-limit";
import { logError } from "@/lib/server-logger";

export const runtime = "nodejs";
const MAX_POPUP_DETAILS_IDS = 80;
const MAX_MAP_POINTS = 50_000;

const locationAddressPartsSchema = z.object({
  street: z.string().trim().min(1).max(120).optional(),
  houseNumber: z.string().trim().min(1).max(40).optional(),
  city: z.string().trim().min(1).max(120).optional(),
  country: z.string().trim().min(1).max(120).optional(),
});

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(20),
  q: z.string().trim().min(1).max(120).optional(),
  type: z.enum(LISTING_TYPES).optional(),
  containerSize: z.enum(["10", "20", "40", "45", "53"]).transform((value) => {
    if (value === "10") {
      return 10;
    }
    if (value === "20") {
      return 20;
    }
    if (value === "40") {
      return 40;
    }
    if (value === "45") {
      return 45;
    }
    return 53;
  }).optional(),
  containerHeight: z.enum(CONTAINER_HEIGHTS).optional(),
  containerType: z.enum(CONTAINER_TYPES).optional(),
  containerFeature: z.enum(CONTAINER_FEATURES).optional(),
  containerCondition: z.enum(CONTAINER_CONDITIONS).optional(),
  locationLat: z.coerce.number().finite().min(-90).max(90).optional(),
  locationLng: z.coerce.number().finite().min(-180).max(180).optional(),
  radiusKm: z.enum(["20", "50", "100", "200"]).transform((value) => {
    if (value === "20") {
      return 20;
    }
    if (value === "50") {
      return 50;
    }
    if (value === "100") {
      return 100;
    }
    return 200;
  }).optional(),
  dealType: z.enum(DEAL_TYPES).optional(),
  city: z.string().trim().min(1).max(120).optional(),
  country: z.string().trim().min(1).max(120).optional(),
  status: z.enum(LISTING_STATUSES).optional(),
  mine: z
    .string()
    .optional()
    .transform((value) => value === "1" || value === "true"),
  sortBy: z.enum(["createdAt", "availableFrom", "expiresAt", "quantity"]).default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  view: z.enum(["list", "map"]).default("list"),
  all: z
    .string()
    .optional()
    .transform((value) => value === "1" || value === "true"),
  ids: z.string().trim().optional(),
});

const createSchema = z.object({
  type: z.enum(LISTING_TYPES),
  container: z.object({
    size: z
      .number()
      .int()
      .refine((value) => CONTAINER_SIZES.includes(value as (typeof CONTAINER_SIZES)[number])),
    height: z.enum(CONTAINER_HEIGHTS),
    type: z.enum(CONTAINER_TYPES),
    features: z.array(z.enum(CONTAINER_FEATURES)).default([]),
    condition: z.enum(CONTAINER_CONDITIONS),
  }),
  quantity: z.coerce.number().int().min(1).max(100_000),
  locationLat: z.coerce.number().finite().min(-90).max(90),
  locationLng: z.coerce.number().finite().min(-180).max(180),
  locationAddressLabel: z.string().trim().max(250).optional(),
  locationAddressParts: locationAddressPartsSchema.optional(),
  availableFrom: z.coerce.date(),
  dealType: z.enum(DEAL_TYPES),
  price: z.string().trim().max(100).optional(),
  description: z.string().trim().max(2_000).optional(),
  companyName: z.string().trim().min(2).max(160),
  contactEmail: z.email().trim().max(160),
  contactPhone: z.string().trim().max(40).optional(),
});

function normalizeOptionalString(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function isAllowedMineStatus(status?: ListingStatus): status is ListingStatus {
  return status === LISTING_STATUS.ACTIVE || status === LISTING_STATUS.EXPIRED || status === LISTING_STATUS.CLOSED;
}

export async function GET(request: NextRequest) {
  try {
    await ensureContainerListingsIndexes();
    await expireContainerListingsIfNeeded();

    const parsed = querySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid query parameters",
          issues: parsed.error.issues.map((issue) => issue.message),
        },
        { status: 400 },
      );
    }

    const {
      page,
      pageSize,
      q,
      type,
      containerSize,
      containerHeight,
      containerType,
      containerFeature,
      containerCondition,
      locationLat,
      locationLng,
      radiusKm,
      dealType,
      city,
      country,
      status,
      mine,
      sortBy,
      sortDir,
      view,
      all,
      ids,
    } = parsed.data;

    const user = mine ? await getCurrentUserFromRequest(request) : null;
    if (mine && !user?._id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const includeOnlyPublic = !mine;
    const filter = buildContainerListingsFilter({
      q,
      type,
      containerSize,
      containerHeight,
      containerType,
      containerFeature,
      containerCondition,
      locationLat,
      locationLng,
      radiusKm,
      dealType,
      city,
      country,
      status: mine && isAllowedMineStatus(status) ? status : undefined,
      ownerUserId: mine && user?._id ? new ObjectId(user._id.toHexString()) : undefined,
      includeOnlyPublic,
    });

    const sortFieldMap = {
      createdAt: "createdAt",
      availableFrom: "availableFrom",
      expiresAt: "expiresAt",
      quantity: "quantity",
    } as const;

    const sortField = sortFieldMap[sortBy];
    const sortDirection = sortDir === "asc" ? 1 : -1;
    const sort: Record<string, 1 | -1> = { [sortField]: sortDirection };
    if (sortField !== "createdAt") {
      sort.createdAt = -1;
    }

    const listings = await getContainerListingsCollection();
    const typedFilter = filter as Filter<ContainerListingDocument>;

    if (ids) {
      const requestedIds = ids
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, MAX_POPUP_DETAILS_IDS);

      if (requestedIds.length === 0) {
        return NextResponse.json({ items: [] });
      }

      const validObjectIds = requestedIds
        .filter((value) => ObjectId.isValid(value))
        .map((value) => new ObjectId(value));

      if (validObjectIds.length === 0) {
        return NextResponse.json({ items: [] });
      }

      const rows = await listings
        .find({
          ...typedFilter,
          _id: { $in: validObjectIds },
        })
        .toArray();

      const byId = new Map(rows.map((row) => [row._id.toHexString(), row]));
      const ordered = requestedIds
        .map((id) => byId.get(id))
        .filter((row): row is ContainerListingDocument => Boolean(row));

      return NextResponse.json({
        items: ordered.map(mapContainerListingToItem),
      });
    }

    if (view === "map") {
      const rows = await listings
        .find(typedFilter)
        .sort(sort)
        .limit(all ? MAX_MAP_POINTS : pageSize)
        .project({
          _id: 1,
          type: 1,
          locationLat: 1,
          locationLng: 1,
        })
        .toArray();

      return NextResponse.json({
        items: rows.map((row) =>
          mapContainerListingToMapPoint(
            row as Pick<
              ContainerListingDocument,
              "_id" | "type" | "locationLat" | "locationLng"
            >,
          ),
        ),
        meta: {
          page: 1,
          pageSize: rows.length,
          total: rows.length,
          totalPages: 1,
          truncated: all && rows.length >= MAX_MAP_POINTS,
        },
      });
    }

    const total = await listings.countDocuments(typedFilter);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(page, totalPages);
    const skip = (currentPage - 1) * pageSize;

    const rows = await listings
      .find(typedFilter)
      .sort(sort)
      .skip(skip)
      .limit(pageSize)
      .toArray();

    return NextResponse.json({
      items: rows.map(mapContainerListingToItem),
      meta: {
        page: currentPage,
        pageSize,
        total,
        totalPages,
      },
    });
  } catch (error) {
    logError("Unhandled API error", { route: "/api/containers", error });
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown containers error",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureContainerListingsIndexes();

    const ipRateLimitResponse = await enforceRateLimitOrResponse({
      request,
      scope: "containers:create:ip",
      limit: 50,
      windowMs: 60_000,
    });
    if (ipRateLimitResponse) {
      return ipRateLimitResponse;
    }

    const user = await getCurrentUserFromRequest(request);
    if (!user?._id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.isBlocked === true) {
      return NextResponse.json(
        { error: "Blocked user cannot create listings" },
        { status: 403 },
      );
    }

    const userRateLimitResponse = await enforceRateLimitOrResponse({
      request,
      scope: "containers:create:user",
      limit: 10,
      windowMs: 60_000,
      identity: user._id.toHexString(),
    });
    if (userRateLimitResponse) {
      return userRateLimitResponse;
    }

    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          issues: parsed.error.issues.map((issue) => issue.message),
        },
        { status: 400 },
      );
    }

    const now = new Date();
    const listing = parsed.data;
    const locationAddressLabel = normalizeOptionalString(listing.locationAddressLabel);
    const locationAddressParts = normalizeGeocodeAddressParts(listing.locationAddressParts);
    const locationCity = locationAddressParts?.city ?? "";
    const locationCountry = locationAddressParts?.country ?? "";
    const listings = await getContainerListingsCollection();
    const insertResult = await listings.insertOne({
      _id: new ObjectId(),
      type: listing.type,
      container: {
        size: listing.container.size as ContainerSize,
        height: listing.container.height,
        type: listing.container.type,
        features: Array.from(new Set(listing.container.features)),
        condition: listing.container.condition,
      },
      quantity: listing.quantity,
      locationCity,
      locationCountry,
      locationLat: listing.locationLat,
      locationLng: listing.locationLng,
      ...(locationAddressLabel ? { locationAddressLabel } : {}),
      ...(locationAddressParts ? { locationAddressParts } : {}),
      availableFrom: listing.availableFrom,
      dealType: listing.dealType,
      price: normalizeOptionalString(listing.price),
      description: normalizeOptionalString(listing.description),
      companyName: listing.companyName.trim(),
      contactEmail: listing.contactEmail.trim(),
      contactPhone: normalizeOptionalString(listing.contactPhone),
      status: LISTING_STATUS.ACTIVE,
      createdByUserId: user._id,
      createdAt: now,
      updatedAt: now,
      expiresAt: getDefaultListingExpiration(now),
    });

    return NextResponse.json(
      {
        id: insertResult.insertedId.toHexString(),
      },
      { status: 201 },
    );
  } catch (error) {
    logError("Unhandled API error", { route: "/api/containers", error });
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown create container error",
      },
      { status: 500 },
    );
  }
}

