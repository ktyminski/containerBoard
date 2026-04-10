import { jwtVerify, createRemoteJWKSet } from "jose";
import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, setSessionCookie } from "@/lib/auth-session";
import { getEnv } from "@/lib/env";
import { sendWelcomeEmail } from "@/lib/mailer";
import { USER_ROLE } from "@/lib/user-roles";
import {
  ensureUsersIndexes,
  getUsersCollection,
  normalizeEmail,
} from "@/lib/users";
import { logError } from "@/lib/server-logger";

export const runtime = "nodejs";

const OAUTH_STATE_COOKIE = "containerboard_google_state";
const OAUTH_NEXT_COOKIE = "containerboard_google_next";
const GOOGLE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

function sanitizeNext(next: string | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/";
  }
  return next;
}

function redirectWithError(request: NextRequest, errorCode: string): NextResponse {
  return NextResponse.redirect(new URL(`/login?error=${errorCode}`, request.url));
}

function getRedirectUri(request: NextRequest): string {
  const env = getEnv();
  if (env.GOOGLE_REDIRECT_URI) {
    return env.GOOGLE_REDIRECT_URI;
  }
  return new URL("/api/auth/google/callback", request.url).toString();
}

export async function GET(request: NextRequest) {
  const env = getEnv();
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return redirectWithError(request, "google_not_configured");
  }

  const state = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");
  const savedState = request.cookies.get(OAUTH_STATE_COOKIE)?.value;
  const nextPath = sanitizeNext(request.cookies.get(OAUTH_NEXT_COOKIE)?.value);

  if (!state || !code || !savedState || state !== savedState) {
    return redirectWithError(request, "google_auth_failed");
  }

  try {
    const redirectUri = getRedirectUri(request);
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
      cache: "no-store",
    });

    if (!tokenResponse.ok) {
      return redirectWithError(request, "google_auth_failed");
    }

    const tokenData = (await tokenResponse.json()) as { id_token?: string };
    if (!tokenData.id_token) {
      return redirectWithError(request, "google_auth_failed");
    }

    const { payload } = await jwtVerify(tokenData.id_token, GOOGLE_JWKS, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: env.GOOGLE_CLIENT_ID,
    });

    if (
      typeof payload.sub !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.email_verified !== "boolean" ||
      payload.email_verified !== true
    ) {
      return redirectWithError(request, "google_auth_failed");
    }

    const email = payload.email;
    const name =
      typeof payload.name === "string" && payload.name.trim().length > 0
        ? payload.name.trim()
        : email.split("@")[0];
    const emailNormalized = normalizeEmail(email);

    await ensureUsersIndexes();
    const users = await getUsersCollection();
    const now = new Date();
    const upsertResult = await users.updateOne(
      { emailNormalized },
      {
        $setOnInsert: {
          email,
          emailNormalized,
          role: USER_ROLE.USER,
          isBlocked: false,
          authProvider: "google",
          createdAt: now,
        },
        $set: {
          name,
          googleSub: payload.sub,
          isEmailVerified: true,
          emailVerifiedAt: now,
          updatedAt: now,
        },
      },
      { upsert: true },
    );

    const user = await users.findOne({ emailNormalized });
    if (!user?._id) {
      return redirectWithError(request, "google_auth_failed");
    }

    if (upsertResult.upsertedId) {
      const welcomeMailResult = await sendWelcomeEmail({
        to: user.email,
        name: user.name,
      });
      if (!welcomeMailResult.ok) {
        logError("Failed to send welcome email for Google user", {
          userId: user._id.toHexString(),
          status: welcomeMailResult.status,
          error: welcomeMailResult.error,
        });
      }
    }

    const sessionToken = await createSessionToken({
      sub: user._id.toHexString(),
      role: user.role,
      email: user.email,
      name: user.name,
      authProvider: "google",
    });

    const response = NextResponse.redirect(new URL(nextPath, request.url));
    setSessionCookie(response, sessionToken);
    response.cookies.set(OAUTH_STATE_COOKIE, "", { path: "/", maxAge: 0 });
    response.cookies.set(OAUTH_NEXT_COOKIE, "", { path: "/", maxAge: 0 });
    return response;
  } catch (error) {
    logError("Unhandled API error", { route: "/api/auth/google/callback", error });
    return redirectWithError(request, "google_auth_failed");
  }
}
