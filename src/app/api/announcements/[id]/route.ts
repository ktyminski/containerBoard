import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getAnnouncementsCollection,
  type JobAnnouncementContactPerson,
  type JobAnnouncementLocation,
} from "@/lib/announcements";
import { getCurrentUserFromRequest } from "@/lib/auth-user";
import { getAnnouncementFavoritesCollection } from "@/lib/announcement-favorites";
import { getCompaniesCollection } from "@/lib/companies";
import { normalizeExternalLink } from "@/lib/external-links";
import { sanitizeRichTextHtml } from "@/lib/html-sanitizer";
import { formatTemplate, getLocaleFromApiRequest, getMessages } from "@/lib/i18n";
import { stripHtmlToPlainText } from "@/lib/rich-text";
import {
  JOB_ANNOUNCEMENT_REQUIREMENTS,
  JOB_CONTRACT_TYPES,
  JOB_EMPLOYMENT_TYPES,
  JOB_RATE_PERIODS,
  JOB_WORK_LOCATION_MODE,
  JOB_WORK_LOCATION_MODES,
  JOB_WORK_MODELS,
  type JobAnnouncementRequirement,
} from "@/lib/job-announcement";
import { USER_ROLE } from "@/lib/user-roles";
import { logError } from "@/lib/server-logger";

export const runtime = "nodejs";

const optionalNumberSchema = z.preprocess(
  (value) => {
    if (value === undefined || value === null) {
      return undefined;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) {
        return undefined;
      }
      return Number(trimmed);
    }
    return Number(value);
  },
  z.number().finite().gte(0).lte(1_000_000).optional(),
);

const optionalApplicationEmailSchema = z
  .string()
  .trim()
  .max(220)
  .optional()
  .or(z.literal(""))
  .default("")
  .superRefine((value, ctx) => {
    if (!value) {
      return;
    }
    if (!z.string().email().safeParse(value).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "application email must be valid",
      });
    }
  });

const contactPersonSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    phone: z.string().trim().max(60).optional().or(z.literal("")),
    email: z.string().trim().max(220).optional().or(z.literal("")),
  })
  .superRefine((value, ctx) => {
    const email = value.email?.trim() || "";
    const phone = value.phone?.trim() || "";

    if (!email && !phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "contact person requires email or phone",
      });
      return;
    }

    if (email && !z.string().email().safeParse(email).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "contact person email must be valid",
        path: ["email"],
      });
    }
  });

const updateAnnouncementSchema = z.object({
  companyId: z.string().refine((value) => ObjectId.isValid(value), {
    message: "companyId must be a valid id",
  }),
  title: z.string().trim().min(3).max(180),
  description: z.string().trim().min(1).max(20_000),
  workLocationMode: z.enum(JOB_WORK_LOCATION_MODES),
  branchId: z.string().trim().max(120).optional().default(""),
  manualLocationText: z.string().trim().max(220).optional().default(""),
  mapLat: z.number().finite().gte(-90).lte(90).nullable(),
  mapLng: z.number().finite().gte(-180).lte(180).nullable(),
  workModel: z.enum(JOB_WORK_MODELS),
  employmentType: z.enum(JOB_EMPLOYMENT_TYPES),
  contractTypes: z.array(z.enum(JOB_CONTRACT_TYPES)).min(1).max(JOB_CONTRACT_TYPES.length),
  salaryRatePeriod: z.enum(JOB_RATE_PERIODS),
  salaryFrom: optionalNumberSchema,
  salaryTo: optionalNumberSchema,
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  requirements: z
    .array(z.enum(JOB_ANNOUNCEMENT_REQUIREMENTS))
    .max(JOB_ANNOUNCEMENT_REQUIREMENTS.length)
    .default([]),
  externalLinks: z.array(z.string().trim().max(600)).max(10).default([]),
  contactPersons: z.array(contactPersonSchema).max(3).default([]),
  applicationEmail: optionalApplicationEmailSchema,
});

const updateAnnouncementPublicationSchema = z.object({
  action: z.literal("setPublicationStatus"),
  isPublished: z.boolean(),
});

function parseBranchIndex(branchId: string, companyId: ObjectId): number | null {
  const [branchCompanyId, rawIndex] = branchId.split(":");
  if (branchCompanyId !== companyId.toHexString()) {
    return null;
  }

  const index = Number(rawIndex);
  if (!Number.isInteger(index) || index < 0) {
    return null;
  }

  return index;
}

