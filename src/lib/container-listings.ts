import { ObjectId, type Collection, type Filter } from "mongodb";
import { getDb } from "@/lib/mongodb";
import {
  LISTING_STATUS,
  type ContainerType,
  type DealType,
  type ListingStatus,
  type ListingType,
} from "@/lib/container-listing-types";
import { escapeRegexPattern } from "@/lib/escape-regex-pattern";

export const LISTING_TTL_DAYS = 14;

export type ContainerListingDocument = {
  _id: ObjectId;
  type: ListingType;
  containerType: ContainerType;
  quantity: number;
  locationCity: string;
  locationCountry: string;
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
  containerType: ContainerType;
  quantity: number;
  locationCity: string;
  locationCountry: string;
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

let indexesReadyPromise: Promise<void> | null = null;

function computeExpiresAt(from: Date): Date {
  return new Date(from.getTime() + LISTING_TTL_DAYS * 24 * 60 * 60 * 1000);
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
      await listings.createIndex({ type: 1, containerType: 1, dealType: 1, createdAt: -1 });
      await listings.createIndex({ locationCity: 1, locationCountry: 1 });
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
    containerType: doc.containerType,
    quantity: doc.quantity,
    locationCity: doc.locationCity,
    locationCountry: doc.locationCountry,
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

export function buildContainerListingsFilter(input: {
  q?: string;
  type?: ListingType;
  containerType?: ContainerType;
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

  if (input.containerType) {
    filter.containerType = input.containerType;
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
    filter.$or = [
      { companyName: pattern },
      { description: pattern },
      { locationCity: pattern },
      { locationCountry: pattern },
      { containerType: pattern },
      { dealType: pattern },
    ];
  }

  return filter;
}

