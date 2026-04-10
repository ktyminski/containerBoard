import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { ObjectId } from "mongodb";
import {
  clearSessionCookie,
  createSessionToken,
  getSessionFromRequest,
  setSessionCookie,
} from "@/lib/auth-session";
import { getCurrentUserFromRequest } from "@/lib/auth-user";
import { getAnnouncementFavoritesCollection } from "@/lib/announcement-favorites";
import { getEmailVerificationTokensCollection } from "@/lib/email-verification";
import {
  ensureCompanyOwnershipClaimsIndexes,
  getCompanyOwnershipClaimsCollection,
} from "@/lib/company-ownership-claims";
import { ensureCompaniesIndexes, getCompaniesCollection } from "@/lib/companies";
import {
  getUsersCollection,
  type UserDocument,
} from "@/lib/users";
import { USER_ROLE } from "@/lib/user-roles";
import { logError } from "@/lib/server-logger";

export const runtime = "nodejs";
const PHONE_REGEX = /^[+()0-9\s-]{6,30}$/;

const detachCompanySchema = z.object({
  action: z.literal("detachCompany"),
  companyId: z.string().refine((value) => ObjectId.isValid(value), {
    message: "companyId must be a valid id",
  }),
});
const updateProfileSchema = z.object({
  action: z.literal("updateProfile"),
  name: z.string().trim().min(2).max(80),
  phone: z
    .string()
    .trim()
    .max(30)
    .optional()
    .default("")
    .refine((value) => value.length === 0 || PHONE_REGEX.test(value), {
      message: "Invalid phone number",
    }),
});
const changePasswordSchema = z
  .object({
    action: z.literal("changePassword"),
    currentPassword: z.string().min(8).max(72),
    newPassword: z.string().min(8).max(72),
  })
  .refine((input) => input.currentPassword !== input.newPassword, {
    message: "New password must differ from current password",
    path: ["newPassword"],
  });
const accountPatchSchema = z.discriminatedUnion("action", [
  detachCompanySchema,
  updateProfileSchema,
  changePasswordSchema,
]);

async function requireCurrentUser(
  request: NextRequest,
): Promise<
  | { user: UserDocument; sessionAuthProvider: "local" | "google" }
  | { response: NextResponse }
