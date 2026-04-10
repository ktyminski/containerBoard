import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { logError } from "@/lib/server-logger";

export const runtime = "nodejs";

export async function GET() {
  try {
    const db = await getDb();
    await db.command({ ping: 1 });

    return NextResponse.json(
      {
        status: "ok",
        timestamp: new Date().toISOString(),
        database: "up",
      },
      { status: 200 },
    );
  } catch (error) {
    logError("Unhandled API error", { route: "/api/health", error });
    return NextResponse.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        database: "down",
        message:
          error instanceof Error ? error.message : "Unknown healthcheck error",
      },
      { status: 500 },
    );
  }
}
