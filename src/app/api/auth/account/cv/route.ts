import { Buffer } from "node:buffer";
import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth-session";
import { getCurrentUserFromRequest } from "@/lib/auth-user";
import {
  buildBlobPath,
  downloadBlobToBuffer,
  safeDeleteBlobUrls,
  uploadBlobFromBuffer,
} from "@/lib/blob-storage";
import { ensureUserCvIndexes, getUserCvCollection } from "@/lib/user-cv";
import { logError } from "@/lib/server-logger";

export const runtime = "nodejs";

const MAX_CV_BYTES = 8 * 1024 * 1024;
const ALLOWED_CV_EXTENSIONS = new Set(["pdf", "doc", "docx"]);
const ALLOWED_CV_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function getCvExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot < 0) {
    return "";
  }
  return filename.slice(lastDot + 1).toLowerCase();
}

function validateCvFile(file: File): { ok: true } | { ok: false; error: string } {
  const filename = file.name?.trim();
  if (!filename || file.size <= 0) {
    return { ok: false, error: "CV file is required" };
  }

  if (file.size > MAX_CV_BYTES) {
    return { ok: false, error: "CV file is too large" };
  }

  const extension = getCvExtension(filename);
  if (!ALLOWED_CV_EXTENSIONS.has(extension)) {
    return { ok: false, error: "Unsupported CV file type" };
  }

  const normalizedType = (file.type || "").toLowerCase();
  if (normalizedType && !ALLOWED_CV_MIME_TYPES.has(normalizedType)) {
    return { ok: false, error: "Unsupported CV file type" };
  }

  return { ok: true };
}

function toAttachmentHeader(filename: string): string {
  const safeFilename = filename.replace(/[\r\n"]/g, "_");
  const utf8Name = encodeURIComponent(filename);
  return `attachment; filename="${safeFilename}"; filename*=UTF-8''${utf8Name}`;
}

function cvDataToBuffer(data: unknown): Buffer | null {
  if (Buffer.isBuffer(data)) {
    return data;
  }

  if (data instanceof Uint8Array) {
    return Buffer.from(data);
  }

  if (typeof data === "object" && data !== null && "buffer" in data) {
    const nested = (data as { buffer?: unknown }).buffer;
    if (Buffer.isBuffer(nested)) {
      return nested;
    }
    if (nested instanceof Uint8Array) {
      return Buffer.from(nested);
    }
  }

  return null;
}

async function requireCurrentUser(
  request: NextRequest,
): Promise<{ userId: ObjectId } | { response: NextResponse }> {
  const user = await getCurrentUserFromRequest(request);
  if (!user?._id) {
    const unauthorizedResponse = NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
    clearSessionCookie(unauthorizedResponse);
    return { response: unauthorizedResponse };
  }

  return { userId: user._id };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireCurrentUser(request);
    if ("response" in auth) {
      return auth.response;
    }

    const cvFiles = await getUserCvCollection();
    const cv = await cvFiles.findOne(
      { userId: auth.userId },
      {
        projection: {
          filename: 1,
          contentType: 1,
          size: 1,
          data: 1,
          blobUrl: 1,
        },
      },
    );
    if (!cv) {
      return NextResponse.json({ error: "CV not found" }, { status: 404 });
    }

    if (cv.blobUrl) {
      const downloaded = await downloadBlobToBuffer({
        urlOrPathname: cv.blobUrl,
        access: "private",
        useCache: false,
      });
      if (!downloaded) {
        return NextResponse.json({ error: "CV not found" }, { status: 404 });
      }

      const contentType =
        cv.contentType ||
        downloaded.contentType ||
        "application/octet-stream";
      return new NextResponse(new Uint8Array(downloaded.buffer), {
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(cv.size || downloaded.buffer.byteLength),
          "Content-Disposition": toAttachmentHeader(cv.filename),
          "Cache-Control": "private, no-store",
        },
      });
    }

    const legacyBuffer = cvDataToBuffer(cv.data);
    if (!legacyBuffer) {
      return NextResponse.json({ error: "CV not found" }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(legacyBuffer), {
      headers: {
        "Content-Type": cv.contentType || "application/octet-stream",
        "Content-Length": String(cv.size || legacyBuffer.byteLength),
        "Content-Disposition": toAttachmentHeader(cv.filename),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    logError("Unhandled API error", { route: "/api/auth/account/cv", error });
    return NextResponse.json(
      {
        error: "Internal server error",
        message:
          error instanceof Error ? error.message : "Unknown get account CV error",
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireCurrentUser(request);
    if ("response" in auth) {
      return auth.response;
    }

    const formData = await request.formData();
    const cvRaw = formData.get("cv");
    if (!(cvRaw instanceof File)) {
      return NextResponse.json({ error: "CV file is required" }, { status: 400 });
    }
    const validation = validateCvFile(cvRaw);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    await ensureUserCvIndexes();
    const now = new Date();
    const cvBuffer = Buffer.from(await cvRaw.arrayBuffer());
    const cvFiles = await getUserCvCollection();
    const previousCv = await cvFiles.findOne(
      { userId: auth.userId },
      { projection: { blobUrl: 1 } },
    );

    const contentType = cvRaw.type || "application/octet-stream";
    const uploaded = await uploadBlobFromBuffer({
      pathname: buildBlobPath({
        segments: ["user-cv", auth.userId.toHexString()],
        filenameBase: cvRaw.name.trim(),
        contentType,
      }),
      contentType,
      access: "private",
      cacheControlMaxAge: 60 * 60 * 24 * 7,
      buffer: cvBuffer,
    });

    try {
      await cvFiles.updateOne(
        { userId: auth.userId },
        {
          $set: {
            filename: cvRaw.name.trim(),
            contentType,
            size: cvRaw.size,
            blobUrl: uploaded.url,
            updatedAt: now,
          },
          $unset: {
            data: "",
          },
          $setOnInsert: {
            userId: auth.userId,
            createdAt: now,
          },
        },
        { upsert: true },
      );
    } catch (dbError) {
      await safeDeleteBlobUrls([uploaded.url]);
      throw dbError;
    }

    if (previousCv?.blobUrl && previousCv.blobUrl !== uploaded.url) {
      await safeDeleteBlobUrls([previousCv.blobUrl]);
    }

    return NextResponse.json({
      ok: true,
      cv: {
        filename: cvRaw.name.trim(),
        size: cvRaw.size,
        updatedAt: now.toISOString(),
      },
    });
  } catch (error) {
    logError("Unhandled API error", { route: "/api/auth/account/cv", error });
    return NextResponse.json(
      {
        error: "Internal server error",
        message:
          error instanceof Error ? error.message : "Unknown upload account CV error",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireCurrentUser(request);
    if ("response" in auth) {
      return auth.response;
    }

    const cvFiles = await getUserCvCollection();
    const currentCv = await cvFiles.findOne(
      { userId: auth.userId },
      { projection: { blobUrl: 1 } },
    );
    const result = await cvFiles.deleteOne({ userId: auth.userId });

    if (currentCv?.blobUrl) {
      await safeDeleteBlobUrls([currentCv.blobUrl]);
    }

    return NextResponse.json({ ok: true, deleted: result.deletedCount > 0 });
  } catch (error) {
    logError("Unhandled API error", { route: "/api/auth/account/cv", error });
    return NextResponse.json(
      {
        error: "Internal server error",
        message:
          error instanceof Error ? error.message : "Unknown delete account CV error",
      },
      { status: 500 },
    );
  }
}
