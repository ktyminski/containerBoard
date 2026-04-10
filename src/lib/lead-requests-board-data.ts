import { getCurrentUserFromToken } from "@/lib/auth-user";
import { getCompaniesCollection } from "@/lib/companies";
import {
  getLeadRequestsCollection,
} from "@/lib/lead-requests";
import type { LeadRequestDocument } from "@/lib/lead-requests";
import { getLeadRequestCreationLimitState } from "@/lib/lead-request-creation-limit";
import { COMPANY_VERIFICATION_STATUS } from "@/lib/company-verification";
import {
  LEAD_REQUEST_STATUS,
  LEAD_REQUEST_TRANSPORT_MODE,
  type LeadRequestStatus,
  type LeadRequestTransportMode,
  type LeadRequestType,
} from "@/lib/lead-request-types";
import type { AppLocale } from "@/lib/i18n";
import { getTurnstileSiteKey } from "@/lib/turnstile";
import { USER_ROLE } from "@/lib/user-roles";
import type { Filter, ObjectId } from "mongodb";

export type LeadRequestsBoardTab = "all" | "mine";
export type LeadRequestsSortOrder = "newest" | "oldest";

type LeadRequestBoardItem = {
  id: string;
  leadType: LeadRequestType;
  transportMode: LeadRequestTransportMode;
  originLocation: string;
  originCountryCode: string | null;
  destinationLocation: string;
  destinationCountryCode: string | null;
  status: LeadRequestStatus;
  description: string;
  contactEmail: string | null;
  contactPhone: string | null;
  createdAtIso: string;
  expiresAtIso: string | null;
  isExpired: boolean;
};

export type LeadRequestCountryOption = {
  value: string;
  label: string;
};

export type LeadRequestsBoardData = {
  isLoggedIn: boolean;
  currentUserEmail: string;
  turnstileSiteKey: string | null;
  creationLimit: {
    isLimited: boolean;
    limit: number;
    windowHours: number;
  } | null;
  isBlocked: boolean;
  isEmailVerified: boolean;
  canManageRequests: boolean;
  canSeeContact: boolean;
  initialAllPage: LeadRequestsPageData;
  initialMyPage: LeadRequestsPageData;
  countryOptions: LeadRequestCountryOption[];
  intlLocale: string;
};

export type LeadRequestsQueryFilters = {
  keyword?: string;
  transportModes?: LeadRequestTransportMode[];
  originCountries?: string[];
  destinationCountries?: string[];
};

export type LeadRequestsPageData = {
  items: LeadRequestBoardItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

function toIntlLocale(locale: AppLocale): string {
  if (locale === "en") {
    return "en-US";
  }
  if (locale === "de") {
    return "de-DE";
  }
  if (locale === "uk") {
    return "uk-UA";
  }
  return "pl-PL";
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildLeadRequestItem(
  row: LeadRequestDocument,
  input: {
    canSeeContact: boolean;
    now: Date;
  },
): LeadRequestBoardItem {
  const isExpired =
    row.status === LEAD_REQUEST_STATUS.EXPIRED ||
    Boolean(row.expiresAt && row.expiresAt <= input.now);

  return {
    id: row._id.toHexString(),
    leadType: row.leadType,
    transportMode: row.transportMode ?? LEAD_REQUEST_TRANSPORT_MODE.ANY,
    originLocation: row.originLocation ?? "",
    originCountryCode: row.originCountryCode ?? null,
    destinationLocation: row.destinationLocation ?? "",
    destinationCountryCode: row.destinationCountryCode ?? null,
    status: isExpired ? LEAD_REQUEST_STATUS.EXPIRED : row.status,
    description: row.description,
    contactEmail: input.canSeeContact ? row.contactEmail ?? null : null,
    contactPhone: input.canSeeContact ? row.contactPhone ?? null : null,
    createdAtIso: row.createdAt.toISOString(),
    expiresAtIso: row.expiresAt ? row.expiresAt.toISOString() : null,
    isExpired,
  };
}

function buildLeadRequestsQuery(input: {
  scope: LeadRequestsBoardTab;
  userId?: ObjectId | null;
  filters?: LeadRequestsQueryFilters;
  now: Date;
}): Filter<LeadRequestDocument> {
  const conditions: Filter<LeadRequestDocument>[] = [];

  if (input.scope === "mine") {
    if (!input.userId) {
      return { _id: { $exists: false } };
    }
    conditions.push({ createdByUserId: input.userId });
  } else {
    conditions.push({
      status: {
        $in: [LEAD_REQUEST_STATUS.ACTIVE, LEAD_REQUEST_STATUS.PENDING],
      },
    });
    conditions.push({
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: { $gt: input.now } },
      ],
    });
  }

  const keyword = input.filters?.keyword?.trim();
  if (keyword) {
    const pattern = new RegExp(escapeRegExp(keyword), "i");
    conditions.push({
      $or: [
        { description: pattern },
        { originLocation: pattern },
        { destinationLocation: pattern },
        { originCountryCode: pattern },
        { destinationCountryCode: pattern },
      ],
    });
  }

  if (input.filters?.transportModes?.length) {
    conditions.push({
      transportMode: { $in: input.filters.transportModes },
    });
  }
  if (input.filters?.originCountries?.length) {
    conditions.push({
      originCountryCode: { $in: input.filters.originCountries },
    });
  }
  if (input.filters?.destinationCountries?.length) {
    conditions.push({
      destinationCountryCode: { $in: input.filters.destinationCountries },
    });
  }

  if (conditions.length === 0) {
    return {};
  }
  if (conditions.length === 1) {
    return conditions[0];
  }
  return { $and: conditions };
}

