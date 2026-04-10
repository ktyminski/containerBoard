import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import {
  buildAnnouncementsFilter,
  ensureAnnouncementsIndexes,
  getAnnouncementsCollection,
  mapToJobAnnouncementMapItem,
  type JobAnnouncementContactPerson,
  type JobAnnouncementLocation,
} from "@/lib/announcements";
import { getCurrentUserFromRequest } from "@/lib/auth-user";
import { getAnnouncementFavoritesCollection } from "@/lib/announcement-favorites";
import { getCompaniesCollection } from "@/lib/companies";
import { normalizeExternalLink } from "@/lib/external-links";
import { parseBbox } from "@/lib/geo";
import { sanitizeRichTextHtml } from "@/lib/html-sanitizer";
import { sendAnnouncementPublishedEmail } from "@/lib/mailer";
import { enforceRateLimitOrResponse } from "@/lib/request-rate-limit";
import { formatTemplate, getLocaleFromApiRequest, getMessages } from "@/lib/i18n";
import { stripHtmlToPlainText } from "@/lib/rich-text";
import {
  JOB_ANNOUNCEMENT_REQUIREMENTS,
  JOB_ANNOUNCEMENT_PLAN_TIERS,
  JOB_ANNOUNCEMENT_PLAN_TIER,
  JOB_CONTRACT_TYPES,
  JOB_EMPLOYMENT_TYPES,
  JOB_RATE_PERIODS,
  JOB_WORK_LOCATION_MODE,
  JOB_WORK_LOCATION_MODES,
  JOB_WORK_MODELS,
  type JobAnnouncementRequirement,
  type JobContractType,
  type JobWorkModel,
} from "@/lib/job-announcement";
import { USER_ROLE } from "@/lib/user-roles";
import { logError } from "@/lib/server-logger";

export const runtime = "nodejs";
const JOB_CONTRACT_TYPE_SET = new Set<string>(JOB_CONTRACT_TYPES);
const JOB_WORK_MODEL_SET = new Set<string>(JOB_WORK_MODELS);

const querySchema = z.object({
  bbox: z.string().optional(),
  q: z.string().trim().min(1).max(100).optional(),
  tags: z
    .string()
    .optional()
    .transform((value) => {
      if (!value) {
        return [];
      }

      return value
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean);
    }),
  contractTypes: z
    .string()
    .optional()
    .transform((value) => {
      if (!value) {
        return [];
      }

      return value
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);
    })
    .refine((value) => value.every((item) => JOB_CONTRACT_TYPE_SET.has(item)), {
      message: "contractTypes contains unsupported value",
    }),
  workModels: z
    .string()
    .optional()
    .transform((value) => {
      if (!value) {
        return [];
      }

      return value
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);
    })
    .refine((value) => value.every((item) => JOB_WORK_MODEL_SET.has(item)), {
      message: "workModels contains unsupported value",
    }),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

const optionalNumberSchema = z.preprocess(
  (value) => {
    if (value === undefined || value === null) {
      return undefined;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) {
        return undefined;
      }
      return Number(trimmed);
    }
    return Number(value);
  },
  z.number().finite().gte(0).lte(1_000_000).optional(),
);

const optionalApplicationEmailSchema = z
  .string()
  .trim()
  .max(220)
  .optional()
  .or(z.literal(""))
  .default("")
  .superRefine((value, ctx) => {
    if (!value) {
      return;
    }
    if (!z.string().email().safeParse(value).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "application email must be valid",
      });
    }
  });

const contactPersonSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    phone: z.string().trim().max(60).optional().or(z.literal("")),
    email: z.string().trim().max(220).optional().or(z.literal("")),
  })
  .superRefine((value, ctx) => {
    const email = value.email?.trim() || "";
    const phone = value.phone?.trim() || "";

    if (!email && !phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "contact person requires email or phone",
      });
      return;
    }

    if (email && !z.string().email().safeParse(email).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "contact person email must be valid",
        path: ["email"],
      });
    }
  });

