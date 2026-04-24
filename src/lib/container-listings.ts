import { Binary, ObjectId, type Collection, type Filter } from "mongodb";
import { getDb } from "@/lib/mongodb";
import type { GeocodeAddressParts } from "@/lib/geocode-address";
import {
  MAX_LISTING_LOCATIONS,
  normalizeListingLocations,
  type ListingLocation,
} from "@/lib/listing-locations";
import {
  sanitizeContainerRalColors,
  type ContainerRalColor,
} from "@/lib/container-ral-colors";
import {
  CONTAINER_CONDITIONS,
  CONTAINER_FEATURES,
  CONTAINER_HEIGHTS,
  CONTAINER_SIZE,
  CONTAINER_SIZES,
  CONTAINER_TYPES,
  LISTING_STATUS,
  type Container,
  type ContainerCondition,
  type ContainerFeature,
  type ContainerHeight,
  type ContainerSize,
  type Currency,
  type ListingPrice,
  type ListingStatus,
  type ListingType,
  type TaxMode,
} from "@/lib/container-listing-types";
import {
  resolveCountryCodeFromInput,
  resolveCountryCodeFromInputApprox,
} from "@/lib/country-flags";
import { escapeRegexPattern } from "@/lib/escape-regex-pattern";

export const LISTING_TTL_DAYS = 30;
export const LISTING_REMINDER_FIRST_DAYS = 7;
export const LISTING_REMINDER_FINAL_DAYS = 2;

type LegacyContainerTypeCode =
  | "20DV"
  | "40DV"
  | "40HC"
  | "reefer"
  | "open_top"
  | "flat_rack"
  | "other";

const LEGACY_CONTAINER_CODES: LegacyContainerTypeCode[] = [
  "20DV",
  "40DV",
  "40HC",
  "reefer",
  "open_top",
  "flat_rack",
  "other",
];

const DEFAULT_CONTAINER: Container = {
  size: 40,
  height: "standard",
  type: "dry",
  features: [],
  condition: "cargo_worthy",
};

const standardContainerSizeSet = new Set<number>(CONTAINER_SIZES);
const containerHeightSet = new Set<string>(CONTAINER_HEIGHTS);
const containerTypeSet = new Set<string>(CONTAINER_TYPES);
const containerFeatureSet = new Set<string>(CONTAINER_FEATURES);
const containerConditionSet = new Set<string>(CONTAINER_CONDITIONS);

function isSupportedContainerSize(value: unknown): value is ContainerSize {
  if (value === CONTAINER_SIZE.CUSTOM) {
    return true;
  }

  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    standardContainerSizeSet.has(value)
  );
}

function normalizeContainerSizeFromDocument(value: unknown): ContainerSize | null {
  if (isSupportedContainerSize(value)) {
    return value;
  }

  if (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value > 0
  ) {
    return CONTAINER_SIZE.CUSTOM;
  }

  return null;
}

export type ContainerListingDocument = {
  _id: ObjectId;
  type: ListingType;
  container?: Container;
  containerType?: string;
  containerColors?: ContainerRalColor[];
  photos?: ContainerListingImageAsset[];
  quantity: number;
  locationCity: string;
  locationCountry: string;
  locationCountryCode?: string;
  locationLat?: number;
  locationLng?: number;
  locationAddressLabel?: string;
  locationAddressParts?: GeocodeAddressParts;
  locations?: ListingLocation[];
  availableNow?: boolean;
  availableFromApproximate?: boolean;
  availableFrom: Date;
  pricing?: ListingPrice;
  priceAmount?: number;
  priceNegotiable?: boolean;
  logisticsTransportAvailable?: boolean;
  logisticsTransportIncluded?: boolean;
  logisticsTransportFreeDistanceKm?: number;
  logisticsUnloadingAvailable?: boolean;
  logisticsUnloadingIncluded?: boolean;
  logisticsComment?: string;
  hasCscPlate?: boolean;
  hasCscCertification?: boolean;
  hasBranding?: boolean;
  hasWarranty?: boolean;
  cscValidToMonth?: number;
  cscValidToYear?: number;
  productionYear?: number;
  price?: string;
  description?: string;
  companyName: string;
  companySlug?: string;
  companyIsVerified?: boolean;
  publishedAsCompany?: boolean;
  contactEmail: string;
  contactPhone?: string;
  status: ListingStatus;
  createdByUserId: ObjectId;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  expiryReminder7dSentAt?: Date;
  expiryReminder2dSentAt?: Date;
};

export type ContainerListingImageAsset = {
  filename: string;
  contentType: string;
  size: number;
  width?: number;
  height?: number;
  data?: Binary;
  blobUrl?: string;
};

