import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  ensureCompaniesIndexes,
  getCompaniesCollection,
  type CompanyImageAsset,
} from "@/lib/companies";
import { getCurrentUserFromRequest } from "@/lib/auth-user";
import {
  processBackgroundUpload,
  processGalleryUpload,
  processLogoUpload,
} from "@/lib/company-media";
import { enforceAuthenticatedRateLimitOrResponse } from "@/lib/app-rate-limit";
import {
  buildBlobPath,
  safeDeleteBlobUrls,
  uploadBlobFromBuffer,
} from "@/lib/blob-storage";
import {
  COMPANY_OPERATING_AREAS,
  normalizeCompanyOperatingArea,
} from "@/lib/company-operating-area";
import { normalizeCompanyVerificationStatus } from "@/lib/company-verification";
import { normalizeGeocodeAddressParts } from "@/lib/geocode-address";
import { USER_ROLE } from "@/lib/user-roles";
import { logError } from "@/lib/server-logger";

export const runtime = "nodejs";

const MAX_LOGO_BYTES = 3 * 1024 * 1024;
const MAX_BACKGROUND_BYTES = 6 * 1024 * 1024;
const MAX_PHOTO_BYTES = 6 * 1024 * 1024;
const MAX_BRANCH_PHOTO_COUNT = 3;
const MAX_TOTAL_IMAGES_BYTES = 14 * 1024 * 1024;

const optionalTrimmedStringAllowingNull = (maxLength: number) =>
  z.preprocess(
    (value) => (value === null ? undefined : value),
    z.string().trim().max(maxLength).optional(),
  );

const branchAddressPartsSchema = z
  .object({
    street: optionalTrimmedStringAllowingNull(120),
    houseNumber: optionalTrimmedStringAllowingNull(40),
    postalCode: optionalTrimmedStringAllowingNull(40),
    city: optionalTrimmedStringAllowingNull(120),
    country: optionalTrimmedStringAllowingNull(120),
  })
  .partial();

const updateCompanySchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(10).max(5000),
  operatingArea: z.enum(COMPANY_OPERATING_AREAS).default("local"),
  operatingAreaDetails: z.string().trim().max(200).optional().or(z.literal("")),
  nip: z.string().trim().max(30).optional().or(z.literal("")),
  phone: z.string().trim().max(60).optional().or(z.literal("")),
  email: z.string().trim().email().optional().or(z.literal("")),
  website: z.string().trim().max(600).optional().or(z.literal("")),
  facebookUrl: z.string().trim().max(600).optional().or(z.literal("")),
  instagramUrl: z.string().trim().max(600).optional().or(z.literal("")),
  linkedinUrl: z.string().trim().max(600).optional().or(z.literal("")),
  branches: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(120),
        addressText: z.string().trim().min(1).max(200),
        addressParts: branchAddressPartsSchema.nullable().optional(),
        useCustomDetails: z.boolean().optional().default(false),
        phone: z.string().trim().max(60).optional().or(z.literal("")),
        email: z.string().trim().email().optional().or(z.literal("")),
        lat: z.preprocess(
          (value) => {
            if (typeof value === "string" && value.trim().length === 0) {
              return Number.NaN;
            }
            return Number(value);
          },
          z.number().finite().gte(-90).lte(90),
        ),
        lng: z.preprocess(
          (value) => {
            if (typeof value === "string" && value.trim().length === 0) {
              return Number.NaN;
            }
            return Number(value);
          },
          z.number().finite().gte(-180).lte(180),
        ),
      }),
    )
    .min(1)
    .max(30),
});

function normalizeOptionalHttpLink(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) {
    return undefined;
  }
  const candidate = /^[a-z][a-z\d+\-.]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return undefined;
    }
    return parsed.toString();
  } catch {
    return undefined;
  }
}

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

