import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth-session";

export const runtime = "nodejs";

function buildLogoutResponse(redirectUrl?: URL): NextResponse {
  const response = redirectUrl
    ? NextResponse.redirect(redirectUrl)
    : NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}

export async function POST(request: NextRequest) {
  const shouldRedirect = request.nextUrl.searchParams.get("redirect") === "1";
  if (shouldRedirect) {
    return buildLogoutResponse(new URL("/", request.url));
  }

  return buildLogoutResponse();
}