export type ContainerInquiryDocument = {
  _id: ObjectId;
  listingId: ObjectId;
  buyerName: string;
  buyerEmail: string;
  buyerPhone?: string;
  message: string;
  requestedQuantity?: number;
  offeredPrice?: string;
  createdByUserId?: ObjectId;
  createdAt: Date;
};

export type ContainerListingFavoriteDocument = {
  _id: ObjectId;
  userId: ObjectId;
  listingId: ObjectId;
  createdAt: Date;
};

export type ContainerListingItem = {
  id: string;
  type: ListingType;
  container: Container;
  containerColors?: ContainerRalColor[];
  photoUrls?: string[];
  quantity: number;
  locationCity: string;
  locationCountry: string;
  locationCountryCode?: string;
  locationLat: number | null;
  locationLng: number | null;
  locationAddressLabel?: string;
  locationAddressParts?: GeocodeAddressParts;
  locations?: ListingLocation[];
  availableNow: boolean;
  availableFromApproximate: boolean;
  availableFrom: string;
  pricing?: ListingPrice;
  priceAmount?: number;
  priceNegotiable: boolean;
  logisticsTransportAvailable: boolean;
  logisticsTransportIncluded: boolean;
  logisticsTransportFreeDistanceKm?: number;
  logisticsUnloadingAvailable: boolean;
  logisticsUnloadingIncluded: boolean;
  logisticsComment?: string;
  hasCscPlate: boolean;
  hasCscCertification: boolean;
  hasBranding: boolean;
  hasWarranty: boolean;
  cscValidToMonth?: number;
  cscValidToYear?: number;
  productionYear?: number;
  price?: string;
  description?: string;
  companyName: string;
  companySlug?: string;
  companyIsVerified: boolean;
  publishedAsCompany: boolean;
  contactEmail: string;
  contactPhone?: string;
  status: ListingStatus;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  isExpired: boolean;
  canRefresh: boolean;
  isFavorite?: boolean;
};

export type ContainerListingMapPoint = {
  id: string;
  type: ListingType;
  quantity: number;
  locationLat: number | null;
  locationLng: number | null;
};

type MapPointBounds = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

let indexesReadyPromise: Promise<void> | null = null;

function computeExpiresAt(from: Date): Date {
  return new Date(from.getTime() + LISTING_TTL_DAYS * 24 * 60 * 60 * 1000);
}

function toBboxFromRadius(input: {
  lat: number;
  lng: number;
  radiusKm: number;
}): [number, number, number, number] {
  const latDelta = input.radiusKm / 110.574;
  const cosLat = Math.cos((input.lat * Math.PI) / 180);
  const lngDelta = input.radiusKm / (111.32 * Math.max(0.1, Math.abs(cosLat)));

  const minLng = Math.max(-180, input.lng - lngDelta);
  const maxLng = Math.min(180, input.lng + lngDelta);
  const minLat = Math.max(-90, input.lat - latDelta);
  const maxLat = Math.min(90, input.lat + latDelta);

  return [minLng, minLat, maxLng, maxLat];
}

function mapLegacyContainerTypeToContainer(code: LegacyContainerTypeCode): Container {
  if (code === "20DV") {
    return { ...DEFAULT_CONTAINER, size: 20, height: "standard", type: "dry" };
  }
  if (code === "40DV") {
    return { ...DEFAULT_CONTAINER, size: 40, height: "standard", type: "dry" };
  }
  if (code === "40HC") {
    return { ...DEFAULT_CONTAINER, size: 40, height: "HC", type: "dry" };
  }
  if (code === "reefer") {
    return { ...DEFAULT_CONTAINER, size: 40, height: "standard", type: "reefer" };
  }
  if (code === "open_top") {
    return { ...DEFAULT_CONTAINER, size: 40, height: "standard", type: "open_top" };
  }
  if (code === "flat_rack") {
    return { ...DEFAULT_CONTAINER, size: 40, height: "standard", type: "flat_rack" };
  }

  return { ...DEFAULT_CONTAINER, size: 40, height: "standard", type: "dry" };
}

function sanitizeContainer(input: unknown): Container | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const candidate = input as {
    size?: unknown;
    height?: unknown;
    type?: unknown;
    features?: unknown;
    condition?: unknown;
  };

  const size = normalizeContainerSizeFromDocument(candidate.size);
  const height =
    typeof candidate.height === "string" && containerHeightSet.has(candidate.height)
      ? (candidate.height as ContainerHeight)
      : null;
  const type =
    typeof candidate.type === "string" && containerTypeSet.has(candidate.type)
      ? (candidate.type as Container["type"])
      : null;
  const condition =
    typeof candidate.condition === "string" && containerConditionSet.has(candidate.condition)
      ? (candidate.condition as ContainerCondition)
      : null;

  const features = Array.isArray(candidate.features)
    ? Array.from(
        new Set(
          candidate.features.filter(
            (feature): feature is ContainerFeature =>
              typeof feature === "string" && containerFeatureSet.has(feature),
          ),
        ),
      )
    : [];

  if (size === null || !height || !type || !condition) {
    return null;
  }

  return {
    size,
    height,
    type,
    features,
    condition,
  };
}

