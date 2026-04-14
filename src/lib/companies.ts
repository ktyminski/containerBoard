import { Binary, ObjectId, type Collection, type Filter, type WithId } from "mongodb";
import {
  normalizeCompanyVerificationStatus,
  type CompanyVerificationStatus,
} from "@/lib/company-verification";
import { escapeRegexPattern } from "@/lib/escape-regex-pattern";
import { getDb } from "@/lib/mongodb";
import { logWarn } from "@/lib/server-logger";
import type { CompanyBenefit } from "@/lib/company-benefits";
import {
  COMPANY_OPERATING_AREA,
  normalizeCompanyOperatingArea,
  type CompanyOperatingArea,
} from "@/lib/company-operating-area";
import type { GeocodeAddressParts } from "@/lib/geocode-address";
import type { CompanyMapItem } from "@/types/company";
import type { CompanyCommunicationLanguage } from "@/types/company-communication-language";
import {
  normalizeCompanySpecializations,
  type CompanySpecialization,
} from "@/types/company-specialization";

export type GeoPoint = {
  type: "Point";
  coordinates: [number, number];
};

export type CompanyImageAsset = {
  filename: string;
  contentType: string;
  size: number;
  width?: number;
  height?: number;
  data?: Binary;
  blobUrl?: string;
};

export type CompanyDeletionRequest = {
  isRequested: boolean;
  reason: string;
  requestedAt: Date;
  requestedByUserId: ObjectId;
};

export type CompanyLocation = {
  label: string;
  addressText: string;
  addressParts?: GeocodeAddressParts;
  phone?: string;
  email?: string;
  photos?: CompanyImageAsset[];
  point: GeoPoint;
};

export type CompanyDocument = {
  _id: ObjectId;
  name: string;
  slug: string;
  description: string;
  nip?: string;
  verificationStatus?: CompanyVerificationStatus;
  isBlocked?: boolean;
  isPremium?: boolean;
  deletionRequest?: CompanyDeletionRequest;
  website?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  linkedinUrl?: string;
  email?: string;
  phone?: string;
  logo?: CompanyImageAsset;
  logoThumb?: CompanyImageAsset;
  background?: CompanyImageAsset;
  // Legacy single-value field kept for backward compatibility in reads/filters.
  communicationLanguage?: CompanyCommunicationLanguage;
  communicationLanguages?: CompanyCommunicationLanguage[];
  tags: string[];
  services: string[];
  specializations?: CompanySpecialization[];
  benefits?: CompanyBenefit[];
  operatingArea?: CompanyOperatingArea;
  operatingAreaDetails?: string;
  locations: CompanyLocation[];
  createdByUserId?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

let indexesReadyPromise: Promise<void> | null = null;

function isDiskSpaceIndexError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return /available disk space .* required minimum/i.test(error.message);
}

async function createCompanyIndex(
  companies: Collection<CompanyDocument>,
  indexSpec: Record<string, 1 | -1 | "2dsphere">,
  options?: { unique?: boolean },
): Promise<void> {
  try {
    await companies.createIndex(indexSpec, options);
  } catch (error) {
    if (!isDiskSpaceIndexError(error)) {
      throw error;
    }

    logWarn("Skipping companies index creation due to low disk space", {
      indexSpec,
      options,
      error,
    });
  }
}

export async function getCompaniesCollection(): Promise<Collection<CompanyDocument>> {
  const db = await getDb();
  return db.collection<CompanyDocument>("companies");
}

