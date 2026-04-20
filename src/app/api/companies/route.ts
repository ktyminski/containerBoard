import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import {
  buildCompaniesFilter,
  ensureCompaniesIndexes,
  getCompaniesCollection,
  mapToCompanyMapItem,
  type CompanyImageAsset,
} from "@/lib/companies";
import { getCurrentUserFromRequest } from "@/lib/auth-user";
import {
  processBackgroundUpload,
  processGalleryUpload,
  processLogoUpload,
} from "@/lib/company-media";
import {
  buildBlobPath,
  safeDeleteBlobUrls,
  uploadBlobFromBuffer,
} from "@/lib/blob-storage";
import { normalizeGeocodeAddressParts } from "@/lib/geocode-address";
import {
  COMPANY_OPERATING_AREAS,
  normalizeCompanyOperatingArea,
} from "@/lib/company-operating-area";
import {
  normalizeCompanyVerificationStatus,
} from "@/lib/company-verification";
import { enforcePublicReadRateLimitOrResponse } from "@/lib/app-rate-limit";
import { getCompanyCreationLimitState } from "@/lib/company-creation-limit";
import { parseBbox } from "@/lib/geo";
import { getUsersCollection } from "@/lib/users";
import { USER_ROLE } from "@/lib/user-roles";
import { enforceRateLimitOrResponse } from "@/lib/request-rate-limit";
import { logError } from "@/lib/server-logger";

export const runtime = "nodejs";

const MAX_LOGO_BYTES = 3 * 1024 * 1024;
const MAX_BACKGROUND_BYTES = 6 * 1024 * 1024;
const MAX_PHOTO_BYTES = 6 * 1024 * 1024;
const MAX_BRANCH_PHOTO_COUNT = 3;
const MAX_TOTAL_IMAGES_BYTES = 14 * 1024 * 1024;