function resolveContainerFromDocument(doc: {
  container?: unknown;
  containerType?: string;
}): Container {
  const sanitized = sanitizeContainer(doc.container);
  if (sanitized) {
    return sanitized;
  }

  const legacyType = doc.containerType;
  if (
    typeof legacyType === "string" &&
    LEGACY_CONTAINER_CODES.includes(legacyType as LegacyContainerTypeCode)
  ) {
    return mapLegacyContainerTypeToContainer(legacyType as LegacyContainerTypeCode);
  }

  return { ...DEFAULT_CONTAINER };
}

export function getDefaultListingExpiration(from = new Date()): Date {
  return computeExpiresAt(from);
}

export async function getContainerListingsCollection(): Promise<Collection<ContainerListingDocument>> {
  const db = await getDb();
  return db.collection<ContainerListingDocument>("container_listings");
}

export async function getContainerInquiriesCollection(): Promise<Collection<ContainerInquiryDocument>> {
  const db = await getDb();
  return db.collection<ContainerInquiryDocument>("container_inquiries");
}

export async function getContainerListingFavoritesCollection(): Promise<
  Collection<ContainerListingFavoriteDocument>
> {
  const db = await getDb();
  return db.collection<ContainerListingFavoriteDocument>("container_listing_favorites");
}

export async function ensureContainerListingsIndexes(): Promise<void> {
  if (!indexesReadyPromise) {
    indexesReadyPromise = (async () => {
      const listings = await getContainerListingsCollection();
      const inquiries = await getContainerInquiriesCollection();
      const favorites = await getContainerListingFavoritesCollection();

      await listings.createIndex({ status: 1, expiresAt: 1, createdAt: -1 });
      await listings.createIndex({ status: 1, expiresAt: 1, companySlug: 1, createdAt: -1 });
      await listings.createIndex({
        status: 1,
        expiresAt: 1,
        expiryReminder7dSentAt: 1,
        expiryReminder2dSentAt: 1,
      });
      await listings.createIndex({ createdByUserId: 1, createdAt: -1 });
      await listings.createIndex({ type: 1, "container.type": 1, createdAt: -1 });
      await listings.createIndex({ type: 1, containerType: 1, createdAt: -1 });
      await listings.createIndex({ "containerColors.ral": 1 });
      await listings.createIndex({ "container.size": 1, "container.height": 1, "container.type": 1 });
      await listings.createIndex({ "container.condition": 1 });
      await listings.createIndex({ "container.features": 1 });
      await listings.createIndex({ priceAmount: 1 });
      await listings.createIndex({ priceNegotiable: 1, priceAmount: 1 });
      await listings.createIndex({ "pricing.original.currency": 1 });
      await listings.createIndex({ "pricing.original.taxMode": 1, "pricing.original.negotiable": 1 });
      await listings.createIndex({ "pricing.normalized.net.amountPln": 1 });
      await listings.createIndex({ "pricing.normalized.net.amountEur": 1 });
      await listings.createIndex({ "pricing.normalized.net.amountUsd": 1 });
      await listings.createIndex({ hasCscPlate: 1, hasCscCertification: 1, productionYear: 1 });
      await listings.createIndex({ locationCity: 1, locationCountry: 1 });
      await listings.createIndex({ locationCountryCode: 1, type: 1, status: 1, expiresAt: 1, createdAt: -1 });
      await listings.createIndex({ locationLat: 1, locationLng: 1 });
      await listings.createIndex({ "locations.locationCity": 1, "locations.locationCountry": 1 });
      await listings.createIndex({ "locations.locationCountryCode": 1, type: 1, status: 1, expiresAt: 1, createdAt: -1 });
      await listings.createIndex({ "locations.locationLat": 1, "locations.locationLng": 1 });
      await listings.createIndex({ expiresAt: 1 });

      await inquiries.createIndex({ listingId: 1, createdAt: -1 });
      await inquiries.createIndex({ createdByUserId: 1, createdAt: -1 });

      await favorites.createIndex({ userId: 1, listingId: 1 }, { unique: true });
      await favorites.createIndex({ userId: 1, createdAt: -1 });
      await favorites.createIndex({ listingId: 1 });

      await listings.updateMany(
        { "pricing.original.unit": { $exists: true } },
        { $unset: { "pricing.original.unit": "" } },
      );
    })();
  }

  await indexesReadyPromise;
}

