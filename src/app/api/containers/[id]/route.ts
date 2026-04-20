import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
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
  type ContainerListingImageAsset,
} from "@/lib/container-listings";
import { getCompaniesCollection } from "@/lib/companies";
import {
  LISTING_STATUS,
  type ContainerSize,
  type ListingStatus,
} from "@/lib/container-listing-types";
import {
  buildLegacyListingPrice,
  normalizeListingPrice,
  type ListingPriceInput,
} from "@/lib/listing-price";
import { processGalleryUpload } from "@/lib/company-media";
import {
  buildBlobPath,
  safeDeleteBlobUrls,
  uploadBlobFromBuffer,
} from "@/lib/blob-storage";
import { enforceAuthenticatedRateLimitOrResponse, enforcePublicReadRateLimitOrResponse } from "@/lib/app-rate-limit";
import { getLatestFxContext } from "@/lib/fx-rates";
import { getRichTextLength } from "@/lib/listing-rich-text";
import {
  LISTING_DESCRIPTION_MAX_TEXT_LENGTH,
  normalizeOptionalListingDescriptionHtml,
} from "@/lib/listing-description-html";
import {
  MAX_CONTAINER_RAL_COLORS,
  parseContainerRalColors,
} from "@/lib/container-ral-colors";
import {
  buildListingPersistenceFields,
  normalizeOptionalString,
  resolveAvailableFromDate,
} from "@/lib/container-listing-write";
import { updateListingSchema } from "@/lib/container-listing-write-schema";
import { USER_ROLE } from "@/lib/user-roles";
import { logError } from "@/lib/server-logger";

export const runtime = "nodejs";
const MAX_LISTING_PHOTO_COUNT = 4;
const MAX_LISTING_PHOTO_BYTES = 5 * 1024 * 1024;

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const updateSchema = updateListingSchema;

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

