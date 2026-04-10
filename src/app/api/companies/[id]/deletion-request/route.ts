import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserFromRequest } from "@/lib/auth-user";
import { ensureCompaniesIndexes, getCompaniesCollection } from "@/lib/companies";
import { USER_ROLE } from "@/lib/user-roles";
import { logError } from "@/lib/server-logger";

export const runtime = "nodejs";

const requestDeletionSchema = z.object({
  reason: z.string().trim().min(10).max(1500),
});

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

    const payload = await request.json().catch(() => null);
    const parsed = requestDeletionSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid payload",
          issues: parsed.error.issues.map((issue) => issue.message),
        },
        { status: 400 },
      );
    }

    await ensureCompaniesIndexes();
    const companies = await getCompaniesCollection();
    const companyId = new ObjectId(id);
    const company = await companies.findOne(
      { _id: companyId },
      { projection: { _id: 1, createdByUserId: 1 } },
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

    const now = new Date();
    await companies.updateOne(
      { _id: companyId },
      {
        $set: {
          deletionRequest: {
            isRequested: true,
            reason: parsed.data.reason.trim(),
            requestedAt: now,
            requestedByUserId: user._id,
          },
          updatedAt: now,
        },
      },
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    logError("Unhandled API error", { route: "/api/companies/[id]/deletion-request", error });
    return NextResponse.json(
      {
        error: "Internal server error",
        message:
          error instanceof Error
            ? error.message
            : "Unknown company deletion request error",
      },
      { status: 500 },
    );
  }
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
    const companies = await getCompaniesCollection();
    const companyId = new ObjectId(id);
    const company = await companies.findOne(
      { _id: companyId },
      { projection: { _id: 1, createdByUserId: 1 } },
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

    await companies.updateOne(
      { _id: companyId },
      {
        $set: {
          updatedAt: new Date(),
        },
        $unset: {
          deletionRequest: "",
        },
      },
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    logError("Unhandled API error", { route: "/api/companies/[id]/deletion-request", error });
    return NextResponse.json(
      {
        error: "Internal server error",
        message:
          error instanceof Error
            ? error.message
            : "Unknown company deletion request withdraw error",
      },
      { status: 500 },
    );
  }
}
