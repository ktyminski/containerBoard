import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    { error: "Company ownership claims are disabled" },
    { status: 410 },
  );
}
