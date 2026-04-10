import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AUTH_ERROR } from "@/lib/auth-error-codes";
import {
  consumePasswordResetToken,
  deletePasswordResetTokensForUser,
  hashPasswordResetToken,
} from "@/lib/password-reset";
import { enforceRateLimitOrResponse } from "@/lib/request-rate-limit";
import {
  getRequestIp,
  isTurnstileEnabled,
  verifyTurnstileToken,
} from "@/lib/turnstile";
import { ensureUsersIndexes, getUsersCollection } from "@/lib/users";
import { logError } from "@/lib/server-logger";

export const runtime = "nodejs";

const resetPasswordSchema = z.object({
  token: z.string().trim().min(20).max(200),
  password: z.string().min(8).max(72),
  turnstileToken: z.string().trim().optional().default(""),
});

export async function POST(request: Request) {
  try {
    const ipRateLimitResponse = await enforceRateLimitOrResponse({
      request,
      scope: "auth:reset-password:ip",
      limit: 10,
      windowMs: 10 * 60_000,
    });
    if (ipRateLimitResponse) {
      return ipRateLimitResponse;
    }

    const body = await request.json();
    const parsed = resetPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: AUTH_ERROR.INVALID_PAYLOAD,
          issues: parsed.error.issues.map((issue) => issue.message),
        },
        { status: 400 },
      );
    }

    const tokenRateLimitResponse = await enforceRateLimitOrResponse({
      request,
      scope: "auth:reset-password:token",
      limit: 8,
      windowMs: 60 * 60_000,
      identity: hashPasswordResetToken(parsed.data.token),
    });
    if (tokenRateLimitResponse) {
      return tokenRateLimitResponse;
    }

    if (isTurnstileEnabled() && !parsed.data.turnstileToken) {
      return NextResponse.json({ error: "TURNSTILE_REQUIRED" }, { status: 400 });
    }
    const turnstileResult = await verifyTurnstileToken({
      token: parsed.data.turnstileToken,
      remoteIp: getRequestIp(request.headers),
    });
    if (!turnstileResult.ok) {
      return NextResponse.json({ error: "TURNSTILE_FAILED" }, { status: 400 });
    }

    const tokenDocument = await consumePasswordResetToken(parsed.data.token);
    if (!tokenDocument?.userId) {
      return NextResponse.json(
        { error: AUTH_ERROR.PASSWORD_RESET_INVALID_TOKEN },
        { status: 400 },
      );
    }

    await ensureUsersIndexes();
    const users = await getUsersCollection();
    const user = await users.findOne(
      { _id: tokenDocument.userId },
      {
        projection: {
          _id: 1,
          authProvider: 1,
          passwordHash: 1,
        },
      },
    );

    if (
      !user?._id ||
      user.authProvider !== "local" ||
      typeof user.passwordHash !== "string" ||
      user.passwordHash.length === 0
    ) {
      return NextResponse.json(
        { error: AUTH_ERROR.PASSWORD_RESET_INVALID_TOKEN },
        { status: 400 },
      );
    }

    const nextPasswordHash = await bcrypt.hash(parsed.data.password, 12);
    const now = new Date();
    const updateResult = await users.updateOne(
      { _id: user._id },
      {
        $set: {
          passwordHash: nextPasswordHash,
          updatedAt: now,
        },
      },
    );

    if (updateResult.matchedCount === 0) {
      return NextResponse.json(
        { error: AUTH_ERROR.PASSWORD_RESET_INVALID_TOKEN },
        { status: 400 },
      );
    }

    await deletePasswordResetTokensForUser(user._id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    logError("Unhandled API error", { route: "/api/auth/reset-password", error });
    return NextResponse.json(
      {
        error: AUTH_ERROR.INTERNAL_SERVER_ERROR,
        message: error instanceof Error ? error.message : "Unknown reset password error",
      },
      { status: 500 },
    );
  }
}
