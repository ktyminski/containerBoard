import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import {
  createSessionToken,
  setSessionCookie,
} from "@/lib/auth-session";
import {
  ensureUsersIndexes,
  getUsersCollection,
  normalizeEmail,
  toPublicUser,
} from "@/lib/users";
import { enforceRateLimitOrResponse } from "@/lib/request-rate-limit";
import { AUTH_ERROR } from "@/lib/auth-error-codes";
import { logError } from "@/lib/server-logger";

export const runtime = "nodejs";

const loginSchema = z.object({
  email: z.email().transform((value) => value.trim()),
  password: z.string().min(8).max(72),
});

export async function POST(request: Request) {
  try {
    const ipRateLimitResponse = await enforceRateLimitOrResponse({
      request,
      scope: "auth:login:ip",
      limit: 20,
      windowMs: 60_000,
      onError: "block",
    });
    if (ipRateLimitResponse) {
      return ipRateLimitResponse;
    }

    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: AUTH_ERROR.INVALID_PAYLOAD,
          issues: parsed.error.issues.map((issue) => issue.message),
        },
        { status: 400 },
      );
    }

    const emailRateLimitResponse = await enforceRateLimitOrResponse({
      request,
      scope: "auth:login:email",
      limit: 25,
      windowMs: 5 * 60_000,
      identity: normalizeEmail(parsed.data.email),
      onError: "block",
    });
    if (emailRateLimitResponse) {
      return emailRateLimitResponse;
    }

    await ensureUsersIndexes();
    const users = await getUsersCollection();
    const user = await users.findOne({
      emailNormalized: normalizeEmail(parsed.data.email),
    });

    if (!user) {
      return NextResponse.json(
        { error: AUTH_ERROR.INVALID_CREDENTIALS },
        { status: 401 },
      );
    }
    if (!user.passwordHash) {
      return NextResponse.json(
        { error: AUTH_ERROR.GOOGLE_SIGN_IN_REQUIRED },
        { status: 401 },
      );
    }
    const isValidPassword = await bcrypt.compare(
      parsed.data.password,
      user.passwordHash,
    );
    if (!isValidPassword) {
      return NextResponse.json(
        { error: AUTH_ERROR.INVALID_CREDENTIALS },
        { status: 401 },
      );
    }
    if (!user._id) {
      return NextResponse.json(
        { error: AUTH_ERROR.USER_INVALID },
        { status: 500 },
      );
    }

    const token = await createSessionToken({
      sub: user._id.toHexString(),
      role: user.role,
      email: user.email,
      name: user.name,
      authProvider: "local",
    });

    const response = NextResponse.json({ user: toPublicUser(user) });
    setSessionCookie(response, token);
    return response;
  } catch (error) {
    logError("Unhandled API error", { route: "/api/auth/login", error });
    return NextResponse.json(
      {
        error: AUTH_ERROR.INTERNAL_SERVER_ERROR,
        message: error instanceof Error ? error.message : "Unknown login error",
      },
      { status: 500 },
    );
  }
}
