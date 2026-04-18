import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  ensureContainerListingsIndexes,
  expireContainerListingsIfNeeded,
} from "@/lib/container-listings";
import { getEnv } from "@/lib/env";
import { sendListingExpiryReminders } from "@/lib/listing-expiry-reminders";
import { logError } from "@/lib/server-logger";

export const runtime = "nodejs";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(5000).optional(),
});

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

    const parsedQuery = querySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );
    if (!parsedQuery.success) {
      return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
    }

    const now = new Date();
    await ensureContainerListingsIndexes();
    await expireContainerListingsIfNeeded(now);
    const result = await sendListingExpiryReminders({
      now,
      limit: parsedQuery.data.limit,
    });

    return NextResponse.json({
      ...result,
      refreshedAt: new Date().toISOString(),
    });
  } catch (error) {
    logError("Unhandled API error", {
      route: "/api/cron/listing-expiry-reminders",
      error,
    });
    return NextResponse.json(
      {
        error: "Internal server error",
        message:
          error instanceof Error
            ? error.message
            : "Unknown listing reminder cron error",
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

