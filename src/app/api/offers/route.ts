import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getCurrentUserFromRequest } from "@/lib/auth-user";
import { getCompaniesCollection } from "@/lib/companies";
import {
  COMPANY_OPERATING_AREA,
  COMPANY_OPERATING_AREAS,
  type CompanyOperatingArea,
} from "@/lib/company-operating-area";
import { COMPANY_CATEGORIES, type CompanyCategory } from "@/types/company-category";
import {
  COMPANY_SPECIALIZATIONS,
  type CompanySpecialization,
} from "@/types/company-specialization";
import { normalizeExternalLink } from "@/lib/external-links";
import { parseBbox } from "@/lib/geo";
import { sanitizeRichTextHtml } from "@/lib/html-sanitizer";
import { sendOfferPublishedEmail } from "@/lib/mailer";
import { OFFER_TYPES, type OfferType } from "@/lib/offer-type";
import { stripHtmlToPlainText } from "@/lib/rich-text";
import {
  buildOffersFilter,
  ensureOffersIndexes,
  getOffersCollection,
  mapToOfferMapItem,
} from "@/lib/offers";
import { enforceRateLimitOrResponse } from "@/lib/request-rate-limit";
import { USER_ROLE } from "@/lib/user-roles";
import { logError } from "@/lib/server-logger";

export const runtime = "nodejs";

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
  operatingAreas: z
    .string()
    .optional()
    .transform((value) => {
      if (!value) {
        return [];
      }
      const allowed = new Set<string>(COMPANY_OPERATING_AREAS);
      return value
        .split(",")
        .map((entry) => entry.trim().toLowerCase())
        .filter((entry): entry is CompanyOperatingArea => allowed.has(entry));
    }),
  categories: z
    .string()
    .optional()
    .transform((value) => {
      if (!value) {
        return [];
      }
      const allowed = new Set<string>(COMPANY_CATEGORIES);
      return value
        .split(",")
        .map((entry) => entry.trim().toLowerCase())
        .filter((entry): entry is CompanyCategory => allowed.has(entry));
    }),
  specializations: z
    .string()
    .optional()
    .transform((value) => {
      if (!value) {
        return [];
      }
      const allowed = new Set<string>(COMPANY_SPECIALIZATIONS);
      return value
        .split(",")
        .map((entry) => entry.trim().toLowerCase())
        .filter((entry): entry is CompanySpecialization => allowed.has(entry));
    }),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

const createOfferSchema = z.object({
  companyId: z.string().refine((value) => ObjectId.isValid(value), {
    message: "companyId must be a valid id",
  }),
  offerType: z.enum(OFFER_TYPES),
  branchId: z.string().trim().min(1).max(120),
  title: z.string().trim().min(3).max(180),
  description: z.string().trim().min(1).max(20_000),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  externalLinks: z.array(z.string().trim().max(600)).max(10).default([]),
});

