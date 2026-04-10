import { ObjectId, type Filter } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserFromRequest } from "@/lib/auth-user";
import { ensureCompaniesIndexes, getCompaniesCollection } from "@/lib/companies";
import { USER_ROLE } from "@/lib/user-roles";
import {
  getUsersCollection,
  toPublicUser,
  USER_ROLES,
  type UserDocument,
} from "@/lib/users";
import { logError } from "@/lib/server-logger";

export const runtime = "nodejs";

const updateRoleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(USER_ROLES),
});

const updateUserBlockSchema = z.object({
  userId: z.string().min(1),
  isBlocked: z.boolean(),
});

const usersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(20),
  q: z.string().trim().min(1).max(100).optional(),
  role: z.union([z.enum(USER_ROLES), z.literal("all")]).default("all"),
  blockStatus: z.enum(["all", "blocked", "active"]).default("all"),
  sortBy: z.enum(["createdAt", "name", "email", "role"]).default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

const removeCompanyAssignmentSchema = z.object({
  userId: z.string().min(1),
  companyId: z.string().min(1),
});

const assignCompanySchema = z.object({
  userId: z.string().min(1),
  companyId: z.string().min(1),
});

async function requireAdmin(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user || user.role !== USER_ROLE.ADMIN) {
    return null;
  }
  return user;
}

