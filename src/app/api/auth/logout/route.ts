import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth-session";
import { enforceRateLimitOrResponse } from "@/lib/request-rate-limit";

export const runtime = "nodejs";

function buildLogoutResponse(redirectUrl?: URL): NextResponse {
  const response = redirectUrl
    ? NextResponse.redirect(redirectUrl)
    : NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}

export async function POST(request: NextRequest) {
  const rateLimitResponse = await enforceRateLimitOrResponse({
    request,
    scope: "auth:logout:ip",
    limit: 120,
    windowMs: 60_000,
    onError: "block",
  });
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const shouldRedirect = request.nextUrl.searchParams.get("redirect") === "1";
  if (shouldRedirect) {
    return buildLogoutResponse(new URL("/", request.url));
  }

  return buildLogoutResponse();
}
