import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { ensureCompaniesIndexes, getCompaniesCollection } from "@/lib/companies";
import {
  COMPANY_OWNERSHIP_CLAIM_STATUS,
  ensureCompanyOwnershipClaimsIndexes,
  getCompanyOwnershipClaimsCollection,
} from "@/lib/company-ownership-claims";
import { getCurrentUserFromRequest } from "@/lib/auth-user";
import { sendClaimSubmittedEmail } from "@/lib/mailer";
import { logError } from "@/lib/server-logger";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
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
    const companies = await getCompaniesCollection();
    const companyId = new ObjectId(id);

    const company = await companies.findOne(
      { _id: companyId },
      { projection: { _id: 1, createdByUserId: 1, name: 1 } },
    );
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }
    if (company.createdByUserId) {
      return NextResponse.json(
        { error: "Company already has an assigned owner" },
        { status: 409 },
      );
    }

    await ensureCompanyOwnershipClaimsIndexes();
    const claims = await getCompanyOwnershipClaimsCollection();
    const existingUserPendingClaim = await claims.findOne(
      { userId: user._id, status: COMPANY_OWNERSHIP_CLAIM_STATUS.PENDING },
      { projection: { _id: 1, companyId: 1 } },
    );
    if (existingUserPendingClaim) {
      const isSameCompany = existingUserPendingClaim.companyId.equals(companyId);
      return NextResponse.json(
        {
          error: isSameCompany
            ? "Claim already submitted for this company"
            : "You already have a pending ownership claim for another company",
        },
        { status: 409 },
      );
    }

    const now = new Date();
    const result = await claims.updateOne(
      {
        companyId,
        userId: user._id,
        status: COMPANY_OWNERSHIP_CLAIM_STATUS.PENDING,
      },
      {
        $setOnInsert: {
          _id: new ObjectId(),
          companyId,
          userId: user._id,
          status: COMPANY_OWNERSHIP_CLAIM_STATUS.PENDING,
          createdAt: now,
          updatedAt: now,
        },
      },
      { upsert: true },
    );

    if (!result.upsertedId) {
      return NextResponse.json(
        { error: "Claim already submitted for this company" },
        { status: 409 },
      );
    }

    const claimSubmittedMailResult = await sendClaimSubmittedEmail({
      to: user.email,
      name: user.name,
      companyName: company.name,
    });
    if (!claimSubmittedMailResult.ok) {
      logError("Failed to send claim-submitted email", {
        companyId: companyId.toHexString(),
        userId: user._id.toHexString(),
        error: claimSubmittedMailResult.error,
        status: claimSubmittedMailResult.status,
      });
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    logError("Unhandled API error", { route: "/api/companies/[id]/claim", error });
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: number }).code === 11000
    ) {
      return NextResponse.json(
        { error: "You already have a pending ownership claim" },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown claim error",
      },
      { status: 500 },
    );
  }
}