function parseBooleanFormFlag(value: FormDataEntryValue | null): boolean {
  if (typeof value !== "string") {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
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

function assetDataToBuffer(asset: CompanyImageAsset): Buffer {
  if (!asset.data?.buffer) {
    throw new Error("Missing processed image buffer");
  }

  return Buffer.from(asset.data.buffer);
}

function toStoredImageAsset(
  asset: CompanyImageAsset,
  blobUrl: string,
): CompanyImageAsset {
  return {
    filename: asset.filename,
    contentType: asset.contentType,
    size: asset.size,
    width: asset.width,
    height: asset.height,
    blobUrl,
  };
}

async function uploadCompanyImageAsset(input: {
  companyId: ObjectId;
  key: string;
  asset: CompanyImageAsset;
}): Promise<CompanyImageAsset> {
  const buffer = assetDataToBuffer(input.asset);
  const { url } = await uploadBlobFromBuffer({
    pathname: buildBlobPath({
      segments: ["companies", input.companyId.toHexString(), input.key],
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
  assets: Array<CompanyImageAsset | null | undefined>,
): string[] {
  return assets
    .map((asset) => asset?.blobUrl?.trim() ?? "")
    .filter(Boolean);
}

function sumImageAssetBytes(
  assets: Array<{ size?: number } | null | undefined> | undefined,
): number {
  if (!assets || assets.length === 0) {
    return 0;
  }

  return assets.reduce((sum, asset) => {
    if (!asset || typeof asset.size !== "number" || !Number.isFinite(asset.size)) {
      return sum;
    }
    return sum + asset.size;
  }, 0);
}

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid company id" }, { status: 400 });
    }

    const user = await getCurrentUserFromRequest(request);
    if (!user?._id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const rateLimitResponse = await enforceAuthenticatedRateLimitOrResponse({
      request,
      scope: "companies:update",
      userId: user._id.toHexString(),
      ipLimit: 30,
      userLimit: 15,
    });
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    await ensureCompaniesIndexes();
    const companies = await getCompaniesCollection();
    const companyId = new ObjectId(id);
    const existing = await companies.findOne(
      { _id: companyId },
      {
        projection: {
          createdByUserId: 1,
          name: 1,
          "logo.size": 1,
          "logo.blobUrl": 1,
          "logoThumb.size": 1,
          "logoThumb.blobUrl": 1,
          "background.size": 1,
          "background.blobUrl": 1,
          "photos.blobUrl": 1,
          "locations.label": 1,
          "locations.addressText": 1,
          "locations.point": 1,
          "locations.photos.size": 1,
          "locations.photos.blobUrl": 1,
          verificationStatus: 1,
        },
      },
    );

    if (!existing) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const isAdmin = user.role === USER_ROLE.ADMIN;
    const isOwner =
      existing.createdByUserId &&
      existing.createdByUserId.toHexString() === user._id.toHexString();
    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const legacyCompanyPhotos =
      ((existing as unknown as { photos?: CompanyImageAsset[] }).photos ?? []);

    const formData = await request.formData();
    const removeLogo = parseBooleanFormFlag(formData.get("removeLogo"));
    const removeBackground = parseBooleanFormFlag(formData.get("removeBackground"));
    const payload = {
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? ""),
      operatingArea: String(formData.get("operatingArea") ?? "local"),
      operatingAreaDetails: String(formData.get("operatingAreaDetails") ?? ""),
      nip: String(formData.get("nip") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      email: String(formData.get("email") ?? ""),
      website: String(formData.get("website") ?? ""),
      facebookUrl: String(formData.get("facebookUrl") ?? ""),
      instagramUrl: String(formData.get("instagramUrl") ?? ""),
      linkedinUrl: String(formData.get("linkedinUrl") ?? ""),
      branches: parseJsonField<unknown[]>(formData.get("branches")) ?? [],
    };

    const parsed = updateCompanySchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid payload",
          issues: parsed.error.issues.map((issue) => issue.message),
        },
        { status: 400 },
      );
    }

    const logoInput = formData.get("logo");
    const logoFile = logoInput instanceof File && logoInput.size > 0 ? logoInput : null;
    const backgroundInput = formData.get("background");
    const backgroundFile =
      backgroundInput instanceof File && backgroundInput.size > 0 ? backgroundInput : null;
    const branchPhotoFiles = parsed.data.branches.map((_, branchIndex) =>
      formData
        .getAll(`branchPhotos-${branchIndex}`)
        .filter((item): item is File => item instanceof File && item.size > 0),
    );

    const issues: string[] = [];
    if (logoFile) {
      const logoIssue = ensureImageFile(logoFile, MAX_LOGO_BYTES, "logo");
      if (logoIssue) {
        issues.push(logoIssue);
      }
    }
    if (backgroundFile) {
      const backgroundIssue = ensureImageFile(
        backgroundFile,
        MAX_BACKGROUND_BYTES,
        "background",
      );
      if (backgroundIssue) {
        issues.push(backgroundIssue);
      }
    }
    for (let branchIndex = 0; branchIndex < branchPhotoFiles.length; branchIndex += 1) {
      const files = branchPhotoFiles[branchIndex];
      if (files.length > MAX_BRANCH_PHOTO_COUNT) {
        issues.push(`branch ${branchIndex + 1} has too many photos`);
      }
      for (const file of files) {
        const issue = ensureImageFile(file, MAX_PHOTO_BYTES, `branch ${branchIndex + 1} photo`);
        if (issue) {
          issues.push(issue);
        }
      }
    }

    const totalBytes =
      (logoFile?.size ?? 0) +
      (backgroundFile?.size ?? 0) +
      branchPhotoFiles.flat().reduce((sum, photo) => sum + photo.size, 0);
    if (totalBytes > MAX_TOTAL_IMAGES_BYTES) {
      issues.push("total images size exceeds limit");
    }

    const existingBranchPhotoBytesByIndex = (existing.locations ?? []).map((location) =>
      sumImageAssetBytes(location?.photos),
    );
    const nextBranchPhotoBytesByIndex = branchPhotoFiles.map((files) =>
      files.reduce((sum, photo) => sum + photo.size, 0),
    );
    const shouldKeepExistingLogo = !removeLogo || Boolean(logoFile);
    const shouldKeepExistingBackground = !removeBackground || Boolean(backgroundFile);
    const estimatedPersistedImagesBytes =
      (logoFile?.size ?? (shouldKeepExistingLogo ? existing.logo?.size ?? 0 : 0)) +
      (backgroundFile?.size ?? (shouldKeepExistingBackground ? existing.background?.size ?? 0 : 0)) +
      parsed.data.branches.reduce((sum, _branch, index) => {
        const nextBranchBytes = nextBranchPhotoBytesByIndex[index] ?? 0;
        if (nextBranchBytes > 0) {
          return sum + nextBranchBytes;
        }
        return sum + (existingBranchPhotoBytesByIndex[index] ?? 0);
      }, 0);
    if (estimatedPersistedImagesBytes > MAX_TOTAL_IMAGES_BYTES) {
      issues.push("total images size exceeds limit");
    }

    if (issues.length > 0) {
      return NextResponse.json({ error: "Invalid files", issues }, { status: 400 });
    }

    const operatingArea = normalizeCompanyOperatingArea(parsed.data.operatingArea);
    const operatingAreaDetails = parsed.data.operatingAreaDetails?.trim() || undefined;
    const nextCompanyName = parsed.data.name.trim();
    const nextCompanyDescription = parsed.data.description.trim();
    const nip = parsed.data.nip?.trim() || undefined;
    const phone = parsed.data.phone?.trim() || undefined;
    const email = parsed.data.email?.trim() || undefined;
    const website = normalizeOptionalHttpLink(parsed.data.website);
    const facebookUrl = normalizeOptionalHttpLink(parsed.data.facebookUrl);
    const instagramUrl = normalizeOptionalHttpLink(parsed.data.instagramUrl);
    const linkedinUrl = normalizeOptionalHttpLink(parsed.data.linkedinUrl);
    const urlIssues: string[] = [];
    if ((parsed.data.facebookUrl ?? "").trim() && !facebookUrl) {
      urlIssues.push("facebookUrl must be a valid URL");
    }
    if ((parsed.data.instagramUrl ?? "").trim() && !instagramUrl) {
      urlIssues.push("instagramUrl must be a valid URL");
    }
    if ((parsed.data.linkedinUrl ?? "").trim() && !linkedinUrl) {
      urlIssues.push("linkedinUrl must be a valid URL");
    }
    if (urlIssues.length > 0) {
      return NextResponse.json(
        { error: "Invalid payload", issues: urlIssues },
        { status: 400 },
      );
    }

    let nextLogo:
      | Awaited<ReturnType<typeof processLogoUpload>>["logo"]
      | undefined;
    let nextLogoThumb:
      | Awaited<ReturnType<typeof processLogoUpload>>["logoThumb"]
      | undefined;
    let nextBackground: CompanyImageAsset | undefined;
    let locationPhotos: CompanyImageAsset[][];

    try {
      if (logoFile) {
        const processedLogo = await processLogoUpload(logoFile);
        nextLogo = processedLogo.logo;
        nextLogoThumb = processedLogo.logoThumb;
      }
      nextBackground = backgroundFile ? await processBackgroundUpload(backgroundFile) : undefined;
      locationPhotos = await Promise.all(
        branchPhotoFiles.map((files, branchIndex) =>
          Promise.all(
            files.map((file) =>
              processGalleryUpload(file, `branch ${branchIndex + 1} photo`),
            ),
          ),
        ),
      );
    } catch (mediaError) {
      return NextResponse.json(
        {
          error: "Invalid files",
          issues: [mediaError instanceof Error ? mediaError.message : "image processing failed"],
        },
        { status: 400 },
      );
    }

    const uploadedBlobUrls: string[] = [];
    let storedNextLogo: CompanyImageAsset | undefined;
    let storedNextLogoThumb: CompanyImageAsset | undefined;
    let storedNextBackground: CompanyImageAsset | undefined;
    let storedLocationPhotos: CompanyImageAsset[][];

    try {
      if (nextLogo) {
        storedNextLogo = await uploadCompanyImageAsset({
          companyId,
          key: "logo",
          asset: nextLogo,
        });
        if (storedNextLogo.blobUrl) {
          uploadedBlobUrls.push(storedNextLogo.blobUrl);
        }
      }
      if (nextLogoThumb) {
        storedNextLogoThumb = await uploadCompanyImageAsset({
          companyId,
          key: "logo-thumb",
          asset: nextLogoThumb,
        });
        if (storedNextLogoThumb.blobUrl) {
          uploadedBlobUrls.push(storedNextLogoThumb.blobUrl);
        }
      }
      if (nextBackground) {
        storedNextBackground = await uploadCompanyImageAsset({
          companyId,
          key: "background",
          asset: nextBackground,
        });
        if (storedNextBackground.blobUrl) {
          uploadedBlobUrls.push(storedNextBackground.blobUrl);
        }
      }
      storedLocationPhotos = await Promise.all(
        locationPhotos.map((branchAssets, branchIndex) =>
          Promise.all(
            branchAssets.map(async (asset, photoIndex) => {
              const stored = await uploadCompanyImageAsset({
                companyId,
                key: `branches/${branchIndex}/photos/${photoIndex}`,
                asset,
              });
              if (stored.blobUrl) {
                uploadedBlobUrls.push(stored.blobUrl);
              }
              return stored;
            }),
          ),
        ),
      );
    } catch (storageError) {
      await safeDeleteBlobUrls(uploadedBlobUrls);
      return NextResponse.json(
        {
          error: "Media storage unavailable",
          message:
            storageError instanceof Error
              ? storageError.message
              : "Unknown blob upload error",
        },
        { status: 500 },
      );
    }

    const nextLocations = parsed.data.branches.map((branch, index) => {
      const branchPhone = branch.phone?.trim() || undefined;
      const branchEmail = branch.email?.trim() || undefined;
      const hasCustomContactDetails =
        branch.useCustomDetails ||
        Boolean(branchPhone) ||
        Boolean(branchEmail);
      const addressParts = normalizeGeocodeAddressParts(branch.addressParts);
      const existingBranch = existing.locations?.[index];
      const nextBranchPhotos = storedLocationPhotos[index];

      return {
        label: branch.label.trim(),
        addressText: branch.addressText.trim(),
        ...(addressParts ? { addressParts } : {}),
        phone: hasCustomContactDetails ? (branchPhone ?? phone) : phone,
        email: hasCustomContactDetails ? (branchEmail ?? email) : email,
        photos:
          nextBranchPhotos.length > 0
            ? nextBranchPhotos
            : existingBranch?.photos,
        point: {
          type: "Point" as const,
          coordinates: [branch.lng, branch.lat] as [number, number],
        },
      };
    });

    const unsetFields: Record<string, ""> = {
      communicationLanguages: "",
      communicationLanguage: "",
      benefits: "",
      specializations: "",
      photos: "",
      category: "",
    };
    if (removeLogo && !storedNextLogo) {
      unsetFields.logo = "";
      unsetFields.logoThumb = "";
    }
    if (removeBackground && !storedNextBackground) {
      unsetFields.background = "";
    }

    const staleBlobUrls: string[] = [
      ...((removeLogo || Boolean(storedNextLogo))
        ? toBlobUrls([existing.logo, existing.logoThumb])
        : []),
      ...((removeBackground || Boolean(storedNextBackground))
        ? toBlobUrls([existing.background])
        : []),
      ...toBlobUrls(legacyCompanyPhotos),
    ];

    const existingLocations = existing.locations ?? [];
    for (let index = 0; index < existingLocations.length; index += 1) {
      const existingBranchPhotos = existingLocations[index]?.photos ?? [];
      const hasReplacementPhotos = (storedLocationPhotos[index]?.length ?? 0) > 0;
      const branchRemoved = index >= parsed.data.branches.length;
      if (!hasReplacementPhotos && !branchRemoved) {
        continue;
      }
      staleBlobUrls.push(...toBlobUrls(existingBranchPhotos));
    }

    let updateResult;
    try {
      updateResult = await companies.updateOne(
        { _id: companyId },
        {
          $set: {
            name: nextCompanyName,
            description: nextCompanyDescription,
            operatingArea,
            operatingAreaDetails,
            nip,
            verificationStatus: normalizeCompanyVerificationStatus(existing.verificationStatus),
            phone,
            email,
            website,
            facebookUrl,
            instagramUrl,
            linkedinUrl,
            ...(storedNextLogo ? { logo: storedNextLogo } : {}),
            ...(storedNextLogoThumb ? { logoThumb: storedNextLogoThumb } : {}),
            ...(storedNextBackground ? { background: storedNextBackground } : {}),
            locations: nextLocations,
            updatedAt: new Date(),
          },
          ...(Object.keys(unsetFields).length > 0 ? { $unset: unsetFields } : {}),
        },
      );
    } catch (dbError) {
      await safeDeleteBlobUrls(uploadedBlobUrls);
      throw dbError;
    }

    if (updateResult.matchedCount === 0) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    await safeDeleteBlobUrls(staleBlobUrls);

    return NextResponse.json({ ok: true });
  } catch (error) {
    logError("Unhandled API error", { route: "/api/companies/[id]", error });
    const errorMessage = error instanceof Error ? error.message : "Unknown update company error";
    if (/bson|document|object to insert too large|too large/i.test(errorMessage)) {
      return NextResponse.json(
        {
          error: "Invalid files",
          issues: ["total images size exceeds limit"],
        },
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        error: "Internal server error",
        message: errorMessage,
      },
      { status: 500 },
    );
  }
}
