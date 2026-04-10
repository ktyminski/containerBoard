import { NextRequest, NextResponse } from "next/server";
import { ObjectId, type Filter } from "mongodb";
import { z } from "zod";
import { getCurrentUserFromRequest } from "@/lib/auth-user";
import {
  buildContainerListingsFilter,
  ensureContainerListingsIndexes,
  expireContainerListingsIfNeeded,
  getContainerListingsCollection,
  getDefaultListingExpiration,
  mapContainerListingToItem,
  type ContainerListingDocument,
} from "@/lib/container-listings";
import {
  CONTAINER_TYPES,
  DEAL_TYPES,
  LISTING_STATUSES,
  LISTING_TYPES,
  LISTING_STATUS,
  type ListingStatus,
} from "@/lib/container-listing-types";
import { enforceRateLimitOrResponse } from "@/lib/request-rate-limit";
import { logError } from "@/lib/server-logger";

export const runtime = "nodejs";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().min(1).max(120).optional(),
  type: z.enum(LISTING_TYPES).optional(),
  containerType: z.enum(CONTAINER_TYPES).optional(),
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
});

const createSchema = z.object({
  type: z.enum(LISTING_TYPES),
  containerType: z.enum(CONTAINER_TYPES),
  quantity: z.coerce.number().int().min(1).max(100_000),
  locationCity: z.string().trim().min(2).max(120),
  locationCountry: z.string().trim().min(2).max(120),
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
      containerType,
      dealType,
      city,
      country,
      status,
      mine,
      sortBy,
      sortDir,
    } = parsed.data;

    const user = mine ? await getCurrentUserFromRequest(request) : null;
    if (mine && !user?._id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const includeOnlyPublic = !mine;
    const filter = buildContainerListingsFilter({
      q,
      type,
      containerType,
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
    const listings = await getContainerListingsCollection();
    const insertResult = await listings.insertOne({
      _id: new ObjectId(),
      type: listing.type,
      containerType: listing.containerType,
      quantity: listing.quantity,
      locationCity: listing.locationCity.trim(),
      locationCountry: listing.locationCountry.trim(),
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

