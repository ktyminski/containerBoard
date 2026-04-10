import { ObjectId } from "mongodb";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth-session";
import { getCompaniesCollection } from "@/lib/companies";
import { USER_ROLE } from "@/lib/user-roles";
import { getUsersCollection, type UserDocument } from "@/lib/users";

export type CurrentUserDocument = UserDocument & {
  sessionAuthProvider: "local" | "google";
};

export async function getCurrentUserFromRequest(
  request: NextRequest,
): Promise<CurrentUserDocument | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  return getCurrentUserFromToken(token);
}

export async function getCurrentUserFromToken(
  token: string,
): Promise<CurrentUserDocument | null> {
  const session = await verifySessionToken(token);
  if (!session || !ObjectId.isValid(session.sub)) {
    return null;
  }

  const users = await getUsersCollection();
  const user = await users.findOne({ _id: new ObjectId(session.sub) });
  if (!user?._id) {
    return null;
  }

  if (user.role === USER_ROLE.USER || user.role === USER_ROLE.COMPANY_OWNER) {
    const companies = await getCompaniesCollection();
    const hasAssignedCompany = Boolean(
      await companies.findOne(
        { createdByUserId: user._id },
        { projection: { _id: 1 } },
      ),
    );
    const derivedRole = hasAssignedCompany
      ? USER_ROLE.COMPANY_OWNER
      : USER_ROLE.USER;

    if (derivedRole !== user.role) {
      const now = new Date();
      await users.updateOne(
        { _id: user._id },
        {
          $set: {
            role: derivedRole,
            updatedAt: now,
          },
        },
      );
      user.role = derivedRole;
      user.updatedAt = now;
    }
  }

  return {
    ...user,
    sessionAuthProvider: session.authProvider ?? user.authProvider,
  };
}
