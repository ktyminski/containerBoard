import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getCurrentUserFromRequest } from "@/lib/auth-user";
import { normalizeGeocodeAddressParts } from "@/lib/geocode-address";
import {
  ensureContainerListingsIndexes,
  expireContainerListingsIfNeeded,
  getContainerListingsCollection,
  getDefaultListingExpiration,
  mapContainerListingToItem,
} from "@/lib/container-listings";
import {
  CONTAINER_CONDITIONS,
  CONTAINER_FEATURES,
  CONTAINER_HEIGHTS,
  CONTAINER_SIZES,
  CONTAINER_TYPES,
  DEAL_TYPES,
  LISTING_TYPES,
  LISTING_STATUS,
  type ContainerSize,
  type ListingStatus,
} from "@/lib/container-listing-types";
import { USER_ROLE } from "@/lib/user-roles";
import { logError } from "@/lib/server-logger";

export const runtime = "nodejs";

const locationAddressPartsSchema = z.object({
  street: z.string().trim().min(1).max(120).optional(),
  houseNumber: z.string().trim().min(1).max(40).optional(),
  city: z.string().trim().min(1).max(120).optional(),
  country: z.string().trim().min(1).max(120).optional(),
});

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const updateSchema = z.object({
  action: z.literal("update"),
  type: z.enum(LISTING_TYPES),
  container: z.object({
    size: z
      .number()
      .int()
      .refine((value) => CONTAINER_SIZES.includes(value as (typeof CONTAINER_SIZES)[number])),
    height: z.enum(CONTAINER_HEIGHTS),
    type: z.enum(CONTAINER_TYPES),
    features: z.array(z.enum(CONTAINER_FEATURES)).default([]),
    condition: z.enum(CONTAINER_CONDITIONS),
  }),
  quantity: z.coerce.number().int().min(1).max(100_000),
  locationLat: z.coerce.number().finite().min(-90).max(90),
  locationLng: z.coerce.number().finite().min(-180).max(180),
  locationAddressLabel: z.string().trim().max(250).optional(),
  locationAddressParts: locationAddressPartsSchema.optional(),
  availableFrom: z.coerce.date(),
  dealType: z.enum(DEAL_TYPES),
  price: z.string().trim().max(100).optional(),
  description: z.string().trim().max(2_000).optional(),
  companyName: z.string().trim().min(2).max(160),
  contactEmail: z.email().trim().max(160),
  contactPhone: z.string().trim().max(40).optional(),
});

const closeSchema = z.object({
  action: z.literal("close"),
});

const refreshSchema = z.object({
  action: z.literal("refresh"),
});

const adminSetStatusSchema = z.object({
  action: z.literal("setStatus"),
  status: z.enum(["active", "expired", "closed"]),
});

