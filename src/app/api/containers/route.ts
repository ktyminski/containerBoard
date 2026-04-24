import { NextRequest, NextResponse } from "next/server";
import { ObjectId, type Filter } from "mongodb";
import { z } from "zod";
import { SESSION_COOKIE_NAME } from "@/lib/auth-session";
import { getCurrentUserFromRequest } from "@/lib/auth-user";
import { normalizeGeocodeAddressParts } from "@/lib/geocode-address";
import {
  resolveCountryCodeFromInput,
  resolveCountryCodeFromInputApprox,
} from "@/lib/country-flags";
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
  mapContainerListingToMapPoints,
  mapContainerListingToItem,
  type ContainerListingDocument,
  type ContainerListingImageAsset,
  type ContainerListingItem,
} from "@/lib/container-listings";
import { getCompaniesCollection } from "@/lib/companies";
import {
  CONTAINER_CONDITIONS,
  CONTAINER_FEATURES,
  CONTAINER_HEIGHTS,
  CONTAINER_TYPES,
  LISTING_STATUSES,
  LISTING_STATUS,
  PRICE_CURRENCIES,
  PRICE_TAX_MODES,
  type Currency,
  type ContainerSize,
  type ListingStatus,
} from "@/lib/container-listing-types";
import {
  buildLegacyListingPrice,
  normalizeListingPrice,
  type ListingPriceInput,
} from "@/lib/listing-price";
import { processGalleryUpload } from "@/lib/company-media";
import {
  buildBlobPath,
  safeDeleteBlobUrls,
  uploadBlobFromBuffer,
} from "@/lib/blob-storage";
import { getLatestFxContext } from "@/lib/fx-rates";
import { getRichTextLength } from "@/lib/listing-rich-text";
import {
  LISTING_DESCRIPTION_MAX_TEXT_LENGTH,
  normalizeOptionalListingDescriptionHtml,
} from "@/lib/listing-description-html";
import {
  MAX_CONTAINER_RAL_COLORS,
  parseContainerRalColors,
} from "@/lib/container-ral-colors";
import {
  buildContainerListingDocument,
  normalizeOptionalString,
  resolveAvailableFromDate,
} from "@/lib/container-listing-write";
import { enforcePublicReadRateLimitOrResponse } from "@/lib/app-rate-limit";
import {
  createListingSchema,
  listingTypeInputSchema,
} from "@/lib/container-listing-write-schema";
import { normalizeCompanyVerificationStatus } from "@/lib/company-verification";
import { enforceRateLimitOrResponse } from "@/lib/request-rate-limit";
import { logError } from "@/lib/server-logger";

export const runtime = "nodejs";
const MAX_POPUP_DETAILS_IDS = 80;
const MAX_MAP_POINTS = 50_000;
const MAX_LOCAL_FAVORITE_IDS = 2_000;
const MAX_LISTING_PHOTO_COUNT = 4;
const MAX_LISTING_PHOTO_BYTES = 5 * 1024 * 1024;

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(20),
  q: z.string().trim().min(1).max(120).optional(),
  company: z.string().trim().min(1).max(160).optional(),
  companySlug: z.string().trim().min(1).max(160).optional(),
  type: listingTypeInputSchema.optional(),
  containerSize: z.string().trim().max(120).optional(),
  containerHeight: z.string().trim().max(160).optional(),
  containerType: z.string().trim().max(240).optional(),
  containerFeature: z.string().trim().max(320).optional(),
  containerCondition: z.string().trim().max(240).optional(),
  containerRal: z.string().trim().max(2_000).optional(),
  priceMin: z.string().trim().max(32).optional(),
  priceMax: z.string().trim().max(32).optional(),
  priceCurrency: z.enum(PRICE_CURRENCIES).optional(),
  priceTaxMode: z.enum(PRICE_TAX_MODES).optional(),
  productionYear: z.string().trim().max(8).optional(),
  priceNegotiable: z.string().trim().max(8).optional(),
  logisticsTransport: z.string().trim().max(8).optional(),
  logisticsUnloading: z.string().trim().max(8).optional(),
  hasCscPlate: z.string().trim().max(8).optional(),
  hasCscCertification: z.string().trim().max(8).optional(),
  locationLat: z.coerce.number().finite().min(-90).max(90).optional(),
  locationLng: z.coerce.number().finite().min(-180).max(180).optional(),
  radiusKm: z.enum(["20", "50", "100", "200", "400"]).transform((value) => {
    if (value === "20") {
      return 20;
    }
    if (value === "50") {
      return 50;
    }
    if (value === "100") {
      return 100;
    }
    if (value === "200") {
      return 200;
    }
    return 400;
  }).optional(),
  city: z.string().trim().min(1).max(120).optional(),
  country: z.string().trim().min(1).max(120).optional(),
  countryCode: z.string().trim().length(2).optional(),
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
  deliveryReach: z
    .string()
    .optional()
    .transform((value) => value === "1" || value === "true"),
});

