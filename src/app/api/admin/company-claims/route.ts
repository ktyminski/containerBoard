import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserFromRequest } from "@/lib/auth-user";
import { ensureCompaniesIndexes, getCompaniesCollection } from "@/lib/companies";
import {
  COMPANY_OWNERSHIP_CLAIM_STATUS,
  ensureCompanyOwnershipClaimsIndexes,
  getCompanyOwnershipClaimsCollection,
} from "@/lib/company-ownership-claims";
import {
  sendClaimApprovedEmail,
  sendClaimRejectedEmail,
} from "@/lib/mailer";
import { USER_ROLE } from "@/lib/user-roles";
import { ensureUsersIndexes, getUsersCollection } from "@/lib/users";
import { logError } from "@/lib/server-logger";

export const runtime = "nodejs";

const decideClaimSchema = z.object({
  claimId: z.string().min(1),
  action: z.enum(["approve", "reject"]),
});

async function requireAdmin(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user || user.role !== USER_ROLE.ADMIN || !user._id) {
    return null;
  }
  return user;
}

function logMailFailure(context: string, metadata: Record<string, unknown>) {
  logError(`Failed to send ${context} email`, metadata);
}

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const claims = await getCompanyOwnershipClaimsCollection();
    const users = await getUsersCollection();
    const companies = await getCompaniesCollection();

    const rows = await claims
      .find(
        { status: COMPANY_OWNERSHIP_CLAIM_STATUS.PENDING },
        {
          projection: {
            companyId: 1,
            userId: 1,
            createdAt: 1,
          },
        },
      )
      .sort({ createdAt: 1 })
      .limit(500)
      .toArray();

    const userIds = Array.from(new Set(rows.map((row) => row.userId.toHexString()))).map(
      (id) => new ObjectId(id),
    );
    const companyIds = Array.from(
      new Set(rows.map((row) => row.companyId.toHexString())),
    ).map((id) => new ObjectId(id));

    const [userRows, companyRows] = await Promise.all([
      users
        .find(
          { _id: { $in: userIds } },
          { projection: { name: 1, email: 1, role: 1, createdAt: 1 } },
        )
        .toArray(),
      companies
        .find(
          { _id: { $in: companyIds } },
          { projection: { name: 1, slug: 1, createdByUserId: 1 } },
        )
        .toArray(),
    ]);

    const usersById = new Map(userRows.filter((row) => row._id).map((row) => [row._id!.toHexString(), row]));
    const companiesById = new Map(
      companyRows.filter((row) => row._id).map((row) => [row._id!.toHexString(), row]),
    );

    const items = rows
      .filter((row) => row._id)
      .map((row) => {
        const user = usersById.get(row.userId.toHexString());
        const company = companiesById.get(row.companyId.toHexString());
        if (!user || !company || !company._id) {
          return null;
        }
        if (company.createdByUserId) {
          return null;
        }

        return {
          id: row._id!.toHexString(),
          createdAt: row.createdAt.toISOString(),
          user: {
            id: row.userId.toHexString(),
            name: user.name,
            email: user.email,
            role: user.role,
          },
          company: {
            id: row.companyId.toHexString(),
            name: company.name,
            slug: company.slug,
          },
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return NextResponse.json({ items });
  } catch (error) {
    logError("Unhandled API error", { route: "/api/admin/company-claims", error });
    return NextResponse.json(
      {
        error: "Internal server error",
        message:
          error instanceof Error ? error.message : "Unknown admin claims error",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin || !admin._id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = decideClaimSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid payload",
          issues: parsed.error.issues.map((issue) => issue.message),
        },
        { status: 400 },
      );
    }

    if (!ObjectId.isValid(parsed.data.claimId)) {
      return NextResponse.json({ error: "Invalid claim id" }, { status: 400 });
    }

    await ensureCompanyOwnershipClaimsIndexes();
    await ensureCompaniesIndexes();
    await ensureUsersIndexes();

    const claims = await getCompanyOwnershipClaimsCollection();
    const companies = await getCompaniesCollection();
    const users = await getUsersCollection();
    const claimId = new ObjectId(parsed.data.claimId);

    const claim = await claims.findOne(
      { _id: claimId },
      {
        projection: {
          _id: 1,
          companyId: 1,
          userId: 1,
          status: 1,
        },
      },
    );
    if (!claim) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    }
    if (claim.status !== COMPANY_OWNERSHIP_CLAIM_STATUS.PENDING) {
      return NextResponse.json({ error: "Claim already reviewed" }, { status: 409 });
    }

    const [claimUser, claimCompany] = await Promise.all([
      users.findOne(
        { _id: claim.userId },
        { projection: { _id: 1, name: 1, email: 1 } },
      ),
      companies.findOne(
        { _id: claim.companyId },
        { projection: { _id: 1, name: 1 } },
      ),
    ]);

    const now = new Date();

    if (parsed.data.action === "approve") {
      const competingClaims = await claims
        .find(
          {
            companyId: claim.companyId,
            status: COMPANY_OWNERSHIP_CLAIM_STATUS.PENDING,
            _id: { $ne: claimId },
          },
          {
            projection: {
              userId: 1,
            },
          },
        )
        .toArray();

      const companyAssignResult = await companies.updateOne(
        {
          _id: claim.companyId,
          createdByUserId: { $exists: false },
        },
        {
          $set: {
            createdByUserId: claim.userId,
            updatedAt: now,
          },
        },
      );

      if (companyAssignResult.modifiedCount === 0) {
        return NextResponse.json(
          { error: "Company already has an assigned owner" },
          { status: 409 },
        );
      }

      await users.updateOne(
        { _id: claim.userId, role: { $in: [USER_ROLE.USER, USER_ROLE.COMPANY_OWNER] } },
        {
          $set: {
            role: USER_ROLE.COMPANY_OWNER,
            updatedAt: now,
          },
        },
      );

      await claims.updateOne(
        { _id: claimId, status: COMPANY_OWNERSHIP_CLAIM_STATUS.PENDING },
        {
          $set: {
            status: COMPANY_OWNERSHIP_CLAIM_STATUS.APPROVED,
            reviewedAt: now,
            reviewedByUserId: admin._id,
            updatedAt: now,
          },
        },
      );

      await claims.updateMany(
        {
          companyId: claim.companyId,
          status: COMPANY_OWNERSHIP_CLAIM_STATUS.PENDING,
          _id: { $ne: claimId },
        },
        {
          $set: {
            status: COMPANY_OWNERSHIP_CLAIM_STATUS.REJECTED,
            reviewedAt: now,
            reviewedByUserId: admin._id,
            updatedAt: now,
          },
        },
      );

      if (claimUser && claimCompany) {
        const approvedMailResult = await sendClaimApprovedEmail({
          to: claimUser.email,
          name: claimUser.name,
          companyName: claimCompany.name,
        });
        if (!approvedMailResult.ok) {
          logMailFailure("claim-approved", {
            claimId: claimId.toHexString(),
            userId: claimUser._id?.toHexString(),
            error: approvedMailResult.error,
            status: approvedMailResult.status,
          });
        }
      }

      if (competingClaims.length > 0 && claimCompany) {
        const competingUserIds = Array.from(
          new Set(competingClaims.map((item) => item.userId.toHexString())),
        ).map((id) => new ObjectId(id));

        const competingUsers = await users
          .find(
            { _id: { $in: competingUserIds } },
            { projection: { _id: 1, name: 1, email: 1 } },
          )
          .toArray();

        for (const competingUser of competingUsers) {
          const rejectedMailResult = await sendClaimRejectedEmail({
            to: competingUser.email,
            name: competingUser.name,
            companyName: claimCompany.name,
          });

          if (!rejectedMailResult.ok) {
            logMailFailure("claim-rejected", {
              claimId: claimId.toHexString(),
              userId: competingUser._id?.toHexString(),
              error: rejectedMailResult.error,
              status: rejectedMailResult.status,
            });
          }
        }
      }
    } else {
      const updateResult = await claims.updateOne(
        { _id: claimId, status: COMPANY_OWNERSHIP_CLAIM_STATUS.PENDING },
        {
          $set: {
            status: COMPANY_OWNERSHIP_CLAIM_STATUS.REJECTED,
            reviewedAt: now,
            reviewedByUserId: admin._id,
            updatedAt: now,
          },
        },
      );

      if (updateResult.modifiedCount === 0) {
        return NextResponse.json({ error: "Claim already reviewed" }, { status: 409 });
      }

      if (claimUser && claimCompany) {
        const rejectedMailResult = await sendClaimRejectedEmail({
          to: claimUser.email,
          name: claimUser.name,
          companyName: claimCompany.name,
        });
        if (!rejectedMailResult.ok) {
          logMailFailure("claim-rejected", {
            claimId: claimId.toHexString(),
            userId: claimUser._id?.toHexString(),
            error: rejectedMailResult.error,
            status: rejectedMailResult.status,
          });
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    logError("Unhandled API error", { route: "/api/admin/company-claims", error });
    return NextResponse.json(
      {
        error: "Internal server error",
        message:
          error instanceof Error ? error.message : "Unknown admin claim action error",
      },
      { status: 500 },
    );
  }
}
