import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import {
  createSessionToken,
  setSessionCookie,
} from "@/lib/auth-session";
import {
  createEmailVerificationToken,
  deleteEmailVerificationTokensForUser,
} from "@/lib/email-verification";
import { sendEmailVerificationEmail } from "@/lib/mailer";
import {
  getRequestIp,
  isTurnstileEnabled,
  verifyTurnstileToken,
} from "@/lib/turnstile";
import {
  ensureUsersIndexes,
  getUsersCollection,
  normalizeEmail,
  toPublicUser,
} from "@/lib/users";
import { USER_ROLE } from "@/lib/user-roles";
import { enforceRateLimitOrResponse } from "@/lib/request-rate-limit";
import { AUTH_ERROR } from "@/lib/auth-error-codes";
import { logError } from "@/lib/server-logger";

export const runtime = "nodejs";

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email().transform((value) => value.trim()),
  password: z.string().min(8).max(72),
  legalConsent: z
    .boolean()
    .refine((value) => value === true, { message: "LEGAL_CONSENT_REQUIRED" }),
  turnstileToken: z.string().trim().optional().default(""),
});

export async function POST(request: Request) {
  try {
    const ipRateLimitResponse = await enforceRateLimitOrResponse({
      request,
      scope: "auth:register:ip",
      limit: 12,
      windowMs: 10 * 60_000,
    });
    if (ipRateLimitResponse) {
      return ipRateLimitResponse;
    }

    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

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
      scope: "auth:register:email",
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

    const normalizedEmail = normalizeEmail(parsed.data.email);
    const existingUser = await users.findOne({ emailNormalized: normalizedEmail });
    if (existingUser) {
      return NextResponse.json(
        { error: AUTH_ERROR.EMAIL_ALREADY_REGISTERED },
        { status: 409 },
      );
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const now = new Date();
    const result = await users.insertOne({
      email: parsed.data.email,
      emailNormalized: normalizedEmail,
      passwordHash,
      name: parsed.data.name,
      role: USER_ROLE.USER,
      isBlocked: false,
      isEmailVerified: false,
      authProvider: "local",
      createdAt: now,
      updatedAt: now,
    });

    const user = await users.findOne({ _id: result.insertedId });
    if (!user) {
      return NextResponse.json(
        { error: AUTH_ERROR.CREATED_USER_NOT_FOUND },
        { status: 500 },
      );
    }
    if (!user._id) {
      return NextResponse.json(
        { error: AUTH_ERROR.CREATED_USER_INVALID_ID },
        { status: 500 },
      );
    }

    const { token: verificationToken } = await createEmailVerificationToken(user._id);
    const verificationUrl = new URL("/api/auth/verify-email", request.url);
    verificationUrl.searchParams.set("token", verificationToken);

    const verificationMailResult = await sendEmailVerificationEmail({
      to: user.email,
      name: user.name,
      verificationUrl: verificationUrl.toString(),
    });
    if (!verificationMailResult.ok) {
      await Promise.allSettled([
        users.deleteOne({ _id: user._id }),
        deleteEmailVerificationTokensForUser(user._id),
      ]);
      logError("Failed to send registration verification email", {
        userId: user._id.toHexString(),
        error: verificationMailResult.error,
        status: verificationMailResult.status,
      });
      return NextResponse.json({ error: AUTH_ERROR.VERIFICATION_MAIL_FAILED }, { status: 502 });
    }

    const token = await createSessionToken({
      sub: user._id.toHexString(),
      role: user.role,
      email: user.email,
      name: user.name,
      authProvider: "local",
    });

    const response = NextResponse.json(
      {
        user: toPublicUser(user),
        requiresEmailVerification: true,
      },
      { status: 201 },
    );
    setSessionCookie(response, token);
    return response;
  } catch (error) {
    logError("Unhandled API error", { route: "/api/auth/register", error });
    return NextResponse.json(
      {
        error: AUTH_ERROR.INTERNAL_SERVER_ERROR,
        message: error instanceof Error ? error.message : "Unknown register error",
      },
      { status: 500 },
    );
  }
}
