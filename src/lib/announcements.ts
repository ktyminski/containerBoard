import { ObjectId, type Collection, type Filter, type WithId } from "mongodb";
import type { GeoPoint } from "@/lib/companies";
import {
  type JobAnnouncementPlanTier,
  type JobAnnouncementRequirement,
  type JobContractType,
  type JobEmploymentType,
  type JobRatePeriod,
  type JobWorkLocationMode,
  type JobWorkModel,
} from "@/lib/job-announcement";
import { getDb } from "@/lib/mongodb";
import { escapeRegexPattern } from "@/lib/escape-regex-pattern";

export type JobAnnouncementLocation = {
  mode: JobWorkLocationMode;
  label: string;
  point: GeoPoint;
};

export type JobAnnouncementContactPerson = {
  name: string;
  phone?: string;
  email?: string;
};

export type JobAnnouncementDocument = {
  _id: ObjectId;
  companyId: ObjectId;
  companyName: string;
  companySlug: string;
  title: string;
  description: string;
  workModel: JobWorkModel;
  employmentType: JobEmploymentType;
  contractTypes: JobContractType[];
  salaryRatePeriod: JobRatePeriod;
  salaryFrom?: number;
  salaryTo?: number;
  tags: string[];
  requirements?: JobAnnouncementRequirement[];
  externalLinks: string[];
  contactPersons: JobAnnouncementContactPerson[];
  applicationEmail?: string;
  location: JobAnnouncementLocation;
  branchIndex?: number;
  planTier: JobAnnouncementPlanTier;
  isPublished: boolean;
  createdByUserId: ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export type JobAnnouncementMapItem = {
  id: string;
  companyName: string;
  companySlug: string;
  companyLogoUrl: string | null;
  companyIsPremium: boolean;
  title: string;
  locationLabel: string;
  locationCity?: string;
  locationCountry?: string;
  salaryRatePeriod: JobRatePeriod;
  salaryFrom?: number;
  salaryTo?: number;
  tags: string[];
  planTier: JobAnnouncementPlanTier;
  mainPoint: [number, number];
  isFavorite?: boolean;
};

let indexesReadyPromise: Promise<void> | null = null;

export async function getAnnouncementsCollection(): Promise<Collection<JobAnnouncementDocument>> {
  const db = await getDb();
  return db.collection<JobAnnouncementDocument>("announcements");
}

export async function ensureAnnouncementsIndexes(): Promise<void> {
  if (!indexesReadyPromise) {
    indexesReadyPromise = (async () => {
      const announcements = await getAnnouncementsCollection();
      await announcements.createIndex({ "location.point": "2dsphere" });
      await announcements.createIndex({ companyId: 1, createdAt: -1 });
      await announcements.createIndex({ companyId: 1, isPublished: 1, createdAt: -1 });
      await announcements.createIndex({ isPublished: 1, createdAt: -1 });
      await announcements.createIndex({ tags: 1 });
      await announcements.createIndex({ createdByUserId: 1, createdAt: -1 });
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

export function mapToJobAnnouncementMapItem(
  announcement: WithId<JobAnnouncementDocument>,
  bbox?: [number, number, number, number],
  companyLogoUrl: string | null = null,
  locationMeta?: {
    city?: string | null;
    country?: string | null;
  },
  companyIsPremium = false,
): JobAnnouncementMapItem | null {
  const point = announcement.location?.point?.coordinates;
  if (!point) {
    return null;
  }

  if (bbox && !pointInBbox(point, bbox)) {
    return null;
  }

  return {
    id: announcement._id.toHexString(),
    companyName: announcement.companyName,
    companySlug: announcement.companySlug,
    companyLogoUrl,
    companyIsPremium,
    title: announcement.title,
    locationLabel: announcement.location.label,
    locationCity: locationMeta?.city?.trim() || undefined,
    locationCountry: locationMeta?.country?.trim() || undefined,
    salaryRatePeriod: announcement.salaryRatePeriod,
    salaryFrom: announcement.salaryFrom,
    salaryTo: announcement.salaryTo,
    tags: announcement.tags ?? [],
    planTier: announcement.planTier,
    mainPoint: point,
    isFavorite: false,
  };
}

export function buildAnnouncementsFilter(input: {
  bbox?: [number, number, number, number];
  q?: string;
  tags?: string[];
  contractTypes?: JobContractType[];
  workModels?: JobWorkModel[];
}): Filter<JobAnnouncementDocument> {
  const filter: Filter<JobAnnouncementDocument> = {
    isPublished: true,
  };

  if (input.bbox) {
    const [minLng, minLat, maxLng, maxLat] = input.bbox;
    filter["location.point"] = {
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

  if (input.contractTypes && input.contractTypes.length > 0) {
    filter.contractTypes = { $in: input.contractTypes };
  }

  if (input.workModels && input.workModels.length > 0) {
    filter.workModel = { $in: input.workModels };
  }

  return filter;
}
