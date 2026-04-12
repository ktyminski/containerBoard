import { NextRequest, NextResponse } from "next/server";
import { ObjectId, type Filter } from "mongodb";
import sanitizeHtml from "sanitize-html";
import { z } from "zod";
import { SESSION_COOKIE_NAME } from "@/lib/auth-session";
import { getCurrentUserFromRequest } from "@/lib/auth-user";
import { normalizeGeocodeAddressParts } from "@/lib/geocode-address";
import {
  MAX_LISTING_LOCATIONS,
  normalizeListingLocations,
} from "@/lib/listing-locations";
import {
  buildContainerListingsFilter,
  ensureContainerListingsIndexes,
  expireContainerListingsIfNeeded,
  getContainerListingFavoritesCollection,
  getContainerListingsCollection,
  getDefaultListingExpiration,
  mapContainerListingToMapPoints,
  mapContainerListingToItem,
  type ContainerListingDocument,
  type ContainerListingItem,
} from "@/lib/container-listings";
import {
  CONTAINER_CONDITIONS,
  CONTAINER_FEATURES,
  CONTAINER_HEIGHTS,
  CONTAINER_SIZES,
  CONTAINER_TYPES,
  LISTING_STATUSES,
  LISTING_TYPES,
  LISTING_STATUS,
  PRICE_CURRENCIES,
  PRICE_TAX_MODES,
  PRICE_TYPES,
  PRICE_UNITS,
  type Currency,
  type ContainerSize,
  type ListingStatus,
} from "@/lib/container-listing-types";
import {
  buildLegacyListingPrice,
  normalizeListingPrice,
  type ListingPriceInput,
} from "@/lib/listing-price";
import { getRichTextLength, hasRichTextContent } from "@/lib/listing-rich-text";
import { enforceRateLimitOrResponse } from "@/lib/request-rate-limit";
import { logError } from "@/lib/server-logger";

export const runtime = "nodejs";
const MAX_POPUP_DETAILS_IDS = 80;
const MAX_MAP_POINTS = 50_000;
const MAX_LOCAL_FAVORITE_IDS = 2_000;
const DESCRIPTION_MAX_TEXT_LENGTH = 1000;
const DESCRIPTION_ALLOWED_TAGS = ["p", "br", "strong", "em", "u", "ul", "ol", "li", "div"];

const locationAddressPartsSchema = z.object({
  street: z.string().trim().min(1).max(120).optional(),
  houseNumber: z.string().trim().min(1).max(40).optional(),
  city: z.string().trim().min(1).max(120).optional(),
  country: z.string().trim().min(1).max(120).optional(),
});

const listingLocationSchema = z.object({
  locationLat: z.coerce.number().finite().min(-90).max(90),
  locationLng: z.coerce.number().finite().min(-180).max(180),
  locationCity: z.string().trim().max(120).optional(),
  locationCountry: z.string().trim().max(120).optional(),
  locationAddressLabel: z.string().trim().max(250).optional(),
  locationAddressParts: locationAddressPartsSchema.optional(),
  isPrimary: z.coerce.boolean().optional(),
});

const pricingOriginalSchema = z.object({
  amount: z.coerce.number().finite().nonnegative().max(100_000_000).nullable(),
  currency: z.enum(PRICE_CURRENCIES).nullable(),
  unit: z.enum(PRICE_UNITS).nullable(),
  taxMode: z.enum(PRICE_TAX_MODES).nullable(),
  vatRate: z.coerce.number().finite().min(0).max(100).nullable(),
  negotiable: z.coerce.boolean(),
});