export async function ensureCompaniesIndexes(): Promise<void> {
  if (!indexesReadyPromise) {
    indexesReadyPromise = (async () => {
      const companies = await getCompaniesCollection();
      await createCompanyIndex(companies, { "locations.point": "2dsphere" });
      await createCompanyIndex(companies, { slug: 1 }, { unique: true });
      await createCompanyIndex(companies, { tags: 1 });
      await createCompanyIndex(companies, { specializations: 1 });
      await createCompanyIndex(companies, { communicationLanguages: 1 });
      await createCompanyIndex(companies, { createdByUserId: 1, createdAt: -1 });
      await createCompanyIndex(companies, { isBlocked: 1 });
      await createCompanyIndex(companies, { "deletionRequest.isRequested": 1, updatedAt: -1 });
      await createCompanyIndex(companies, { verificationStatus: 1, createdAt: -1 });
      await createCompanyIndex(companies, {
        isPremium: -1,
        verificationStatus: -1,
        createdAt: -1,
      });
      await companies.updateMany(
        { photos: { $exists: true } },
        { $unset: { photos: "" } },
      );
      await companies.updateMany(
        { "locations.note": { $exists: true } },
        { $unset: { "locations.$[].note": "" } },
      );
      await companies.updateMany(
        { category: { $exists: true } },
        {
          $unset: {
            category: "",
          },
        },
      );
      await companies.updateMany(
        { "locations.category": { $exists: true } },
        {
          $unset: {
            "locations.$[].category": "",
          },
        },
      );
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

function isValidPoint(point: unknown): point is [number, number] {
  if (!Array.isArray(point) || point.length !== 2) {
    return false;
  }

  const [lng, lat] = point;
  if (typeof lng !== "number" || !Number.isFinite(lng)) {
    return false;
  }
  if (typeof lat !== "number" || !Number.isFinite(lat)) {
    return false;
  }

  return lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
}

export function mapToCompanyMapItem(
  company: WithId<CompanyDocument>,
  bbox?: [number, number, number, number],
): CompanyMapItem | null {
  const locationsWithValidPoint = company.locations.filter((location) =>
    isValidPoint(location.point?.coordinates),
  );
  if (locationsWithValidPoint.length === 0) {
    return null;
  }

  const companyId = company._id.toHexString();
  const mainLocation = locationsWithValidPoint[0];
  const selectedLocation =
    bbox === undefined
      ? mainLocation
      : locationsWithValidPoint.find((location) =>
          pointInBbox(location.point.coordinates, bbox),
        ) ?? mainLocation;
  const locationCity = selectedLocation.addressParts?.city?.trim();
  const mapPoints = locationsWithValidPoint.map((location, index) => ({
    id: `${companyId}:${index}`,
    coordinates: location.point.coordinates,
    label: location.label?.trim() || undefined,
    isMain: index === 0,
  }));

  return {
    id: companyId,
    name: company.name,
    slug: company.slug,
    isPremium: company.isPremium === true,
    locationCity: locationCity || undefined,
    communicationLanguages:
      company.communicationLanguages ??
      (company.communicationLanguage ? [company.communicationLanguage] : undefined),
    verificationStatus: normalizeCompanyVerificationStatus(company.verificationStatus),
    logoUrl:
      company.logo?.size || company.logo?.filename
        ? `/api/companies/${companyId}/logo?variant=thumb${
            company.updatedAt instanceof Date ? `&v=${company.updatedAt.getTime()}` : ""
          }`
        : null,
    tags: company.tags ?? [],
    operatingArea: normalizeCompanyOperatingArea(company.operatingArea),
    specializations: normalizeCompanySpecializations(company.specializations ?? []),
    mainPoint: mainLocation.point.coordinates,
    mapPoints,
    locationCount: company.locations.length,
  };
}

export function buildCompaniesFilter(input: {
  bbox?: [number, number, number, number];
  q?: string;
  tags?: string[];
  operatingAreas?: CompanyOperatingArea[];
  communicationLanguages?: CompanyCommunicationLanguage[];
  specializations?: CompanySpecialization[];
}): Filter<CompanyDocument> {
  const filter: Filter<CompanyDocument> = {
    isBlocked: { $ne: true },
  };

  if (input.bbox) {
    const [minLng, minLat, maxLng, maxLat] = input.bbox;
    filter.locations = {
      $elemMatch: {
        point: {
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
        },
      },
    };
  }

  if (input.q) {
    const search = new RegExp(escapeRegexPattern(input.q), "i");
    filter.$or = [{ name: search }, { description: search }];
  }

  if (input.operatingAreas && input.operatingAreas.length > 0) {
    const areaSet = new Set(input.operatingAreas);
    const includeLegacyLocal = areaSet.has(COMPANY_OPERATING_AREA.LOCAL);
    const explicitAreas = Array.from(areaSet.values());
    const areaCondition: Filter<CompanyDocument> = includeLegacyLocal
      ? {
          $or: [
            { operatingArea: { $in: explicitAreas } },
            { operatingArea: { $exists: false } },
          ],
        }
      : {
          operatingArea: { $in: explicitAreas },
        };

    if (filter.$or) {
      const keywordOr = filter.$or;
      delete filter.$or;
      filter.$and = [{ $or: keywordOr }, areaCondition];
    } else if ("$or" in areaCondition) {
      filter.$or = areaCondition.$or;
    } else {
      filter.operatingArea = areaCondition.operatingArea;
    }
  }

  if (input.tags && input.tags.length > 0) {
    filter.tags = { $all: input.tags };
  }

  if (input.communicationLanguages && input.communicationLanguages.length > 0) {
    const languageCondition: Filter<CompanyDocument> = {
      $or: [
        { communicationLanguages: { $in: input.communicationLanguages } },
        { communicationLanguage: { $in: input.communicationLanguages } },
      ],
    };

    if (filter.$and) {
      filter.$and = [...filter.$and, languageCondition];
    } else if (filter.$or) {
      const currentOr = filter.$or;
      delete filter.$or;
      filter.$and = [{ $or: currentOr }, languageCondition];
    } else if ("$or" in languageCondition) {
      filter.$or = languageCondition.$or;
    }
  }

  if (input.specializations && input.specializations.length > 0) {
    filter.specializations = { $in: input.specializations };
  }

  return filter;
}
