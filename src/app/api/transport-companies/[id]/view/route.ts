import { ObjectId } from "mongodb";
import { NextResponse, type NextRequest } from "next/server";
import { enforceRateLimitOrResponse } from "@/lib/request-rate-limit";
import { getCurrentUserFromRequest } from "@/lib/auth-user";
import {
  ensureTransportCompaniesIndexes,
  getTransportCompaniesCollection,
} from "@/lib/transport-companies";
import { logError } from "@/lib/server-logger";
import { USER_ROLE } from "@/lib/user-roles";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function normalizeDetailsViewCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : 0;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const rateLimitResponse = await enforceRateLimitOrResponse({
    request,
    scope: "transport-companies:details-view:ip",
    limit: 120,
    windowMs: 60_000,
  });
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    await ensureTransportCompaniesIndexes();

    const { id } = await context.params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid transport company id" }, { status: 400 });
    }

    const currentUser = await getCurrentUserFromRequest(request);
    const collection = await getTransportCompaniesCollection();
    const companyId = new ObjectId(id);

    if (currentUser?.role === USER_ROLE.ADMIN) {
      const company = await collection.findOne(
        { _id: companyId },
        { projection: { detailsViewCount: 1 } },
      );
      if (!company?._id) {
        return NextResponse.json({ error: "Transport company not found" }, { status: 404 });
      }
      return NextResponse.json({
        ok: true,
        count: normalizeDetailsViewCount(company.detailsViewCount),
        incremented: false,
      });
    }

    const result = await collection.findOneAndUpdate(
      { _id: companyId, isActive: true },
      { $inc: { detailsViewCount: 1 } },
      { returnDocument: "after", projection: { detailsViewCount: 1 } },
    );

    if (!result?._id) {
      return NextResponse.json({ error: "Transport company not found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      count: normalizeDetailsViewCount(result.detailsViewCount),
      incremented: true,
    });
  } catch (error) {
    logError("Unhandled API error", {
      route: "/api/transport-companies/[id]/view",
      error,
    });
    return NextResponse.json(
      { error: "Unknown transport company view error" },
      { status: 500 },
    );
  }
}
