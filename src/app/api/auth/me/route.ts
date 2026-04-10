import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth-session";
import { getCurrentUserFromRequest } from "@/lib/auth-user";
import { toPublicUser } from "@/lib/users";
import { logError } from "@/lib/server-logger";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);

    if (!user) {
      const response = NextResponse.json({ user: null });
      clearSessionCookie(response);
      return response;
    }

    return NextResponse.json({ user: toPublicUser(user) });
  } catch (error) {
    logError("Unhandled API error", { route: "/api/auth/me", error });
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown me error",
      },
      { status: 500 },
    );
  }
}