function createLocationPoint(lat: number, lng: number) {
  return {
    type: "Point" as const,
    coordinates: [lng, lat] as [number, number],
  };
}

function normalizeContactPersons(
  input: z.infer<typeof updateAnnouncementSchema>["contactPersons"],
): JobAnnouncementContactPerson[] {
  const unique = new Map<string, JobAnnouncementContactPerson>();
  for (const person of input) {
    const name = person.name.trim();
    const email = person.email?.trim() || undefined;
    const phone = person.phone?.trim() || undefined;
    if (!email && !phone) {
      continue;
    }
    const dedupeKey = `${name.toLowerCase()}::${email?.toLowerCase() ?? ""}::${phone?.toLowerCase() ?? ""}`;
    if (unique.has(dedupeKey)) {
      continue;
    }
    unique.set(dedupeKey, { name, email, phone });
  }
  return Array.from(unique.values()).slice(0, 3);
}

function normalizeRequirements(
  input: z.infer<typeof updateAnnouncementSchema>["requirements"],
): JobAnnouncementRequirement[] {
  return Array.from(new Set(input)).slice(0, JOB_ANNOUNCEMENT_REQUIREMENTS.length);
}

function resolveLocation(input: {
  workLocationMode: z.infer<typeof updateAnnouncementSchema>["workLocationMode"];
  branchId: string;
  manualLocationText: string;
  mapLat: number | null;
  mapLng: number | null;
  companyId: ObjectId;
  companyLocations: Array<{
    label: string;
    addressText: string;
    point: {
      coordinates: [number, number];
    };
  }>;
  labels: {
    mapPointTemplate: string;
    manualFallback: string;
    anywhere: string;
  };
}): { location: JobAnnouncementLocation; branchIndex?: number } | { error: string } {
  const fallbackBranch = input.companyLocations[0];
  if (!fallbackBranch?.point?.coordinates) {
    return { error: "Company has no mappable branch location" };
  }

  if (input.workLocationMode === JOB_WORK_LOCATION_MODE.BRANCH) {
    const branchIndex = parseBranchIndex(input.branchId, input.companyId);
    if (branchIndex === null) {
      return { error: "Selected branch is invalid" };
    }

    const branch = input.companyLocations[branchIndex];
    if (!branch?.point?.coordinates) {
      return { error: "Selected branch has no coordinates" };
    }

    const [lng, lat] = branch.point.coordinates;
    return {
      location: {
        mode: JOB_WORK_LOCATION_MODE.BRANCH,
        label: `${branch.label} - ${branch.addressText}`,
        point: createLocationPoint(lat, lng),
      },
      branchIndex,
    };
  }

  if (input.workLocationMode === JOB_WORK_LOCATION_MODE.MAP) {
    if (input.mapLat === null || input.mapLng === null) {
      return { error: "Map location coordinates are required" };
    }

    return {
      location: {
        mode: JOB_WORK_LOCATION_MODE.MAP,
        label: formatTemplate(input.labels.mapPointTemplate, {
          lat: input.mapLat.toFixed(4),
          lng: input.mapLng.toFixed(4),
        }),
        point: createLocationPoint(input.mapLat, input.mapLng),
      },
    };
  }

  if (input.workLocationMode === JOB_WORK_LOCATION_MODE.MANUAL) {
    if (input.mapLat === null || input.mapLng === null) {
      return { error: "Manual location coordinates are required" };
    }
    const manualLabel = input.manualLocationText.trim();
    if (!manualLabel) {
      return { error: "Manual location label is required" };
    }
    return {
      location: {
        mode: JOB_WORK_LOCATION_MODE.MANUAL,
        label: manualLabel,
        point: createLocationPoint(input.mapLat, input.mapLng),
      },
    };
  }

  const [fallbackLng, fallbackLat] = fallbackBranch.point.coordinates;
  return {
    location: {
      mode: JOB_WORK_LOCATION_MODE.ANYWHERE,
      label: input.labels.anywhere,
      point: createLocationPoint(fallbackLat, fallbackLng),
    },
  };
}

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

