import { type Filter } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { enforceAuthenticatedRateLimitOrResponse } from "@/lib/app-rate-limit";
import { getCurrentUserFromRequest } from "@/lib/auth-user";
import {
  CONTACT_ACTIVITY_TYPE,
  ensureContactActivityIndexes,
  getContactActivityCollection,
  type ContactActivityDocument,
} from "@/lib/contact-activity";
import { escapeRegexPattern } from "@/lib/escape-regex-pattern";
import { logError } from "@/lib/server-logger";
import { USER_ROLE } from "@/lib/user-roles";

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
  type: z
    .enum([
      "all",
      CONTACT_ACTIVITY_TYPE.INQUIRY_SENT,
      CONTACT_ACTIVITY_TYPE.CONTACT_REVEALED,
    ])
    .default("all"),
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
      scope: "admin:contact-activity:read",
      userId: admin._id.toHexString(),
      ipLimit: 180,
      userLimit: 90,
    });
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    await ensureContactActivityIndexes();
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
    const filters: Filter<ContactActivityDocument>[] = [];
    if (query.type !== "all") {
      filters.push({ type: query.type });
    }
    if (query.q) {
      const pattern = new RegExp(escapeRegexPattern(query.q), "i");
      filters.push({
        $or: [
          { listingSummary: pattern },
          { listingCompanyName: pattern },
          { actorName: pattern },
          { actorEmail: pattern },
          { actorPhone: pattern },
          { actorIp: pattern },
          { recipientCompanyName: pattern },
          { recipientEmail: pattern },
          { recipientPhone: pattern },
          { inquiryMessage: pattern },
          { offeredPrice: pattern },
        ],
      });
    }

    const filter: Filter<ContactActivityDocument> =
      filters.length > 0 ? { $and: filters } : {};

    const collection = await getContactActivityCollection();
    const total = await collection.countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
    const page = Math.min(query.page, totalPages);
    const skip = (page - 1) * query.pageSize;
    const sortDirection = query.sortDir === "asc" ? 1 : -1;

    const rows = await collection
      .find(filter, {
        projection: {
          type: 1,
          listingId: 1,
          listingType: 1,
          listingSummary: 1,
          listingCompanyName: 1,
          actorUserId: 1,
          actorIsGuest: 1,
          actorName: 1,
          actorEmail: 1,
          actorPhone: 1,
          actorAccountName: 1,
          actorAccountEmail: 1,
          actorIp: 1,
          recipientUserId: 1,
          recipientCompanyName: 1,
          recipientEmail: 1,
          recipientPhone: 1,
          inquiryMessage: 1,
          requestedQuantity: 1,
          offeredPrice: 1,
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
          id: row._id.toHexString(),
          type: row.type,
          listingId: row.listingId.toHexString(),
          listingType: row.listingType,
          listingSummary: row.listingSummary,
          listingCompanyName: row.listingCompanyName,
          actorUserId: row.actorUserId?.toHexString(),
          actorIsGuest: row.actorIsGuest === true,
          actorName: row.actorName,
          actorEmail: row.actorEmail,
          actorPhone: row.actorPhone,
          actorAccountName: row.actorAccountName,
          actorAccountEmail: row.actorAccountEmail,
          actorIp: row.actorIp,
          recipientUserId: row.recipientUserId?.toHexString(),
          recipientCompanyName: row.recipientCompanyName,
          recipientEmail: row.recipientEmail,
          recipientPhone: row.recipientPhone,
          inquiryMessage: row.inquiryMessage,
          requestedQuantity: row.requestedQuantity,
          offeredPrice: row.offeredPrice,
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
      route: "/api/admin/contact-activity",
      error,
    });
    return NextResponse.json(
      {
        error: "Internal server error",
        message:
          error instanceof Error
            ? error.message
            : "Unknown admin contact activity error",
      },
      { status: 500 },
    );
  }
}