const EARTH_RADIUS_KM = 6371;

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

function parseRalCodesList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  const parsed = parseContainerRalColors(value, {
    ignoreIncompleteTrailingToken: true,
  });
  return parsed.colors.map((color) => color.ral);
}

function parseContainerSizeList(value: string | undefined): {
  sizes: ContainerSize[];
  includeCustomSize: boolean;
} {
  if (!value) {
    return {
      sizes: [],
      includeCustomSize: false,
    };
  }

  const rawEntries = value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const includeCustomSize = rawEntries.includes("custom");
  const standardSizeValues = parseEnumList(value, ["10", "20", "40", "45", "53"] as const);
  const sizes = standardSizeValues.map((item) => Number(item) as ContainerSize);

  return {
    sizes,
    includeCustomSize,
  };
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

function getEffectiveCountryCode(input: {
  locationCountry?: string;
  locationCountryCode?: string;
  locationAddressParts?: {
    country?: string;
  };
}): string {
  const countryName =
    input.locationAddressParts?.country?.trim() ||
    input.locationCountry?.trim() ||
    "";
  const resolved =
    resolveCountryCodeFromInput(countryName) ??
    resolveCountryCodeFromInputApprox(countryName) ??
    input.locationCountryCode?.trim().toUpperCase() ??
    "";
  return resolved.toUpperCase();
}

function locationMatchesAdministrativeFilter(
  location: {
    locationCity?: string;
    locationCountry?: string;
    locationCountryCode?: string;
    locationAddressParts?: {
      city?: string;
      country?: string;
    };
  },
  filter: {
    city?: string;
    country?: string;
    countryCode?: string;
  },
): boolean {
  const normalizedFilterCity = filter.city?.trim().toLowerCase() ?? "";
  const normalizedFilterCountry = filter.country?.trim().toLowerCase() ?? "";
  const normalizedFilterCountryCode = filter.countryCode?.trim().toUpperCase() ?? "";

  const locationCity =
    location.locationAddressParts?.city?.trim().toLowerCase() ||
    location.locationCity?.trim().toLowerCase() ||
    "";
  const locationCountry =
    location.locationAddressParts?.country?.trim().toLowerCase() ||
    location.locationCountry?.trim().toLowerCase() ||
    "";
  const locationCountryCode = getEffectiveCountryCode(location);

  if (normalizedFilterCity && locationCity !== normalizedFilterCity) {
    return false;
  }

  if (normalizedFilterCountryCode && locationCountryCode !== normalizedFilterCountryCode) {
    return false;
  }

  if (normalizedFilterCountryCode) {
    return true;
  }

  if (
    normalizedFilterCountry &&
    locationCountry &&
    locationCountry !== normalizedFilterCountry
  ) {
    return false;
  }

  return true;
}

function pruneMapRowToMatchingLocations(
  row: MapListingRow,
  filter: {
    city?: string;
    country?: string;
    countryCode?: string;
  } | null,
): MapListingRow {
  if (!filter) {
    return row;
  }

  const matchingLocations = (row.locations ?? []).filter((location) =>
    locationMatchesAdministrativeFilter(location, filter),
  );
  const rootLocationMatches = locationMatchesAdministrativeFilter(
    {
      locationCity: row.locationCity,
      locationCountry: row.locationCountry,
      locationCountryCode: row.locationCountryCode,
      locationAddressParts: row.locationAddressParts,
    },
    filter,
  );

  return {
    ...row,
    locations: matchingLocations,
    locationLat: rootLocationMatches ? row.locationLat : undefined,
    locationLng: rootLocationMatches ? row.locationLng : undefined,
  };
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function getDistanceKmBetweenPoints(input: {
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
}): number {
  const dLat = toRadians(input.toLat - input.fromLat);
  const dLng = toRadians(input.toLng - input.fromLng);
  const fromLatRad = toRadians(input.fromLat);
  const toLatRad = toRadians(input.toLat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(fromLatRad) *
      Math.cos(toLatRad) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getListingDeliveryReachDistanceKm(
  listing: Pick<
    ContainerListingDocument,
    | "locationLat"
    | "locationLng"
    | "locations"
    | "logisticsTransportIncluded"
    | "logisticsTransportFreeDistanceKm"
  >,
  target: { lat: number; lng: number },
): number | null {
  const freeDistanceKm =
    listing.logisticsTransportIncluded === true &&
    typeof listing.logisticsTransportFreeDistanceKm === "number" &&
    Number.isFinite(listing.logisticsTransportFreeDistanceKm) &&
    listing.logisticsTransportFreeDistanceKm > 0
      ? Math.trunc(listing.logisticsTransportFreeDistanceKm)
      : null;

  if (freeDistanceKm === null) {
    return null;
  }

  let bestDistanceKm: number | null = null;

  const tryPoint = (lat: number | null | undefined, lng: number | null | undefined) => {
    if (
      typeof lat !== "number" ||
      !Number.isFinite(lat) ||
      typeof lng !== "number" ||
      !Number.isFinite(lng)
    ) {
      return;
    }

    const distanceKm = getDistanceKmBetweenPoints({
      fromLat: lat,
      fromLng: lng,
      toLat: target.lat,
      toLng: target.lng,
    });

    if (distanceKm > freeDistanceKm) {
      return;
    }

    if (bestDistanceKm === null || distanceKm < bestDistanceKm) {
      bestDistanceKm = distanceKm;
    }
  };

  for (const location of listing.locations ?? []) {
    tryPoint(location.locationLat, location.locationLng);
  }

  tryPoint(listing.locationLat, listing.locationLng);

  return bestDistanceKm;
}

function appendAndCondition(
  filter: Filter<ContainerListingDocument>,
  condition: Filter<ContainerListingDocument>,
): Filter<ContainerListingDocument> {
  const existingAnd = Array.isArray(filter.$and) ? filter.$and : [];
  const baseFilter =
    Array.isArray(filter.$and) && Object.keys(filter).length === 1
      ? {}
      : filter;

  return {
    ...(Object.keys(baseFilter).length > 0 ? baseFilter : {}),
    $and: [...existingAnd, condition],
  };
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
    $ifNull: [`$${sortPriceField}`, 0],
  };
}

function getPriceMissingSortExpression(sortPriceField: string): Record<string, unknown> {
  return {
    $cond: [
      {
        $eq: [
          {
            $ifNull: [`$${sortPriceField}`, null],
          },
          null,
        ],
      },
      1,
      0,
    ],
  };
}

function getLocationBoundsFromRadius(input: {
  lat: number;
  lng: number;
  radiusKm: number;
}): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
  const latDelta = input.radiusKm / 110.574;
  const cosLat = Math.cos((input.lat * Math.PI) / 180);
  const lngDelta = input.radiusKm / (111.32 * Math.max(0.1, Math.abs(cosLat)));

  return {
    minLng: Math.max(-180, input.lng - lngDelta),
    maxLng: Math.min(180, input.lng + lngDelta),
    minLat: Math.max(-90, input.lat - latDelta),
    maxLat: Math.min(90, input.lat + latDelta),
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

type CompanyProfileByOwner = {
  slug: string;
  name: string;
  isVerified: boolean;
};

type MapListingRow = Pick<
  ContainerListingDocument,
  | "_id"
  | "type"
  | "quantity"
  | "locationLat"
  | "locationLng"
  | "locationCity"
  | "locationCountry"
  | "locationCountryCode"
  | "locationAddressParts"
  | "locations"
>;

function isSameCompanyName(left: string, right: string): boolean {
  return left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase();
}

function resolveListingCompanySlug(input: {
  row: ContainerListingDocument;
  item: ContainerListingItem;
  byOwnerUserId: Map<string, CompanyProfileByOwner>;
}): string | undefined {
  if (input.item.companySlug) {
    return input.item.companySlug;
  }

  const ownerUserId = input.row.createdByUserId?.toHexString();
  if (!ownerUserId) {
    return undefined;
  }

  const profile = input.byOwnerUserId.get(ownerUserId);
  if (!profile) {
    return undefined;
  }

  if (!isSameCompanyName(input.row.companyName, profile.name)) {
    return undefined;
  }

  return profile.slug;
}

async function getCompanyProfilesByOwnerUserId(
  rows: ContainerListingDocument[],
): Promise<Map<string, CompanyProfileByOwner>> {
  const ownerUserIds = Array.from(
    new Set(rows.map((row) => row.createdByUserId?.toHexString()).filter(Boolean)),
  ).filter((value): value is string => Boolean(value) && ObjectId.isValid(value));

  if (ownerUserIds.length === 0) {
    return new Map<string, CompanyProfileByOwner>();
  }

  const companies = await getCompaniesCollection();
  const companyRows = await companies
    .find(
      {
        createdByUserId: { $in: ownerUserIds.map((value) => new ObjectId(value)) },
        isBlocked: { $ne: true },
      },
      {
        projection: {
          createdByUserId: 1,
          slug: 1,
          name: 1,
          verificationStatus: 1,
          updatedAt: 1,
        },
        sort: { updatedAt: -1 },
      },
    )
    .toArray();

  const byOwnerUserId = new Map<string, CompanyProfileByOwner>();
  for (const company of companyRows) {
    const ownerUserId = company.createdByUserId?.toHexString();
    if (!ownerUserId || byOwnerUserId.has(ownerUserId)) {
      continue;
    }
    const slug = company.slug?.trim();
    const name = company.name?.trim();
    if (!slug || !name) {
      continue;
    }
    byOwnerUserId.set(ownerUserId, {
      slug,
      name,
      isVerified:
        normalizeCompanyVerificationStatus(company.verificationStatus) === "verified",
    });
  }

  return byOwnerUserId;
}

function mapRowsToItems(
  rows: ContainerListingDocument[],
  input?: {
    favoriteIdSet?: Set<string>;
    companyProfilesByOwnerUserId?: Map<string, CompanyProfileByOwner>;
  },
): ContainerListingItem[] {
  const companyProfilesByOwnerUserId =
    input?.companyProfilesByOwnerUserId ?? new Map<string, CompanyProfileByOwner>();
  return rows.map((row) => {
    const mapped = mapContainerListingToItem(row);
    const ownerUserId = row.createdByUserId?.toHexString();
    const ownerProfile = ownerUserId
      ? companyProfilesByOwnerUserId.get(ownerUserId)
      : undefined;
    const companySlug = resolveListingCompanySlug({
      row,
      item: mapped,
      byOwnerUserId: companyProfilesByOwnerUserId,
    });
    let companyIsVerified = mapped.companyIsVerified;
    if (
      companySlug &&
      ownerProfile &&
      isSameCompanyName(row.companyName, ownerProfile.name)
    ) {
      companyIsVerified = ownerProfile.isVerified;
    }

    return {
      ...mapped,
      ...(companySlug ? { companySlug } : {}),
      companyIsVerified,
      ...(input?.favoriteIdSet
        ? { isFavorite: input.favoriteIdSet.has(row._id.toHexString()) }
        : {}),
    };
  });
}

async function getPagedListingRows(input: {
  listings: Awaited<ReturnType<typeof getContainerListingsCollection>>;
  filter: Filter<ContainerListingDocument>;
  sortBy: "createdAt" | "availableFrom" | "expiresAt" | "quantity" | "priceNet";
  sort: Record<string, 1 | -1>;
  sortDirection: 1 | -1;
  priceCurrency?: Currency;
  skip: number;
  limit: number;
}): Promise<ContainerListingDocument[]> {
  const { listings, filter, sortBy, sort, sortDirection, priceCurrency, skip, limit } = input;

  if (sortBy === "priceNet") {
    return listings
      .aggregate<ContainerListingDocument>([
        { $match: filter },
        {
          $addFields: {
            __sortPriceMissing: getPriceMissingSortExpression(
              getPriceNetFieldForCurrency(priceCurrency ?? "PLN"),
            ),
            __sortPriceValue: getPriceSortValueExpression(
              getPriceNetFieldForCurrency(priceCurrency ?? "PLN"),
            ),
          },
        },
        {
          $sort: {
            __sortPriceMissing: 1,
            __sortPriceValue: sortDirection,
            createdAt: -1,
          },
        },
        { $skip: skip },
        { $limit: limit },
        { $project: { __sortPriceMissing: 0, __sortPriceValue: 0 } },
      ])
      .toArray();
  }

  return listings.find(filter).sort(sort).skip(skip).limit(limit).toArray();
}

async function getMapListingRows(input: {
  listings: Awaited<ReturnType<typeof getContainerListingsCollection>>;
  filter: Filter<ContainerListingDocument>;
  sortBy: "createdAt" | "availableFrom" | "expiresAt" | "quantity" | "priceNet";
  sort: Record<string, 1 | -1>;
  sortDirection: 1 | -1;
  priceCurrency?: Currency;
  limit: number;
}): Promise<MapListingRow[]> {
  const { listings, filter, sortBy, sort, sortDirection, priceCurrency, limit } = input;

  if (sortBy === "priceNet") {
    return listings
      .aggregate<MapListingRow>([
        { $match: filter },
        {
          $addFields: {
            __sortPriceMissing: getPriceMissingSortExpression(
              getPriceNetFieldForCurrency(priceCurrency ?? "PLN"),
            ),
            __sortPriceValue: getPriceSortValueExpression(
              getPriceNetFieldForCurrency(priceCurrency ?? "PLN"),
            ),
          },
        },
        {
          $sort: {
            __sortPriceMissing: 1,
            __sortPriceValue: sortDirection,
            createdAt: -1,
          },
        },
        { $limit: limit },
        {
          $project: {
            _id: 1,
            type: 1,
            quantity: 1,
            locationLat: 1,
            locationLng: 1,
            locations: 1,
          },
        },
      ])
      .toArray();
  }

  return listings
    .find(filter)
    .sort(sort)
    .limit(limit)
    .project({
      _id: 1,
      type: 1,
      quantity: 1,
      locationLat: 1,
      locationLng: 1,
      locations: 1,
    })
    .toArray() as Promise<MapListingRow[]>;
}

const createSchema = createListingSchema;

function parseJsonField<T>(value: FormDataEntryValue | null): T | null {
  if (typeof value !== "string") {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function ensureImageFile(file: File, maxBytes: number, field: string): string | null {
  if (!file.type.startsWith("image/")) {
    return `${field} must be an image file`;
  }

  if (file.size > maxBytes) {
    return `${field} exceeds size limit`;
  }

  return null;
}

function assetDataToBuffer(asset: ContainerListingImageAsset): Buffer {
  if (!asset.data?.buffer) {
    throw new Error("Missing processed image buffer");
  }

  return Buffer.from(asset.data.buffer);
}

function toStoredImageAsset(
  asset: ContainerListingImageAsset,
  blobUrl: string,
): ContainerListingImageAsset {
  return {
    filename: asset.filename,
    contentType: asset.contentType,
    size: asset.size,
    width: asset.width,
    height: asset.height,
    blobUrl,
  };
}

async function uploadContainerImageAsset(input: {
  listingId: ObjectId;
  key: string;
  asset: ContainerListingImageAsset;
}): Promise<ContainerListingImageAsset> {
  const buffer = assetDataToBuffer(input.asset);
  const { url } = await uploadBlobFromBuffer({
    pathname: buildBlobPath({
      segments: ["containers", input.listingId.toHexString(), input.key],
      filenameBase: input.asset.filename,
      contentType: input.asset.contentType,
    }),
    contentType: input.asset.contentType,
    access: "public",
    cacheControlMaxAge: 31536000,
    buffer,
  });

  return toStoredImageAsset(input.asset, url);
}

async function parseCreateBody(request: NextRequest): Promise<{
  payload: unknown;
  photoFiles: File[];
}> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const payload = parseJsonField<unknown>(formData.get("payload"));
    return {
      payload,
      photoFiles: formData
        .getAll("photos")
        .filter((item): item is File => item instanceof File && item.size > 0),
    };
  }

  return {
    payload: await request.json(),
    photoFiles: [],
  };
}

function isAllowedMineStatus(status?: ListingStatus): status is ListingStatus {
  return status === LISTING_STATUS.ACTIVE || status === LISTING_STATUS.EXPIRED || status === LISTING_STATUS.CLOSED;
}

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await enforcePublicReadRateLimitOrResponse({
      request,
      scope: "containers:list",
      limit: 225,
    });
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    await Promise.all([ensureContainerListingsIndexes(), expireContainerListingsIfNeeded()]);

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
      company,
      companySlug,
      type,
      containerSize,
      containerHeight,
      containerType,
      containerFeature,
      containerCondition,
      containerRal,
      priceMin,
      priceMax,
      priceCurrency,
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
      countryCode,
      status,
      mine,
      sortBy,
      sortDir,
      view,
      all,
      ids,
      favorites,
      localFavoriteIds,
      deliveryReach,
    } = parsed.data;

    const { sizes: containerSizes, includeCustomSize } = parseContainerSizeList(containerSize);
    const containerHeights = parseEnumList(containerHeight, CONTAINER_HEIGHTS);
    const containerTypes = parseEnumList(containerType, CONTAINER_TYPES);
    const containerFeatures = parseEnumList(containerFeature, CONTAINER_FEATURES);
    const containerConditions = parseEnumList(containerCondition, CONTAINER_CONDITIONS);
    const containerRalColors = parseRalCodesList(containerRal);
    const parsedPriceMin = parseOptionalNumber(priceMin);
    const parsedPriceMax = parseOptionalNumber(priceMax);
    const hasPriceRangeFilter =
      typeof parsedPriceMin === "number" || typeof parsedPriceMax === "number";
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
    if (hasPriceRangeFilter && !priceCurrency) {
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

    let companyFilterSlug = companySlug?.trim() || undefined;
    let companyFilterName: string | undefined;
    if (!companyFilterSlug && company?.trim()) {
      const companies = await getCompaniesCollection();
      const companyRecord = await companies.findOne(
        { slug: company.trim(), isBlocked: { $ne: true } },
        { projection: { slug: 1, name: 1 } },
      );
      if (companyRecord?.slug?.trim()) {
        companyFilterSlug = companyRecord.slug.trim();
        companyFilterName = companyRecord.name?.trim() || undefined;
      } else {
        companyFilterSlug = "__no_company_match__";
      }
    }

    const includeOnlyPublic = !mine;
    const filter = buildContainerListingsFilter({
      q,
      type,
      companySlug: companyFilterSlug,
      companyName: companyFilterName,
      containerSizes: containerSizes.length > 0 ? containerSizes : undefined,
      includeCustomContainerSize: includeCustomSize,
      containerHeights: containerHeights.length > 0 ? containerHeights : undefined,
      containerTypes: containerTypes.length > 0 ? containerTypes : undefined,
      containerFeatures: containerFeatures.length > 0 ? containerFeatures : undefined,
      containerConditions: containerConditions.length > 0 ? containerConditions : undefined,
      containerRalColors:
        containerRalColors.length > 0 ? containerRalColors : undefined,
      priceMin: parsedPriceMin,
      priceMax: parsedPriceMax,
      priceCurrency: hasPriceRangeFilter ? priceCurrency : undefined,
      priceTaxMode,
      productionYear: parsedProductionYear,
      priceNegotiable: parsedPriceNegotiable,
      logisticsTransportAvailable: parsedLogisticsTransport,
      logisticsUnloadingAvailable: parsedLogisticsUnloading,
      hasCscPlate: parsedHasCscPlate,
      hasCscCertification: parsedHasCscCertification,
      locationLat: deliveryReach ? undefined : locationLat,
      locationLng: deliveryReach ? undefined : locationLng,
      radiusKm: deliveryReach ? undefined : radiusKm,
      city,
      country,
      countryCode,
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
    const mapLocationBounds =
      typeof locationLat === "number" &&
      Number.isFinite(locationLat) &&
      typeof locationLng === "number" &&
      Number.isFinite(locationLng) &&
      typeof radiusKm === "number" &&
      Number.isFinite(radiusKm) &&
      radiusKm > 0
        ? getLocationBoundsFromRadius({
            lat: locationLat,
            lng: locationLng,
            radiusKm,
          })
        : null;

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
      const [companyProfilesByOwnerUserId, favoriteIdSet] = await Promise.all([
        getCompanyProfilesByOwnerUserId(ordered),
        user?._id
          ? favorites
            ? Promise.resolve(new Set(ordered.map((row) => row._id.toHexString())))
            : getUserFavoriteListingIdSet(
                user._id,
                ordered.map((row) => row._id),
              )
          : Promise.resolve<Set<string> | undefined>(undefined),
      ]);

      if (!user?._id) {
        return NextResponse.json({
          items: mapRowsToItems(ordered, { companyProfilesByOwnerUserId }),
        });
      }

      return NextResponse.json({
        items: mapRowsToItems(ordered, {
          favoriteIdSet: favoriteIdSet ?? new Set<string>(),
          companyProfilesByOwnerUserId,
        }),
      });
    }

    if (deliveryReach) {
      if (
        typeof locationLat !== "number" ||
        !Number.isFinite(locationLat) ||
        typeof locationLng !== "number" ||
        !Number.isFinite(locationLng)
      ) {
        return NextResponse.json({
          items: [],
          meta: {
            page: 1,
            pageSize,
            total: 0,
            totalPages: 1,
          },
        });
      }

      const deliveryReachFilter = appendAndCondition(typedFilter, {
        logisticsTransportIncluded: true,
        logisticsTransportFreeDistanceKm: { $gt: 0 },
      });
      const candidateRows = await listings.find(deliveryReachFilter).toArray();
      const matchedRows = candidateRows
        .map((row) => ({
          row,
          deliveryDistanceKm: getListingDeliveryReachDistanceKm(row, {
            lat: locationLat,
            lng: locationLng,
          }),
        }))
        .filter(
          (
            entry,
          ): entry is {
            row: ContainerListingDocument;
            deliveryDistanceKm: number;
          } => typeof entry.deliveryDistanceKm === "number",
        )
        .sort((left, right) => {
          if (left.deliveryDistanceKm !== right.deliveryDistanceKm) {
            return left.deliveryDistanceKm - right.deliveryDistanceKm;
          }
          return right.row.createdAt.getTime() - left.row.createdAt.getTime();
        });

      const deliveryTotal = matchedRows.length;
      const deliveryTotalPages = Math.max(1, Math.ceil(deliveryTotal / pageSize));
      const deliveryCurrentPage = Math.min(page, deliveryTotalPages);
      const deliveryPageRows = matchedRows
        .slice((deliveryCurrentPage - 1) * pageSize, deliveryCurrentPage * pageSize)
        .map((entry) => entry.row);

      const [companyProfilesByOwnerUserId, favoriteIdSet] = await Promise.all([
        getCompanyProfilesByOwnerUserId(deliveryPageRows),
        user?._id
          ? favorites
            ? Promise.resolve(new Set(deliveryPageRows.map((row) => row._id.toHexString())))
            : getUserFavoriteListingIdSet(
                user._id,
                deliveryPageRows.map((row) => row._id),
              )
          : Promise.resolve<Set<string> | undefined>(undefined),
      ]);

      return NextResponse.json({
        items: mapRowsToItems(deliveryPageRows, {
          favoriteIdSet: favoriteIdSet ?? undefined,
          companyProfilesByOwnerUserId,
        }),
        meta: {
          page: deliveryCurrentPage,
          pageSize,
          total: deliveryTotal,
          totalPages: deliveryTotalPages,
        },
      });
    }

    if (view === "map") {
      const rows = await getMapListingRows({
        listings,
        filter: typedFilter,
        sortBy,
        sort,
        sortDirection,
        priceCurrency: priceCurrency ?? undefined,
        limit: all ? MAX_MAP_POINTS : pageSize,
      });
      const administrativeLocationFilter =
        city || country || countryCode
          ? {
              city,
              country,
              countryCode,
            }
          : null;

      const mapPoints = rows.flatMap((row) =>
        mapContainerListingToMapPoints(
          pruneMapRowToMatchingLocations(row as MapListingRow, administrativeLocationFilter),
          {
            bounds: mapLocationBounds,
          },
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

    const requestedSkip = (page - 1) * pageSize;
    const [total, initialRows] = await Promise.all([
      listings.countDocuments(typedFilter),
      getPagedListingRows({
        listings,
        filter: typedFilter,
        sortBy,
        sort,
        sortDirection,
        priceCurrency: priceCurrency ?? undefined,
        skip: requestedSkip,
        limit: pageSize,
      }),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(page, totalPages);
    const rows =
      currentPage === page
        ? initialRows
        : await getPagedListingRows({
            listings,
            filter: typedFilter,
            sortBy,
            sort,
            sortDirection,
            priceCurrency: priceCurrency ?? undefined,
            skip: (currentPage - 1) * pageSize,
            limit: pageSize,
          });
    const [companyProfilesByOwnerUserId, favoriteIdSet] = await Promise.all([
      getCompanyProfilesByOwnerUserId(rows),
      user?._id
        ? favorites
          ? Promise.resolve(new Set(rows.map((row) => row._id.toHexString())))
          : getUserFavoriteListingIdSet(
              user._id,
              rows.map((row) => row._id),
            )
        : Promise.resolve<Set<string> | undefined>(undefined),
    ]);

    if (!user?._id) {
      return NextResponse.json({
        items: mapRowsToItems(rows, { companyProfilesByOwnerUserId }),
        meta: {
          page: currentPage,
          pageSize,
          total,
          totalPages,
        },
      });
    }

    return NextResponse.json({
      items: mapRowsToItems(rows, {
        favoriteIdSet: favoriteIdSet ?? new Set<string>(),
        companyProfilesByOwnerUserId,
      }),
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
      onError: "block",
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
      onError: "block",
    });
    if (userRateLimitResponse) {
      return userRateLimitResponse;
    }

    const { payload, photoFiles } = await parseCreateBody(request);
    const parsed = createSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          issues: parsed.error.issues.map((issue) => issue.message),
        },
        { status: 400 },
      );
    }
    if (photoFiles.length > MAX_LISTING_PHOTO_COUNT) {
      return NextResponse.json(
        {
          error: "Invalid files",
          issues: [`photos cannot exceed ${MAX_LISTING_PHOTO_COUNT} files`],
        },
        { status: 400 },
      );
    }
    const fileIssues = photoFiles
      .map((file, index) => ensureImageFile(file, MAX_LISTING_PHOTO_BYTES, `photo ${index + 1}`))
      .filter((issue): issue is string => Boolean(issue));
    if (fileIssues.length > 0) {
      return NextResponse.json(
        {
          error: "Invalid files",
          issues: fileIssues,
        },
        { status: 400 },
      );
    }

    const now = new Date();
    const listing = parsed.data;
    const companies = await getCompaniesCollection();
    const ownerCompany = await companies.findOne(
      {
        createdByUserId: user._id,
        isBlocked: { $ne: true },
      },
      {
        projection: {
          name: 1,
          slug: 1,
        },
        sort: { updatedAt: -1 },
      },
    );
    const publishAsCompanyRequested = listing.publishedAsCompany === true;
    if (publishAsCompanyRequested && !ownerCompany?._id) {
      return NextResponse.json(
        { error: "Company profile not found for this user" },
        { status: 400 },
      );
    }
    const publishedAsCompany = publishAsCompanyRequested && Boolean(ownerCompany?._id);
    const effectiveCompanyName = publishedAsCompany
      ? ownerCompany?.name?.trim() || listing.companyName.trim()
      : listing.companyName.trim();
    const effectiveCompanySlug = publishedAsCompany
      ? ownerCompany?.slug?.trim() || undefined
      : undefined;
    const listingId = new ObjectId();
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

    const resolvedAvailableFrom = resolveAvailableFromDate({
      availableNow: listing.availableNow,
      availableFrom: listing.availableFrom,
      now,
    });
    const normalizedDescription = normalizeOptionalListingDescriptionHtml(
      listing.description,
    );
    const normalizedPrice = normalizeOptionalString(listing.price);
    const normalizedPriceAmount =
      typeof listing.priceAmount === "number" && Number.isFinite(listing.priceAmount)
        ? listing.priceAmount
        : undefined;
    const normalizedLogisticsComment = normalizeOptionalString(listing.logisticsComment);
    const parsedContainerColors = parseContainerRalColors(listing.containerColorsRal);
    if (parsedContainerColors.tooMany) {
      return NextResponse.json(
        {
          error: `containerColorsRal supports at most ${MAX_CONTAINER_RAL_COLORS} RAL codes`,
        },
        { status: 400 },
      );
    }
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
    const normalizedCscValidToMonth =
      typeof listing.cscValidToMonth === "number" &&
      Number.isInteger(listing.cscValidToMonth) &&
      listing.cscValidToMonth >= 1 &&
      listing.cscValidToMonth <= 12
        ? listing.cscValidToMonth
        : undefined;
    const normalizedCscValidToYear =
      typeof listing.cscValidToYear === "number" &&
      Number.isInteger(listing.cscValidToYear) &&
      listing.cscValidToYear >= 1900 &&
      listing.cscValidToYear <= 2100
        ? listing.cscValidToYear
        : undefined;
    const fxContext = await getLatestFxContext(now);
    const normalizedPricing =
      listing.pricing
        ? normalizeListingPrice(listing.pricing as ListingPriceInput, now, fxContext)
        : buildLegacyListingPrice({
            amount: normalizedPriceAmount,
            negotiable: listing.priceNegotiable,
            now,
            fxContext,
          });

    if (
      normalizedDescription &&
      getRichTextLength(normalizedDescription) >
        LISTING_DESCRIPTION_MAX_TEXT_LENGTH
    ) {
      return NextResponse.json(
        {
          error: `description exceeds ${LISTING_DESCRIPTION_MAX_TEXT_LENGTH} characters`,
        },
        { status: 400 },
      );
    }

    let uploadedPhotos: ContainerListingImageAsset[] = [];
    let storedPhotos: ContainerListingImageAsset[] = [];
    const uploadedBlobUrls: string[] = [];
    try {
      uploadedPhotos =
        photoFiles.length > 0
          ? await Promise.all(photoFiles.map((file) => processGalleryUpload(file, "photo")))
          : [];
      storedPhotos =
        uploadedPhotos.length > 0
          ? await Promise.all(
              uploadedPhotos.map(async (asset, index) => {
                const stored = await uploadContainerImageAsset({
                  listingId,
                  key: `photos/${index}`,
                  asset,
                });
                if (stored.blobUrl) {
                  uploadedBlobUrls.push(stored.blobUrl);
                }
                return stored;
              }),
            )
          : [];
    } catch (mediaError) {
      if (uploadedBlobUrls.length > 0) {
        await safeDeleteBlobUrls(uploadedBlobUrls);
      }
      const message =
        mediaError instanceof Error ? mediaError.message : "image processing failed";
      return NextResponse.json(
        {
          error: "Invalid files",
          issues: [message],
        },
        { status: 400 },
      );
    }

    const listings = await getContainerListingsCollection();
    let insertResult;
    try {
      insertResult = await listings.insertOne(
        buildContainerListingDocument({
          listingId,
          now,
          createdByUserId: user._id,
          status: LISTING_STATUS.ACTIVE,
          type: listing.type,
          container: {
            size: listing.container.size as ContainerSize,
            height: listing.container.height,
            type: listing.container.type,
            features: listing.container.features,
            condition: listing.container.condition,
          },
          parsedContainerColors: parsedContainerColors.colors,
          photos: storedPhotos,
          quantity: listing.quantity,
          normalizedLocations,
          availableNow: listing.availableNow === true,
          availableFromApproximate: listing.availableNow === true
            ? false
            : listing.availableFromApproximate === true,
          resolvedAvailableFrom,
          normalizedPricing,
          normalizedPriceAmount,
          normalizedPrice,
          priceNegotiable: listing.priceNegotiable,
          logisticsTransportAvailable,
          logisticsTransportIncluded,
          normalizedLogisticsTransportFreeDistanceKm,
          logisticsUnloadingAvailable,
          logisticsUnloadingIncluded,
          normalizedLogisticsComment,
          hasCscPlate: listing.hasCscPlate === true,
          hasCscCertification: listing.hasCscCertification === true,
          hasBranding: listing.hasBranding === true,
          hasWarranty: listing.hasWarranty === true,
          normalizedCscValidToMonth,
          normalizedCscValidToYear,
          productionYear:
            typeof listing.productionYear === "number"
              ? listing.productionYear
              : undefined,
          normalizedDescription,
          companyName: effectiveCompanyName,
          companySlug: effectiveCompanySlug,
          publishedAsCompany,
          contactEmail: listing.contactEmail.trim(),
          contactPhone: normalizeOptionalString(listing.contactPhone),
        }),
      );
    } catch (dbError) {
      if (uploadedBlobUrls.length > 0) {
        await safeDeleteBlobUrls(uploadedBlobUrls);
      }
      throw dbError;
    }

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