function parseJsonField<T>(value: FormDataEntryValue | null): T | null {
  if (typeof value !== "string") {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function ensureImageFile(file: File, maxBytes: number, field: string): string | null {
  if (!file.type.startsWith("image/")) {
    return `${field} must be an image file`;
  }

  if (file.size > maxBytes) {
    return `${field} exceeds size limit`;
  }

  return null;
}

function assetDataToBuffer(asset: ContainerListingImageAsset): Buffer {
  if (!asset.data?.buffer) {
    throw new Error("Missing processed image buffer");
  }

  return Buffer.from(asset.data.buffer);
}

function toStoredImageAsset(
  asset: ContainerListingImageAsset,
  blobUrl: string,
): ContainerListingImageAsset {
  return {
    filename: asset.filename,
    contentType: asset.contentType,
    size: asset.size,
    width: asset.width,
    height: asset.height,
    blobUrl,
  };
}

async function uploadContainerImageAsset(input: {
  listingId: ObjectId;
  key: string;
  asset: ContainerListingImageAsset;
}): Promise<ContainerListingImageAsset> {
  const buffer = assetDataToBuffer(input.asset);
  const { url } = await uploadBlobFromBuffer({
    pathname: buildBlobPath({
      segments: ["containers", input.listingId.toHexString(), input.key],
      filenameBase: input.asset.filename,
      contentType: input.asset.contentType,
    }),
    contentType: input.asset.contentType,
    access: "public",
    cacheControlMaxAge: 31536000,
    buffer,
  });

  return toStoredImageAsset(input.asset, url);
}

function toBlobUrls(
  assets: Array<ContainerListingImageAsset | null | undefined>,
): string[] {
  return assets
    .map((asset) => asset?.blobUrl?.trim() ?? "")
    .filter(Boolean);
}

async function parsePatchBody(request: NextRequest): Promise<{
  payload: unknown;
  photoFiles: File[];
  keepPhotoIndexesRaw: unknown[] | null;
  prependUploadedPhotos: boolean;
}> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const prependUploadedPhotosRaw = formData.get("prependUploadedPhotos");
    return {
      payload: parseJsonField<unknown>(formData.get("payload")),
      photoFiles: formData
        .getAll("photos")
        .filter((item): item is File => item instanceof File && item.size > 0),
      keepPhotoIndexesRaw: parseJsonField<unknown[]>(formData.get("keepPhotoIndexes")),
      prependUploadedPhotos:
        prependUploadedPhotosRaw === "1" ||
        prependUploadedPhotosRaw === "true",
    };
  }

  return {
    payload: await request.json(),
    photoFiles: [],
    keepPhotoIndexesRaw: null,
    prependUploadedPhotos: false,
  };
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
    const rateLimitResponse = await enforcePublicReadRateLimitOrResponse({
      request,
      scope: "containers:details",
      limit: 300,
    });
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

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
    const rateLimitResponse = await enforceAuthenticatedRateLimitOrResponse({
      request,
      scope: "containers:update",
      userId: user._id.toHexString(),
      ipLimit: 40,
      userLimit: 20,
    });
    if (rateLimitResponse) {
      return rateLimitResponse;
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

    const { payload, photoFiles, keepPhotoIndexesRaw, prependUploadedPhotos } = await parsePatchBody(request);

    const updateParsed = updateSchema.safeParse(payload);
    if (updateParsed.success) {
      if (photoFiles.length > MAX_LISTING_PHOTO_COUNT) {
        return NextResponse.json(
          {
            error: "Invalid files",
            issues: [`photos cannot exceed ${MAX_LISTING_PHOTO_COUNT} files`],
          },
          { status: 400 },
        );
      }
      const fileIssues = photoFiles
        .map((file, index) =>
          ensureImageFile(file, MAX_LISTING_PHOTO_BYTES, `photo ${index + 1}`),
        )
        .filter((issue): issue is string => Boolean(issue));
      if (fileIssues.length > 0) {
        return NextResponse.json(
          {
            error: "Invalid files",
            issues: fileIssues,
          },
          { status: 400 },
        );
      }
      const existingPhotos = listing.photos ?? [];
      const keepPhotoIndexes =
        keepPhotoIndexesRaw === null
          ? existingPhotos.map((_, index) => index)
          : Array.from(
              new Set(
                keepPhotoIndexesRaw
                  .map((value) => Number(value))
                  .filter(
                    (value) =>
                      Number.isInteger(value) &&
                      value >= 0 &&
                      value < existingPhotos.length,
                  ),
              ),
            );
      const keptExistingPhotos = keepPhotoIndexes
        .map((index) => existingPhotos[index])
        .filter(Boolean);
      const removedExistingPhotos = existingPhotos.filter(
        (_photo, index) => !keepPhotoIndexes.includes(index),
      );
      if (keptExistingPhotos.length + photoFiles.length > MAX_LISTING_PHOTO_COUNT) {
        return NextResponse.json(
          {
            error: "Invalid files",
            issues: [`photos cannot exceed ${MAX_LISTING_PHOTO_COUNT} files`],
          },
          { status: 400 },
        );
      }
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

      const resolvedAvailableFrom = resolveAvailableFromDate({
        availableNow: updateParsed.data.availableNow,
        availableFrom: updateParsed.data.availableFrom,
        now,
      });
      const normalizedDescription = normalizeOptionalListingDescriptionHtml(
        updateParsed.data.description,
      );
      const normalizedPrice = normalizeOptionalString(updateParsed.data.price);
      const normalizedLogisticsComment = normalizeOptionalString(updateParsed.data.logisticsComment);
      const hasContainerColorsRalInput = typeof updateParsed.data.containerColorsRal === "string";
      const parsedContainerColors = hasContainerColorsRalInput
        ? parseContainerRalColors(updateParsed.data.containerColorsRal)
        : null;
      if (parsedContainerColors?.tooMany) {
        return NextResponse.json(
          {
            error: `containerColorsRal supports at most ${MAX_CONTAINER_RAL_COLORS} RAL codes`,
          },
          { status: 400 },
        );
      }
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
      const normalizedCscValidToMonth =
        typeof updateParsed.data.cscValidToMonth === "number" &&
        Number.isInteger(updateParsed.data.cscValidToMonth) &&
        updateParsed.data.cscValidToMonth >= 1 &&
        updateParsed.data.cscValidToMonth <= 12
          ? updateParsed.data.cscValidToMonth
          : undefined;
      const normalizedCscValidToYear =
        typeof updateParsed.data.cscValidToYear === "number" &&
        Number.isInteger(updateParsed.data.cscValidToYear) &&
        updateParsed.data.cscValidToYear >= 1900 &&
        updateParsed.data.cscValidToYear <= 2100
          ? updateParsed.data.cscValidToYear
          : undefined;
      const fxContext = await getLatestFxContext(now);
      const normalizedPricing =
        updateParsed.data.pricing
          ? normalizeListingPrice(
              updateParsed.data.pricing as ListingPriceInput,
              now,
              fxContext,
            )
          : buildLegacyListingPrice({
              amount: normalizedPriceAmount,
              negotiable: updateParsed.data.priceNegotiable,
              now,
              fxContext,
            });
      const companies = await getCompaniesCollection();
      const ownerCompany = await companies.findOne(
        {
          createdByUserId: listing.createdByUserId,
          isBlocked: { $ne: true },
        },
        {
          projection: {
            name: 1,
            slug: 1,
          },
          sort: { updatedAt: -1 },
        },
      );
      const publishAsCompanyRequested = updateParsed.data.publishedAsCompany === true;
      const publishedAsCompany =
        listing.publishedAsCompany === true || publishAsCompanyRequested;
      const effectiveCompanyName = publishedAsCompany
        ? ownerCompany?.name?.trim() || listing.companyName
        : updateParsed.data.companyName.trim();
      const effectiveCompanySlug = publishedAsCompany
        ? ownerCompany?.slug?.trim() || listing.companySlug?.trim() || undefined
        : undefined;
      const uploadedBlobUrls: string[] = [];
      let storedNextUploadedPhotos: ContainerListingImageAsset[] = [];
      try {
        const nextUploadedPhotos =
          photoFiles.length > 0
            ? await Promise.all(photoFiles.map((file) => processGalleryUpload(file, "photo")))
            : [];
        storedNextUploadedPhotos =
          nextUploadedPhotos.length > 0
            ? await Promise.all(
                nextUploadedPhotos.map(async (asset, index) => {
                  const stored = await uploadContainerImageAsset({
                    listingId,
                    key: `photos/${keepPhotoIndexes.length + index}`,
                    asset,
                  });
                  if (stored.blobUrl) {
                    uploadedBlobUrls.push(stored.blobUrl);
                  }
                  return stored;
                }),
              )
            : [];
      } catch (mediaError) {
        if (uploadedBlobUrls.length > 0) {
          await safeDeleteBlobUrls(uploadedBlobUrls);
        }
        const message =
          mediaError instanceof Error ? mediaError.message : "image processing failed";
        return NextResponse.json(
          {
            error: "Invalid files",
            issues: [message],
          },
          { status: 400 },
        );
      }
      const nextPhotos = prependUploadedPhotos
        ? [...storedNextUploadedPhotos, ...keptExistingPhotos]
        : [...keptExistingPhotos, ...storedNextUploadedPhotos];
      const unsetPatch: Record<string, 1> = {};
      unsetPatch.containerType = 1;
      if (!primaryLocation.locationAddressLabel) {
        unsetPatch.locationAddressLabel = 1;
      }
      if (!primaryLocation.locationAddressParts) {
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
      if (normalizedCscValidToMonth === undefined || normalizedCscValidToYear === undefined) {
        unsetPatch.cscValidToMonth = 1;
        unsetPatch.cscValidToYear = 1;
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
      if (hasContainerColorsRalInput && parsedContainerColors?.colors.length === 0) {
        unsetPatch.containerColors = 1;
      }
      if (nextPhotos.length === 0) {
        unsetPatch.photos = 1;
      }
      if (!effectiveCompanySlug) {
        unsetPatch.companySlug = 1;
      }

      if (
        normalizedDescription &&
        getRichTextLength(normalizedDescription) >
          LISTING_DESCRIPTION_MAX_TEXT_LENGTH
      ) {
        return NextResponse.json(
          {
            error: `description exceeds ${LISTING_DESCRIPTION_MAX_TEXT_LENGTH} characters`,
          },
          { status: 400 },
        );
      }

      const { setFields } = buildListingPersistenceFields({
        type: listing.type,
        container: {
          size: updateParsed.data.container.size as ContainerSize,
          height: updateParsed.data.container.height,
          type: updateParsed.data.container.type,
          features: updateParsed.data.container.features,
          condition: updateParsed.data.container.condition,
        },
        parsedContainerColors: parsedContainerColors?.colors,
        photos: nextPhotos,
        quantity: updateParsed.data.quantity,
        normalizedLocations,
        availableNow: updateParsed.data.availableNow === true,
        availableFromApproximate:
          updateParsed.data.availableNow === true
            ? false
            : updateParsed.data.availableFromApproximate === true,
        resolvedAvailableFrom,
        normalizedPricing,
        normalizedPriceAmount,
        normalizedPrice,
        priceNegotiable: updateParsed.data.priceNegotiable,
        logisticsTransportAvailable,
        logisticsTransportIncluded,
        normalizedLogisticsTransportFreeDistanceKm,
        logisticsUnloadingAvailable,
        logisticsUnloadingIncluded,
        normalizedLogisticsComment,
        hasCscPlate: updateParsed.data.hasCscPlate === true,
        hasCscCertification: updateParsed.data.hasCscCertification === true,
        hasBranding: updateParsed.data.hasBranding === true,
        hasWarranty: updateParsed.data.hasWarranty === true,
        normalizedCscValidToMonth,
        normalizedCscValidToYear,
        productionYear:
          typeof updateParsed.data.productionYear === "number"
            ? updateParsed.data.productionYear
            : undefined,
        normalizedDescription,
        companyName: effectiveCompanyName,
        companySlug: effectiveCompanySlug,
        publishedAsCompany,
        contactEmail: updateParsed.data.contactEmail.trim(),
        contactPhone: normalizeOptionalString(updateParsed.data.contactPhone),
      });

      try {
        await listings.updateOne(
          { _id: listingId },
          {
            $set: {
              ...setFields,
              updatedAt: now,
            },
            ...(Object.keys(unsetPatch).length > 0 ? { $unset: unsetPatch } : {}),
          },
        );
      } catch (dbError) {
        if (uploadedBlobUrls.length > 0) {
          await safeDeleteBlobUrls(uploadedBlobUrls);
        }
        throw dbError;
      }
      const staleBlobUrls = toBlobUrls(removedExistingPhotos);
      if (staleBlobUrls.length > 0) {
        await safeDeleteBlobUrls(staleBlobUrls);
      }

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
          $unset: {
            expiryReminder7dSentAt: "",
            expiryReminder2dSentAt: "",
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

      await listings.updateOne({
        _id: listingId,
      }, {
        $set: patch,
        ...(patch.status === LISTING_STATUS.ACTIVE
          ? {
              $unset: {
                expiryReminder7dSentAt: "",
                expiryReminder2dSentAt: "",
              },
            }
          : {}),
      });

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
    const rateLimitResponse = await enforceAuthenticatedRateLimitOrResponse({
      request,
      scope: "containers:delete",
      userId: user._id.toHexString(),
      ipLimit: 20,
      userLimit: 10,
    });
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const listingId = new ObjectId(id);
    const listings = await getContainerListingsCollection();
    const listing = await listings.findOne(
      { _id: listingId },
      {
        projection: {
          _id: 1,
          createdByUserId: 1,
          "photos.blobUrl": 1,
        },
      },
    );
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
    const staleBlobUrls = toBlobUrls(listing.photos ?? []);
    if (staleBlobUrls.length > 0) {
      await safeDeleteBlobUrls(staleBlobUrls);
    }
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


