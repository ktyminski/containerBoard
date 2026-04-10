import { ObjectId, type Filter } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAnnouncementFavoritesCollection } from "@/lib/announcement-favorites";
import { getAnnouncementsCollection } from "@/lib/announcements";
import { getCurrentUserFromRequest } from "@/lib/auth-user";
import { safeDeleteBlobUrls } from "@/lib/blob-storage";
import {
  COMPANY_VERIFICATION_STATUSES,
  normalizeCompanyVerificationStatus,
  type CompanyVerificationStatus,
} from "@/lib/company-verification";
import { getCompanyOwnershipClaimsCollection } from "@/lib/company-ownership-claims";
import {
  ensureCompaniesIndexes,
  getCompaniesCollection,
  type CompanyDocument,
} from "@/lib/companies";
import { getOffersCollection } from "@/lib/offers";
import { USER_ROLE } from "@/lib/user-roles";
import { getUsersCollection } from "@/lib/users";
import { logError } from "@/lib/server-logger";

export const runtime = "nodejs";

async function requireAdmin(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user || user.role !== USER_ROLE.ADMIN) {
    return null;
  }
  return user;
}

type CompanyAdminRow = {
  id: string;
  name: string;
  slug: string;
  nip?: string;
  verificationStatus: CompanyVerificationStatus;
  isBlocked: boolean;
  isPremium: boolean;
  deletionRequest: {
    isRequested: boolean;
    reason?: string;
    requestedAt?: string;
  };
  createdAt: string;
  createdBy:
    | {
        id: string;
        name: string;
        email: string;
      }
    | null;
};

const companiesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(20),
  q: z.string().trim().min(1).max(100).optional(),
  verificationStatus: z
    .union([z.enum(COMPANY_VERIFICATION_STATUSES), z.literal("all")])
    .default("all"),
  blockStatus: z.enum(["all", "blocked", "active"]).default("all"),
  sortBy: z
    .enum(["createdAt", "name", "slug", "verificationStatus"])
    .default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

const updateCompanySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("block"),
    companyId: z.string().min(1),
    isBlocked: z.boolean(),
  }),
  z.object({
    action: z.literal("premium"),
    companyId: z.string().min(1),
    isPremium: z.boolean(),
  }),
  z.object({
    action: z.literal("verification"),
    companyId: z.string().min(1),
    verificationStatus: z.enum(COMPANY_VERIFICATION_STATUSES),
  }),
]);

const deleteCompanySchema = z.object({
  companyId: z.string().min(1),
});