async function getLeadRequestCountryOptions(input: {
  locale: AppLocale;
  now: Date;
}): Promise<LeadRequestCountryOption[]> {
  const leadRequests = await getLeadRequestsCollection();
  const query = buildLeadRequestsQuery({
    scope: "all",
    now: input.now,
  });
  const [originCountries, destinationCountries] = await Promise.all([
    leadRequests.distinct("originCountryCode", query),
    leadRequests.distinct("destinationCountryCode", query),
  ]);
  const displayNames = new Intl.DisplayNames([toIntlLocale(input.locale)], {
    type: "region",
  });
  const codes = Array.from(
    new Set(
      [...originCountries, ...destinationCountries]
        .map((value) => value?.trim().toUpperCase())
        .filter((value): value is string => Boolean(value && /^[A-Z]{2}$/.test(value))),
    ),
  );

  return codes
    .map((value) => ({
      value,
      label: `${value} - ${displayNames.of(value) ?? value}`,
    }))
    .sort((left, right) => left.label.localeCompare(right.label, toIntlLocale(input.locale)));
}

export async function getLeadRequestsPageData(input: {
  scope: LeadRequestsBoardTab;
  userId?: ObjectId | null;
  canSeeContact: boolean;
  page: number;
  pageSize: number;
  sortOrder: LeadRequestsSortOrder;
  filters?: LeadRequestsQueryFilters;
  now?: Date;
}): Promise<LeadRequestsPageData> {
  const now = input.now ?? new Date();
  const leadRequests = await getLeadRequestsCollection();
  const query = buildLeadRequestsQuery({
    scope: input.scope,
    userId: input.userId,
    filters: input.filters,
    now,
  });
  const page = Math.max(1, input.page);
  const pageSize = Math.max(1, Math.min(100, input.pageSize));
  const totalCount = await leadRequests.countDocuments(query);
  const rows =
    totalCount > 0
      ? await leadRequests
          .find(query, {
            projection: {
              _id: 1,
              leadType: 1,
              transportMode: 1,
              originLocation: 1,
              originCountryCode: 1,
              destinationLocation: 1,
              destinationCountryCode: 1,
              description: 1,
              contactEmail: 1,
              contactPhone: 1,
              status: 1,
              createdAt: 1,
              expiresAt: 1,
            },
            sort: { createdAt: input.sortOrder === "newest" ? -1 : 1 },
            skip: (page - 1) * pageSize,
            limit: pageSize,
          })
          .toArray()
      : [];

  return {
    items: rows.map((row) =>
      buildLeadRequestItem(row, {
        canSeeContact: input.canSeeContact,
        now,
      }),
    ),
    totalCount,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
  };
}

export async function getLeadRequestsBoardData(input: {
  token?: string;
  locale: AppLocale;
}): Promise<LeadRequestsBoardData> {
  const currentUser = input.token ? await getCurrentUserFromToken(input.token) : null;
  const hasVerifiedOwnedCompany = currentUser?._id
    ? await getCompaniesCollection()
        .then((companies) =>
          companies.findOne(
            {
              createdByUserId: currentUser._id,
              verificationStatus: COMPANY_VERIFICATION_STATUS.VERIFIED,
            },
            { projection: { _id: 1 } },
          ),
        )
        .then((row) => Boolean(row))
    : false;
  const canSeeContact =
    Boolean(currentUser?._id) &&
    (currentUser?.role === USER_ROLE.ADMIN || hasVerifiedOwnedCompany);
  const canManageRequests =
    Boolean(currentUser?._id) &&
    currentUser?.isBlocked !== true;
  const isEmailVerified =
    Boolean(currentUser?._id) &&
    (currentUser?.authProvider !== "local" || currentUser?.isEmailVerified !== false);
  const now = new Date();

  const leadRequests = await getLeadRequestsCollection();
  const creationLimit = currentUser?._id
    ? await getLeadRequestCreationLimitState({
        leadRequests,
        userId: currentUser._id,
        now,
      })
    : null;
  const allPage = await getLeadRequestsPageData({
    scope: "all",
    canSeeContact,
    page: 1,
    pageSize: 20,
    sortOrder: "newest",
    now,
  });
  const myPage = currentUser?._id
    ? await getLeadRequestsPageData({
        scope: "mine",
        userId: currentUser._id,
        canSeeContact: true,
        page: 1,
        pageSize: 20,
        sortOrder: "newest",
        now,
      })
    : { items: [], totalCount: 0, page: 1, pageSize: 20, totalPages: 1 };
  const countryOptions = await getLeadRequestCountryOptions({
    locale: input.locale,
    now,
  });

  return {
    isLoggedIn: Boolean(currentUser?._id),
    currentUserEmail: currentUser?.email ?? "",
    turnstileSiteKey: getTurnstileSiteKey(),
    creationLimit: creationLimit
      ? {
          isLimited: creationLimit.isLimited,
          limit: creationLimit.limit,
          windowHours: creationLimit.windowHours,
        }
      : null,
    isBlocked: currentUser?.isBlocked === true,
    isEmailVerified,
    canManageRequests,
    canSeeContact,
    initialAllPage: allPage,
    initialMyPage: myPage,
    countryOptions,
    intlLocale: toIntlLocale(input.locale),
  };
}
