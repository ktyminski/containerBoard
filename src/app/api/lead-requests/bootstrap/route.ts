import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth-session";
import { getLocaleFromApiRequest } from "@/lib/i18n";
import { getLeadRequestsBoardData } from "@/lib/lead-requests-board-data";
import { logError } from "@/lib/server-logger";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const locale = getLocaleFromApiRequest(request);
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const data = await getLeadRequestsBoardData({
      token,
      locale,
    });

    return NextResponse.json(data);
  } catch (error) {
    logError("Unhandled API error", { route: "/api/lead-requests/bootstrap", error });
    return NextResponse.json(
      {
        error: "Internal server error",
        message:
          error instanceof Error
            ? error.message
            : "Unknown lead-requests bootstrap error",
      },
      { status: 500 },
    );
  }
}