function parseBranchIndex(branchId: string, companyId: ObjectId): number | null {
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

function dedupeNormalized(values: string[]): string[] {
  const unique = new Map<string, string>();
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }
    const normalized = trimmed.toLowerCase();
    if (!unique.has(normalized)) {
      unique.set(normalized, trimmed);
    }
  }
  return Array.from(unique.values());
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

    const { q, tags, operatingAreas, categories, specializations, limit } = query.data;
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

    const offers = await getOffersCollection();
    const filter = buildOffersFilter({ bbox, q, tags });

    if (
      operatingAreas.length > 0 ||
      categories.length > 0 ||
      specializations.length > 0
    ) {
      const companies = await getCompaniesCollection();
      const companyFilter: Record<string, unknown> = {
        isBlocked: { $ne: true },
      };

      if (categories.length > 0) {
        companyFilter.category = { $in: categories };
      }

      if (specializations.length > 0) {
        companyFilter.specializations = { $in: specializations };
      }

      if (operatingAreas.length > 0) {
        const areaSet = new Set(operatingAreas);
        const includeLegacyLocal = areaSet.has(COMPANY_OPERATING_AREA.LOCAL);
        if (includeLegacyLocal) {
          companyFilter.$or = [
            { operatingArea: { $in: Array.from(areaSet) } },
            { operatingArea: { $exists: false } },
          ];
        } else {
          companyFilter.operatingArea = { $in: Array.from(areaSet) };
        }
      }

      const matchingCompanies = await companies
        .find(companyFilter, { projection: { _id: 1 }, limit: 5000 })
        .toArray();
      const matchingCompanyIds = matchingCompanies.map((company) => company._id);
      if (matchingCompanyIds.length === 0) {
        return NextResponse.json({
          items: [],
          meta: {
            count: 0,
            limit,
            hasMore: false,
          },
        });
      }
      filter.companyId = { $in: matchingCompanyIds };
    }
    const rows = await offers
      .find(filter, {
        projection: {
          companyId: 1,
          companyName: 1,
          companySlug: 1,
          offerType: 1,
          title: 1,
          tags: 1,
          locationLabel: 1,
          point: 1,
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
      Map<string, { city?: string; country?: string }>
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

        const locationMeta = new Map<string, { city?: string; country?: string }>();
        for (const location of company.locations ?? []) {
          const fullLabel = formatBranchLocationLabel({
            label: location.label,
            addressText: location.addressText,
          });
          if (!fullLabel) {
            continue;
          }
          locationMeta.set(fullLabel, {
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
        const locationMeta =
          companyLocationMetaById.get(companyId)?.get(row.locationLabel.trim()) ??
          undefined;
        return mapToOfferMapItem(
          row,
          bbox,
          companyLogoUrlsById.get(companyId) ?? null,
          locationMeta,
          companyPremiumById.get(companyId) === true,
        );
      })
      .filter((item) => item !== null);

    return NextResponse.json({
      items,
      meta: {
        count: items.length,
        limit,
        hasMore: rows.length === limit,
      },
    });
  } catch (error) {
    logError("Unhandled API error", { route: "/api/offers", error });
    return NextResponse.json(
      {
        error: "Internal server error",
        message:
          error instanceof Error ? error.message : "Unknown offers error",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const ipRateLimitResponse = await enforceRateLimitOrResponse({
      request,
      scope: "offers:create:ip",
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
      scope: "offers:create:user",
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
        { error: "Blocked user cannot publish offers" },
        { status: 403 },
      );
    }

    const parsed = createOfferSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          issues: parsed.error.issues.map((issue) => issue.message),
        },
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

    const companyId = new ObjectId(parsed.data.companyId);
    const companies = await getCompaniesCollection();
    const company = await companies.findOne(
      { _id: companyId },
      {
        projection: {
          _id: 1,
          name: 1,
          slug: 1,
          email: 1,
          phone: 1,
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

    const branchIndex = parseBranchIndex(parsed.data.branchId, companyId);
    if (branchIndex === null) {
      return NextResponse.json({ error: "Selected branch is invalid" }, { status: 400 });
    }

    const branch = company.locations?.[branchIndex];
    if (!branch?.point?.coordinates) {
      return NextResponse.json(
        { error: "Selected branch has no coordinates" },
        { status: 400 },
      );
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
    const externalLinks = dedupeNormalized(
      normalizedExternalLinks.filter((link): link is string => Boolean(link)),
    );

    const contactEmails = dedupeNormalized([
      company.email?.trim() ?? "",
      branch.email?.trim() ?? "",
    ]);
    const contactPhones = dedupeNormalized([
      company.phone?.trim() ?? "",
      branch.phone?.trim() ?? "",
    ]);

    const now = new Date();
    await ensureOffersIndexes();
    const offers = await getOffersCollection();
    const insertResult = await offers.insertOne({
      _id: new ObjectId(),
      companyId,
      companyName: company.name,
      companySlug: company.slug,
      offerType: parsed.data.offerType as OfferType,
      title: parsed.data.title.trim(),
      description,
      tags,
      externalLinks,
      contactEmails,
      contactPhones,
      locationLabel: `${branch.label} - ${branch.addressText}`,
      point: {
        type: "Point",
        coordinates: branch.point.coordinates,
      },
      isPublished: true,
      createdByUserId: user._id,
      createdAt: now,
      updatedAt: now,
    });
    const offerId = insertResult.insertedId.toHexString();
    const offerUrl = new URL(`/offers/${offerId}`, request.url).toString();
    const publicationMailResult = await sendOfferPublishedEmail({
      to: user.email,
      name: user.name,
      offerTitle: parsed.data.title.trim(),
      companyName: company.name,
      offerUrl,
    });
    if (!publicationMailResult.ok) {
      logError("Failed to send offer publication email", {
        offerId,
        userId: user._id.toHexString(),
        error: publicationMailResult.error,
        status: publicationMailResult.status,
      });
    }

    return NextResponse.json(
      {
        id: offerId,
      },
      { status: 201 },
    );
  } catch (error) {
    logError("Unhandled API error", { route: "/api/offers", error });
    return NextResponse.json(
      {
        error: "Internal server error",
        message:
          error instanceof Error ? error.message : "Unknown create offer error",
      },
      { status: 500 },
    );
  }
}



