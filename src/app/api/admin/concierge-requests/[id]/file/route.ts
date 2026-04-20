import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { enforceAuthenticatedRateLimitOrResponse } from "@/lib/app-rate-limit";
import { getCurrentUserFromRequest } from "@/lib/auth-user";
import { downloadBlobToBufferWithAccessFallback } from "@/lib/blob-storage";
import { getBulkConciergeRequestsCollection } from "@/lib/bulk-concierge-requests";
import { USER_ROLE } from "@/lib/user-roles";
import { logError } from "@/lib/server-logger";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

async function requireAdmin(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user || user.role !== USER_ROLE.ADMIN) {
    return null;
  }
  return user;
}

function sanitizeDownloadFilename(value: string): string {
  const normalized = value
    .trim()
    .replace(/[^\w.\-() ]+/g, "_")
    .replace(/\s+/g, " ");
  if (!normalized) {
    return "stock-upload.bin";
  }
  return normalized.slice(0, 180);
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const admin = await requireAdmin(request);
    if (!admin?._id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const rateLimitResponse = await enforceAuthenticatedRateLimitOrResponse({
      request,
      scope: "admin:concierge-requests:file",
      userId: admin._id.toHexString(),
      ipLimit: 60,
      userLimit: 30,
    });
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const { id } = await context.params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid request id" }, { status: 400 });
    }

    const requests = await getBulkConciergeRequestsCollection();
    const row = await requests.findOne(
      { _id: new ObjectId(id) },
      {
        projection: {
          stockFile: 1,
        },
      },
    );

    if (!row?.stockFile?.blobUrl) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const downloaded = await downloadBlobToBufferWithAccessFallback({
      urlOrPathname: row.stockFile.blobUrl,
      useCache: false,
    });
    if (!downloaded) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const filename = sanitizeDownloadFilename(row.stockFile.filename);
    const contentType =
      row.stockFile.contentType || downloaded.contentType || "application/octet-stream";

    return new NextResponse(new Uint8Array(downloaded.buffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(downloaded.buffer.byteLength),
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    logError("Unhandled API error", {
      route: "/api/admin/concierge-requests/[id]/file",
      error,
    });
    return NextResponse.json(
      {
        error: "Internal server error",
        message:
          error instanceof Error
            ? error.message
            : "Unknown admin concierge file error",
      },
      { status: 500 },
    );
  }
}
