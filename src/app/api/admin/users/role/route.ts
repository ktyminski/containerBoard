import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getEnv } from "@/lib/env";
import {
  USER_ROLES,
  ensureUsersIndexes,
  getUsersCollection,
  normalizeEmail,
  toPublicUser,
} from "@/lib/users";
import { logError } from "@/lib/server-logger";

export const runtime = "nodejs";

const updateRoleSchema = z.object({
  email: z.email().transform((value) => value.trim()),
  role: z.enum(USER_ROLES),
});

export async function PATCH(request: NextRequest) {
  try {
    const adminToken = getEnv().ADMIN_TOKEN;
    const providedToken = request.headers.get("x-admin-token");

    if (!adminToken || providedToken !== adminToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    await ensureUsersIndexes();
    const users = await getUsersCollection();
    await users.updateOne(
      { emailNormalized: normalizeEmail(parsed.data.email) },
      { $set: { role: parsed.data.role, updatedAt: new Date() } },
    );

    const updatedUser = await users.findOne({
      emailNormalized: normalizeEmail(parsed.data.email),
    });
    if (!updatedUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user: toPublicUser(updatedUser) });
  } catch (error) {
    logError("Unhandled API error", { route: "/api/admin/users/role", error });
    return NextResponse.json(
      {
        error: "Internal server error",
        message:
          error instanceof Error ? error.message : "Unknown update role error",
      },
      { status: 500 },
    );
  }
}