export async function expireContainerListingsIfNeeded(now = new Date()): Promise<void> {
  const listings = await getContainerListingsCollection();
  await listings.updateMany(
    {
      status: LISTING_STATUS.ACTIVE,
      expiresAt: { $lte: now },
    },
    {
      $set: {
        status: LISTING_STATUS.EXPIRED,
        updatedAt: now,
      },
    },
  );
}

export function mapContainerListingToItem(doc: ContainerListingDocument): ContainerListingItem {
  const now = Date.now();
  const expiresAtMs = doc.expiresAt.getTime();
  const isExpired = doc.status === LISTING_STATUS.EXPIRED || expiresAtMs <= now;
  const pricing = doc.pricing;
  const normalizedOriginalAmount =
    typeof pricing?.original.amount === "number" && Number.isFinite(pricing.original.amount)
      ? pricing.original.amount
      : undefined;
  const normalizedNegotiable = pricing?.original.negotiable === true || doc.priceNegotiable === true;
  const logisticsTransportIncluded =
    doc.logisticsTransportAvailable === true && doc.logisticsTransportIncluded === true;
  const logisticsTransportFreeDistanceKm =
    logisticsTransportIncluded &&
    typeof doc.logisticsTransportFreeDistanceKm === "number" &&
    Number.isFinite(doc.logisticsTransportFreeDistanceKm) &&
    doc.logisticsTransportFreeDistanceKm > 0
      ? Math.trunc(doc.logisticsTransportFreeDistanceKm)
      : undefined;
  const resolvedLocations = normalizeListingLocations({
    locations: doc.locations,
    fallback: {
      locationLat: doc.locationLat,
      locationLng: doc.locationLng,
      locationCity: doc.locationCity,
      locationCountry: doc.locationCountry,
      locationCountryCode: doc.locationCountryCode,
      locationAddressLabel: doc.locationAddressLabel,
      locationAddressParts: doc.locationAddressParts,
      isPrimary: true,
    },
    max: MAX_LISTING_LOCATIONS,
  });
  const primaryLocation = resolvedLocations[0];
  const containerColors = sanitizeContainerRalColors(doc.containerColors);
  const mediaVersion = doc.updatedAt instanceof Date ? doc.updatedAt.getTime() : 0;
  const photoUrls = Array.from(
    new Set(
      (doc.photos ?? [])
        .map((photo, index) => {
          if (!photo?.data && !photo?.filename && typeof photo?.size !== "number") {
            return "";
          }
          const baseUrl = `/api/containers/${doc._id.toHexString()}/photos/${index}`;
          return mediaVersion > 0 ? `${baseUrl}?v=${mediaVersion}` : baseUrl;
        })
        .filter(Boolean),
    ),
  );

  return {
    id: doc._id.toHexString(),
    type: doc.type,
    container: resolveContainerFromDocument(doc),
    ...(containerColors.length > 0 ? { containerColors } : {}),
    ...(photoUrls.length > 0 ? { photoUrls } : {}),
    quantity: doc.quantity,
    locationCity: primaryLocation?.locationCity ?? doc.locationCity,
    locationCountry: primaryLocation?.locationCountry ?? doc.locationCountry,
    locationCountryCode: primaryLocation?.locationCountryCode ?? doc.locationCountryCode,
    locationLat:
      primaryLocation?.locationLat ??
      (typeof doc.locationLat === "number" && Number.isFinite(doc.locationLat)
        ? doc.locationLat
        : null),
    locationLng:
      primaryLocation?.locationLng ??
      (typeof doc.locationLng === "number" && Number.isFinite(doc.locationLng)
        ? doc.locationLng
        : null),
    locationAddressLabel: primaryLocation?.locationAddressLabel ?? doc.locationAddressLabel,
    locationAddressParts: primaryLocation?.locationAddressParts ?? doc.locationAddressParts,
    ...(resolvedLocations.length > 0 ? { locations: resolvedLocations } : {}),
    availableNow: doc.availableNow === true,
    availableFromApproximate: doc.availableFromApproximate === true,
    availableFrom: doc.availableFrom.toISOString(),
    pricing,
    priceAmount:
      normalizedOriginalAmount ??
      (typeof doc.priceAmount === "number" && Number.isFinite(doc.priceAmount)
        ? doc.priceAmount
        : undefined),
    priceNegotiable: normalizedNegotiable,
    logisticsTransportAvailable: doc.logisticsTransportAvailable === true,
    logisticsTransportIncluded,
    logisticsTransportFreeDistanceKm,
    logisticsUnloadingAvailable: doc.logisticsUnloadingAvailable === true,
    logisticsUnloadingIncluded:
      doc.logisticsUnloadingAvailable === true && doc.logisticsUnloadingIncluded === true,
    logisticsComment: doc.logisticsComment?.trim() || undefined,
    hasCscPlate: doc.hasCscPlate === true,
    hasCscCertification: doc.hasCscCertification === true,
    hasBranding: doc.hasBranding === true,
    hasWarranty: doc.hasWarranty === true,
    cscValidToMonth:
      typeof doc.cscValidToMonth === "number" &&
      Number.isInteger(doc.cscValidToMonth) &&
      doc.cscValidToMonth >= 1 &&
      doc.cscValidToMonth <= 12
        ? doc.cscValidToMonth
        : undefined,
    cscValidToYear:
      typeof doc.cscValidToYear === "number" &&
      Number.isInteger(doc.cscValidToYear) &&
      doc.cscValidToYear >= 1900 &&
      doc.cscValidToYear <= 2100
        ? doc.cscValidToYear
        : undefined,
    productionYear:
      typeof doc.productionYear === "number" && Number.isFinite(doc.productionYear)
        ? doc.productionYear
        : undefined,
    price: doc.price,
    description: doc.description,
    companyName: doc.companyName,
    companySlug: doc.companySlug?.trim() || undefined,
    companyIsVerified: doc.companyIsVerified === true,
    publishedAsCompany: doc.publishedAsCompany === true,
    contactEmail: doc.contactEmail,
    contactPhone: doc.contactPhone,
    status: isExpired && doc.status === LISTING_STATUS.ACTIVE
      ? LISTING_STATUS.EXPIRED
      : doc.status,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    expiresAt: doc.expiresAt.toISOString(),
    isExpired,
    canRefresh: doc.status !== LISTING_STATUS.CLOSED,
  };
}