> {
  const user = await getCurrentUserFromRequest(request);
  if (!user?._id) {
    const unauthorizedResponse = NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
    clearSessionCookie(unauthorizedResponse);
    return { response: unauthorizedResponse };
  }

  const session = await getSessionFromRequest(request);
  if (!session) {
    const unauthorizedResponse = NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
    clearSessionCookie(unauthorizedResponse);
    return { response: unauthorizedResponse };
  }

  return {
    user,
    sessionAuthProvider: session.authProvider ?? user.authProvider,
  };
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireCurrentUser(request);
    if ("response" in auth) {
      return auth.response;
    }

    const { user, sessionAuthProvider } = auth;
    const userId = user._id;
    if (!userId) {
      const unauthorizedResponse = NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
      clearSessionCookie(unauthorizedResponse);
      return unauthorizedResponse;
    }
    const body = await request.json();
    const parsed = accountPatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid payload",
          issues: parsed.error.issues.map((issue) => issue.message),
        },
        { status: 400 },
      );
    }

    if (parsed.data.action === "updateProfile") {
      const users = await getUsersCollection();
      const now = new Date();
      const normalizedPhone = parsed.data.phone.trim();
      const updateDocument: {
        $set: {
          name: string;
          updatedAt: Date;
          phone?: string;
        };
        $unset?: { phone: "" };
      } = {
        $set: {
          name: parsed.data.name,
          updatedAt: now,
        },
      };
      if (normalizedPhone) {
        updateDocument.$set.phone = normalizedPhone;
      } else {
        updateDocument.$unset = { phone: "" };
      }
      await users.updateOne(
        { _id: userId },
        updateDocument,
      );

      const token = await createSessionToken({
        sub: userId.toHexString(),
        role: user.role,
        email: user.email,
        name: parsed.data.name,
        authProvider: sessionAuthProvider,
      });
      const response = NextResponse.json({
        ok: true,
        user: {
          name: parsed.data.name,
          email: user.email,
          phone: normalizedPhone,
          authProvider: user.authProvider,
        },
      });
      setSessionCookie(response, token);
      return response;
    }

    if (parsed.data.action === "changePassword") {
      if (sessionAuthProvider !== "local") {
        return NextResponse.json(
          { error: "Password change is available only for local accounts" },
          { status: 403 },
        );
      }
      if (!user.passwordHash) {
        return NextResponse.json(
          { error: "User password is not configured" },
          { status: 400 },
        );
      }

      const isCurrentPasswordValid = await bcrypt.compare(
        parsed.data.currentPassword,
        user.passwordHash,
      );
      if (!isCurrentPasswordValid) {
        return NextResponse.json(
          { error: "Current password is incorrect" },
          { status: 401 },
        );
      }

      const nextPasswordHash = await bcrypt.hash(parsed.data.newPassword, 12);
      await (await getUsersCollection()).updateOne(
        { _id: userId },
        {
          $set: {
            passwordHash: nextPasswordHash,
            updatedAt: new Date(),
          },
        },
      );

      return NextResponse.json({ ok: true });
    }

    if (user.role !== USER_ROLE.USER && user.role !== USER_ROLE.COMPANY_OWNER) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await ensureCompaniesIndexes();
    const [users, companies] = await Promise.all([getUsersCollection(), getCompaniesCollection()]);
    const now = new Date();
    const companyId = new ObjectId(parsed.data.companyId);
    const detachResult = await companies.updateOne(
      { _id: companyId, createdByUserId: userId },
      {
        $unset: { createdByUserId: "" },
        $set: { updatedAt: now },
      },
    );

    if (detachResult.modifiedCount === 0) {
      return NextResponse.json({ error: "Company assignment not found" }, { status: 404 });
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
          updatedAt: now,
        },
      },
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    logError("Unhandled API error", { route: "/api/auth/account", error });
    return NextResponse.json(
      {
        error: "Internal server error",
        message:
          error instanceof Error ? error.message : "Unknown account company detach error",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireCurrentUser(request);
    if ("response" in auth) {
      return auth.response;
    }
    const { user } = auth;

    if (user.role === USER_ROLE.ADMIN) {
      return NextResponse.json(
        { error: "Admin account cannot be deleted" },
        { status: 403 },
      );
    }

    await ensureCompaniesIndexes();
    await ensureCompanyOwnershipClaimsIndexes();

    const [users, companies, claims, favorites, verificationTokens] = await Promise.all([
      getUsersCollection(),
      getCompaniesCollection(),
      getCompanyOwnershipClaimsCollection(),
      getAnnouncementFavoritesCollection(),
      getEmailVerificationTokensCollection(),
    ]);

    const now = new Date();
    await Promise.all([
      companies.updateMany(
        { createdByUserId: user._id },
        {
          $unset: { createdByUserId: "" },
          $set: { updatedAt: now },
        },
      ),
      claims.deleteMany({ userId: user._id }),
      favorites.deleteMany({ userId: user._id }),
      verificationTokens.deleteMany({ userId: user._id }),
    ]);

    const deleteResult = await users.deleteOne({ _id: user._id });
    if (deleteResult.deletedCount === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const response = NextResponse.json({ ok: true });
    clearSessionCookie(response);
    return response;
  } catch (error) {
    logError("Unhandled API error", { route: "/api/auth/account", error });
    return NextResponse.json(
      {
        error: "Internal server error",
        message:
          error instanceof Error ? error.message : "Unknown delete account error",
      },
      { status: 500 },
    );
  }
}
