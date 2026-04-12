import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import sanitizeHtml from "sanitize-html";
import { z } from "zod";
import { getCurrentUserFromRequest } from "@/lib/auth-user";
import { normalizeGeocodeAddressParts } from "@/lib/geocode-address";
import {
  MAX_LISTING_LOCATIONS,
  normalizeListingLocations,
} from "@/lib/listing-locations";
import {
  ensureContainerListingsIndexes,
  expireContainerListingsIfNeeded,
  getContainerListingFavoritesCollection,
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
  LISTING_TYPES,
  LISTING_STATUS,
  PRICE_CURRENCIES,
  PRICE_TAX_MODES,
  PRICE_TYPES,
  PRICE_UNITS,
  type ContainerSize,
  type ListingStatus,
} from "@/lib/container-listing-types";
import {
  buildLegacyListingPrice,
  normalizeListingPrice,
  type ListingPriceInput,
} from "@/lib/listing-price";
import { getRichTextLength, hasRichTextContent } from "@/lib/listing-rich-text";
import { USER_ROLE } from "@/lib/user-roles";
import { logError } from "@/lib/server-logger";

export const runtime = "nodejs";
const DESCRIPTION_MAX_TEXT_LENGTH = 1000;
const DESCRIPTION_ALLOWED_TAGS = ["p", "br", "strong", "em", "u", "ul", "ol", "li", "div"];

const locationAddressPartsSchema = z.object({
  street: z.string().trim().min(1).max(120).optional(),
  houseNumber: z.string().trim().min(1).max(40).optional(),
  city: z.string().trim().min(1).max(120).optional(),
  country: z.string().trim().min(1).max(120).optional(),
});

const listingLocationSchema = z.object({
  locationLat: z.coerce.number().finite().min(-90).max(90),
  locationLng: z.coerce.number().finite().min(-180).max(180),
  locationCity: z.string().trim().max(120).optional(),
  locationCountry: z.string().trim().max(120).optional(),
  locationAddressLabel: z.string().trim().max(250).optional(),
  locationAddressParts: locationAddressPartsSchema.optional(),
  isPrimary: z.coerce.boolean().optional(),
});

const pricingOriginalSchema = z.object({
  amount: z.coerce.number().finite().nonnegative().max(100_000_000).nullable(),
  currency: z.enum(PRICE_CURRENCIES).nullable(),
  unit: z.enum(PRICE_UNITS).nullable(),
  taxMode: z.enum(PRICE_TAX_MODES).nullable(),
  vatRate: z.coerce.number().finite().min(0).max(100).nullable(),
  negotiable: z.coerce.boolean(),
});

const pricingPayloadSchema = z
  .object({
    type: z.enum(PRICE_TYPES),
    original: pricingOriginalSchema,
  })
  .superRefine((value, context) => {
    if (value.type === "request") {
      return;
    }

    if (value.original.amount === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["original", "amount"],
        message: "Amount is required for fixed/starting_from price type",
      });
    }
    if (value.original.currency === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["original", "currency"],
        message: "Currency is required for fixed/starting_from price type",
      });
    }
    if (value.original.unit === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["original", "unit"],
        message: "Unit is required for fixed/starting_from price type",
      });
    }
    if (value.original.taxMode === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["original", "taxMode"],
        message: "Tax mode is required for fixed/starting_from price type",
      });
    }
  });

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const updateSchema = z.object({
  action: z.literal("update"),
  type: z.enum(LISTING_TYPES),
  title: z.string().trim().max(80).optional(),
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
  locationLat: z.coerce.number().finite().min(-90).max(90).optional(),
  locationLng: z.coerce.number().finite().min(-180).max(180).optional(),
  locationAddressLabel: z.string().trim().max(250).optional(),
  locationAddressParts: locationAddressPartsSchema.optional(),
  locations: z.array(listingLocationSchema).min(1).max(MAX_LISTING_LOCATIONS).optional(),
  availableNow: z.coerce.boolean().optional(),
  availableFromApproximate: z.coerce.boolean().optional(),
  availableFrom: z.coerce.date().optional(),
  pricing: pricingPayloadSchema.optional(),
  priceAmount: z.coerce.number().finite().nonnegative().max(100_000_000).optional(),
  priceNegotiable: z.coerce.boolean().optional(),
  logisticsTransportAvailable: z.coerce.boolean().optional(),
  logisticsTransportIncluded: z.coerce.boolean().optional(),
  logisticsTransportFreeDistanceKm: z.coerce.number().int().min(1).max(10_000).optional(),
  logisticsUnloadingAvailable: z.coerce.boolean().optional(),
  logisticsUnloadingIncluded: z.coerce.boolean().optional(),
  logisticsComment: z.string().trim().max(600).optional(),
  hasCscPlate: z.coerce.boolean().optional(),
  hasCscCertification: z.coerce.boolean().optional(),
  productionYear: z.coerce.number().int().min(1900).max(2100).optional(),
  price: z.string().trim().max(100).optional(),
  description: z.string().trim().max(16_000).optional(),
  companyName: z.string().trim().min(2).max(160),
  contactEmail: z.email().trim().max(160),
  contactPhone: z.string().trim().max(40).optional(),
}).superRefine((value, context) => {
  const hasLegacyLocation =
    typeof value.locationLat === "number" &&
    Number.isFinite(value.locationLat) &&
    typeof value.locationLng === "number" &&
    Number.isFinite(value.locationLng);
  const hasLocations = Array.isArray(value.locations) && value.locations.length > 0;

  if (!hasLegacyLocation && !hasLocations) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["locations"],
      message: "At least one location is required",
    });
  }

  if (value.availableNow !== true && !value.availableFrom) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["availableFrom"],
      message: "availableFrom is required when availableNow is false",
    });
  }

  if (
    value.logisticsTransportIncluded === true &&
    typeof value.logisticsTransportFreeDistanceKm !== "number"
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["logisticsTransportFreeDistanceKm"],
      message: "logisticsTransportFreeDistanceKm is required when transport is included",
    });
  }
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

