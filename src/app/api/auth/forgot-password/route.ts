import { NextResponse } from "next/server";
import { z } from "zod";
import { AUTH_ERROR } from "@/lib/auth-error-codes";
import { getLocaleFromApiRequest, withLang } from "@/lib/i18n";
import { sendPasswordResetEmail } from "@/lib/mailer";
import {
  createPasswordResetToken,
  deletePasswordResetTokensForUser,
} from "@/lib/password-reset";
import { enforceRateLimitOrResponse } from "@/lib/request-rate-limit";
import {
  getRequestIp,
  isTurnstileEnabled,
  verifyTurnstileToken,
} from "@/lib/turnstile";
import { ensureUsersIndexes, getUsersCollection, normalizeEmail } from "@/lib/users";
import { logError } from "@/lib/server-logger";

export const runtime = "nodejs";

const forgotPasswordSchema = z.object({
  email: z.email().transform((value) => value.trim()),
  turnstileToken: z.string().trim().optional().default(""),
});

export async function POST(request: Request) {
  try {
    const ipRateLimitResponse = await enforceRateLimitOrResponse({
      request,
      scope: "auth:forgot-password:ip",
      limit: 8,
      windowMs: 10 * 60_000,
    });
    if (ipRateLimitResponse) {
      return ipRateLimitResponse;
    }

    const body = await request.json();
    const parsed = forgotPasswordSchema.safeParse(body);

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
      scope: "auth:forgot-password:email",
      limit: 5,
      windowMs: 60 * 60_000,
      identity: normalizeEmail(parsed.data.email),
    });
    if (emailRateLimitResponse) {
      return emailRateLimitResponse;
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

    await ensureUsersIndexes();
    const users = await getUsersCollection();
    const user = await users.findOne(
      { emailNormalized: normalizeEmail(parsed.data.email) },
      {
        projection: {
          _id: 1,
          email: 1,
          name: 1,
          passwordHash: 1,
          authProvider: 1,
        },
      },
    );

    if (
      user?._id &&
      user.authProvider === "local" &&
      typeof user.passwordHash === "string" &&
      user.passwordHash.length > 0
    ) {
      const { token } = await createPasswordResetToken(user._id);
      const locale = getLocaleFromApiRequest(request);
      const resetUrl = new URL(withLang("/reset-password", locale), request.url);
      resetUrl.searchParams.set("token", token);

      const mailResult = await sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        resetUrl: resetUrl.toString(),
      });

      if (!mailResult.ok) {
        await deletePasswordResetTokensForUser(user._id);
        logError("Failed to send password reset email", {
          userId: user._id.toHexString(),
          error: mailResult.error,
          status: mailResult.status,
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    logError("Unhandled API error", { route: "/api/auth/forgot-password", error });
    return NextResponse.json(
      {
        error: AUTH_ERROR.INTERNAL_SERVER_ERROR,
        message: error instanceof Error ? error.message : "Unknown forgot password error",
      },
      { status: 500 },
    );
  }
}
