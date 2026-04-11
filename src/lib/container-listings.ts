import { ObjectId, type Collection, type Filter } from "mongodb";
import { getDb } from "@/lib/mongodb";
import type { GeocodeAddressParts } from "@/lib/geocode-address";
import {
  CONTAINER_CONDITIONS,
  CONTAINER_FEATURES,
  CONTAINER_HEIGHTS,
  CONTAINER_SIZES,
  CONTAINER_TYPES,
  LISTING_STATUS,
  type Container,
  type ContainerCondition,
  type ContainerFeature,
  type ContainerHeight,
  type ContainerSize,
  type DealType,
  type ListingStatus,
  type ListingType,
} from "@/lib/container-listing-types";
import { escapeRegexPattern } from "@/lib/escape-regex-pattern";

export const LISTING_TTL_DAYS = 14;

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

const containerSizeSet = new Set<number>(CONTAINER_SIZES);
const containerHeightSet = new Set<string>(CONTAINER_HEIGHTS);
const containerTypeSet = new Set<string>(CONTAINER_TYPES);
const containerFeatureSet = new Set<string>(CONTAINER_FEATURES);
const containerConditionSet = new Set<string>(CONTAINER_CONDITIONS);

export type ContainerListingDocument = {
  _id: ObjectId;
  type: ListingType;
  container?: Container;
  containerType?: string;
  quantity: number;
  locationCity: string;
  locationCountry: string;
  locationLat?: number;
  locationLng?: number;
  locationAddressLabel?: string;
  locationAddressParts?: GeocodeAddressParts;
  availableFrom: Date;
  dealType: DealType;
  price?: string;
  description?: string;
  companyName: string;
  contactEmail: string;
  contactPhone?: string;
  status: ListingStatus;
  createdByUserId: ObjectId;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
};

export type ContainerInquiryDocument = {
  _id: ObjectId;
  listingId: ObjectId;
  buyerName: string;
  buyerEmail: string;
  message: string;
  requestedQuantity?: number;
  offeredPrice?: string;
  createdByUserId?: ObjectId;
  createdAt: Date;
};

export type ContainerListingItem = {
  id: string;
  type: ListingType;
  container: Container;
  quantity: number;
  locationCity: string;
  locationCountry: string;
  locationLat: number | null;
  locationLng: number | null;
  locationAddressLabel?: string;
  locationAddressParts?: GeocodeAddressParts;
  availableFrom: string;
  dealType: DealType;
  price?: string;
  description?: string;
  companyName: string;
  contactEmail: string;
  contactPhone?: string;
  status: ListingStatus;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  isExpired: boolean;
  canRefresh: boolean;
};