function normalizeOptionalDescriptionHtml(value?: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || !hasRichTextContent(trimmed)) {
    return undefined;
  }

  const sanitized = sanitizeHtml(trimmed, {
    allowedTags: DESCRIPTION_ALLOWED_TAGS,
    allowedAttributes: {},
  }).trim();

  if (!sanitized || !hasRichTextContent(sanitized)) {
    return undefined;
  }

  return sanitized;
}

function resolveAvailableFromDate(input: {
  availableNow?: boolean;
  availableFrom?: Date;
  now: Date;
}): Date {
  if (input.availableNow === true) {
    return input.now;
  }

  if (input.availableFrom instanceof Date && Number.isFinite(input.availableFrom.getTime())) {
    return input.availableFrom;
  }

  return input.now;
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
      const legacyLocationAddressLabel = normalizeOptionalString(updateParsed.data.locationAddressLabel);
      const legacyLocationAddressParts = normalizeGeocodeAddressParts(updateParsed.data.locationAddressParts);
      const normalizedLocations = normalizeListingLocations({
        locations: updateParsed.data.locations,
        fallback: {
          locationLat: updateParsed.data.locationLat,
          locationLng: updateParsed.data.locationLng,
          locationAddressLabel: legacyLocationAddressLabel,
          locationAddressParts: legacyLocationAddressParts,
          isPrimary: true,
        },
        max: MAX_LISTING_LOCATIONS,
      });
      const primaryLocation = normalizedLocations[0];
      if (!primaryLocation) {
        return NextResponse.json(
          { error: "At least one valid location is required" },
          { status: 400 },
        );
      }

      const locationAddressLabel = primaryLocation.locationAddressLabel;
      const locationAddressParts = primaryLocation.locationAddressParts;
      const locationCity = primaryLocation.locationCity;
      const locationCountry = primaryLocation.locationCountry;
      const resolvedAvailableFrom = resolveAvailableFromDate({
        availableNow: updateParsed.data.availableNow,
        availableFrom: updateParsed.data.availableFrom,
        now,
      });
      const normalizedTitle = normalizeOptionalString(updateParsed.data.title);
      const normalizedDescription = normalizeOptionalDescriptionHtml(updateParsed.data.description);
      const normalizedPrice = normalizeOptionalString(updateParsed.data.price);
      const normalizedLogisticsComment = normalizeOptionalString(updateParsed.data.logisticsComment);
      const normalizedPriceAmount =
        typeof updateParsed.data.priceAmount === "number" &&
        Number.isFinite(updateParsed.data.priceAmount)
          ? updateParsed.data.priceAmount
          : undefined;
      const logisticsTransportIncluded = updateParsed.data.logisticsTransportIncluded === true;
      const logisticsTransportAvailable =
        updateParsed.data.logisticsTransportAvailable === true || logisticsTransportIncluded;
      const normalizedLogisticsTransportFreeDistanceKm =
        logisticsTransportIncluded &&
        typeof updateParsed.data.logisticsTransportFreeDistanceKm === "number" &&
        Number.isFinite(updateParsed.data.logisticsTransportFreeDistanceKm) &&
        updateParsed.data.logisticsTransportFreeDistanceKm > 0
          ? Math.trunc(updateParsed.data.logisticsTransportFreeDistanceKm)
          : undefined;
      const logisticsUnloadingIncluded = updateParsed.data.logisticsUnloadingIncluded === true;
      const logisticsUnloadingAvailable =
        updateParsed.data.logisticsUnloadingAvailable === true || logisticsUnloadingIncluded;
      const normalizedPricing =
        updateParsed.data.pricing
          ? normalizeListingPrice(updateParsed.data.pricing as ListingPriceInput, now)
          : buildLegacyListingPrice({
              amount: normalizedPriceAmount,
              negotiable: updateParsed.data.priceNegotiable,
              now,
            });
      const unsetPatch: Record<string, 1> = {};
      unsetPatch.containerType = 1;
      if (!locationAddressLabel) {
        unsetPatch.locationAddressLabel = 1;
      }
      if (!locationAddressParts) {
        unsetPatch.locationAddressParts = 1;
      }
      if (normalizedPriceAmount === undefined && normalizedPricing?.original.amount === null) {
        unsetPatch.priceAmount = 1;
      }
      if (!normalizedPricing) {
        unsetPatch.pricing = 1;
      }
      if (typeof updateParsed.data.productionYear !== "number") {
        unsetPatch.productionYear = 1;
      }
      if (!normalizedTitle) {
        unsetPatch.title = 1;
      }
      if (!normalizedDescription) {
        unsetPatch.description = 1;
      }
      if (!normalizedLogisticsComment) {
        unsetPatch.logisticsComment = 1;
      }
      if (normalizedLogisticsTransportFreeDistanceKm === undefined) {
        unsetPatch.logisticsTransportFreeDistanceKm = 1;
      }

      if (
        normalizedDescription &&
        getRichTextLength(normalizedDescription) > DESCRIPTION_MAX_TEXT_LENGTH
      ) {
        return NextResponse.json(
          { error: `description exceeds ${DESCRIPTION_MAX_TEXT_LENGTH} characters` },
          { status: 400 },
        );
      }

      await listings.updateOne(
        { _id: listingId },
        {
          $set: {
            type: updateParsed.data.type,
            ...(normalizedTitle ? { title: normalizedTitle } : {}),
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
            locationLat: primaryLocation.locationLat,
            locationLng: primaryLocation.locationLng,
            ...(locationAddressLabel ? { locationAddressLabel } : {}),
            ...(locationAddressParts ? { locationAddressParts } : {}),
            locations: normalizedLocations,
            availableNow: updateParsed.data.availableNow === true,
            availableFromApproximate:
              updateParsed.data.availableNow === true
                ? false
                : updateParsed.data.availableFromApproximate === true,
            availableFrom: resolvedAvailableFrom,
            ...(normalizedPricing ? { pricing: normalizedPricing } : {}),
            ...(normalizedPriceAmount !== undefined || normalizedPricing?.original.amount !== null
              ? { priceAmount: normalizedPriceAmount ?? normalizedPricing?.original.amount ?? undefined }
              : {}),
            priceNegotiable:
              normalizedPricing?.original.negotiable === true ||
              updateParsed.data.priceNegotiable === true,
            logisticsTransportAvailable,
            logisticsTransportIncluded:
              logisticsTransportAvailable && logisticsTransportIncluded,
            ...(normalizedLogisticsTransportFreeDistanceKm !== undefined
              ? { logisticsTransportFreeDistanceKm: normalizedLogisticsTransportFreeDistanceKm }
              : {}),
            logisticsUnloadingAvailable,
            logisticsUnloadingIncluded:
              logisticsUnloadingAvailable && logisticsUnloadingIncluded,
            ...(normalizedLogisticsComment ? { logisticsComment: normalizedLogisticsComment } : {}),
            hasCscPlate: updateParsed.data.hasCscPlate === true,
            hasCscCertification: updateParsed.data.hasCscCertification === true,
            ...(typeof updateParsed.data.productionYear === "number"
              ? { productionYear: updateParsed.data.productionYear }
              : {}),
            price:
              normalizedPrice ??
              (normalizedPriceAmount !== undefined
                ? String(normalizedPriceAmount)
                : normalizedPricing?.original.amount !== null
                  ? String(normalizedPricing?.original.amount)
                  : undefined),
            ...(normalizedDescription ? { description: normalizedDescription } : {}),
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
    await (await getContainerListingFavoritesCollection()).deleteMany({ listingId });
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


