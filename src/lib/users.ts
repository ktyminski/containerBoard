import { ObjectId, type Collection } from "mongodb";
import { getDb } from "@/lib/mongodb";
import {
  USER_ROLE,
  USER_ROLES,
  USER_REGISTRATION_ROLES,
  type UserRole,
} from "@/lib/user-roles";

export { USER_ROLE, USER_ROLES, USER_REGISTRATION_ROLES };
export type { UserRole, UserRegistrationRole } from "@/lib/user-roles";

export type UserDocument = {
  _id?: ObjectId;
  email: string;
  emailNormalized: string;
  passwordHash?: string;
  name: string;
  phone?: string;
  role: UserRole;
  isBlocked?: boolean;
  isEmailVerified?: boolean;
  emailVerifiedAt?: Date;
  authProvider: "local" | "google";
  googleSub?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isBlocked: boolean;
  createdAt: string;
};

let userIndexesReadyPromise: Promise<void> | null = null;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function getUsersCollection(): Promise<Collection<UserDocument>> {
  const db = await getDb();
  return db.collection<UserDocument>("users");
}

export async function ensureUsersIndexes(): Promise<void> {
  if (!userIndexesReadyPromise) {
    userIndexesReadyPromise = (async () => {
      const users = await getUsersCollection();
      await users.createIndex({ emailNormalized: 1 }, { unique: true });
      await users.createIndex({ role: 1 });
      await users.createIndex({ isBlocked: 1 });
    })();
  }

  return userIndexesReadyPromise;
}

export function toPublicUser(user: UserDocument): PublicUser {
  if (!user._id) {
    throw new Error("User document is missing _id");
  }

  return {
    id: user._id.toHexString(),
    email: user.email,
    name: user.name,
    role: user.role,
    isBlocked: user.isBlocked === true,
    createdAt: user.createdAt.toISOString(),
  };
}
