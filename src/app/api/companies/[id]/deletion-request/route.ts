import { ObjectId, type Filter } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/auth-user";
import { safeDeleteBlobUrls } from "@/lib/blob-storage";
import { getCompanyOwnershipClaimsCollection } from "@/lib/company-ownership-claims";
import {
  ensureCompaniesIndexes,
  getCompaniesCollection,
  type CompanyDocument,
} from "@/lib/companies";
import {
  getContainerListingFavoritesCollection,
  getContainerInquiriesCollection,
  getContainerListingsCollection,
  type ContainerListingDocument,
} from "@/lib/container-listings";
import { escapeRegexPattern } from "@/lib/escape-regex-pattern";
import { logError } from "@/lib/server-logger";
import { USER_ROLE } from "@/lib/user-roles";
import { getUsersCollection } from "@/lib/users";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function collectCompanyBlobUrls(
  company: Pick<CompanyDocument, "logo" | "logoThumb" | "background" | "locations">,
): string[] {
  const urls = [
    company.logo?.blobUrl,
    company.logoThumb?.blobUrl,
    company.background?.blobUrl,
    ...(company.locations ?? []).flatMap((location) =>
      (location.photos ?? []).map((photo) => photo?.blobUrl),
    ),
  ];

  return Array.from(
    new Set(
      urls
        .map((url) => url?.trim() ?? "")
        .filter(Boolean),
    ),
  );
}

function buildRelatedListingsFilter(input: {
  companyName: string;
  ownerUserId?: ObjectId;
  ownerCompaniesCount: number;
}): Filter<ContainerListingDocument> | null {
  const normalizedCompanyName = input.companyName.trim();
  const ownerUserId = input.ownerUserId;

  if (!ownerUserId) {
    if (!normalizedCompanyName) {
      return null;
    }

    return {
      companyName: new RegExp(`^${escapeRegexPattern(normalizedCompanyName)}$`, "i"),
    };
  }

  if (input.ownerCompaniesCount <= 1) {
    return { createdByUserId: ownerUserId };
  }

  if (!normalizedCompanyName) {
    return { createdByUserId: ownerUserId };
  }

  return {
    createdByUserId: ownerUserId,
    companyName: new RegExp(`^${escapeRegexPattern(normalizedCompanyName)}$`, "i"),
  };
}

export async function POST() {
  return NextResponse.json(
    {
      error: "Method not allowed",
    },
    { status: 405 },
  );
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid company id" }, { status: 400 });
    }

    const user = await getCurrentUserFromRequest(request);
    if (!user?._id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensureCompaniesIndexes();
    const companyId = new ObjectId(id);
    const [companies, users, claims, listings, favorites, inquiries] = await Promise.all([
      getCompaniesCollection(),
      getUsersCollection(),
      getCompanyOwnershipClaimsCollection(),
      getContainerListingsCollection(),
      getContainerListingFavoritesCollection(),
      getContainerInquiriesCollection(),
    ]);

    const company = await companies.findOne(
      { _id: companyId },
      {
        projection: {
          createdByUserId: 1,
          name: 1,
          logo: 1,
          logoThumb: 1,
          background: 1,
          locations: 1,
        },
      },
    );
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const isAdmin = user.role === USER_ROLE.ADMIN;
    const isOwner =
      company.createdByUserId &&
      company.createdByUserId.toHexString() === user._id.toHexString();
    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const ownerCompaniesCount = company.createdByUserId
      ? await companies.countDocuments({ createdByUserId: company.createdByUserId })
      : 0;
    const relatedListingsFilter = buildRelatedListingsFilter({
      companyName: company.name ?? "",
      ownerUserId: company.createdByUserId,
      ownerCompaniesCount,
    });

    const relatedListingIds = relatedListingsFilter
      ? (
          await listings
            .find(relatedListingsFilter, { projection: { _id: 1 } })
            .toArray()
        ).map((row) => row._id)
      : [];
    const blobUrls = collectCompanyBlobUrls(company);

    const deleteResult = await companies.deleteOne({ _id: companyId });
    if (deleteResult.deletedCount === 0) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const cleanupOperations: Promise<unknown>[] = [claims.deleteMany({ companyId })];

    if (relatedListingsFilter) {
      cleanupOperations.push(listings.deleteMany(relatedListingsFilter));
    }
    if (relatedListingIds.length > 0) {
      cleanupOperations.push(
        favorites.deleteMany({
          listingId: { $in: relatedListingIds },
        }),
      );
      cleanupOperations.push(
        inquiries.deleteMany({
          listingId: { $in: relatedListingIds },
        }),
      );
    }
    if (company.createdByUserId) {
      cleanupOperations.push(
        (async () => {
          const hasAssignedCompany = Boolean(
            await companies.findOne(
              { createdByUserId: company.createdByUserId },
              { projection: { _id: 1 } },
            ),
          );
          const derivedRole = hasAssignedCompany
            ? USER_ROLE.COMPANY_OWNER
            : USER_ROLE.USER;
          await users.updateOne(
            {
              _id: company.createdByUserId,
              role: { $in: [USER_ROLE.USER, USER_ROLE.COMPANY_OWNER] },
            },
            {
              $set: {
                role: derivedRole,
                updatedAt: new Date(),
              },
            },
          );
        })(),
      );
    }

    const cleanupResults = await Promise.allSettled(cleanupOperations);
    const cleanupFailures = cleanupResults
      .map((result) => {
        if (result.status !== "rejected") {
          return null;
        }
        return result.reason instanceof Error
          ? result.reason.message
          : String(result.reason);
      })
      .filter((failure): failure is string => Boolean(failure));

    if (cleanupFailures.length > 0) {
      logError("Company self-delete cleanup failed", {
        route: "/api/companies/[id]/deletion-request",
        companyId: companyId.toHexString(),
        failures: cleanupFailures,
      });
    }

    await safeDeleteBlobUrls(blobUrls);

    return NextResponse.json({
      ok: true,
      deletedListings: relatedListingIds.length,
    });
  } catch (error) {
    logError("Unhandled API error", { route: "/api/companies/[id]/deletion-request", error });
    return NextResponse.json(
      {
        error: "Internal server error",
        message:
          error instanceof Error ? error.message : "Unknown company self-delete error",
      },
      { status: 500 },
    );
  }
}
