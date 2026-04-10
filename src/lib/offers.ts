import { ObjectId, type Collection, type Filter, type WithId } from "mongodb";
import type { GeoPoint } from "@/lib/companies";
import { escapeRegexPattern } from "@/lib/escape-regex-pattern";
import { getDb } from "@/lib/mongodb";
import { normalizeOfferType, type OfferType } from "@/lib/offer-type";

export type OfferDocument = {
  _id: ObjectId;
  companyId: ObjectId;
  companyName: string;
  companySlug: string;
  offerType: OfferType;
  title: string;
  description: string;
  tags: string[];
  externalLinks: string[];
  contactEmails: string[];
  contactPhones: string[];
  locationLabel: string;
  point: GeoPoint;
  isPublished: boolean;
  createdByUserId: ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export type OfferMapItem = {
  id: string;
  companyName: string;
  companySlug: string;
  companyLogoUrl: string | null;
  companyIsPremium: boolean;
  offerType: OfferType;
  title: string;
  locationLabel: string;
  locationCity?: string;
  locationCountry?: string;
  tags: string[];
  mainPoint: [number, number];
};

let indexesReadyPromise: Promise<void> | null = null;

export async function getOffersCollection(): Promise<Collection<OfferDocument>> {
  const db = await getDb();
  return db.collection<OfferDocument>("offers");
}

export async function ensureOffersIndexes(): Promise<void> {
  if (!indexesReadyPromise) {
    indexesReadyPromise = (async () => {
      const offers = await getOffersCollection();
      await offers.createIndex({ point: "2dsphere" });
      await offers.createIndex({ companyId: 1, createdAt: -1 });
      await offers.createIndex({ companyId: 1, isPublished: 1, createdAt: -1 });
      await offers.createIndex({ offerType: 1, createdAt: -1 });
      await offers.createIndex({ isPublished: 1, createdAt: -1 });
      await offers.createIndex({ tags: 1 });
      await offers.createIndex({ createdByUserId: 1, createdAt: -1 });
    })();
  }

  return indexesReadyPromise;
}

function pointInBbox(
  point: [number, number],
  bbox: [number, number, number, number],
): boolean {
  const [lng, lat] = point;
  const [minLng, minLat, maxLng, maxLat] = bbox;
  return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat;
}

export function mapToOfferMapItem(
  offer: WithId<OfferDocument>,
  bbox?: [number, number, number, number],
  companyLogoUrl: string | null = null,
  locationMeta?: {
    city?: string | null;
    country?: string | null;
  },
  companyIsPremium = false,
): OfferMapItem | null {
  const point = offer.point?.coordinates;
  if (!point) {
    return null;
  }

  if (bbox && !pointInBbox(point, bbox)) {
    return null;
  }

  return {
    id: offer._id.toHexString(),
    companyName: offer.companyName,
    companySlug: offer.companySlug,
    companyLogoUrl,
    companyIsPremium,
    offerType: normalizeOfferType(offer.offerType),
    title: offer.title,
    locationLabel: offer.locationLabel,
    locationCity: locationMeta?.city?.trim() || undefined,
    locationCountry: locationMeta?.country?.trim() || undefined,
    tags: offer.tags ?? [],
    mainPoint: point,
  };
}

export function buildOffersFilter(input: {
  bbox?: [number, number, number, number];
  q?: string;
  tags?: string[];
}): Filter<OfferDocument> {
  const filter: Filter<OfferDocument> = {
    isPublished: true,
  };

  if (input.bbox) {
    const [minLng, minLat, maxLng, maxLat] = input.bbox;
    filter.point = {
      $geoWithin: {
        $geometry: {
          type: "Polygon",
          coordinates: [
            [
              [minLng, minLat],
              [maxLng, minLat],
              [maxLng, maxLat],
              [minLng, maxLat],
              [minLng, minLat],
            ],
          ],
        },
      },
    };
  }

  if (input.q) {
    const search = new RegExp(escapeRegexPattern(input.q), "i");
    filter.$or = [{ title: search }, { description: search }, { companyName: search }];
  }

  if (input.tags && input.tags.length > 0) {
    filter.tags = { $all: input.tags };
  }

  return filter;
}
