import { NextRequest, NextResponse } from "next/server";
import { ObjectId, type Filter } from "mongodb";
import { z } from "zod";
import { enforceAuthenticatedRateLimitOrResponse } from "@/lib/app-rate-limit";
import { getCurrentUserFromRequest } from "@/lib/auth-user";
import {
  getContainerListingsCollection,
  mapContainerListingToItem,
  type ContainerListingDocument,
} from "@/lib/container-listings";
import {
  ensureSocialPostDraftIndexes,
  getSocialPostDraftsCollection,
  SOCIAL_PLATFORMS,
  SOCIAL_POST_DRAFT_STATUSES,
  type SocialPostDraftDocument,
} from "@/lib/social-post-drafts";
import { getContainerShortLabel } from "@/lib/container-listing-types";
import { USER_ROLE } from "@/lib/user-roles";
import { logError } from "@/lib/server-logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(20),
  platform: z.union([z.enum(SOCIAL_PLATFORMS), z.literal("all")]).default("all"),
  status: z
    .union([z.enum(SOCIAL_POST_DRAFT_STATUSES), z.literal("all")])
    .default("all"),
});

const patchSchema = z.object({
  id: z.string().refine((value) => ObjectId.isValid(value), "Invalid draft id"),
  status: z.enum(SOCIAL_POST_DRAFT_STATUSES),
});

function mapDraftForApi(
  draft: SocialPostDraftDocument,
  listing?: ContainerListingDocument,
) {
  const item = listing ? mapContainerListingToItem(listing) : null;

  return {
    id: draft._id.toHexString(),
    listingId: draft.listingId.toHexString(),
    platform: draft.platform,
    status: draft.status,
    title: draft.title,
    caption: draft.caption,
    imageUrl: draft.imageUrl,
    previewImageUrl: `/api/admin/social-post-drafts/${draft._id.toHexString()}/image?v=${draft.updatedAt.getTime()}`,
    listingUrl: draft.listingUrl,
    dateKey: draft.dateKey,
    generatedAt: draft.generatedAt.toISOString(),
    postedAt: draft.postedAt?.toISOString() ?? null,
    skippedAt: draft.skippedAt?.toISOString() ?? null,
    listing: item
      ? {
          companyName: item.companyName,
          containerLabel: getContainerShortLabel(item.container),
          location: [item.locationCity, item.locationCountry].filter(Boolean).join(", "),
          status: item.status,
        }
      : null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user?._id || user.role !== USER_ROLE.ADMIN) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const rateLimitResponse = await enforceAuthenticatedRateLimitOrResponse({
      request,
      scope: "admin:social-post-drafts:read",
      userId: user._id.toHexString(),
      ipLimit: 240,
      userLimit: 120,
    });
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const parsed = querySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
    }

    await ensureSocialPostDraftIndexes();

    const { page, pageSize, platform, status } = parsed.data;
    const filter: Filter<SocialPostDraftDocument> = {};
    if (platform !== "all") {
      filter.platform = platform;
    }
    if (status !== "all") {
      filter.status = status;
    }

    const drafts = await getSocialPostDraftsCollection();
    const total = await drafts.countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(page, totalPages);
    const rows = await drafts
      .find(filter)
      .sort({ generatedAt: -1, platform: 1 })
      .skip((currentPage - 1) * pageSize)
      .limit(pageSize)
      .toArray();

    const listingIds = Array.from(
      new Set(rows.map((draft) => draft.listingId.toHexString())),
    ).map((id) => new ObjectId(id));
    const listings = await getContainerListingsCollection();
    const listingRows =
      listingIds.length > 0
        ? await listings.find({ _id: { $in: listingIds } }).toArray()
        : [];
    const listingById = new Map(
      listingRows.map((listing) => [listing._id.toHexString(), listing]),
    );

    return NextResponse.json({
      items: rows.map((draft) =>
        mapDraftForApi(draft, listingById.get(draft.listingId.toHexString())),
      ),
      meta: {
        page: currentPage,
        pageSize,
        total,
        totalPages,
      },
    });
  } catch (error) {
    logError("Unhandled API error", {
      route: "/api/admin/social-post-drafts",
      error,
    });
    return NextResponse.json(
      {
        error: "Internal server error",
        message:
          error instanceof Error
            ? error.message
            : "Unknown admin social drafts error",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user?._id || user.role !== USER_ROLE.ADMIN) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const rateLimitResponse = await enforceAuthenticatedRateLimitOrResponse({
      request,
      scope: "admin:social-post-drafts:write",
      userId: user._id.toHexString(),
      ipLimit: 120,
      userLimit: 80,
    });
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    await ensureSocialPostDraftIndexes();

    const now = new Date();
    const setFields: Partial<SocialPostDraftDocument> = {
      status: parsed.data.status,
      updatedAt: now,
    };
    const unsetFields: Record<string, ""> = {};
    if (parsed.data.status === "posted") {
      setFields.postedAt = now;
      unsetFields.skippedAt = "";
    } else if (parsed.data.status === "skipped") {
      setFields.skippedAt = now;
      unsetFields.postedAt = "";
    } else {
      unsetFields.postedAt = "";
      unsetFields.skippedAt = "";
    }
    const drafts = await getSocialPostDraftsCollection();
    const result = await drafts.updateOne(
      { _id: new ObjectId(parsed.data.id) },
      {
        $set: setFields,
        ...(Object.keys(unsetFields).length > 0 ? { $unset: unsetFields } : {}),
      },
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    logError("Unhandled API error", {
      route: "/api/admin/social-post-drafts",
      error,
    });
    return NextResponse.json(
      {
        error: "Internal server error",
        message:
          error instanceof Error
            ? error.message
            : "Unknown admin social draft update error",
      },
      { status: 500 },
    );
  }
}
