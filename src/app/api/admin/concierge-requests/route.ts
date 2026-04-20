import { type Filter } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { enforceAuthenticatedRateLimitOrResponse } from "@/lib/app-rate-limit";
import { getCurrentUserFromRequest } from "@/lib/auth-user";
import {
  ensureBulkConciergeRequestIndexes,
  getBulkConciergeRequestsCollection,
  type BulkConciergeRequestDocument,
} from "@/lib/bulk-concierge-requests";
import { escapeRegexPattern } from "@/lib/escape-regex-pattern";
import { USER_ROLE } from "@/lib/user-roles";
import { logError } from "@/lib/server-logger";

export const runtime = "nodejs";

async function requireAdmin(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user || user.role !== USER_ROLE.ADMIN) {
    return null;
  }
  return user;
}

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(20),
  q: z.string().trim().min(1).max(160).optional(),
  status: z.enum(["all", "new", "completed"]).default("all"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin?._id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const rateLimitResponse = await enforceAuthenticatedRateLimitOrResponse({
      request,
      scope: "admin:concierge-requests:read",
      userId: admin._id.toHexString(),
      ipLimit: 180,
      userLimit: 90,
    });
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    await ensureBulkConciergeRequestIndexes();
    const parsed = querySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid query parameters",
          issues: parsed.error.issues.map((issue) => issue.message),
        },
        { status: 400 },
      );
    }

    const query = parsed.data;
    const filters: Filter<BulkConciergeRequestDocument>[] = [];
    if (query.status !== "all") {
      filters.push({ status: query.status });
    }
    if (query.q) {
      const pattern = new RegExp(escapeRegexPattern(query.q), "i");
      filters.push({
        $or: [
          { companyName: pattern },
          { companySlug: pattern },
          { userName: pattern },
          { userEmail: pattern },
          { contactEmail: pattern },
          { "stockFile.filename": pattern },
          { note: pattern },
        ],
      });
    }

    const filter: Filter<BulkConciergeRequestDocument> =
      filters.length > 0 ? { $and: filters } : {};

    const requests = await getBulkConciergeRequestsCollection();
    const total = await requests.countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
    const page = Math.min(query.page, totalPages);
    const skip = (page - 1) * query.pageSize;
    const sortDirection = query.sortDir === "asc" ? 1 : -1;

    const rows = await requests
      .find(filter, {
        projection: {
          companyName: 1,
          companySlug: 1,
          userName: 1,
          userEmail: 1,
          contactEmail: 1,
          contactPhone: 1,
          note: 1,
          stockFile: 1,
          status: 1,
          notificationSentAt: 1,
          notificationError: 1,
          createdAt: 1,
        },
      })
      .sort({ createdAt: sortDirection })
      .skip(skip)
      .limit(query.pageSize)
      .toArray();

    return NextResponse.json({
      items: rows
        .filter((row) => row._id)
        .map((row) => ({
          id: row._id!.toHexString(),
          companyName: row.companyName,
          companySlug: row.companySlug,
          userName: row.userName,
          userEmail: row.userEmail,
          contactEmail: row.contactEmail,
          contactPhone: row.contactPhone,
          note: row.note,
          stockFile: {
            filename: row.stockFile.filename,
            contentType: row.stockFile.contentType,
            size: row.stockFile.size,
          },
          status: row.status,
          notificationSentAt: row.notificationSentAt?.toISOString(),
          notificationError: row.notificationError,
          createdAt: row.createdAt.toISOString(),
        })),
      meta: {
        page,
        pageSize: query.pageSize,
        total,
        totalPages,
      },
    });
  } catch (error) {
    logError("Unhandled API error", {
      route: "/api/admin/concierge-requests",
      error,
    });
    return NextResponse.json(
      {
        error: "Internal server error",
        message:
          error instanceof Error
            ? error.message
            : "Unknown admin concierge requests error",
      },
      { status: 500 },
    );
  }
}