export type ContainerListingMapPoint = {
  id: string;
  type: ListingType;
  locationLat: number | null;
  locationLng: number | null;
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

  const size =
    typeof candidate.size === "number" && containerSizeSet.has(candidate.size)
      ? (candidate.size as ContainerSize)
      : null;
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

  if (!size || !height || !type || !condition) {
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

export async function ensureContainerListingsIndexes(): Promise<void> {
  if (!indexesReadyPromise) {
    indexesReadyPromise = (async () => {
      const listings = await getContainerListingsCollection();
      const inquiries = await getContainerInquiriesCollection();

      await listings.createIndex({ status: 1, expiresAt: 1, createdAt: -1 });
      await listings.createIndex({ createdByUserId: 1, createdAt: -1 });
      await listings.createIndex({ type: 1, "container.type": 1, dealType: 1, createdAt: -1 });
      await listings.createIndex({ type: 1, containerType: 1, dealType: 1, createdAt: -1 });
      await listings.createIndex({ "container.size": 1, "container.height": 1, "container.type": 1 });
      await listings.createIndex({ "container.condition": 1 });
      await listings.createIndex({ "container.features": 1 });
      await listings.createIndex({ locationCity: 1, locationCountry: 1 });
      await listings.createIndex({ locationLat: 1, locationLng: 1 });
      await listings.createIndex({ expiresAt: 1 });

      await inquiries.createIndex({ listingId: 1, createdAt: -1 });
      await inquiries.createIndex({ createdByUserId: 1, createdAt: -1 });
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

  return {
    id: doc._id.toHexString(),
    type: doc.type,
    container: resolveContainerFromDocument(doc),
    quantity: doc.quantity,
    locationCity: doc.locationCity,
    locationCountry: doc.locationCountry,
    locationLat:
      typeof doc.locationLat === "number" && Number.isFinite(doc.locationLat)
        ? doc.locationLat
        : null,
    locationLng:
      typeof doc.locationLng === "number" && Number.isFinite(doc.locationLng)
        ? doc.locationLng
        : null,
    locationAddressLabel: doc.locationAddressLabel,
    locationAddressParts: doc.locationAddressParts,
    availableFrom: doc.availableFrom.toISOString(),
    dealType: doc.dealType,
    price: doc.price,
    description: doc.description,
    companyName: doc.companyName,
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

export function mapContainerListingToMapPoint(
  doc: Pick<ContainerListingDocument, "_id" | "type" | "locationLat" | "locationLng">,
): ContainerListingMapPoint {
  return {
    id: doc._id.toHexString(),
    type: doc.type,
    locationLat:
      typeof doc.locationLat === "number" && Number.isFinite(doc.locationLat)
        ? doc.locationLat
        : null,
    locationLng:
      typeof doc.locationLng === "number" && Number.isFinite(doc.locationLng)
        ? doc.locationLng
        : null,
  };
}

export function buildContainerListingsFilter(input: {
  q?: string;
  type?: ListingType;
  containerSize?: ContainerSize;
  containerHeight?: ContainerHeight;
  containerType?: Container["type"];
  containerFeature?: ContainerFeature;
  containerCondition?: ContainerCondition;
  locationLat?: number;
  locationLng?: number;
  radiusKm?: number;
  dealType?: DealType;
  city?: string;
  country?: string;
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

  if (input.containerSize) {
    const sizeConditions: Filter<ContainerListingDocument>[] = [
      { "container.size": input.containerSize } as Filter<ContainerListingDocument>,
    ];
    if (input.containerSize === 20) {
      sizeConditions.push({ containerType: "20DV" });
    } else if (input.containerSize === 40) {
      sizeConditions.push({ containerType: { $in: ["40DV", "40HC", "reefer", "open_top", "flat_rack", "other"] } });
    }
    andConditions.push(sizeConditions.length === 1 ? sizeConditions[0] : { $or: sizeConditions });
  }

  if (input.containerHeight) {
    const heightConditions: Filter<ContainerListingDocument>[] = [
      { "container.height": input.containerHeight } as Filter<ContainerListingDocument>,
    ];
    if (input.containerHeight === "standard") {
      heightConditions.push({ containerType: { $in: ["20DV", "40DV", "reefer", "open_top", "flat_rack", "other"] } });
    } else {
      heightConditions.push({ containerType: "40HC" });
    }
    andConditions.push(heightConditions.length === 1 ? heightConditions[0] : { $or: heightConditions });
  }

  if (input.containerType) {
    const typeConditions: Filter<ContainerListingDocument>[] = [
      { "container.type": input.containerType } as Filter<ContainerListingDocument>,
    ];
    if (input.containerType === "dry") {
      typeConditions.push({ containerType: { $in: ["20DV", "40DV", "40HC", "other"] } });
    } else if (["reefer", "open_top", "flat_rack"].includes(input.containerType)) {
      typeConditions.push({ containerType: input.containerType });
    }
    andConditions.push(typeConditions.length === 1 ? typeConditions[0] : { $or: typeConditions });
  }

  if (input.containerFeature) {
    andConditions.push({ "container.features": input.containerFeature } as Filter<ContainerListingDocument>);
  }

  if (input.containerCondition) {
    andConditions.push({ "container.condition": input.containerCondition } as Filter<ContainerListingDocument>);
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
      locationLat: { $gte: minLat, $lte: maxLat },
      locationLng: { $gte: minLng, $lte: maxLng },
    } as Filter<ContainerListingDocument>);
  }

  if (input.dealType) {
    filter.dealType = input.dealType;
  }

  if (input.city?.trim()) {
    filter.locationCity = {
      $regex: new RegExp(`^${escapeRegexPattern(input.city.trim())}$`, "i"),
    };
  }

  if (input.country?.trim()) {
    filter.locationCountry = {
      $regex: new RegExp(`^${escapeRegexPattern(input.country.trim())}$`, "i"),
    };
  }

  if (input.q?.trim()) {
    const pattern = new RegExp(escapeRegexPattern(input.q.trim()), "i");
    andConditions.push({
      $or: [
        { companyName: pattern },
        { description: pattern },
        { locationCity: pattern },
        { locationCountry: pattern },
        { "container.type": pattern } as Filter<ContainerListingDocument>,
        { containerType: pattern },
        { dealType: pattern },
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