export function mapContainerListingToMapPoints(
  doc: Pick<
    ContainerListingDocument,
    "_id" | "type" | "quantity" | "locationLat" | "locationLng" | "locations"
  >,
  options?: {
    bounds?: MapPointBounds | null;
    locationFilter?: {
      city?: string;
      country?: string;
      countryCode?: string;
    } | null;
  },
): ContainerListingMapPoint[] {
  const listingId = doc._id.toHexString();
  const listingQuantity =
    typeof doc.quantity === "number" && Number.isFinite(doc.quantity) && doc.quantity > 0
      ? Math.trunc(doc.quantity)
      : 1;
  const points: ContainerListingMapPoint[] = [];
  const seenCoordinates = new Set<string>();
  const bounds = options?.bounds ?? null;
  const locationFilter = options?.locationFilter ?? null;
  const normalizedFilterCity = locationFilter?.city?.trim().toLowerCase() ?? "";
  const normalizedFilterCountry = locationFilter?.country?.trim().toLowerCase() ?? "";
  const normalizedFilterCountryCode = locationFilter?.countryCode?.trim().toUpperCase() ?? "";
  const hasAdministrativeLocationFilter =
    normalizedFilterCity.length > 0 ||
    normalizedFilterCountry.length > 0 ||
    normalizedFilterCountryCode.length > 0;
  const getEffectiveCountryCode = (location: {
    locationCountry?: string;
    locationCountryCode?: string;
    locationAddressParts?: {
      country?: string;
    };
  }) => {
    const countryName =
      location.locationAddressParts?.country?.trim() ||
      location.locationCountry?.trim() ||
      "";
    const resolvedFromCountry =
      resolveCountryCodeFromInput(countryName) ??
      resolveCountryCodeFromInputApprox(countryName) ??
      "";
    if (resolvedFromCountry) {
      return resolvedFromCountry.toUpperCase();
    }
    return location.locationCountryCode?.trim().toUpperCase() ?? "";
  };
  const locationMatchesFilter = (location: {
    locationCity?: string;
    locationCountry?: string;
    locationCountryCode?: string;
    locationAddressParts?: {
      city?: string;
      country?: string;
    };
  }) => {
    if (!hasAdministrativeLocationFilter) {
      return true;
    }

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

    if (normalizedFilterCountryCode) {
      return locationCountryCode === normalizedFilterCountryCode;
    }

    if (normalizedFilterCountry) {
      return locationCountry === normalizedFilterCountry;
    }

    return true;
  };
  const appendPoint = (lat: unknown, lng: unknown) => {
    if (
      typeof lat !== "number" ||
      !Number.isFinite(lat) ||
      typeof lng !== "number" ||
      !Number.isFinite(lng)
    ) {
      return;
    }
    if (
      bounds &&
      (lat < bounds.minLat ||
        lat > bounds.maxLat ||
        lng < bounds.minLng ||
        lng > bounds.maxLng)
    ) {
      return;
    }

    const key = `${lat.toFixed(6)}:${lng.toFixed(6)}`;
    if (seenCoordinates.has(key)) {
      return;
    }
    seenCoordinates.add(key);
    points.push({
      id: listingId,
      type: doc.type,
      quantity: listingQuantity,
      locationLat: lat,
      locationLng: lng,
    });
  };

  for (const location of doc.locations ?? []) {
    if (!locationMatchesFilter(location)) {
      continue;
    }
    appendPoint(location.locationLat, location.locationLng);
  }

  if (points.length === 0 && !hasAdministrativeLocationFilter) {
    appendPoint(doc.locationLat, doc.locationLng);
  }

  return points;
}