const querySchema = z.object({
  bbox: z.string().optional(),
  q: z.string().trim().min(1).max(100).optional(),
  tags: z
    .string()
    .optional()
    .transform((value) => {
      if (!value) {
        return [];
      }

      return value
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean);
    }),
  operatingAreas: z
    .string()
    .optional()
    .transform((value) => {
      if (!value) {
        return [];
      }
      const allowed = new Set<string>(COMPANY_OPERATING_AREAS);
      return value
        .split(",")
        .map((entry) => entry.trim().toLowerCase())
        .filter((entry): entry is (typeof COMPANY_OPERATING_AREAS)[number] => allowed.has(entry));
    }),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

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

const createCompanySchema = z.object({
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

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function generateUniqueSlug(base: string): Promise<string> {
  const companies = await getCompaniesCollection();

  const safeBase = slugify(base) || `company-${Date.now()}`;
  let slug = safeBase;
  let counter = 2;

  while (await companies.findOne({ slug }, { projection: { _id: 1 } })) {
    slug = `${safeBase}-${counter}`;
    counter += 1;
  }

  return slug;
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

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await enforcePublicReadRateLimitOrResponse({
      request,
      scope: "companies:list",
      limit: 150,
    });
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const query = querySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );

    if (!query.success) {
      return NextResponse.json(
        {
          error: "Invalid query parameters",
          issues: query.error.issues.map((issue) => issue.message),
        },
        { status: 400 },
      );
    }

    const {
      q,
      tags,
      operatingAreas,
      limit,
    } = query.data;
    const bbox = parseBbox(query.data.bbox);
    if (query.data.bbox && !bbox) {
      return NextResponse.json(
        {
          error: "Invalid query parameters",
          issues: ["bbox must be minLng,minLat,maxLng,maxLat in valid ranges"],
        },
        { status: 400 },
      );
    }
    const companies = await getCompaniesCollection();
    const filter = buildCompaniesFilter({
      bbox,
      q,
      tags,
      operatingAreas,
    });
    const rows = await companies
      .find(filter, {
        projection: {
          name: 1,
          slug: 1,
          isPremium: 1,
          verificationStatus: 1,
          tags: 1,
          operatingArea: 1,
          "logo.size": 1,
          "logo.filename": 1,
          updatedAt: 1,
          "locations.label": 1,
          "locations.point": 1,
          "locations.addressParts.city": 1,
        },
      })
      .sort({ isPremium: -1, verificationStatus: -1, createdAt: -1 })
      .limit(limit)
      .toArray();

    const items = rows
      .map((row) => mapToCompanyMapItem(row, bbox))
      .filter((item) => item !== null);

    return NextResponse.json({
      items,
      meta: {
        count: items.length,
        limit,
        hasMore: rows.length === limit,
      },
    });
  } catch (error) {
    logError("Unhandled API error", { route: "/api/companies", error });
    return NextResponse.json(
      {
        error: "Internal server error",
        message:
          error instanceof Error ? error.message : "Unknown companies error",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const ipRateLimitResponse = await enforceRateLimitOrResponse({
      request,
      scope: "companies:create:ip",
      limit: 45,
      windowMs: 60_000,
      onError: "block",
    });
    if (ipRateLimitResponse) {
      return ipRateLimitResponse;
    }

    const user = await getCurrentUserFromRequest(request);
    if (!user || !user._id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRateLimitResponse = await enforceRateLimitOrResponse({
      request,
      scope: "companies:create:user",
      limit: 30,
      windowMs: 60_000,
      identity: user._id.toHexString(),
      onError: "block",
    });
    if (userRateLimitResponse) {
      return userRateLimitResponse;
    }

    if (
      user.role !== USER_ROLE.USER &&
      user.role !== USER_ROLE.COMPANY_OWNER &&
      user.role !== USER_ROLE.ADMIN
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (user.authProvider === "local" && user.isEmailVerified === false) {
      return NextResponse.json(
        { error: "Email verification required" },
        { status: 403 },
      );
    }

    await ensureCompaniesIndexes();
    const companies = await getCompaniesCollection();
    const existingOwnedCompany = await companies.findOne(
      { createdByUserId: user._id },
      { projection: { _id: 1 } },
    );
    if (existingOwnedCompany) {
      return NextResponse.json(
        { error: "User already has a company" },
        { status: 409 },
      );
    }
    if (user.role !== USER_ROLE.ADMIN) {
      const limitState = await getCompanyCreationLimitState({
        companies,
        userId: user._id,
      });
      if (limitState.isLimited) {
        const retryAfterSeconds = Math.max(1, Math.ceil(limitState.retryAfterMs / 1000));
        return NextResponse.json(
          {
            error: "Company creation limit reached",
            limit: limitState.limit,
            windowHours: limitState.windowHours,
            createdInWindow: limitState.createdInWindow,
            nextAllowedAt: limitState.nextAllowedAt?.toISOString() ?? null,
            retryAfterSeconds,
          },
          {
            status: 429,
            headers: {
              "Retry-After": String(retryAfterSeconds),
            },
          },
        );
      }
    }

    const formData = await request.formData();

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

    const parsed = createCompanySchema.safeParse(payload);
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

    if (issues.length > 0) {
      return NextResponse.json({ error: "Invalid files", issues }, { status: 400 });
    }

    const now = new Date();
    const companyId = new ObjectId();
    const slug = await generateUniqueSlug(parsed.data.name);
    const operatingArea = normalizeCompanyOperatingArea(parsed.data.operatingArea);
    const operatingAreaDetails = parsed.data.operatingAreaDetails?.trim() || undefined;
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

    let logo:
      | Awaited<ReturnType<typeof processLogoUpload>>["logo"]
      | undefined;
    let logoThumb:
      | Awaited<ReturnType<typeof processLogoUpload>>["logoThumb"]
      | undefined;
    let background: CompanyImageAsset | undefined;
    let locationPhotos: CompanyImageAsset[][];
    const uploadedBlobUrls: string[] = [];

    try {
      if (logoFile) {
        const processedLogo = await processLogoUpload(logoFile);
        logo = processedLogo.logo;
        logoThumb = processedLogo.logoThumb;
      }
      background = backgroundFile ? await processBackgroundUpload(backgroundFile) : undefined;
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

    let storedLogo: CompanyImageAsset | undefined;
    let storedLogoThumb: CompanyImageAsset | undefined;
    let storedBackground: CompanyImageAsset | undefined;
    let storedLocationPhotos: CompanyImageAsset[][];

    try {
      if (logo) {
        storedLogo = await uploadCompanyImageAsset({
          companyId,
          key: "logo",
          asset: logo,
        });
        if (storedLogo.blobUrl) {
          uploadedBlobUrls.push(storedLogo.blobUrl);
        }
      }
      if (logoThumb) {
        storedLogoThumb = await uploadCompanyImageAsset({
          companyId,
          key: "logo-thumb",
          asset: logoThumb,
        });
        if (storedLogoThumb.blobUrl) {
          uploadedBlobUrls.push(storedLogoThumb.blobUrl);
        }
      }
      if (background) {
        storedBackground = await uploadCompanyImageAsset({
          companyId,
          key: "background",
          asset: background,
        });
        if (storedBackground.blobUrl) {
          uploadedBlobUrls.push(storedBackground.blobUrl);
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

    let insertResult;
    try {
      insertResult = await companies.insertOne({
        _id: companyId,
        name: parsed.data.name.trim(),
        slug,
        description: parsed.data.description.trim(),
        operatingArea,
        operatingAreaDetails,
        nip,
        verificationStatus: normalizeCompanyVerificationStatus(undefined),
        isBlocked: false,
        isPremium: false,
        logo: storedLogo,
        logoThumb: storedLogoThumb,
        background: storedBackground,
        phone,
        email,
        website,
        facebookUrl,
        instagramUrl,
        linkedinUrl,
        tags: [],
        services: [],
        locations: parsed.data.branches.map((branch, index) => {
          const branchPhone = branch.phone?.trim() || undefined;
          const branchEmail = branch.email?.trim() || undefined;
          const hasCustomContactDetails =
            branch.useCustomDetails ||
            Boolean(branchPhone) ||
            Boolean(branchEmail);
          const addressParts = normalizeGeocodeAddressParts(branch.addressParts);

          return {
            label: branch.label.trim(),
            addressText: branch.addressText.trim(),
            ...(addressParts ? { addressParts } : {}),
            phone: hasCustomContactDetails ? (branchPhone ?? phone) : phone,
            email: hasCustomContactDetails ? (branchEmail ?? email) : email,
            photos:
              storedLocationPhotos[index].length > 0
                ? storedLocationPhotos[index]
                : undefined,
            point: {
              type: "Point",
              coordinates: [branch.lng, branch.lat],
            },
          };
        }),
        createdByUserId: user._id,
        createdAt: now,
        updatedAt: now,
      });
    } catch (dbError) {
      await safeDeleteBlobUrls(uploadedBlobUrls);
      throw dbError;
    }

    if (user.role !== USER_ROLE.ADMIN) {
      const users = await getUsersCollection();
      await users.updateOne(
        { _id: user._id, role: { $in: [USER_ROLE.USER, USER_ROLE.COMPANY_OWNER] } },
        {
          $set: {
            role: USER_ROLE.COMPANY_OWNER,
            updatedAt: now,
          },
        },
      );
    }

    return NextResponse.json(
      {
        id: insertResult.insertedId.toHexString(),
        slug,
      },
      { status: 201 },
    );
  } catch (error) {
    logError("Unhandled API error", { route: "/api/companies", error });
    const errorMessage = error instanceof Error ? error.message : "Unknown create company error";
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
