import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserFromRequest } from "@/lib/auth-user";
import { getCompaniesCollection } from "@/lib/companies";
import { normalizeExternalLink } from "@/lib/external-links";
import { sanitizeRichTextHtml } from "@/lib/html-sanitizer";
import { OFFER_TYPES, type OfferType } from "@/lib/offer-type";
import { getOffersCollection } from "@/lib/offers";
import { stripHtmlToPlainText } from "@/lib/rich-text";
import { USER_ROLE } from "@/lib/user-roles";
import { logError } from "@/lib/server-logger";

export const runtime = "nodejs";

const updateOfferSchema = z.object({
  companyId: z.string().refine((value) => ObjectId.isValid(value), {
    message: "companyId must be a valid id",
  }),
  offerType: z.enum(OFFER_TYPES),
  branchId: z.string().trim().min(1).max(120),
  title: z.string().trim().min(3).max(180),
  description: z.string().trim().min(1).max(20_000),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  externalLinks: z.array(z.string().trim().max(600)).max(10).default([]),
});

const updateOfferPublicationSchema = z.object({
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

function dedupeNormalized(values: string[]): string[] {
  const unique = new Map<string, string>();
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }
    const normalized = trimmed.toLowerCase();
    if (!unique.has(normalized)) {
      unique.set(normalized, trimmed);
    }
  }
  return Array.from(unique.values());
}

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

async function assertOfferAccess(input: {
  offerId: ObjectId;
  userId: ObjectId;
  isAdmin: boolean;
}) {
  const offers = await getOffersCollection();
  const existingOffer = await offers.findOne(
    { _id: input.offerId },
    {
      projection: {
        _id: 1,
        companyId: 1,
      },
    },
  );
  if (!existingOffer?._id) {
    return { error: "Offer not found" as const, status: 404 };
  }

  const companies = await getCompaniesCollection();
  const sourceCompany = await companies.findOne(
    { _id: existingOffer.companyId },
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
    return { error: "Forbidden for this offer" as const, status: 403 };
  }

  return {
    offers,
    companies,
    existingOffer,
    sourceCompany,
  };
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid offer id" }, { status: 400 });
    }

    const user = await getCurrentUserFromRequest(request);
    if (!user || !user._id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== USER_ROLE.COMPANY_OWNER && user.role !== USER_ROLE.ADMIN) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const payload = await request.json();
    const publicationParsed = updateOfferPublicationSchema.safeParse(payload);
    const isAdmin = user.role === USER_ROLE.ADMIN;
    const offerId = new ObjectId(id);

    if (publicationParsed.success) {
      if (user.isBlocked === true) {
        return NextResponse.json(
          { error: "Blocked user cannot publish or suspend offers" },
          { status: 403 },
        );
      }

      const accessResult = await assertOfferAccess({
        offerId,
        userId: user._id,
        isAdmin,
      });
      if ("error" in accessResult) {
        return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
      }

      const updateResult = await accessResult.offers.updateOne(
        { _id: offerId },
        {
          $set: {
            isPublished: publicationParsed.data.isPublished,
            updatedAt: new Date(),
          },
        },
      );

      if (updateResult.matchedCount === 0) {
        return NextResponse.json({ error: "Offer not found" }, { status: 404 });
      }

      return NextResponse.json({ id: offerId.toHexString() });
    }

    const parsed = updateOfferSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          issues: parsed.error.issues.map((issue) => issue.message),
        },
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

    const accessResult = await assertOfferAccess({
      offerId,
      userId: user._id,
      isAdmin,
    });
    if ("error" in accessResult) {
      return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
    }
    const { offers, companies } = accessResult;
    const targetCompanyId = new ObjectId(parsed.data.companyId);
    const targetCompany = await companies.findOne(
      { _id: targetCompanyId },
      {
        projection: {
          _id: 1,
          name: 1,
          slug: 1,
          email: 1,
          phone: 1,
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
      return NextResponse.json({ error: "Forbidden for this offer" }, { status: 403 });
    }

    const branchIndex = parseBranchIndex(parsed.data.branchId, targetCompanyId);
    if (branchIndex === null) {
      return NextResponse.json({ error: "Selected branch is invalid" }, { status: 400 });
    }

    const branch = targetCompany.locations?.[branchIndex];
    if (!branch?.point?.coordinates) {
      return NextResponse.json(
        { error: "Selected branch has no coordinates" },
        { status: 400 },
      );
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
    const externalLinks = dedupeNormalized(
      normalizedExternalLinks.filter((link): link is string => Boolean(link)),
    );

    const contactEmails = dedupeNormalized([
      targetCompany.email?.trim() ?? "",
      branch.email?.trim() ?? "",
    ]);
    const contactPhones = dedupeNormalized([
      targetCompany.phone?.trim() ?? "",
      branch.phone?.trim() ?? "",
    ]);

    const now = new Date();
    const updateResult = await offers.updateOne(
      { _id: offerId },
      {
        $set: {
          companyId: targetCompany._id,
          companyName: targetCompany.name,
          companySlug: targetCompany.slug,
          offerType: parsed.data.offerType as OfferType,
          title: parsed.data.title.trim(),
          description,
          tags,
          externalLinks,
          contactEmails,
          contactPhones,
          locationLabel: `${branch.label} - ${branch.addressText}`,
          point: {
            type: "Point",
            coordinates: branch.point.coordinates,
          },
          updatedAt: now,
        },
      },
    );

    if (updateResult.matchedCount === 0) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    }

    return NextResponse.json({ id: offerId.toHexString() });
  } catch (error) {
    logError("Unhandled API error", { route: "/api/offers/[id]", error });
    return NextResponse.json(
      {
        error: "Internal server error",
        message:
          error instanceof Error ? error.message : "Unknown update offer error",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid offer id" }, { status: 400 });
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
        { error: "Blocked user cannot delete offers" },
        { status: 403 },
      );
    }

    const isAdmin = user.role === USER_ROLE.ADMIN;
    const offerId = new ObjectId(id);
    const accessResult = await assertOfferAccess({
      offerId,
      userId: user._id,
      isAdmin,
    });
    if ("error" in accessResult) {
      return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
    }

    const deleteResult = await accessResult.offers.deleteOne({ _id: offerId });
    if (deleteResult.deletedCount === 0) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    logError("Unhandled API error", { route: "/api/offers/[id]", error });
    return NextResponse.json(
      {
        error: "Internal server error",
        message:
          error instanceof Error ? error.message : "Unknown delete offer error",
      },
      { status: 500 },
    );
  }
}