const createAnnouncementSchema = z.object({
  planTier: z.enum(JOB_ANNOUNCEMENT_PLAN_TIERS).default(JOB_ANNOUNCEMENT_PLAN_TIER.BASIC),
  companyId: z.string().refine((value) => ObjectId.isValid(value), {
    message: "companyId must be a valid id",
  }),
  title: z.string().trim().min(3).max(180),
  description: z.string().trim().min(1).max(20_000),
  workLocationMode: z.enum(JOB_WORK_LOCATION_MODES),
  branchId: z.string().trim().max(120).optional().default(""),
  manualLocationText: z.string().trim().max(220).optional().default(""),
  mapLat: z.number().finite().gte(-90).lte(90).nullable(),
  mapLng: z.number().finite().gte(-180).lte(180).nullable(),
  workModel: z.enum(JOB_WORK_MODELS),
  employmentType: z.enum(JOB_EMPLOYMENT_TYPES),
  contractTypes: z.array(z.enum(JOB_CONTRACT_TYPES)).min(1).max(JOB_CONTRACT_TYPES.length),
  salaryRatePeriod: z.enum(JOB_RATE_PERIODS),
  salaryFrom: optionalNumberSchema,
  salaryTo: optionalNumberSchema,
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  requirements: z
    .array(z.enum(JOB_ANNOUNCEMENT_REQUIREMENTS))
    .max(JOB_ANNOUNCEMENT_REQUIREMENTS.length)
    .default([]),
  externalLinks: z.array(z.string().trim().max(600)).max(10).default([]),
  contactPersons: z.array(contactPersonSchema).max(3).default([]),
  applicationEmail: optionalApplicationEmailSchema,
});

function parseBranchIndex(
  branchId: string,
  companyId: ObjectId,
): number | null {
  const [branchCompanyId, rawIndex] = branchId.split(":");
  if (branchCompanyId !== companyId.toHexString()) {
    return null;
  }

  const index = Number(rawIndex);
  if (!Number.isInteger(index) || index < 0) {
    return null;
  }

  return index;
}

function createLocationPoint(lat: number, lng: number) {
  return {
    type: "Point" as const,
    coordinates: [lng, lat] as [number, number],
  };
}

function normalizeContactPersons(
  input: z.infer<typeof createAnnouncementSchema>["contactPersons"],
): JobAnnouncementContactPerson[] {
  const unique = new Map<string, JobAnnouncementContactPerson>();
  for (const person of input) {
    const name = person.name.trim();
    const email = person.email?.trim() || undefined;
    const phone = person.phone?.trim() || undefined;
    if (!email && !phone) {
      continue;
    }
    const dedupeKey = `${name.toLowerCase()}::${email?.toLowerCase() ?? ""}::${phone?.toLowerCase() ?? ""}`;
    if (unique.has(dedupeKey)) {
      continue;
    }
    unique.set(dedupeKey, { name, email, phone });
  }
  return Array.from(unique.values()).slice(0, 3);
}

function normalizeRequirements(
  input: z.infer<typeof createAnnouncementSchema>["requirements"],
): JobAnnouncementRequirement[] {
  return Array.from(new Set(input)).slice(0, JOB_ANNOUNCEMENT_REQUIREMENTS.length);
}

function resolveLocation(input: {
  workLocationMode: z.infer<typeof createAnnouncementSchema>["workLocationMode"];
  branchId: string;
  manualLocationText: string;
  mapLat: number | null;
  mapLng: number | null;
  companyId: ObjectId;
  companyLocations: Array<{
    label: string;
    addressText: string;
    point: {
      coordinates: [number, number];
    };
  }>;
  labels: {
    mapPointTemplate: string;
    manualFallback: string;
    anywhere: string;
  };
}): { location: JobAnnouncementLocation; branchIndex?: number } | { error: string } {
  const fallbackBranch = input.companyLocations[0];
  if (!fallbackBranch?.point?.coordinates) {
    return { error: "Company has no mappable branch location" };
  }

  if (input.workLocationMode === JOB_WORK_LOCATION_MODE.BRANCH) {
    const branchIndex = parseBranchIndex(input.branchId, input.companyId);
    if (branchIndex === null) {
      return { error: "Selected branch is invalid" };
    }

    const branch = input.companyLocations[branchIndex];
    if (!branch?.point?.coordinates) {
      return { error: "Selected branch has no coordinates" };
    }

    const [lng, lat] = branch.point.coordinates;
    return {
      location: {
        mode: JOB_WORK_LOCATION_MODE.BRANCH,
        label: `${branch.label} - ${branch.addressText}`,
        point: createLocationPoint(lat, lng),
      },
      branchIndex,
    };
  }

  if (input.workLocationMode === JOB_WORK_LOCATION_MODE.MAP) {
    if (input.mapLat === null || input.mapLng === null) {
      return { error: "Map location coordinates are required" };
    }

    return {
      location: {
        mode: JOB_WORK_LOCATION_MODE.MAP,
        label: formatTemplate(input.labels.mapPointTemplate, {
          lat: input.mapLat.toFixed(4),
          lng: input.mapLng.toFixed(4),
        }),
        point: createLocationPoint(input.mapLat, input.mapLng),
      },
    };
  }

  if (input.workLocationMode === JOB_WORK_LOCATION_MODE.MANUAL) {
    if (input.mapLat === null || input.mapLng === null) {
      return { error: "Manual location coordinates are required" };
    }
    const manualLabel = input.manualLocationText.trim();
    if (!manualLabel) {
      return { error: "Manual location label is required" };
    }
    return {
      location: {
        mode: JOB_WORK_LOCATION_MODE.MANUAL,
        label: manualLabel,
        point: createLocationPoint(input.mapLat, input.mapLng),
      },
    };
  }

  const [fallbackLng, fallbackLat] = fallbackBranch.point.coordinates;
  return {
    location: {
      mode: JOB_WORK_LOCATION_MODE.ANYWHERE,
      label: input.labels.anywhere,
      point: createLocationPoint(fallbackLat, fallbackLng),
    },
  };
}

