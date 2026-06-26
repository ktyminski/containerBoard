import { ObjectId, type Filter } from "mongodb";
import {
  buildContainerListingsFilter,
  ensureContainerListingsIndexes,
  expireContainerListingsIfNeeded,
  getContainerListingsCollection,
  getListingBumpedAtSortExpression,
  mapContainerListingToItem,
  type ContainerListingDocument,
  type ContainerListingItem,
} from "@/lib/container-listings";
import { getCompaniesCollection, type CompanyDocument } from "@/lib/companies";
import { normalizeCompanyVerificationStatus } from "@/lib/company-verification";
import type { ContainerSize, Currency } from "@/lib/container-listing-types";
import {
  buildContainersApiUrl,
  getSortParams,
  parseContainerListingsPageFilters,
} from "@/components/container-listings-utils";

const PUBLIC_LIST_PAGE_SIZE = 20;

type CompanyProfileByOwner = {
  slug: string;
  name: string;
  isVerified: boolean;
};

type CompanyProfilesForListings = {
  byOwnerUserId: Map<string, CompanyProfileByOwner>;
  bySlug: Map<string, CompanyProfileByOwner>;
};

export type PublicContainerListingsInitialData = {
  requestUrl: string;
  items: ContainerListingItem[];
  page: number;
  total: number;
  totalPages: number;
};