function escapeRegexPattern(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const users = await getUsersCollection();
    const companies = await getCompaniesCollection();
    const parsedQuery = usersQuerySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );
    if (!parsedQuery.success) {
      return NextResponse.json(
        {
          error: "Invalid query parameters",
          issues: parsedQuery.error.issues.map((issue) => issue.message),
        },
        { status: 400 },
      );
    }
    const query = parsedQuery.data;
    const filter: Filter<UserDocument> = {};
    if (query.q) {
      const pattern = new RegExp(escapeRegexPattern(query.q), "i");
      filter.$or = [{ name: pattern }, { email: pattern }];
    }
    if (query.role !== "all") {
      filter.role = query.role;
    }
    if (query.blockStatus === "blocked") {
      filter.isBlocked = true;
    }
    if (query.blockStatus === "active") {
      filter.isBlocked = { $ne: true };
    }
    const sortFieldMap = {
      createdAt: "createdAt",
      name: "name",
      email: "emailNormalized",
      role: "role",
    } as const;
    const sortField = sortFieldMap[query.sortBy];
    const sortDirection = query.sortDir === "asc" ? 1 : -1;
    const sort: Record<string, 1 | -1> = { [sortField]: sortDirection };
    if (sortField !== "createdAt") {
      sort.createdAt = -1;
    }
    const total = await users.countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
    const page = Math.min(query.page, totalPages);
    const skip = (page - 1) * query.pageSize;
    const rows = await users
      .find(
        filter,
        {
          projection: {
            email: 1,
            name: 1,
            role: 1,
            isBlocked: 1,
            isEmailVerified: 1,
            createdAt: 1,
          },
        },
      )
      .sort(sort)
      .skip(skip)
      .limit(query.pageSize)
      .toArray();

    const userIds = rows
      .filter((row) => row._id)
      .map((row) => row._id!);

    const companyRows = await companies
      .find(
        { createdByUserId: { $in: userIds } },
        { projection: { name: 1, slug: 1, createdByUserId: 1 } },
      )
      .toArray();
    const availableCompanyRows = await companies
      .find(
        { createdByUserId: { $exists: false } },
        { projection: { name: 1, slug: 1 } },
      )
      .sort({ name: 1 })
      .limit(1000)
      .toArray();

    const companiesByUserId = new Map<
      string,
      Array<{ id: string; name: string; slug: string }>
    >();
    for (const company of companyRows) {
      if (!company._id || !company.createdByUserId) {
        continue;
      }
      const userId = company.createdByUserId.toHexString();
      const existing = companiesByUserId.get(userId) ?? [];
      existing.push({
        id: company._id.toHexString(),
        name: company.name,
        slug: company.slug,
      });
      companiesByUserId.set(userId, existing);
    }

    return NextResponse.json({
      items: rows
        .filter((row) => row._id)
        .map((row) => {
          const publicUser = toPublicUser(row);
          return {
            ...publicUser,
            isEmailVerified: row.isEmailVerified !== false,
            companies: companiesByUserId.get(publicUser.id) ?? [],
          };
        }),
      meta: {
        page,
        pageSize: query.pageSize,
        total,
        totalPages,
      },
      availableCompanies: availableCompanyRows
        .filter((company) => company._id)
        .map((company) => ({
          id: company._id.toHexString(),
          name: company.name,
          slug: company.slug,
        })),
    });
  } catch (error) {
    logError("Unhandled API error", { route: "/api/admin/users", error });
    return NextResponse.json(
      {
        error: "Internal server error",
        message:
          error instanceof Error ? error.message : "Unknown admin users error",
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
    const parsed = updateRoleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid payload",
          issues: parsed.error.issues.map((issue) => issue.message),
        },
        { status: 400 },
      );
    }

    if (!ObjectId.isValid(parsed.data.userId)) {
      return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
    }

    if (
      admin._id.toHexString() === parsed.data.userId &&
      parsed.data.role !== USER_ROLE.ADMIN
    ) {
      return NextResponse.json(
        { error: "Master admin cannot demote itself" },
        { status: 400 },
      );
    }

    const users = await getUsersCollection();
    const targetId = new ObjectId(parsed.data.userId);
    const result = await users.findOneAndUpdate(
      { _id: targetId },
      {
        $set: {
          role: parsed.data.role,
          updatedAt: new Date(),
        },
      },
      { returnDocument: "after" },
    );

    if (!result || !result._id) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user: toPublicUser(result) });
  } catch (error) {
    logError("Unhandled API error", { route: "/api/admin/users", error });
    return NextResponse.json(
      {
        error: "Internal server error",
        message:
          error instanceof Error ? error.message : "Unknown admin update error",
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin || !admin._id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateUserBlockSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid payload",
          issues: parsed.error.issues.map((issue) => issue.message),
        },
        { status: 400 },
      );
    }

    if (!ObjectId.isValid(parsed.data.userId)) {
      return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
    }

    if (admin._id.toHexString() === parsed.data.userId && parsed.data.isBlocked) {
      return NextResponse.json(
        { error: "Admin cannot block itself" },
        { status: 400 },
      );
    }

    const users = await getUsersCollection();
    const targetId = new ObjectId(parsed.data.userId);
    const updatedUser = await users.findOneAndUpdate(
      { _id: targetId },
      {
        $set: {
          isBlocked: parsed.data.isBlocked,
          updatedAt: new Date(),
        },
      },
      { returnDocument: "after" },
    );

    if (!updatedUser || !updatedUser._id) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user: toPublicUser(updatedUser) });
  } catch (error) {
    logError("Unhandled API error", { route: "/api/admin/users", error });
    return NextResponse.json(
      {
        error: "Internal server error",
        message:
          error instanceof Error ? error.message : "Unknown admin user block update error",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin || !admin._id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = assignCompanySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid payload",
          issues: parsed.error.issues.map((issue) => issue.message),
        },
        { status: 400 },
      );
    }

    if (!ObjectId.isValid(parsed.data.userId)) {
      return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
    }

    if (!ObjectId.isValid(parsed.data.companyId)) {
      return NextResponse.json({ error: "Invalid company id" }, { status: 400 });
    }

    const userId = new ObjectId(parsed.data.userId);
    const companyId = new ObjectId(parsed.data.companyId);

    await ensureCompaniesIndexes();
    const users = await getUsersCollection();
    const companies = await getCompaniesCollection();

    const [user, company] = await Promise.all([
      users.findOne(
        { _id: userId },
        { projection: { _id: 1, role: 1 } },
      ),
      companies.findOne(
        { _id: companyId },
        { projection: { _id: 1, createdByUserId: 1 } },
      ),
    ]);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }
    if (company.createdByUserId) {
      return NextResponse.json(
        { error: "Company already has an assigned owner" },
        { status: 409 },
      );
    }

    const companyUpdateResult = await companies.updateOne(
      { _id: companyId, createdByUserId: { $exists: false } },
      {
        $set: {
          createdByUserId: userId,
          updatedAt: new Date(),
        },
      },
    );

    if (companyUpdateResult.modifiedCount === 0) {
      return NextResponse.json(
        { error: "Company assignment could not be created" },
        { status: 409 },
      );
    }

    await users.updateOne(
      { _id: userId, role: { $in: [USER_ROLE.USER, USER_ROLE.COMPANY_OWNER] } },
      {
        $set: {
          role: USER_ROLE.COMPANY_OWNER,
          updatedAt: new Date(),
        },
      },
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    logError("Unhandled API error", { route: "/api/admin/users", error });
    return NextResponse.json(
      {
        error: "Internal server error",
        message:
          error instanceof Error ? error.message : "Unknown admin assign company error",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin || !admin._id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = removeCompanyAssignmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid payload",
          issues: parsed.error.issues.map((issue) => issue.message),
        },
        { status: 400 },
      );
    }

    if (!ObjectId.isValid(parsed.data.userId)) {
      return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
    }

    if (!ObjectId.isValid(parsed.data.companyId)) {
      return NextResponse.json({ error: "Invalid company id" }, { status: 400 });
    }

    const userId = new ObjectId(parsed.data.userId);
    const companyId = new ObjectId(parsed.data.companyId);

    await ensureCompaniesIndexes();
    const users = await getUsersCollection();
    const companies = await getCompaniesCollection();

    const [user, company] = await Promise.all([
      users.findOne({ _id: userId }, { projection: { _id: 1 } }),
      companies.findOne(
        { _id: companyId },
        { projection: { _id: 1, createdByUserId: 1 } },
      ),
    ]);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }
    if (!company.createdByUserId || !company.createdByUserId.equals(userId)) {
      return NextResponse.json(
        { error: "Company is not assigned to this user" },
        { status: 409 },
      );
    }

    const updateResult = await companies.updateOne(
      { _id: companyId, createdByUserId: userId },
      {
        $unset: { createdByUserId: "" },
        $set: { updatedAt: new Date() },
      },
    );

    if (updateResult.modifiedCount === 0) {
      return NextResponse.json(
        { error: "Company assignment could not be removed" },
        { status: 409 },
      );
    }

    const hasAssignedCompany = Boolean(
      await companies.findOne(
        { createdByUserId: userId },
        { projection: { _id: 1 } },
      ),
    );
    const derivedRole = hasAssignedCompany
      ? USER_ROLE.COMPANY_OWNER
      : USER_ROLE.USER;
    await users.updateOne(
      { _id: userId, role: { $in: [USER_ROLE.USER, USER_ROLE.COMPANY_OWNER] } },
      {
        $set: {
          role: derivedRole,
          updatedAt: new Date(),
        },
      },
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    logError("Unhandled API error", { route: "/api/admin/users", error });
    return NextResponse.json(
      {
        error: "Internal server error",
        message:
          error instanceof Error ? error.message : "Unknown admin remove assignment error",
      },
      { status: 500 },
    );
  }
}