function formatBranchLocationLabel(input: {
  label?: string;
  addressText?: string;
}): string | null {
  const label = input.label?.trim();
  const addressText = input.addressText?.trim();
  if (!label || !addressText) {
    return null;
  }
  return `${label} - ${addressText}`;
}

function resolveAnnouncementLocationMeta(input: {
  branchIndex: number | undefined;
  locationLabel: string;
  companyLocations: Array<{
    fullLabel: string;
    city?: string;
    country?: string;
  }>;
}): { city?: string; country?: string } | undefined {
  const branchIndex = input.branchIndex;
  if (typeof branchIndex === "number" && Number.isInteger(branchIndex) && branchIndex >= 0) {
    const byIndex = input.companyLocations[branchIndex];
    if (byIndex) {
      return {
        city: byIndex.city,
        country: byIndex.country,
      };
    }
  }

  const locationLabel = input.locationLabel.trim();
  if (!locationLabel) {
    return undefined;
  }

  const matched = input.companyLocations.find(
    (location) => location.fullLabel === locationLabel,
  );
  if (!matched) {
    return undefined;
  }
  return {
    city: matched.city,
    country: matched.country,
  };
}

export async function GET(request: NextRequest) {
  try {
    const query = querySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );

    if (!query.success) {
      return NextResponse.json(
        {
          error: "Invalid query parameters",
          issues: query.error.issues.map((issue) => issue.message),
        },
        { status: 400 },
      );
    }

    const { contractTypes, q, tags, limit, workModels } = query.data;
    const bbox = parseBbox(query.data.bbox);
    if (query.data.bbox && !bbox) {
      return NextResponse.json(
        {
          error: "Invalid query parameters",
          issues: ["bbox must be minLng,minLat,maxLng,maxLat in valid ranges"],
        },
        { status: 400 },
      );
    }

    const announcements = await getAnnouncementsCollection();
    const filter = buildAnnouncementsFilter({
      bbox,
      q,
      tags,
      contractTypes: contractTypes as JobContractType[],
      workModels: workModels as JobWorkModel[],
    });
    const rows = await announcements
      .find(filter, {
        projection: {
          companyId: 1,
          companyName: 1,
          companySlug: 1,
          title: 1,
          tags: 1,
          planTier: 1,
          location: 1,
          branchIndex: 1,
          salaryRatePeriod: 1,
          salaryFrom: 1,
          salaryTo: 1,
          createdAt: 1,
        },
        limit,
        sort: { createdAt: -1 },
      })
      .toArray();

    const companyLogoUrlsById = new Map<string, string | null>();
    const companyPremiumById = new Map<string, boolean>();
    const companyLocationMetaById = new Map<
      string,
      Array<{ fullLabel: string; city?: string; country?: string }>
    >();
    const companyIds = Array.from(
      new Set(rows.map((row) => row.companyId.toHexString())),
    );

    if (companyIds.length > 0) {
      const companies = await getCompaniesCollection();
      const companyRows = await companies
        .find(
          {
            _id: {
              $in: companyIds.map((companyId) => new ObjectId(companyId)),
            },
          },
          {
            projection: {
              _id: 1,
              updatedAt: 1,
              "logo.size": 1,
              "logo.filename": 1,
              isPremium: 1,
              "locations.label": 1,
              "locations.addressText": 1,
              "locations.addressParts.city": 1,
              "locations.addressParts.country": 1,
            },
          },
        )
        .toArray();

      for (const company of companyRows) {
        const companyId = company._id.toHexString();
        const hasLogo = Boolean(company.logo?.size || company.logo?.filename);
        const version =
          company.updatedAt instanceof Date
            ? `&v=${company.updatedAt.getTime()}`
            : "";
        const logoUrl = hasLogo
          ? `/api/companies/${companyId}/logo?variant=thumb${version}`
          : null;
        companyLogoUrlsById.set(companyId, logoUrl);
        companyPremiumById.set(companyId, company.isPremium === true);

        const locationMeta: Array<{ fullLabel: string; city?: string; country?: string }> = [];
        for (const location of company.locations ?? []) {
          const fullLabel = formatBranchLocationLabel({
            label: location.label,
            addressText: location.addressText,
          });
          if (!fullLabel) {
            continue;
          }

          locationMeta.push({
            fullLabel,
            city: location.addressParts?.city?.trim() || undefined,
            country: location.addressParts?.country?.trim() || undefined,
          });
        }
        companyLocationMetaById.set(companyId, locationMeta);
      }
    }

    const items = rows
      .map((row) => {
        const companyId = row.companyId.toHexString();
        const locationMeta = resolveAnnouncementLocationMeta({
          branchIndex: row.branchIndex,
          locationLabel: row.location?.label ?? "",
          companyLocations: companyLocationMetaById.get(companyId) ?? [],
        });

        return mapToJobAnnouncementMapItem(
          row,
          bbox,
          companyLogoUrlsById.get(companyId) ?? null,
          locationMeta,
          companyPremiumById.get(companyId) === true,
        );
      })
      .filter((item) => item !== null);

    const user = await getCurrentUserFromRequest(request);
    const canFavorite = Boolean(user?._id);
    let favoriteIds = new Set<string>();
    if (user?._id && items.length > 0) {
      const itemObjectIds = items
        .map((item) => (ObjectId.isValid(item.id) ? new ObjectId(item.id) : null))
        .filter((value): value is ObjectId => value !== null);
      if (itemObjectIds.length > 0) {
        const favorites = await getAnnouncementFavoritesCollection();
        const favoriteRows = await favorites
          .find(
            {
              userId: user._id,
              announcementId: { $in: itemObjectIds },
            },
            {
              projection: { announcementId: 1 },
            },
          )
          .toArray();
        favoriteIds = new Set(
          favoriteRows.map((row) => row.announcementId.toHexString()),
        );
      }
    }

    const itemsWithFavorites = items.map((item) => ({
      ...item,
      isFavorite: favoriteIds.has(item.id),
    }));

    return NextResponse.json({
      items: itemsWithFavorites,
      meta: {
        count: itemsWithFavorites.length,
        limit,
        hasMore: rows.length === limit,
        canFavorite,
      },
    });
  } catch (error) {
    logError("Unhandled API error", { route: "/api/announcements", error });
    return NextResponse.json(
      {
        error: "Internal server error",
        message:
          error instanceof Error
            ? error.message
            : "Unknown announcements error",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const announcementMessages = getMessages(getLocaleFromApiRequest(request)).announcementCreate;
    const ipRateLimitResponse = await enforceRateLimitOrResponse({
      request,
      scope: "announcements:create:ip",
      limit: 90,
      windowMs: 60_000,
    });
    if (ipRateLimitResponse) {
      return ipRateLimitResponse;
    }

    const user = await getCurrentUserFromRequest(request);
    if (!user || !user._id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRateLimitResponse = await enforceRateLimitOrResponse({
      request,
      scope: "announcements:create:user",
      limit: 10,
      windowMs: 60_000,
      identity: user._id.toHexString(),
    });
    if (userRateLimitResponse) {
      return userRateLimitResponse;
    }

    if (user.role !== USER_ROLE.COMPANY_OWNER && user.role !== USER_ROLE.ADMIN) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (user.isBlocked === true) {
      return NextResponse.json(
        { error: "Blocked user cannot publish announcements" },
        { status: 403 },
      );
    }

    const parsed = createAnnouncementSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          issues: parsed.error.issues.map((issue) => issue.message),
        },
        { status: 400 },
      );
    }

    if (parsed.data.planTier !== JOB_ANNOUNCEMENT_PLAN_TIER.BASIC) {
      return NextResponse.json(
        {
          error: "Selected plan is not available yet",
        },
        { status: 400 },
      );
    }

    if (
      parsed.data.salaryFrom !== undefined &&
      parsed.data.salaryTo !== undefined &&
      parsed.data.salaryFrom > parsed.data.salaryTo
    ) {
      return NextResponse.json(
        { error: "salaryFrom cannot be greater than salaryTo" },
        { status: 400 },
      );
    }

    const description = sanitizeRichTextHtml(parsed.data.description);
    const plainDescription = stripHtmlToPlainText(description);
    if (plainDescription.length < 20) {
      return NextResponse.json(
        { error: "description is too short after sanitization" },
        { status: 400 },
      );
    }
    if (plainDescription.length > 5_000) {
      return NextResponse.json(
        { error: "description is too long after sanitization" },
        { status: 400 },
      );
    }

    const companies = await getCompaniesCollection();
    const companyId = new ObjectId(parsed.data.companyId);
    const company = await companies.findOne(
      { _id: companyId },
      {
        projection: {
          _id: 1,
          name: 1,
          slug: 1,
          locations: 1,
          createdByUserId: 1,
        },
      },
    );

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const isAdmin = user.role === USER_ROLE.ADMIN;
    if (
      !isAdmin &&
      (!company.createdByUserId ||
        company.createdByUserId.toHexString() !== user._id.toHexString())
    ) {
      return NextResponse.json({ error: "Forbidden for this company" }, { status: 403 });
    }

    const resolvedLocation = resolveLocation({
      workLocationMode: parsed.data.workLocationMode,
      branchId: parsed.data.branchId,
      manualLocationText: parsed.data.manualLocationText,
      mapLat: parsed.data.mapLat,
      mapLng: parsed.data.mapLng,
      companyId: company._id,
      companyLocations: (company.locations ?? []).map((location) => ({
        label: location.label,
        addressText: location.addressText,
        point: {
          coordinates: location.point.coordinates,
        },
      })),
      labels: {
        mapPointTemplate: announcementMessages.locationPreviewMapPoint,
        manualFallback: announcementMessages.locationPreviewManual,
        anywhere: announcementMessages.locationPreviewAnywhere,
      },
    });

    if ("error" in resolvedLocation) {
      return NextResponse.json({ error: resolvedLocation.error }, { status: 400 });
    }

    const tags = Array.from(
      new Set(
        parsed.data.tags
          .map((tag) => tag.trim().toLowerCase())
          .filter(Boolean),
      ),
    );
    const normalizedExternalLinks = parsed.data.externalLinks.map((link) =>
      normalizeExternalLink(link),
    );
    if (normalizedExternalLinks.some((link) => !link)) {
      return NextResponse.json(
        { error: "Invalid externalLinks value" },
        { status: 400 },
      );
    }
    const externalLinks = Array.from(
      new Set(
        normalizedExternalLinks.filter((link): link is string => Boolean(link)),
      ),
    );
    const contactPersons = normalizeContactPersons(parsed.data.contactPersons);
    const applicationEmail = parsed.data.applicationEmail.trim() || undefined;
    const requirements = normalizeRequirements(parsed.data.requirements);

    const contractTypes = Array.from(new Set(parsed.data.contractTypes));
    const now = new Date();

    await ensureAnnouncementsIndexes();
    const announcements = await getAnnouncementsCollection();
    const insertResult = await announcements.insertOne({
      _id: new ObjectId(),
      companyId,
      companyName: company.name,
      companySlug: company.slug,
      title: parsed.data.title.trim(),
      description,
      workModel: parsed.data.workModel,
      employmentType: parsed.data.employmentType,
      contractTypes,
      salaryRatePeriod: parsed.data.salaryRatePeriod,
      salaryFrom: parsed.data.salaryFrom,
      salaryTo: parsed.data.salaryTo,
      tags,
      requirements,
      externalLinks,
      contactPersons,
      ...(applicationEmail ? { applicationEmail } : {}),
      location: resolvedLocation.location,
      branchIndex: resolvedLocation.branchIndex,
      planTier: parsed.data.planTier,
      isPublished: true,
      createdByUserId: user._id,
      createdAt: now,
      updatedAt: now,
    });
    const announcementId = insertResult.insertedId.toHexString();
    const announcementUrl = new URL(`/announcements/${announcementId}`, request.url).toString();
    const publicationMailResult = await sendAnnouncementPublishedEmail({
      to: user.email,
      name: user.name,
      announcementTitle: parsed.data.title.trim(),
      companyName: company.name,
      announcementUrl,
    });
    if (!publicationMailResult.ok) {
      logError("Failed to send announcement publication email", {
        announcementId,
        userId: user._id.toHexString(),
        error: publicationMailResult.error,
        status: publicationMailResult.status,
      });
    }

    return NextResponse.json(
      {
        id: announcementId,
      },
      { status: 201 },
    );
  } catch (error) {
    logError("Unhandled API error", { route: "/api/announcements", error });
    return NextResponse.json(
      {
        error: "Internal server error",
        message:
          error instanceof Error
            ? error.message
            : "Unknown create announcement error",
      },
      { status: 500 },
    );
  }
}