function parseOptionalNumber(value: string): number | undefined {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) {
    return undefined;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseOptionalYear(value: string): number | undefined {
  const parsed = Number(value.trim());
  if (!Number.isInteger(parsed) || parsed < 1900 || parsed > 2100) {
    return undefined;
  }
  return parsed;
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
  if (!profile || !isSameCompanyName(input.row.companyName, profile.name)) {
    return undefined;
  }

  return profile.slug;
}

async function getCompanyProfilesForListings(
  rows: ContainerListingDocument[],
): Promise<CompanyProfilesForListings> {
  const ownerUserIds = Array.from(
    new Set(rows.map((row) => row.createdByUserId?.toHexString()).filter(Boolean)),
  ).filter((value): value is string => Boolean(value) && ObjectId.isValid(value));
  const companySlugs = Array.from(
    new Set(rows.map((row) => row.companySlug?.trim()).filter(Boolean)),
  ).filter((value): value is string => Boolean(value));

  const emptyProfiles: CompanyProfilesForListings = {
    byOwnerUserId: new Map<string, CompanyProfileByOwner>(),
    bySlug: new Map<string, CompanyProfileByOwner>(),
  };
  const profileFilters: Filter<CompanyDocument>[] = [];
  if (ownerUserIds.length > 0) {
    profileFilters.push({
      createdByUserId: { $in: ownerUserIds.map((value) => new ObjectId(value)) },
    });
  }
  if (companySlugs.length > 0) {
    profileFilters.push({ slug: { $in: companySlugs } });
  }
  if (profileFilters.length === 0) {
    return emptyProfiles;
  }

  const companies = await getCompaniesCollection();
  const companyRows = await companies
    .find(
      {
        $or: profileFilters,
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
  const bySlug = new Map<string, CompanyProfileByOwner>();
  for (const company of companyRows) {
    const slug = company.slug?.trim();
    const name = company.name?.trim();
    if (!slug || !name) {
      continue;
    }

    const profile = {
      slug,
      name,
      isVerified:
        normalizeCompanyVerificationStatus(company.verificationStatus) === "verified",
    };
    if (!bySlug.has(slug)) {
      bySlug.set(slug, profile);
    }

    const ownerUserId = company.createdByUserId?.toHexString();
    if (ownerUserId && !byOwnerUserId.has(ownerUserId)) {
      byOwnerUserId.set(ownerUserId, profile);
    }
  }

  return { byOwnerUserId, bySlug };
}

function mapRowsToPublicItems(
  rows: ContainerListingDocument[],
  companyProfiles: CompanyProfilesForListings,
): ContainerListingItem[] {
  return rows.map((row) => {
    const mapped = mapContainerListingToItem(row);
    const ownerUserId = row.createdByUserId?.toHexString();
    const ownerProfile = ownerUserId
      ? companyProfiles.byOwnerUserId.get(ownerUserId)
      : undefined;
    const companySlug = resolveListingCompanySlug({
      row,
      item: mapped,
      byOwnerUserId: companyProfiles.byOwnerUserId,
    });
    const slugProfile = companySlug ? companyProfiles.bySlug.get(companySlug) : undefined;
    let companyIsVerified = mapped.companyIsVerified;
    if (slugProfile) {
      companyIsVerified = slugProfile.isVerified;
    } else if (
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
    };
  });
}

async function getPagedRows(input: {
  filter: Filter<ContainerListingDocument>;
  sortBy: "createdAt" | "availableFrom" | "expiresAt" | "quantity" | "priceNet";
  sort: Record<string, 1 | -1>;
  sortDirection: 1 | -1;
  priceCurrency: Currency;
}): Promise<ContainerListingDocument[]> {
  const listings = await getContainerListingsCollection();
  if (input.sortBy === "createdAt") {
    return listings
      .aggregate<ContainerListingDocument>([
        { $match: input.filter },
        {
          $addFields: {
            __sortBumpedAt: getListingBumpedAtSortExpression(),
          },
        },
        {
          $sort: {
            __sortBumpedAt: input.sortDirection,
            createdAt: input.sortDirection,
          },
        },
        { $limit: PUBLIC_LIST_PAGE_SIZE },
        { $project: { __sortBumpedAt: 0 } },
      ])
      .toArray();
  }

  if (input.sortBy === "priceNet") {
    const sortPriceField = getPriceNetFieldForCurrency(input.priceCurrency);
    return listings
      .aggregate<ContainerListingDocument>([
        { $match: input.filter },
        {
          $addFields: {
            __sortPriceMissing: getPriceMissingSortExpression(sortPriceField),
            __sortPriceValue: getPriceSortValueExpression(sortPriceField),
            __sortBumpedAt: getListingBumpedAtSortExpression(),
          },
        },
        {
          $sort: {
            __sortPriceMissing: 1,
            __sortPriceValue: input.sortDirection,
            __sortBumpedAt: -1,
            createdAt: -1,
          },
        },
        { $limit: PUBLIC_LIST_PAGE_SIZE },
        { $project: { __sortPriceMissing: 0, __sortPriceValue: 0, __sortBumpedAt: 0 } },
      ])
      .toArray();
  }

  return listings
    .find(input.filter)
    .sort(input.sort)
    .limit(PUBLIC_LIST_PAGE_SIZE)
    .toArray();
}

export async function getPublicContainerListingsInitialData(input: {
  params: URLSearchParams;
  companySlug?: string;
}): Promise<PublicContainerListingsInitialData> {
  const parsed = parseContainerListingsPageFilters(input.params);
  const appliedFilters = parsed.appliedFilters;
  const hasPriceRange =
    appliedFilters.priceMinInput.trim().length > 0 ||
    appliedFilters.priceMaxInput.trim().length > 0;
  const priceCurrency =
    appliedFilters.priceCurrency === "all" ? "PLN" : appliedFilters.priceCurrency;
  const resolvedSortParams = getSortParams(appliedFilters.sortPreset);
  const shouldForceCreatedAtSort =
    resolvedSortParams.sortBy === "priceNet" &&
    (!hasPriceRange || appliedFilters.priceCurrency === "all");
  const { sortBy, sortDir } = shouldForceCreatedAtSort
    ? { sortBy: "createdAt", sortDir: "desc" as const }
    : resolvedSortParams;
  const sortField =
    sortBy === "priceNet" ? getPriceNetFieldForCurrency(priceCurrency) : sortBy;
  const sortDirection = sortDir === "asc" ? 1 : -1;
  const sort: Record<string, 1 | -1> = { [sortField]: sortDirection };
  if (sortField !== "createdAt") {
    sort.bumpedAt = -1;
    sort.createdAt = -1;
  }

  let companyFilterSlug = input.companySlug?.trim() || undefined;
  let companyFilterName: string | undefined;
  if (companyFilterSlug) {
    const companies = await getCompaniesCollection();
    const companyRecord = await companies.findOne(
      { slug: companyFilterSlug, isBlocked: { $ne: true } },
      { projection: { slug: 1, name: 1 } },
    );
    if (companyRecord?.slug?.trim()) {
      companyFilterSlug = companyRecord.slug.trim();
      companyFilterName = companyRecord.name?.trim() || undefined;
    } else {
      companyFilterSlug = "__no_company_match__";
    }
  }

  const standardContainerSizes = appliedFilters.containerSizes
    .filter((value) => value !== "custom")
    .map((value) => Number(value) as ContainerSize);
  const filter = buildContainerListingsFilter({
    q:
      !appliedFilters.locationCenter &&
      !appliedFilters.city &&
      !appliedFilters.country &&
      !appliedFilters.countryCode
        ? appliedFilters.locationQuery
        : undefined,
    type: appliedFilters.listingKind,
    companySlug: companyFilterSlug,
    companyName: companyFilterName,
    containerSizes: standardContainerSizes.length > 0 ? standardContainerSizes : undefined,
    includeCustomContainerSize: appliedFilters.containerSizes.includes("custom"),
    containerHeights:
      appliedFilters.containerHeights.length > 0 ? appliedFilters.containerHeights : undefined,
    containerTypes:
      appliedFilters.containerTypes.length > 0 ? appliedFilters.containerTypes : undefined,
    containerFeatures:
      appliedFilters.containerFeatures.length > 0 ? appliedFilters.containerFeatures : undefined,
    containerConditions:
      appliedFilters.containerConditions.length > 0
        ? appliedFilters.containerConditions
        : undefined,
    containerRalColors:
      appliedFilters.containerRalColors.length > 0
        ? appliedFilters.containerRalColors
        : undefined,
    priceMin: parseOptionalNumber(appliedFilters.priceMinInput),
    priceMax: parseOptionalNumber(appliedFilters.priceMaxInput),
    priceCurrency: hasPriceRange ? priceCurrency : undefined,
    priceTaxMode: appliedFilters.priceTaxMode,
    productionYear: parseOptionalYear(appliedFilters.productionYearInput),
    priceNegotiable: appliedFilters.priceNegotiableOnly ? true : undefined,
    logisticsTransportAvailable: appliedFilters.logisticsTransportOnly ? true : undefined,
    logisticsUnloadingAvailable: appliedFilters.logisticsUnloadingOnly ? true : undefined,
    hasCscPlate: appliedFilters.hasCscPlateOnly ? true : undefined,
    hasCscCertification: appliedFilters.hasCscCertificationOnly ? true : undefined,
    locationLat: appliedFilters.locationCenter?.lat,
    locationLng: appliedFilters.locationCenter?.lng,
    radiusKm: Number(appliedFilters.locationRadiusKm),
    city: appliedFilters.city || undefined,
    country: appliedFilters.country || undefined,
    countryCode: appliedFilters.countryCode || undefined,
    includeOnlyPublic: true,
  });

  await ensureContainerListingsIndexes();
  await expireContainerListingsIfNeeded();

  const listings = await getContainerListingsCollection();
  const typedFilter = filter as Filter<ContainerListingDocument>;
  const [total, rows] = await Promise.all([
    listings.countDocuments(typedFilter),
    getPagedRows({
      filter: typedFilter,
      sortBy: sortBy as "createdAt" | "availableFrom" | "expiresAt" | "quantity" | "priceNet",
      sort,
      sortDirection,
      priceCurrency,
    }),
  ]);
  const companyProfiles = await getCompanyProfilesForListings(rows);

  return {
    requestUrl: buildContainersApiUrl({
      appliedFilters,
      page: 1,
      pageSize: PUBLIC_LIST_PAGE_SIZE,
      companySlug: companyFilterSlug,
    }),
    items: mapRowsToPublicItems(rows, companyProfiles),
    page: 1,
    total,
    totalPages: Math.max(1, Math.ceil(total / PUBLIC_LIST_PAGE_SIZE)),
  };
}