function escapeRegexPattern(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collectCompanyBlobUrls(
  company: Pick<CompanyDocument, "logo" | "logoThumb" | "background" | "photos" | "locations">,
): string[] {
  const urls = [
    company.logo?.blobUrl,
    company.logoThumb?.blobUrl,
    company.background?.blobUrl,
    ...(company.photos ?? []).map((photo) => photo?.blobUrl),
    ...(company.locations ?? []).flatMap((location) =>
      (location.photos ?? []).map((photo) => photo?.blobUrl),
    ),
  ];

  return Array.from(
    new Set(
      urls
        .map((url) => url?.trim() ?? "")
        .filter(Boolean),
    ),
  );
}

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const companies = await getCompaniesCollection();
    const users = await getUsersCollection();
    const parsedQuery = companiesQuerySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );
    if (!parsedQuery.success) {
      return NextResponse.json(
        {
          error: "Invalid query parameters",
          issues: parsedQuery.error.issues.map((issue) => issue.message),
        },
        { status: 400 },
      );
    }
    const query = parsedQuery.data;
    const andFilters: Filter<CompanyDocument>[] = [];
    if (query.q) {
      const pattern = new RegExp(escapeRegexPattern(query.q), "i");
      andFilters.push({
        $or: [{ name: pattern }, { slug: pattern }, { nip: pattern }],
      });
    }
    if (query.verificationStatus === "verified") {
      andFilters.push({ verificationStatus: "verified" });
    } else if (query.verificationStatus === "not_verified") {
      andFilters.push({ verificationStatus: { $ne: "verified" } });
    }
    if (query.blockStatus === "blocked") {
      andFilters.push({ isBlocked: true });
    } else if (query.blockStatus === "active") {
      andFilters.push({ isBlocked: { $ne: true } });
    }
    const filter: Filter<CompanyDocument> =
      andFilters.length > 0 ? { $and: andFilters } : {};
    const sortFieldMap = {
      createdAt: "createdAt",
      name: "name",
      slug: "slug",
      verificationStatus: "verificationStatus",
    } as const;
    const sortField = sortFieldMap[query.sortBy];
    const sortDirection = query.sortDir === "asc" ? 1 : -1;
    const sort: Record<string, 1 | -1> = { [sortField]: sortDirection };
    if (sortField !== "createdAt") {
      sort.createdAt = -1;
    }
    const total = await companies.countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
    const page = Math.min(query.page, totalPages);
    const skip = (page - 1) * query.pageSize;

    const rows = await companies
      .find(
        filter,
        {
          projection: {
            name: 1,
            slug: 1,
            nip: 1,
            verificationStatus: 1,
            isBlocked: 1,
            isPremium: 1,
            deletionRequest: 1,
            createdAt: 1,
            createdByUserId: 1,
          },
        },
      )
      .sort(sort)
      .skip(skip)
      .limit(query.pageSize)
      .toArray();

    const ownerIds = Array.from(
      new Set(
        rows
          .map((row) => row.createdByUserId?.toHexString())
          .filter((id): id is string => Boolean(id)),
      ),
    );

    const ownerRows =
      ownerIds.length > 0
        ? await users
            .find(
              { _id: { $in: ownerIds.map((id) => new ObjectId(id)) } },
              {
                projection: {
                  email: 1,
                  name: 1,
                },
              },
            )
            .toArray()
        : [];

    const ownersById = new Map(
      ownerRows
        .filter((owner) => owner._id)
        .map((owner) => [
          owner._id.toHexString(),
          {
            id: owner._id.toHexString(),
            name: owner.name,
            email: owner.email,
          },
        ]),
    );

    const items: CompanyAdminRow[] = rows
      .filter((row) => row._id)
      .map((row) => ({
        id: row._id.toHexString(),
        name: row.name,
        slug: row.slug,
        nip: row.nip || undefined,
        verificationStatus: normalizeCompanyVerificationStatus(row.verificationStatus),
        isBlocked: row.isBlocked === true,
        isPremium: row.isPremium === true,
        deletionRequest: {
          isRequested: row.deletionRequest?.isRequested === true,
          reason: row.deletionRequest?.reason?.trim() || undefined,
          requestedAt: row.deletionRequest?.requestedAt?.toISOString(),
        },
        createdAt: row.createdAt?.toISOString() ?? new Date(0).toISOString(),
        createdBy: row.createdByUserId
          ? (ownersById.get(row.createdByUserId.toHexString()) ?? null)
          : null,
      }));

    return NextResponse.json({
      items,
      meta: {
        page,
        pageSize: query.pageSize,
        total,
        totalPages,
      },
    });
  } catch (error) {
    logError("Unhandled API error", { route: "/api/admin/companies", error });
    return NextResponse.json(
      {
        error: "Internal server error",
        message:
          error instanceof Error ? error.message : "Unknown admin companies error",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateCompanySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid payload",
          issues: parsed.error.issues.map((issue) => issue.message),
        },
        { status: 400 },
      );
    }

    if (!ObjectId.isValid(parsed.data.companyId)) {
      return NextResponse.json({ error: "Invalid company id" }, { status: 400 });
    }

    await ensureCompaniesIndexes();
    const companies = await getCompaniesCollection();

    const updatePayload =
      parsed.data.action === "block"
        ? {
            isBlocked: parsed.data.isBlocked,
            updatedAt: new Date(),
          }
        : parsed.data.action === "premium"
          ? {
              isPremium: parsed.data.isPremium,
              updatedAt: new Date(),
            }
          : {
              verificationStatus: parsed.data.verificationStatus,
              updatedAt: new Date(),
            };
    const updateResult = await companies.updateOne(
      { _id: new ObjectId(parsed.data.companyId) },
      { $set: updatePayload },
    );

    if (updateResult.matchedCount === 0) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    logError("Unhandled API error", { route: "/api/admin/companies", error });
    return NextResponse.json(
      {
        error: "Internal server error",
        message:
          error instanceof Error ? error.message : "Unknown admin companies update error",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = deleteCompanySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid payload",
          issues: parsed.error.issues.map((issue) => issue.message),
        },
        { status: 400 },
      );
    }

    if (!ObjectId.isValid(parsed.data.companyId)) {
      return NextResponse.json({ error: "Invalid company id" }, { status: 400 });
    }

    const companyId = new ObjectId(parsed.data.companyId);
    await ensureCompaniesIndexes();
    const [companies, users, offers, announcements, favorites, claims] = await Promise.all([
      getCompaniesCollection(),
      getUsersCollection(),
      getOffersCollection(),
      getAnnouncementsCollection(),
      getAnnouncementFavoritesCollection(),
      getCompanyOwnershipClaimsCollection(),
    ]);

    const company = await companies.findOne(
      { _id: companyId },
      {
        projection: {
          createdByUserId: 1,
          logo: 1,
          logoThumb: 1,
          background: 1,
          photos: 1,
          locations: 1,
        },
      },
    );
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const blobUrls = collectCompanyBlobUrls(company);
    const announcementIds = (
      await announcements.find({ companyId }, { projection: { _id: 1 } }).toArray()
    )
      .filter((announcement) => announcement._id)
      .map((announcement) => announcement._id!);

    const deleteResult = await companies.deleteOne({ _id: companyId });
    if (deleteResult.deletedCount === 0) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const cleanupOperations: Promise<unknown>[] = [
      offers.deleteMany({ companyId }),
      announcements.deleteMany({ companyId }),
      claims.deleteMany({ companyId }),
    ];

    if (announcementIds.length > 0) {
      cleanupOperations.push(
        favorites.deleteMany({
          announcementId: { $in: announcementIds },
        }),
      );
    }

    if (company.createdByUserId) {
      cleanupOperations.push(
        (async () => {
          const hasAssignedCompany = Boolean(
            await companies.findOne(
              { createdByUserId: company.createdByUserId },
              { projection: { _id: 1 } },
            ),
          );
          const derivedRole = hasAssignedCompany
            ? USER_ROLE.COMPANY_OWNER
            : USER_ROLE.USER;
          await users.updateOne(
            {
              _id: company.createdByUserId,
              role: { $in: [USER_ROLE.USER, USER_ROLE.COMPANY_OWNER] },
            },
            {
              $set: {
                role: derivedRole,
                updatedAt: new Date(),
              },
            },
          );
        })(),
      );
    }

    const cleanupResults = await Promise.allSettled(cleanupOperations);
    const cleanupFailures = cleanupResults
      .map((result) => {
        if (result.status !== "rejected") {
          return null;
        }
        return result.reason instanceof Error
          ? result.reason.message
          : String(result.reason);
      })
      .filter((failure): failure is string => Boolean(failure));

    if (cleanupFailures.length > 0) {
      logError("Admin company cleanup failed", {
        route: "/api/admin/companies",
        companyId: companyId.toHexString(),
        failures: cleanupFailures,
      });
    }

    await safeDeleteBlobUrls(blobUrls);

    return NextResponse.json({ ok: true });
  } catch (error) {
    logError("Unhandled API error", { route: "/api/admin/companies", error });
    return NextResponse.json(
      {
        error: "Internal server error",
        message:
          error instanceof Error ? error.message : "Unknown admin companies delete error",
      },
      { status: 500 },
    );
  }
}
