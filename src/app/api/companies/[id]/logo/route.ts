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
    const variant = request.nextUrl.searchParams.get("variant");

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid company id" }, { status: 400 });
    }

    const companies = await getCompaniesCollection();

    const company = await companies.findOne(
      { _id: new ObjectId(id) },
      { projection: { logo: 1, logoThumb: 1 } },
    );

    const selectedLogo =
      variant === "thumb"
        ? (company?.logoThumb?.blobUrl || company?.logoThumb?.data
            ? company.logoThumb
            : company?.logo)
        : company?.logo;

    if (selectedLogo?.blobUrl) {
      const downloaded = await downloadBlobToBufferWithAccessFallback({
        urlOrPathname: selectedLogo.blobUrl,
      });
      if (downloaded) {
        const contentType =
          selectedLogo.contentType || downloaded.contentType || "application/octet-stream";
        return new NextResponse(new Uint8Array(downloaded.buffer), {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Content-Length": String(downloaded.buffer.byteLength),
            "Cache-Control": getMediaCacheControl(request.nextUrl.searchParams.has("v")),
          },
        });
      }

      const redirect = NextResponse.redirect(selectedLogo.blobUrl, 307);
      redirect.headers.set(
        "Cache-Control",
        getMediaCacheControl(request.nextUrl.searchParams.has("v")),
      );
      return redirect;
    }

    if (!selectedLogo?.data) {
      return NextResponse.json({ error: "Logo not found" }, { status: 404 });
    }

    const bytes = toBytes(selectedLogo.data);
    if (!bytes || bytes.byteLength === 0) {
      return NextResponse.json({ error: "Logo not found" }, { status: 404 });
    }

    const contentType = selectedLogo.contentType || "application/octet-stream";
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
    logError("Unhandled API error", { route: "/api/companies/[id]/logo", error });
    return NextResponse.json(
      {
        error: "Internal server error",
        message:
          error instanceof Error ? error.message : "Unknown company logo error",
      },
      { status: 500 },
    );
  }
}

