import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";

export const runtime = "nodejs";

const OAUTH_STATE_COOKIE = "containerboard_google_state";
const OAUTH_NEXT_COOKIE = "containerboard_google_next";

function sanitizeNext(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/";
  }
  return next;
}

function getRedirectUri(request: NextRequest): string {
  const env = getEnv();
  if (env.GOOGLE_REDIRECT_URI) {
    return env.GOOGLE_REDIRECT_URI;
  }
  return new URL("/api/auth/google/callback", request.url).toString();
}

function shouldUseSecureCookies(request: NextRequest, nodeEnv: string): boolean {
  if (nodeEnv !== "production") {
    return false;
  }
  const hostname = request.nextUrl.hostname;
  return !["localhost", "127.0.0.1", "::1"].includes(hostname);
}

export async function GET(request: NextRequest) {
  const env = getEnv();
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(
      new URL("/login?error=google_not_configured", request.url),
    );
  }

  const state = crypto.randomBytes(24).toString("hex");
  const next = sanitizeNext(request.nextUrl.searchParams.get("next"));
  const redirectUri = getRedirectUri(request);
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  const useSecureCookies = shouldUseSecureCookies(request, env.NODE_ENV);

  authUrl.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("prompt", "select_account");

  const response = NextResponse.redirect(authUrl);
  response.cookies.set({
    name: OAUTH_STATE_COOKIE,
    value: state,
    httpOnly: true,
    sameSite: "lax",
    secure: useSecureCookies,
    path: "/",
    maxAge: 60 * 10,
  });
  response.cookies.set({
    name: OAUTH_NEXT_COOKIE,
    value: next,
    httpOnly: true,
    sameSite: "lax",
    secure: useSecureCookies,
    path: "/",
    maxAge: 60 * 10,
  });

  return response;
}
