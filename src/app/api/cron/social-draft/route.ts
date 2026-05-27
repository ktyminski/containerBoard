import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { createDailySocialDrafts } from "@/lib/social/create-daily-drafts";
import { logError } from "@/lib/server-logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function extractRequestSecret(request: NextRequest): string | null {
  const authorizationHeader = request.headers.get("authorization");
  if (authorizationHeader) {
    const bearerMatch = authorizationHeader.match(/^Bearer\s+(.+)$/i);
    if (bearerMatch?.[1]) {
      return bearerMatch[1].trim();
    }
  }

  const headerSecret = request.headers.get("x-cron-secret");
  if (headerSecret) {
    return headerSecret.trim();
  }

  return null;
}

async function handleCronRequest(request: NextRequest) {
  try {
    const env = getEnv();
    const expectedSecret = env.CRON_SECRET?.trim();
    if (!expectedSecret) {
      return NextResponse.json(
        { error: "CRON_SECRET is not configured" },
        { status: 500 },
      );
    }

    const providedSecret = extractRequestSecret(request);
    if (!providedSecret || providedSecret !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await createDailySocialDrafts();
    return NextResponse.json({
      ...result,
      refreshedAt: new Date().toISOString(),
    });
  } catch (error) {
    logError("Unhandled API error", {
      route: "/api/cron/social-draft",
      error,
    });
    return NextResponse.json(
      {
        error: "Internal server error",
        message:
          error instanceof Error ? error.message : "Unknown social draft cron error",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  return handleCronRequest(request);
}

export async function POST(request: NextRequest) {
  return handleCronRequest(request);
}