const pricingPayloadSchema = z
  .object({
    type: z.enum(PRICE_TYPES),
    original: pricingOriginalSchema,
  })
  .superRefine((value, context) => {
    if (value.type === "request") {
      return;
    }

    if (value.original.amount === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["original", "amount"],
        message: "Amount is required for fixed/starting_from price type",
      });
    }
    if (value.original.currency === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["original", "currency"],
        message: "Currency is required for fixed/starting_from price type",
      });
    }
    if (value.original.unit === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["original", "unit"],
        message: "Unit is required for fixed/starting_from price type",
      });
    }
    if (value.original.taxMode === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["original", "taxMode"],
        message: "Tax mode is required for fixed/starting_from price type",
      });
    }
  });

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(20),
  q: z.string().trim().min(1).max(120).optional(),
  type: z.enum(LISTING_TYPES).optional(),
  containerSize: z.string().trim().max(120).optional(),
  containerHeight: z.string().trim().max(160).optional(),
  containerType: z.string().trim().max(240).optional(),
  containerFeature: z.string().trim().max(320).optional(),
  containerCondition: z.string().trim().max(240).optional(),
  priceMin: z.string().trim().max(32).optional(),
  priceMax: z.string().trim().max(32).optional(),
  priceCurrency: z.enum(PRICE_CURRENCIES).optional(),
  priceUnit: z.enum(PRICE_UNITS).optional(),
  priceType: z.enum(PRICE_TYPES).optional(),
  priceTaxMode: z.enum(PRICE_TAX_MODES).optional(),
  productionYear: z.string().trim().max(8).optional(),
  priceNegotiable: z.string().trim().max(8).optional(),
  logisticsTransport: z.string().trim().max(8).optional(),
  logisticsUnloading: z.string().trim().max(8).optional(),
  hasCscPlate: z.string().trim().max(8).optional(),
  hasCscCertification: z.string().trim().max(8).optional(),
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
  city: z.string().trim().min(1).max(120).optional(),
  country: z.string().trim().min(1).max(120).optional(),
  status: z.enum(LISTING_STATUSES).optional(),
  mine: z
    .string()
    .optional()
    .transform((value) => value === "1" || value === "true"),
  sortBy: z.enum(["createdAt", "availableFrom", "expiresAt", "quantity", "priceNet"]).default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  view: z.enum(["list", "map"]).default("list"),
  all: z
    .string()
    .optional()
    .transform((value) => value === "1" || value === "true"),
  ids: z.string().trim().optional(),
  favorites: z
    .string()
    .optional()
    .transform((value) => value === "1" || value === "true"),
  localFavoriteIds: z.string().trim().max(80_000).optional(),
});

function parseEnumList<T extends string>(value: string | undefined, allowed: readonly T[]): T[] {
  if (!value) {
    return [];
  }

  const allowedSet = new Set(allowed);
  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter((item): item is T => allowedSet.has(item as T)),
    ),
  );
}

function parseContainerSizeList(value: string | undefined): ContainerSize[] {
  const values = parseEnumList(value, ["10", "20", "40", "45", "53"] as const);

  return values.map((item) => {
    if (item === "10") {
      return 10;
    }
    if (item === "20") {
      return 20;
    }
    if (item === "40") {
      return 40;
    }
    if (item === "45") {
      return 45;
    }
    return 53;
  });
}

function parseOptionalNumber(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.replace(",", ".").trim();
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return parsed;
}

function parseOptionalYear(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value.trim());
  if (!Number.isInteger(parsed) || parsed < 1900 || parsed > 2100) {
    return undefined;
  }

  return parsed;
}

function parseObjectIdList(value: string | undefined, limit: number): ObjectId[] {
  if (!value) {
    return [];
  }

  const unique = new Set<string>();
  const output: ObjectId[] = [];
  for (const item of value.split(",")) {
    const normalized = item.trim();
    if (!normalized || unique.has(normalized) || !ObjectId.isValid(normalized)) {
      continue;
    }
    unique.add(normalized);
    output.push(new ObjectId(normalized));
    if (output.length >= limit) {
      break;
    }
  }

  return output;
}

function parseBooleanFlag(value: string | undefined): boolean | undefined {
  if (!value) {
    return undefined;
  }

  if (value === "1" || value.toLowerCase() === "true") {
    return true;
  }
  if (value === "0" || value.toLowerCase() === "false") {
    return false;
  }

  return undefined;
}

function getPriceNetFieldForCurrency(currency: Currency): string {
  if (currency === "EUR") {
    return "pricing.normalized.net.amountEur";
  }
  if (currency === "USD") {
    return "pricing.normalized.net.amountUsd";
  }
  return "pricing.normalized.net.amountPln";
}

function getPriceSortValueExpression(sortPriceField: string): Record<string, unknown> {
  return {
    $cond: [
      { $eq: ["$pricing.type", "request"] },
      0,
      { $ifNull: [`$${sortPriceField}`, 0] },
    ],
  };
}

