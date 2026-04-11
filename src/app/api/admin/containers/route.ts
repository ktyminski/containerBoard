import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { type Filter } from "mongodb";
import { getCurrentUserFromRequest } from "@/lib/auth-user";
import {
  ensureContainerListingsIndexes,
  expireContainerListingsIfNeeded,
  getContainerListingsCollection,
  mapContainerListingToItem,
  type ContainerListingDocument,
} from "@/lib/container-listings";
import { LISTING_STATUSES, LISTING_TYPES } from "@/lib/container-listing-types";
import { USER_ROLE } from "@/lib/user-roles";
import { logError } from "@/lib/server-logger";
import { escapeRegexPattern } from "@/lib/escape-regex-pattern";

export const runtime = "nodejs";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(20),
  q: z.string().trim().min(1).max(120).optional(),
  type: z.union([z.enum(LISTING_TYPES), z.literal("all")]).default("all"),
  status: z.union([z.enum(LISTING_STATUSES), z.literal("all")]).default("all"),
  sortBy: z
    .enum(["createdAt", "availableFrom", "expiresAt", "quantity", "companyName"])
    .default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user || user.role !== USER_ROLE.ADMIN) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await ensureContainerListingsIndexes();
    await expireContainerListingsIfNeeded();

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

    const { page, pageSize, q, type, status, sortBy, sortDir } = parsed.data;

    const filter: Filter<ContainerListingDocument> = {};
    if (q) {
      const pattern = new RegExp(escapeRegexPattern(q), "i");
      filter.$or = [
        { companyName: pattern },
        { description: pattern },
        { locationCity: pattern },
        { locationCountry: pattern },
        { "container.type": pattern },
        { "container.size": pattern },
        { "container.height": pattern },
        { "container.condition": pattern },
        { containerType: pattern },
        { dealType: pattern },
        { contactEmail: pattern },
      ];
    }

    if (type !== "all") {
      filter.type = type;
    }

    if (status !== "all") {
      filter.status = status;
    }

    const sortFieldMap = {
      createdAt: "createdAt",
      availableFrom: "availableFrom",
      expiresAt: "expiresAt",
      quantity: "quantity",
      companyName: "companyName",
    } as const;

    const sortField = sortFieldMap[sortBy];
    const sortDirection = sortDir === "asc" ? 1 : -1;
    const sort: Record<string, 1 | -1> = { [sortField]: sortDirection };
    if (sortField !== "createdAt") {
      sort.createdAt = -1;
    }

    const listings = await getContainerListingsCollection();
    const total = await listings.countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(page, totalPages);
    const skip = (currentPage - 1) * pageSize;

    const rows = await listings.find(filter).sort(sort).skip(skip).limit(pageSize).toArray();

    return NextResponse.json({
      items: rows.map(mapContainerListingToItem),
      meta: {
        page: currentPage,
        pageSize,
        total,
        totalPages,
      },
    });
  } catch (error) {
    logError("Unhandled API error", { route: "/api/admin/containers", error });
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown admin containers error",
      },
      { status: 500 },
    );
  }
}

