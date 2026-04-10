import { type Filter } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserFromRequest } from "@/lib/auth-user";
import {
  getLeadRequestsCollection,
  type LeadRequestDocument,
} from "@/lib/lead-requests";
import {
  LEAD_REQUEST_STATUSES,
  LEAD_REQUEST_TYPES,
  type LeadRequestStatus,
  type LeadRequestType,
} from "@/lib/lead-request-types";
import { USER_ROLE } from "@/lib/user-roles";
import { getUsersCollection } from "@/lib/users";
import { logError } from "@/lib/server-logger";

export const runtime = "nodejs";

const leadRequestsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(20),
  q: z.string().trim().min(1).max(100).optional(),
  leadType: z.union([z.enum(LEAD_REQUEST_TYPES), z.literal("all")]).default("all"),
  status: z.union([z.enum(LEAD_REQUEST_STATUSES), z.literal("all")]).default("all"),
  sortBy: z.enum(["createdAt", "expiresAt", "leadType", "status"]).default("createdAt"),
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

    const leadRequests = await getLeadRequestsCollection();
    const users = await getUsersCollection();
    const parsedQuery = leadRequestsQuerySchema.safeParse(
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
    const filter: Filter<LeadRequestDocument> = {};
    if (query.q) {
      const pattern = new RegExp(escapeRegexPattern(query.q), "i");
      filter.$or = [
        { description: pattern },
        { originLocation: pattern },
        { destinationLocation: pattern },
        { originCountryCode: pattern },
        { destinationCountryCode: pattern },
        { contactEmail: pattern },
        { contactPhone: pattern },
      ];
    }
    if (query.leadType !== "all") {
      filter.leadType = query.leadType as LeadRequestType;
    }
    if (query.status !== "all") {
      filter.status = query.status as LeadRequestStatus;
    }

    const sortFieldMap = {
      createdAt: "createdAt",
      expiresAt: "expiresAt",
      leadType: "leadType",
      status: "status",
    } as const;
    const sortField = sortFieldMap[query.sortBy];
    const sortDirection = query.sortDir === "asc" ? 1 : -1;
    const sort: Record<string, 1 | -1> = { [sortField]: sortDirection };
    if (sortField !== "createdAt") {
      sort.createdAt = -1;
    }

    const total = await leadRequests.countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
    const page = Math.min(query.page, totalPages);
    const skip = (page - 1) * query.pageSize;
    const rows = await leadRequests
      .find(filter, {
        projection: {
          _id: 1,
          leadType: 1,
          transportMode: 1,
          originLocation: 1,
          destinationLocation: 1,
          description: 1,
          contactEmail: 1,
          contactPhone: 1,
          status: 1,
          createdByUserId: 1,
          createdAt: 1,
          expiresAt: 1,
        },
      })
      .sort(sort)
      .skip(skip)
      .limit(query.pageSize)
      .toArray();

    const userIds = Array.from(
      new Set(rows.map((row) => row.createdByUserId.toHexString())),
    );
    const userRows = userIds.length
      ? await users
          .find(
            { _id: { $in: rows.map((row) => row.createdByUserId) } },
            { projection: { _id: 1, name: 1, email: 1 } },
          )
          .toArray()
      : [];
    const usersById = new Map(
      userRows
        .filter((row) => row._id)
        .map((row) => [row._id!.toHexString(), { name: row.name, email: row.email }] as const),
    );

    return NextResponse.json({
      items: rows.map((row) => {
        const author = usersById.get(row.createdByUserId.toHexString());
        return {
          id: row._id.toHexString(),
          leadType: row.leadType,
          transportMode: row.transportMode ?? null,
          originLocation: row.originLocation ?? "",
          destinationLocation: row.destinationLocation ?? "",
          description: row.description,
          contactEmail: row.contactEmail ?? null,
          contactPhone: row.contactPhone ?? null,
          status: row.status,
          createdByName: author?.name ?? "",
          createdByEmail: author?.email ?? "",
          createdAt: row.createdAt.toISOString(),
          expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
        };
      }),
      meta: {
        page,
        pageSize: query.pageSize,
        total,
        totalPages,
      },
    });
  } catch (error) {
    logError("Unhandled API error", { route: "/api/admin/lead-requests", error });
    return NextResponse.json(
      {
        error: "Internal server error",
        message:
          error instanceof Error ? error.message : "Unknown admin lead requests error",
      },
      { status: 500 },
    );
  }
}