async function getUserFavoriteListingIdSet(
  userId: ObjectId,
  listingIds: ObjectId[],
): Promise<Set<string>> {
  if (listingIds.length === 0) {
    return new Set<string>();
  }

  const favorites = await getContainerListingFavoritesCollection();
  const rows = await favorites
    .find(
      {
        userId,
        listingId: { $in: listingIds },
      },
      {
        projection: {
          listingId: 1,
        },
      },
    )
    .toArray();

  return new Set(rows.map((row) => row.listingId.toHexString()));
}

function mapItemsWithFavoriteFlag(
  rows: ContainerListingDocument[],
  favoriteIdSet: Set<string>,
): ContainerListingItem[] {
  return rows.map((row) => ({
    ...mapContainerListingToItem(row),
    isFavorite: favoriteIdSet.has(row._id.toHexString()),
  }));
}

const createSchema = z.object({
  type: z.enum(LISTING_TYPES),
  title: z.string().trim().max(80).optional(),
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
  locationLat: z.coerce.number().finite().min(-90).max(90).optional(),
  locationLng: z.coerce.number().finite().min(-180).max(180).optional(),
  locationAddressLabel: z.string().trim().max(250).optional(),
  locationAddressParts: locationAddressPartsSchema.optional(),
  locations: z.array(listingLocationSchema).min(1).max(MAX_LISTING_LOCATIONS).optional(),
  availableNow: z.coerce.boolean().optional(),
  availableFromApproximate: z.coerce.boolean().optional(),
  availableFrom: z.coerce.date().optional(),
  pricing: pricingPayloadSchema.optional(),
  priceAmount: z.coerce.number().finite().nonnegative().max(100_000_000).optional(),
  priceNegotiable: z.coerce.boolean().optional(),
  logisticsTransportAvailable: z.coerce.boolean().optional(),
  logisticsTransportIncluded: z.coerce.boolean().optional(),
  logisticsTransportFreeDistanceKm: z.coerce.number().int().min(1).max(10_000).optional(),
  logisticsUnloadingAvailable: z.coerce.boolean().optional(),
  logisticsUnloadingIncluded: z.coerce.boolean().optional(),
  logisticsComment: z.string().trim().max(600).optional(),
  hasCscPlate: z.coerce.boolean().optional(),
  hasCscCertification: z.coerce.boolean().optional(),
  productionYear: z.coerce.number().int().min(1900).max(2100).optional(),
  price: z.string().trim().max(100).optional(),
  description: z.string().trim().max(16_000).optional(),
  companyName: z.string().trim().min(2).max(160),
  contactEmail: z.email().trim().max(160),
  contactPhone: z.string().trim().max(40).optional(),
}).superRefine((value, context) => {
  const hasLegacyLocation =
    typeof value.locationLat === "number" &&
    Number.isFinite(value.locationLat) &&
    typeof value.locationLng === "number" &&
    Number.isFinite(value.locationLng);
  const hasLocations = Array.isArray(value.locations) && value.locations.length > 0;

  if (!hasLegacyLocation && !hasLocations) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["locations"],
      message: "At least one location is required",
    });
  }

  if (value.availableNow !== true && !value.availableFrom) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["availableFrom"],
      message: "availableFrom is required when availableNow is false",
    });
  }

  if (
    value.logisticsTransportIncluded === true &&
    typeof value.logisticsTransportFreeDistanceKm !== "number"
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["logisticsTransportFreeDistanceKm"],
      message: "logisticsTransportFreeDistanceKm is required when transport is included",
    });
  }
});

function normalizeOptionalString(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeOptionalDescriptionHtml(value?: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || !hasRichTextContent(trimmed)) {
    return undefined;
  }

  const sanitized = sanitizeHtml(trimmed, {
    allowedTags: DESCRIPTION_ALLOWED_TAGS,
    allowedAttributes: {},
  }).trim();

  if (!sanitized || !hasRichTextContent(sanitized)) {
    return undefined;
  }

  return sanitized;
}