async function assertAnnouncementAccess(input: {
  announcementId: ObjectId;
  userId: ObjectId;
  isAdmin: boolean;
}) {
  const announcements = await getAnnouncementsCollection();
  const existingAnnouncement = await announcements.findOne(
    { _id: input.announcementId },
    {
      projection: {
        _id: 1,
        companyId: 1,
      },
    },
  );
  if (!existingAnnouncement?._id) {
    return { error: "Announcement not found" as const, status: 404 };
  }

  const companies = await getCompaniesCollection();
  const sourceCompany = await companies.findOne(
    { _id: existingAnnouncement.companyId },
    {
      projection: {
        _id: 1,
        createdByUserId: 1,
      },
    },
  );
  if (!sourceCompany?._id) {
    return { error: "Source company not found" as const, status: 404 };
  }

  if (
    !input.isAdmin &&
    sourceCompany.createdByUserId?.toHexString() !== input.userId.toHexString()
  ) {
    return { error: "Forbidden for this announcement" as const, status: 403 };
  }

  return {
    announcements,
    companies,
    existingAnnouncement,
    sourceCompany,
  };
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const announcementMessages = getMessages(getLocaleFromApiRequest(request)).announcementCreate;
    const { id } = await context.params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid announcement id" }, { status: 400 });
    }

    const user = await getCurrentUserFromRequest(request);
    if (!user || !user._id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== USER_ROLE.COMPANY_OWNER && user.role !== USER_ROLE.ADMIN) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const payload = await request.json();
    const publicationParsed = updateAnnouncementPublicationSchema.safeParse(payload);
    const isAdmin = user.role === USER_ROLE.ADMIN;
    const announcementId = new ObjectId(id);

    if (publicationParsed.success) {
      if (user.isBlocked === true) {
        return NextResponse.json(
          { error: "Blocked user cannot publish or suspend announcements" },
          { status: 403 },
        );
      }

      const accessResult = await assertAnnouncementAccess({
        announcementId,
        userId: user._id,
        isAdmin,
      });
      if ("error" in accessResult) {
        return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
      }

      const updateResult = await accessResult.announcements.updateOne(
        { _id: announcementId },
        {
          $set: {
            isPublished: publicationParsed.data.isPublished,
            updatedAt: new Date(),
          },
        },
      );

      if (updateResult.matchedCount === 0) {
        return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
      }

      return NextResponse.json({ id: announcementId.toHexString() });
    }

    const parsed = updateAnnouncementSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          issues: parsed.error.issues.map((issue) => issue.message),
        },
        { status: 400 },
      );
    }

    if (
      parsed.data.salaryFrom !== undefined &&
      parsed.data.salaryTo !== undefined &&
      parsed.data.salaryFrom > parsed.data.salaryTo
    ) {
      return NextResponse.json(
        { error: "salaryFrom cannot be greater than salaryTo" },
        { status: 400 },
      );
    }

    const description = sanitizeRichTextHtml(parsed.data.description);
    const plainDescription = stripHtmlToPlainText(description);
    if (plainDescription.length < 20) {
      return NextResponse.json(
        { error: "description is too short after sanitization" },
        { status: 400 },
      );
    }
    if (plainDescription.length > 5_000) {
      return NextResponse.json(
        { error: "description is too long after sanitization" },
        { status: 400 },
      );
    }

    const accessResult = await assertAnnouncementAccess({
      announcementId,
      userId: user._id,
      isAdmin,
    });
    if ("error" in accessResult) {
      return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
    }
    const { announcements, companies } = accessResult;
    const targetCompanyId = new ObjectId(parsed.data.companyId);
    const targetCompany = await companies.findOne(
      { _id: targetCompanyId },
      {
        projection: {
          _id: 1,
          name: 1,
          slug: 1,
          locations: 1,
          createdByUserId: 1,
        },
      },
    );

    if (!targetCompany) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    if (
      !isAdmin &&
      targetCompany.createdByUserId?.toHexString() !== user._id.toHexString()
    ) {
      return NextResponse.json({ error: "Forbidden for this announcement" }, { status: 403 });
    }

    const resolvedLocation = resolveLocation({
      workLocationMode: parsed.data.workLocationMode,
      branchId: parsed.data.branchId,
      manualLocationText: parsed.data.manualLocationText,
      mapLat: parsed.data.mapLat,
      mapLng: parsed.data.mapLng,
      companyId: targetCompany._id,
      companyLocations: (targetCompany.locations ?? []).map((location) => ({
        label: location.label,
        addressText: location.addressText,
        point: {
          coordinates: location.point.coordinates,
        },
      })),
      labels: {
        mapPointTemplate: announcementMessages.locationPreviewMapPoint,
        manualFallback: announcementMessages.locationPreviewManual,
        anywhere: announcementMessages.locationPreviewAnywhere,
      },
    });

    if ("error" in resolvedLocation) {
      return NextResponse.json({ error: resolvedLocation.error }, { status: 400 });
    }

    const tags = Array.from(
      new Set(
        parsed.data.tags
          .map((tag) => tag.trim().toLowerCase())
          .filter(Boolean),
      ),
    );
    const normalizedExternalLinks = parsed.data.externalLinks.map((link) =>
      normalizeExternalLink(link),
    );
    if (normalizedExternalLinks.some((link) => !link)) {
      return NextResponse.json(
        { error: "Invalid externalLinks value" },
        { status: 400 },
      );
    }
    const externalLinks = Array.from(
      new Set(
        normalizedExternalLinks.filter((link): link is string => Boolean(link)),
      ),
    );
    const contactPersons = normalizeContactPersons(parsed.data.contactPersons);
    const applicationEmail = parsed.data.applicationEmail.trim() || undefined;
    const requirements = normalizeRequirements(parsed.data.requirements);

    const contractTypes = Array.from(new Set(parsed.data.contractTypes));
    const now = new Date();

    const unsetFields: Record<string, ""> = {};
    if (resolvedLocation.branchIndex === undefined) {
      unsetFields.branchIndex = "";
    }
    if (!applicationEmail) {
      unsetFields.applicationEmail = "";
    }

    const updateResult = await announcements.updateOne(
      { _id: announcementId },
      {
        $set: {
          companyId: targetCompany._id,
          companyName: targetCompany.name,
          companySlug: targetCompany.slug,
          title: parsed.data.title.trim(),
          description,
          workModel: parsed.data.workModel,
          employmentType: parsed.data.employmentType,
          contractTypes,
          salaryRatePeriod: parsed.data.salaryRatePeriod,
          salaryFrom: parsed.data.salaryFrom,
          salaryTo: parsed.data.salaryTo,
          tags,
          requirements,
          externalLinks,
          contactPersons,
          ...(applicationEmail ? { applicationEmail } : {}),
          location: resolvedLocation.location,
          ...(resolvedLocation.branchIndex !== undefined
            ? { branchIndex: resolvedLocation.branchIndex }
            : {}),
          updatedAt: now,
        },
        ...(Object.keys(unsetFields).length > 0 ? { $unset: unsetFields } : {}),
      },
    );

    if (updateResult.matchedCount === 0) {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
    }

    return NextResponse.json({ id: announcementId.toHexString() });
  } catch (error) {
    logError("Unhandled API error", { route: "/api/announcements/[id]", error });
    return NextResponse.json(
      {
        error: "Internal server error",
        message:
          error instanceof Error
            ? error.message
            : "Unknown update announcement error",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid announcement id" }, { status: 400 });
    }

    const user = await getCurrentUserFromRequest(request);
    if (!user || !user._id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== USER_ROLE.COMPANY_OWNER && user.role !== USER_ROLE.ADMIN) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (user.isBlocked === true) {
      return NextResponse.json(
        { error: "Blocked user cannot delete announcements" },
        { status: 403 },
      );
    }

    const isAdmin = user.role === USER_ROLE.ADMIN;
    const announcementId = new ObjectId(id);
    const accessResult = await assertAnnouncementAccess({
      announcementId,
      userId: user._id,
      isAdmin,
    });
    if ("error" in accessResult) {
      return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
    }

    const deleteResult = await accessResult.announcements.deleteOne({ _id: announcementId });
    if (deleteResult.deletedCount === 0) {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
    }
    const favorites = await getAnnouncementFavoritesCollection();
    await favorites.deleteMany({ announcementId });

    return NextResponse.json({ ok: true });
  } catch (error) {
    logError("Unhandled API error", { route: "/api/announcements/[id]", error });
    return NextResponse.json(
      {
        error: "Internal server error",
        message:
          error instanceof Error
            ? error.message
            : "Unknown delete announcement error",
      },
      { status: 500 },
    );
  }
}
