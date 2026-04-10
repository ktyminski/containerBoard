import { type Filter } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getAnnouncementsCollection,
  type JobAnnouncementDocument,
} from "@/lib/announcements";
import { getCurrentUserFromRequest } from "@/lib/auth-user";
import {
  JOB_ANNOUNCEMENT_PLAN_TIERS,
  type JobAnnouncementPlanTier,
} from "@/lib/job-announcement";
import { USER_ROLE } from "@/lib/user-roles";
import { logError } from "@/lib/server-logger";

export const runtime = "nodejs";

const announcementsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(20),
  q: z.string().trim().min(1).max(100).optional(),
  planTier: z
    .union([z.enum(JOB_ANNOUNCEMENT_PLAN_TIERS), z.literal("all")])
    .default("all"),
  publishStatus: z.enum(["all", "published", "unpublished"]).default("all"),
  sortBy: z
    .enum(["createdAt", "title", "companyName", "planTier"])
    .default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

async function requireAdmin(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user || user.role !== USER_ROLE.ADMIN) {
    return null;
  }
  return user;
}

function escapeRegexPattern(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const announcements = await getAnnouncementsCollection();
    const parsedQuery = announcementsQuerySchema.safeParse(
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
    const filter: Filter<JobAnnouncementDocument> = {};
    if (query.q) {
      const pattern = new RegExp(escapeRegexPattern(query.q), "i");
      filter.$or = [
        { title: pattern },
        { description: pattern },
        { companyName: pattern },
        { "location.label": pattern },
        { tags: pattern },
      ];
    }
    if (query.planTier !== "all") {
      filter.planTier = query.planTier as JobAnnouncementPlanTier;
    }
    if (query.publishStatus === "published") {
      filter.isPublished = true;
    }
    if (query.publishStatus === "unpublished") {
      filter.isPublished = false;
    }

    const sortFieldMap = {
      createdAt: "createdAt",
      title: "title",
      companyName: "companyName",
      planTier: "planTier",
    } as const;
    const sortField = sortFieldMap[query.sortBy];
    const sortDirection = query.sortDir === "asc" ? 1 : -1;
    const sort: Record<string, 1 | -1> = { [sortField]: sortDirection };
    if (sortField !== "createdAt") {
      sort.createdAt = -1;
    }

    const total = await announcements.countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
    const page = Math.min(query.page, totalPages);
    const skip = (page - 1) * query.pageSize;

    const rows = await announcements
      .find(filter, {
        projection: {
          companyName: 1,
          companySlug: 1,
          title: 1,
          location: 1,
          planTier: 1,
          isPublished: 1,
          createdAt: 1,
        },
      })
      .sort(sort)
      .skip(skip)
      .limit(query.pageSize)
      .toArray();

    return NextResponse.json({
      items: rows
        .filter((row) => row._id)
        .map((row) => ({
          id: row._id.toHexString(),
          companyName: row.companyName,
          companySlug: row.companySlug,
          title: row.title,
          locationLabel: row.location?.label ?? "-",
          planTier: row.planTier,
          isPublished: row.isPublished === true,
          createdAt: row.createdAt?.toISOString() ?? new Date(0).toISOString(),
        })),
      meta: {
        page,
        pageSize: query.pageSize,
        total,
        totalPages,
      },
    });
  } catch (error) {
    logError("Unhandled API error", { route: "/api/admin/announcements", error });
    return NextResponse.json(
      {
        error: "Internal server error",
        message:
          error instanceof Error
            ? error.message
            : "Unknown admin announcements error",
      },
      { status: 500 },
    );
  }
}