function normalizeOptionalString(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function canManageListing(input: {
  listingOwnerId: ObjectId;
  userId: ObjectId;
  isAdmin: boolean;
}): boolean {
  if (input.isAdmin) {
    return true;
  }

  return input.listingOwnerId.toHexString() === input.userId.toHexString();
}

function isPubliclyVisible(status: ListingStatus, expiresAt: Date): boolean {
  return status === LISTING_STATUS.ACTIVE && expiresAt.getTime() > Date.now();
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    await ensureContainerListingsIndexes();
    await expireContainerListingsIfNeeded();

    const { id } = await context.params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid listing id" }, { status: 400 });
    }

    const listings = await getContainerListingsCollection();
    const listing = await listings.findOne({ _id: new ObjectId(id) });
    if (!listing?._id) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    const user = await getCurrentUserFromRequest(request);
    const isAdmin = user?.role === USER_ROLE.ADMIN;
    const isOwner = user?._id
      ? listing.createdByUserId.toHexString() === user._id.toHexString()
      : false;

    if (!isPubliclyVisible(listing.status, listing.expiresAt) && !isOwner && !isAdmin) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    return NextResponse.json({ item: mapContainerListingToItem(listing) });
  } catch (error) {
    logError("Unhandled API error", { route: "/api/containers/[id]", error });
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown container details error",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    await ensureContainerListingsIndexes();

    const { id } = await context.params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid listing id" }, { status: 400 });
    }

    const user = await getCurrentUserFromRequest(request);
    if (!user?._id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const listingId = new ObjectId(id);
    const listings = await getContainerListingsCollection();
    const listing = await listings.findOne({ _id: listingId });
    if (!listing?._id) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    const isAdmin = user.role === USER_ROLE.ADMIN;
    if (!canManageListing({ listingOwnerId: listing.createdByUserId, userId: user._id, isAdmin })) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (user.isBlocked === true && !isAdmin) {
      return NextResponse.json(
        { error: "Blocked user cannot modify listings" },
        { status: 403 },
      );
    }

    const payload = await request.json();

    const updateParsed = updateSchema.safeParse(payload);
    if (updateParsed.success) {
      const now = new Date();
      const locationAddressLabel = normalizeOptionalString(updateParsed.data.locationAddressLabel);
      const locationAddressParts = normalizeGeocodeAddressParts(updateParsed.data.locationAddressParts);
      const locationCity = locationAddressParts?.city ?? "";
      const locationCountry = locationAddressParts?.country ?? "";
      const unsetPatch: Record<string, 1> = {};
      unsetPatch.containerType = 1;
      if (!locationAddressLabel) {
        unsetPatch.locationAddressLabel = 1;
      }
      if (!locationAddressParts) {
        unsetPatch.locationAddressParts = 1;
      }

      await listings.updateOne(
        { _id: listingId },
        {
          $set: {
            type: updateParsed.data.type,
            container: {
              size: updateParsed.data.container.size as ContainerSize,
              height: updateParsed.data.container.height,
              type: updateParsed.data.container.type,
              features: Array.from(new Set(updateParsed.data.container.features)),
              condition: updateParsed.data.container.condition,
            },
            quantity: updateParsed.data.quantity,
            locationCity,
            locationCountry,
            locationLat: updateParsed.data.locationLat,
            locationLng: updateParsed.data.locationLng,
            ...(locationAddressLabel ? { locationAddressLabel } : {}),
            ...(locationAddressParts ? { locationAddressParts } : {}),
            availableFrom: updateParsed.data.availableFrom,
            dealType: updateParsed.data.dealType,
            price: normalizeOptionalString(updateParsed.data.price),
            description: normalizeOptionalString(updateParsed.data.description),
            companyName: updateParsed.data.companyName.trim(),
            contactEmail: updateParsed.data.contactEmail.trim(),
            contactPhone: normalizeOptionalString(updateParsed.data.contactPhone),
            updatedAt: now,
          },
          ...(Object.keys(unsetPatch).length > 0 ? { $unset: unsetPatch } : {}),
        },
      );

      const refreshed = await listings.findOne({ _id: listingId });
      return NextResponse.json({ item: refreshed ? mapContainerListingToItem(refreshed) : null });
    }

    const closeParsed = closeSchema.safeParse(payload);
    if (closeParsed.success) {
      const now = new Date();
      await listings.updateOne(
        { _id: listingId },
        {
          $set: {
            status: LISTING_STATUS.CLOSED,
            updatedAt: now,
          },
        },
      );

      return NextResponse.json({ ok: true });
    }

    const refreshParsed = refreshSchema.safeParse(payload);
    if (refreshParsed.success) {
      const now = new Date();
      await listings.updateOne(
        { _id: listingId },
        {
          $set: {
            status: LISTING_STATUS.ACTIVE,
            expiresAt: getDefaultListingExpiration(now),
            updatedAt: now,
          },
        },
      );

      return NextResponse.json({ ok: true });
    }

    const adminStatusParsed = adminSetStatusSchema.safeParse(payload);
    if (adminStatusParsed.success && isAdmin) {
      const now = new Date();
      const patch: {
        status: ListingStatus;
        updatedAt: Date;
        expiresAt?: Date;
      } = {
        status: adminStatusParsed.data.status as ListingStatus,
        updatedAt: now,
      };

      if (patch.status === LISTING_STATUS.ACTIVE) {
        patch.expiresAt = getDefaultListingExpiration(now);
      }

      await listings.updateOne(
        { _id: listingId },
        { $set: patch },
      );

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { error: "Invalid payload" },
      { status: 400 },
    );
  } catch (error) {
    logError("Unhandled API error", { route: "/api/containers/[id]", error });
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown update container error",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid listing id" }, { status: 400 });
    }

    const user = await getCurrentUserFromRequest(request);
    if (!user?._id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const listingId = new ObjectId(id);
    const listings = await getContainerListingsCollection();
    const listing = await listings.findOne({ _id: listingId }, { projection: { _id: 1, createdByUserId: 1 } });
    if (!listing?._id) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    const isAdmin = user.role === USER_ROLE.ADMIN;
    if (!canManageListing({ listingOwnerId: listing.createdByUserId, userId: user._id, isAdmin })) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (user.isBlocked === true && !isAdmin) {
      return NextResponse.json(
        { error: "Blocked user cannot delete listings" },
        { status: 403 },
      );
    }

    await listings.deleteOne({ _id: listingId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    logError("Unhandled API error", { route: "/api/containers/[id]", error });
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown delete container error",
      },
      { status: 500 },
    );
  }
}