function resolveAvailableFromDate(input: {
  availableNow?: boolean;
  availableFrom?: Date;
  now: Date;
}): Date {
  if (input.availableNow === true) {
    return input.now;
  }

  if (input.availableFrom instanceof Date && Number.isFinite(input.availableFrom.getTime())) {
    return input.availableFrom;
  }

  return input.now;
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
      priceMin,
      priceMax,
      priceCurrency,
      priceUnit,
      priceType,
      priceTaxMode,
      productionYear,
      priceNegotiable,
      logisticsTransport,
      logisticsUnloading,
      hasCscPlate,
      hasCscCertification,
      locationLat,
      locationLng,
      radiusKm,
      city,
      country,
      status,
      mine,
      sortBy,
      sortDir,
      view,
      all,
      ids,
      favorites,
      localFavoriteIds,
    } = parsed.data;

    const containerSizes = parseContainerSizeList(containerSize);
    const containerHeights = parseEnumList(containerHeight, CONTAINER_HEIGHTS);
    const containerTypes = parseEnumList(containerType, CONTAINER_TYPES);
    const containerFeatures = parseEnumList(containerFeature, CONTAINER_FEATURES);
    const containerConditions = parseEnumList(containerCondition, CONTAINER_CONDITIONS);
    const parsedPriceMin = parseOptionalNumber(priceMin);
    const parsedPriceMax = parseOptionalNumber(priceMax);
    const parsedProductionYear = parseOptionalYear(productionYear);
    const parsedPriceNegotiable = parseBooleanFlag(priceNegotiable);
    const parsedLogisticsTransport = parseBooleanFlag(logisticsTransport);
    const parsedLogisticsUnloading = parseBooleanFlag(logisticsUnloading);
    const parsedHasCscPlate = parseBooleanFlag(hasCscPlate);
    const parsedHasCscCertification = parseBooleanFlag(hasCscCertification);
    const localFavoriteObjectIds = parseObjectIdList(
      localFavoriteIds,
      MAX_LOCAL_FAVORITE_IDS,
    );
    if ((parsedPriceMin !== undefined || parsedPriceMax !== undefined) && !priceCurrency) {
      return NextResponse.json(
        { error: "priceCurrency is required when filtering by price range" },
        { status: 400 },
      );
    }
    if (
      typeof parsedPriceMin === "number" &&
      typeof parsedPriceMax === "number" &&
      parsedPriceMin > parsedPriceMax
    ) {
      return NextResponse.json(
        { error: "priceMin cannot be greater than priceMax" },
        { status: 400 },
      );
    }
    if (sortBy === "priceNet" && !priceCurrency) {
      return NextResponse.json(
        { error: "priceCurrency is required when sorting by price" },
        { status: 400 },
      );
    }

    const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);
    const shouldResolveUser = mine || favorites || hasSessionCookie;
    const user = shouldResolveUser ? await getCurrentUserFromRequest(request) : null;
    if (mine && !user?._id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const includeOnlyPublic = !mine;
    const filter = buildContainerListingsFilter({
      q,
      type,
      containerSizes: containerSizes.length > 0 ? containerSizes : undefined,
      containerHeights: containerHeights.length > 0 ? containerHeights : undefined,
      containerTypes: containerTypes.length > 0 ? containerTypes : undefined,
      containerFeatures: containerFeatures.length > 0 ? containerFeatures : undefined,
      containerConditions: containerConditions.length > 0 ? containerConditions : undefined,
      priceMin: parsedPriceMin,
      priceMax: parsedPriceMax,
      priceCurrency,
      priceUnit,
      priceType,
      priceTaxMode,
      productionYear: parsedProductionYear,
      priceNegotiable: parsedPriceNegotiable,
      logisticsTransportAvailable: parsedLogisticsTransport,
      logisticsUnloadingAvailable: parsedLogisticsUnloading,
      hasCscPlate: parsedHasCscPlate,
      hasCscCertification: parsedHasCscCertification,
      locationLat,
      locationLng,
      radiusKm,
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
      priceNet: getPriceNetFieldForCurrency(priceCurrency ?? "PLN"),
    } as const;

    const sortField = sortFieldMap[sortBy];
    const sortDirection = sortDir === "asc" ? 1 : -1;
    const sort: Record<string, 1 | -1> = { [sortField]: sortDirection };
    if (sortField !== "createdAt") {
      sort.createdAt = -1;
    }

    const listings = await getContainerListingsCollection();
    const typedFilter = filter as Filter<ContainerListingDocument>;
    if (favorites) {
      if (user?._id) {
        const favoriteRows = await (await getContainerListingFavoritesCollection())
          .find(
            { userId: user._id },
            {
              projection: {
                listingId: 1,
              },
            },
          )
          .toArray();

        typedFilter._id = { $in: favoriteRows.map((row) => row.listingId) };
      } else {
        typedFilter._id = { $in: localFavoriteObjectIds };
      }
    }

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

      if (!user?._id) {
        return NextResponse.json({
          items: ordered.map(mapContainerListingToItem),
        });
      }

      const favoriteIdSet = favorites
        ? new Set(ordered.map((row) => row._id.toHexString()))
        : await getUserFavoriteListingIdSet(
            user._id,
            ordered.map((row) => row._id),
          );

      return NextResponse.json({
        items: mapItemsWithFavoriteFlag(ordered, favoriteIdSet),
      });
    }

    if (view === "map") {
      const rows =
        sortBy === "priceNet"
          ? await listings
              .aggregate<
                Pick<
                  ContainerListingDocument,
                  "_id" | "type" | "locationLat" | "locationLng" | "locations"
                >
              >([
                { $match: typedFilter },
                {
                  $addFields: {
                    __sortPriceValue: getPriceSortValueExpression(
                      getPriceNetFieldForCurrency(priceCurrency ?? "PLN"),
                    ),
                  },
                },
                { $sort: { __sortPriceValue: sortDirection, createdAt: -1 } },
                { $limit: all ? MAX_MAP_POINTS : pageSize },
                { $project: { _id: 1, type: 1, locationLat: 1, locationLng: 1, locations: 1 } },
              ])
              .toArray()
          : await listings
              .find(typedFilter)
              .sort(sort)
              .limit(all ? MAX_MAP_POINTS : pageSize)
              .project({
                _id: 1,
                type: 1,
                locationLat: 1,
                locationLng: 1,
                locations: 1,
              })
              .toArray();

      const mapPoints = rows.flatMap((row) =>
        mapContainerListingToMapPoints(
          row as Pick<
            ContainerListingDocument,
            "_id" | "type" | "locationLat" | "locationLng" | "locations"
          >,
        ),
      );
      const clippedMapPoints = all ? mapPoints.slice(0, MAX_MAP_POINTS) : mapPoints;
      const isTruncatedByPointLimit = all && mapPoints.length > clippedMapPoints.length;

      return NextResponse.json({
        items: clippedMapPoints,
        meta: {
          page: 1,
          pageSize: clippedMapPoints.length,
          total: clippedMapPoints.length,
          totalPages: 1,
          truncated: all && (rows.length >= MAX_MAP_POINTS || isTruncatedByPointLimit),
        },
      });
    }

    const total = await listings.countDocuments(typedFilter);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(page, totalPages);
    const skip = (currentPage - 1) * pageSize;

    const rows =
      sortBy === "priceNet"
        ? await listings
            .aggregate<ContainerListingDocument>([
              { $match: typedFilter },
              {
                $addFields: {
                  __sortPriceValue: getPriceSortValueExpression(
                    getPriceNetFieldForCurrency(priceCurrency ?? "PLN"),
                  ),
                },
              },
              { $sort: { __sortPriceValue: sortDirection, createdAt: -1 } },
              { $skip: skip },
              { $limit: pageSize },
              { $project: { __sortPriceValue: 0 } },
            ])
            .toArray()
        : await listings
            .find(typedFilter)
            .sort(sort)
            .skip(skip)
            .limit(pageSize)
            .toArray();

    if (!user?._id) {
      return NextResponse.json({
        items: rows.map(mapContainerListingToItem),
        meta: {
          page: currentPage,
          pageSize,
          total,
          totalPages,
        },
      });
    }

    const favoriteIdSet = favorites
      ? new Set(rows.map((row) => row._id.toHexString()))
      : await getUserFavoriteListingIdSet(
          user._id,
          rows.map((row) => row._id),
        );

    return NextResponse.json({
      items: mapItemsWithFavoriteFlag(rows, favoriteIdSet),
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
    const legacyLocationAddressLabel = normalizeOptionalString(listing.locationAddressLabel);
    const legacyLocationAddressParts = normalizeGeocodeAddressParts(listing.locationAddressParts);
    const normalizedLocations = normalizeListingLocations({
      locations: listing.locations,
      fallback: {
        locationLat: listing.locationLat,
        locationLng: listing.locationLng,
        locationAddressLabel: legacyLocationAddressLabel,
        locationAddressParts: legacyLocationAddressParts,
        isPrimary: true,
      },
      max: MAX_LISTING_LOCATIONS,
    });
    const primaryLocation = normalizedLocations[0];
    if (!primaryLocation) {
      return NextResponse.json(
        { error: "At least one valid location is required" },
        { status: 400 },
      );
    }

    const locationAddressLabel = primaryLocation.locationAddressLabel;
    const locationAddressParts = primaryLocation.locationAddressParts;
    const locationCity = primaryLocation.locationCity;
    const locationCountry = primaryLocation.locationCountry;
    const resolvedAvailableFrom = resolveAvailableFromDate({
      availableNow: listing.availableNow,
      availableFrom: listing.availableFrom,
      now,
    });
    const normalizedTitle = normalizeOptionalString(listing.title);
    const normalizedDescription = normalizeOptionalDescriptionHtml(listing.description);
    const normalizedPrice = normalizeOptionalString(listing.price);
    const normalizedPriceAmount =
      typeof listing.priceAmount === "number" && Number.isFinite(listing.priceAmount)
        ? listing.priceAmount
        : undefined;
    const normalizedLogisticsComment = normalizeOptionalString(listing.logisticsComment);
    const logisticsTransportIncluded = listing.logisticsTransportIncluded === true;
    const logisticsTransportAvailable =
      listing.logisticsTransportAvailable === true || logisticsTransportIncluded;
    const normalizedLogisticsTransportFreeDistanceKm =
      logisticsTransportIncluded &&
      typeof listing.logisticsTransportFreeDistanceKm === "number" &&
      Number.isFinite(listing.logisticsTransportFreeDistanceKm) &&
      listing.logisticsTransportFreeDistanceKm > 0
        ? Math.trunc(listing.logisticsTransportFreeDistanceKm)
        : undefined;
    const logisticsUnloadingIncluded = listing.logisticsUnloadingIncluded === true;
    const logisticsUnloadingAvailable =
      listing.logisticsUnloadingAvailable === true || logisticsUnloadingIncluded;
    const normalizedPricing =
      listing.pricing
        ? normalizeListingPrice(listing.pricing as ListingPriceInput, now)
        : buildLegacyListingPrice({
            amount: normalizedPriceAmount,
            negotiable: listing.priceNegotiable,
            now,
          });

    if (
      normalizedDescription &&
      getRichTextLength(normalizedDescription) > DESCRIPTION_MAX_TEXT_LENGTH
    ) {
      return NextResponse.json(
        { error: `description exceeds ${DESCRIPTION_MAX_TEXT_LENGTH} characters` },
        { status: 400 },
      );
    }

    const listings = await getContainerListingsCollection();
    const insertResult = await listings.insertOne({
      _id: new ObjectId(),
      type: listing.type,
      ...(normalizedTitle ? { title: normalizedTitle } : {}),
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
      locationLat: primaryLocation.locationLat,
      locationLng: primaryLocation.locationLng,
      ...(locationAddressLabel ? { locationAddressLabel } : {}),
      ...(locationAddressParts ? { locationAddressParts } : {}),
      locations: normalizedLocations,
      availableNow: listing.availableNow === true,
      availableFromApproximate:
        listing.availableNow === true ? false : listing.availableFromApproximate === true,
      availableFrom: resolvedAvailableFrom,
      ...(normalizedPricing ? { pricing: normalizedPricing } : {}),
      ...(normalizedPriceAmount !== undefined || normalizedPricing?.original.amount !== null
        ? { priceAmount: normalizedPriceAmount ?? normalizedPricing?.original.amount ?? undefined }
        : {}),
      priceNegotiable:
        normalizedPricing?.original.negotiable === true || listing.priceNegotiable === true,
      logisticsTransportAvailable,
      logisticsTransportIncluded: logisticsTransportAvailable && logisticsTransportIncluded,
      ...(normalizedLogisticsTransportFreeDistanceKm !== undefined
        ? { logisticsTransportFreeDistanceKm: normalizedLogisticsTransportFreeDistanceKm }
        : {}),
      logisticsUnloadingAvailable,
      logisticsUnloadingIncluded: logisticsUnloadingAvailable && logisticsUnloadingIncluded,
      ...(normalizedLogisticsComment ? { logisticsComment: normalizedLogisticsComment } : {}),
      hasCscPlate: listing.hasCscPlate === true,
      hasCscCertification: listing.hasCscCertification === true,
      ...(typeof listing.productionYear === "number" ? { productionYear: listing.productionYear } : {}),
      price:
        normalizedPrice ??
        (normalizedPriceAmount !== undefined
          ? String(normalizedPriceAmount)
          : normalizedPricing?.original.amount !== null
            ? String(normalizedPricing?.original.amount)
            : undefined),
      ...(normalizedDescription ? { description: normalizedDescription } : {}),
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


