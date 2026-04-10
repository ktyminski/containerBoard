import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { downloadBlobToBufferWithAccessFallback } from "@/lib/blob-storage";
import { getMediaCacheControl } from "@/lib/company-media";
import { getCompaniesCollection } from "@/lib/companies";
import { logError } from "@/lib/server-logger";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function toBytes(value: unknown): Uint8Array | null {
  if (Buffer.isBuffer(value)) {
    return new Uint8Array(value);
  }
  if (value instanceof Uint8Array) {
    return value;
  }
  if (typeof value === "object" && value !== null && "buffer" in value) {
    const nested = (value as { buffer?: unknown }).buffer;
    if (Buffer.isBuffer(nested)) {
      return new Uint8Array(nested);
    }
    if (nested instanceof Uint8Array) {
      return nested;
    }
  }
  return null;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid company id" }, { status: 400 });
    }

    const companies = await getCompaniesCollection();

    const company = await companies.findOne(
      { _id: new ObjectId(id) },
      { projection: { background: 1 } },
    );

    if (company?.background?.blobUrl) {
      const downloaded = await downloadBlobToBufferWithAccessFallback({
        urlOrPathname: company.background.blobUrl,
      });
      if (downloaded) {
        const contentType =
          company.background.contentType || downloaded.contentType || "application/octet-stream";
        return new NextResponse(new Uint8Array(downloaded.buffer), {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Content-Length": String(downloaded.buffer.byteLength),
            "Cache-Control": getMediaCacheControl(request.nextUrl.searchParams.has("v")),
          },
        });
      }

      const redirect = NextResponse.redirect(company.background.blobUrl, 307);
      redirect.headers.set(
        "Cache-Control",
        getMediaCacheControl(request.nextUrl.searchParams.has("v")),
      );
      return redirect;
    }

    if (!company?.background?.data) {
      return NextResponse.json({ error: "Background not found" }, { status: 404 });
    }

    const bytes = toBytes(company.background.data);
    if (!bytes || bytes.byteLength === 0) {
      return NextResponse.json({ error: "Background not found" }, { status: 404 });
    }

    const contentType = company.background.contentType || "application/octet-stream";
    const safeBytes = new Uint8Array(bytes.byteLength);
    safeBytes.set(bytes);
    const blob = new Blob([safeBytes.buffer], { type: contentType });

    return new NextResponse(blob, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(safeBytes.byteLength),
        "Cache-Control": getMediaCacheControl(request.nextUrl.searchParams.has("v")),
      },
    });
  } catch (error) {
    logError("Unhandled API error", { route: "/api/companies/[id]/background", error });
    return NextResponse.json(
      {
        error: "Internal server error",
        message:
          error instanceof Error ? error.message : "Unknown company background error",
      },
      { status: 500 },
    );
  }
}