export function buildContainerListingsFilter(input: {
  q?: string;
  type?: ListingType;
  companySlug?: string;
  companyName?: string;
  containerSizes?: ContainerSize[];
  includeCustomContainerSize?: boolean;
  containerHeights?: ContainerHeight[];
  containerTypes?: Container["type"][];
  containerFeatures?: ContainerFeature[];
  containerConditions?: ContainerCondition[];
  containerRalColors?: string[];
  priceMin?: number;
  priceMax?: number;
  priceCurrency?: Currency;
  priceTaxMode?: TaxMode;
  priceNegotiable?: boolean;
  logisticsTransportAvailable?: boolean;
  logisticsUnloadingAvailable?: boolean;
  hasCscPlate?: boolean;
  hasCscCertification?: boolean;
  productionYear?: number;
  locationLat?: number;
  locationLng?: number;
  radiusKm?: number;
  city?: string;
  country?: string;
  countryCode?: string;
  status?: ListingStatus;
  ownerUserId?: ObjectId;
  includeOnlyPublic?: boolean;
  now?: Date;
}): Filter<ContainerListingDocument> {
  const now = input.now ?? new Date();
  const filter: Filter<ContainerListingDocument> = {};
  const andConditions: Filter<ContainerListingDocument>[] = [];

  if (input.includeOnlyPublic) {
    filter.status = LISTING_STATUS.ACTIVE;
    filter.expiresAt = { $gt: now };
  } else if (input.status) {
    filter.status = input.status;
  }

  if (input.ownerUserId) {
    filter.createdByUserId = input.ownerUserId;
  }

  if (input.type) {
    filter.type = input.type;
  }

  const normalizedCompanySlug = input.companySlug?.trim();
  const normalizedCompanyName = input.companyName?.trim();
  if (normalizedCompanySlug && normalizedCompanyName) {
    andConditions.push({
      $or: [
        { companySlug: normalizedCompanySlug } as Filter<ContainerListingDocument>,
        {
          companyName: new RegExp(`^${escapeRegexPattern(normalizedCompanyName)}$`, "i"),
        } as Filter<ContainerListingDocument>,
      ],
    } as Filter<ContainerListingDocument>);
  } else if (normalizedCompanySlug) {
    filter.companySlug = normalizedCompanySlug;
  } else if (normalizedCompanyName) {
    andConditions.push({
      companyName: new RegExp(`^${escapeRegexPattern(normalizedCompanyName)}$`, "i"),
    } as Filter<ContainerListingDocument>);
  }

  if (
    (input.containerSizes && input.containerSizes.length > 0) ||
    input.includeCustomContainerSize === true
  ) {
    const sizeConditions = (input.containerSizes ?? []).map((size) => {
      const oneSizeConditions: Filter<ContainerListingDocument>[] = [
        { "container.size": size } as Filter<ContainerListingDocument>,
      ];
      if (size === 20) {
        oneSizeConditions.push({ containerType: "20DV" });
      } else if (size === 40) {
        oneSizeConditions.push({
          containerType: { $in: ["40DV", "40HC", "reefer", "open_top", "flat_rack", "other"] },
        });
      }

      return oneSizeConditions.length === 1
        ? oneSizeConditions[0]
        : ({ $or: oneSizeConditions } as Filter<ContainerListingDocument>);
    });

    if (input.includeCustomContainerSize === true) {
      sizeConditions.push({
        $and: [
          {
            "container.size": {
              $exists: true,
            },
          },
          {
            "container.size": {
              $nin: Array.from(standardContainerSizeSet),
            },
          },
        ],
      } as Filter<ContainerListingDocument>);
    }

    andConditions.push(
      sizeConditions.length === 1
        ? sizeConditions[0]
        : ({ $or: sizeConditions } as Filter<ContainerListingDocument>),
    );
  }

  if (input.containerHeights && input.containerHeights.length > 0) {
    const heightConditions = input.containerHeights.map((height) => {
      const oneHeightConditions: Filter<ContainerListingDocument>[] = [
        { "container.height": height } as Filter<ContainerListingDocument>,
      ];
      if (height === "standard") {
        oneHeightConditions.push({
          containerType: { $in: ["20DV", "40DV", "reefer", "open_top", "flat_rack", "other"] },
        });
      } else {
        oneHeightConditions.push({ containerType: "40HC" });
      }

      return oneHeightConditions.length === 1
        ? oneHeightConditions[0]
        : ({ $or: oneHeightConditions } as Filter<ContainerListingDocument>);
    });

    andConditions.push(
      heightConditions.length === 1
        ? heightConditions[0]
        : ({ $or: heightConditions } as Filter<ContainerListingDocument>),
    );
  }

  if (input.containerTypes && input.containerTypes.length > 0) {
    const typeConditions = input.containerTypes.map((containerType) => {
      const oneTypeConditions: Filter<ContainerListingDocument>[] = [
        { "container.type": containerType } as Filter<ContainerListingDocument>,
      ];
      if (containerType === "dry") {
        oneTypeConditions.push({ containerType: { $in: ["20DV", "40DV", "40HC", "other"] } });
      } else if (["reefer", "open_top", "flat_rack"].includes(containerType)) {
        oneTypeConditions.push({ containerType });
      }

      return oneTypeConditions.length === 1
        ? oneTypeConditions[0]
        : ({ $or: oneTypeConditions } as Filter<ContainerListingDocument>);
    });

    andConditions.push(
      typeConditions.length === 1
        ? typeConditions[0]
        : ({ $or: typeConditions } as Filter<ContainerListingDocument>),
    );
  }

  if (input.containerFeatures && input.containerFeatures.length > 0) {
    andConditions.push({
      "container.features": { $in: input.containerFeatures },
    } as Filter<ContainerListingDocument>);
  }

  if (input.containerRalColors && input.containerRalColors.length > 0) {
    andConditions.push({
      "containerColors.ral": { $in: input.containerRalColors },
    } as Filter<ContainerListingDocument>);
  }

  if (input.containerConditions && input.containerConditions.length > 0) {
    const includesCargoWorthyFallback = input.containerConditions.includes("cargo_worthy");
    if (includesCargoWorthyFallback) {
      andConditions.push({
        $or: [
          { "container.condition": { $in: input.containerConditions } },
          { "container.condition": { $nin: CONTAINER_CONDITIONS } },
        ],
      } as Filter<ContainerListingDocument>);
    } else {
      andConditions.push({
        "container.condition": { $in: input.containerConditions },
      } as Filter<ContainerListingDocument>);
    }
  }

  if (input.priceNegotiable === true) {
    andConditions.push({
      $or: [
        { "pricing.original.negotiable": true },
        { priceNegotiable: true },
      ],
    } as Filter<ContainerListingDocument>);
  }

  if (input.logisticsTransportAvailable === true) {
    andConditions.push({
      $or: [
        { logisticsTransportAvailable: true },
        { logisticsTransportIncluded: true },
      ],
    } as Filter<ContainerListingDocument>);
  }

  if (input.logisticsUnloadingAvailable === true) {
    andConditions.push({
      $or: [
        { logisticsUnloadingAvailable: true },
        { logisticsUnloadingIncluded: true },
      ],
    } as Filter<ContainerListingDocument>);
  }

  if (input.priceCurrency) {
    filter["pricing.original.currency"] = input.priceCurrency;
  }

  if (input.hasCscPlate === true) {
    filter.hasCscPlate = true;
  }

  if (input.hasCscCertification === true) {
    filter.hasCscCertification = true;
  }

  if (
    typeof input.productionYear === "number" &&
    Number.isFinite(input.productionYear) &&
    input.productionYear >= 1900 &&
    input.productionYear <= 2100
  ) {
    andConditions.push({
      productionYear: { $gte: Math.trunc(input.productionYear) },
    } as Filter<ContainerListingDocument>);
  }

  if (
    typeof input.priceMin === "number" ||
    typeof input.priceMax === "number"
  ) {
    const compareTaxMode = input.priceTaxMode === "gross" ? "gross" : "net";
    const normalizedComparedField =
      input.priceCurrency === "EUR"
        ? `pricing.normalized.${compareTaxMode}.amountEur`
        : input.priceCurrency === "USD"
          ? `pricing.normalized.${compareTaxMode}.amountUsd`
          : `pricing.normalized.${compareTaxMode}.amountPln`;
    const priceAmountFilter: { $gte?: number; $lte?: number } = {};
    if (typeof input.priceMin === "number" && Number.isFinite(input.priceMin)) {
      priceAmountFilter.$gte = input.priceMin;
    }
    if (typeof input.priceMax === "number" && Number.isFinite(input.priceMax)) {
      priceAmountFilter.$lte = input.priceMax;
    }

    if (priceAmountFilter.$gte !== undefined || priceAmountFilter.$lte !== undefined) {
      const rangeConditions: Filter<ContainerListingDocument>[] = [
        { [normalizedComparedField]: priceAmountFilter } as Filter<ContainerListingDocument>,
      ];

      const canUseLegacyPriceFallback =
        (input.priceCurrency ?? "PLN") === "PLN" &&
        input.priceTaxMode !== "gross";
      if (canUseLegacyPriceFallback) {
        rangeConditions.push({
          priceAmount: priceAmountFilter,
        } as Filter<ContainerListingDocument>);
      }

      andConditions.push(
        rangeConditions.length === 1
          ? rangeConditions[0]
          : ({ $or: rangeConditions } as Filter<ContainerListingDocument>),
      );
    }
  }

  if (
    typeof input.locationLat === "number" &&
    Number.isFinite(input.locationLat) &&
    typeof input.locationLng === "number" &&
    Number.isFinite(input.locationLng) &&
    typeof input.radiusKm === "number" &&
    Number.isFinite(input.radiusKm) &&
    input.radiusKm > 0
  ) {
    const [minLng, minLat, maxLng, maxLat] = toBboxFromRadius({
      lat: input.locationLat,
      lng: input.locationLng,
      radiusKm: input.radiusKm,
    });

    andConditions.push({
      $or: [
        {
          locationLat: { $gte: minLat, $lte: maxLat },
          locationLng: { $gte: minLng, $lte: maxLng },
        } as Filter<ContainerListingDocument>,
        {
          locations: {
            $elemMatch: {
              locationLat: { $gte: minLat, $lte: maxLat },
              locationLng: { $gte: minLng, $lte: maxLng },
            },
          },
        } as Filter<ContainerListingDocument>,
      ],
    } as Filter<ContainerListingDocument>);
  }

  const normalizedCity = input.city?.trim();
  const normalizedCountry = input.country?.trim();
  const normalizedCountryCode = input.countryCode?.trim().toUpperCase();
  const cityPattern = normalizedCity
    ? new RegExp(`^${escapeRegexPattern(normalizedCity)}$`, "i")
    : null;
  const countryPattern = normalizedCountry
    ? new RegExp(`^${escapeRegexPattern(normalizedCountry)}$`, "i")
    : null;

  const buildAdministrativeLocationCondition = (
    nested = false,
  ): Filter<ContainerListingDocument> | null => {
    const condition: Record<string, unknown> = {};

    if (cityPattern) {
      condition[nested ? "locationCity" : "locationCity"] = cityPattern;
    }

    if (normalizedCountryCode) {
      condition[nested ? "locationCountryCode" : "locationCountryCode"] = normalizedCountryCode;
    } else if (countryPattern) {
      condition[nested ? "locationCountry" : "locationCountry"] = countryPattern;
    }

    if (Object.keys(condition).length === 0) {
      return null;
    }

    if (nested) {
      return {
        locations: {
          $elemMatch: condition,
        },
      } as Filter<ContainerListingDocument>;
    }

    return condition as Filter<ContainerListingDocument>;
  };

  const rootAdministrativeCondition = buildAdministrativeLocationCondition(false);
  const nestedAdministrativeCondition = buildAdministrativeLocationCondition(true);
  const administrativeLocationConditions = [
    rootAdministrativeCondition,
    nestedAdministrativeCondition,
  ].filter((condition): condition is Filter<ContainerListingDocument> => Boolean(condition));

  if (administrativeLocationConditions.length === 1) {
    andConditions.push(administrativeLocationConditions[0]);
  } else if (administrativeLocationConditions.length > 1) {
    andConditions.push({
      $or: administrativeLocationConditions,
    } as Filter<ContainerListingDocument>);
  }

  if (input.q?.trim()) {
    const pattern = new RegExp(escapeRegexPattern(input.q.trim()), "i");
    andConditions.push({
      $or: [
        { companyName: pattern },
        { description: pattern },
        { locationCity: pattern },
        { locationCountry: pattern },
        { "locations.locationCity": pattern },
        { "locations.locationCountry": pattern },
        { "containerColors.ral": pattern },
        { "container.type": pattern } as Filter<ContainerListingDocument>,
        { containerType: pattern },
      ],
    });
  }

  if (andConditions.length === 1) {
    filter.$and = [andConditions[0]];
  } else if (andConditions.length > 1) {
    filter.$and = andConditions;
  }

  return filter;
}

