import { del, get, put, type BlobAccessType } from "@vercel/blob";

export type BlobAccess = BlobAccessType;

function isPrivateStorePublicAccessError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const message =
    "message" in error && typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message
      : "";

  return (
    message.includes("Cannot use public access on a private store") ||
    message.includes("store is configured with private access")
  );
}

function requireBlobToken(): void {
  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not configured");
  }
}

function sanitizePathSegment(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._/-]+/g, "-")
    .replace(/\/{2,}/g, "/")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
}

function extensionFromContentType(contentType: string): string {
  const normalized = contentType.split(";")[0]?.trim().toLowerCase();
  if (normalized === "image/webp") {
    return "webp";
  }
  if (normalized === "image/png") {
    return "png";
  }
  if (normalized === "image/jpeg") {
    return "jpg";
  }
  if (normalized === "application/pdf") {
    return "pdf";
  }
  if (normalized === "application/msword") {
    return "doc";
  }
  if (
    normalized ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "docx";
  }
  return "bin";
}

export function buildBlobPath(input: {
  segments: string[];
  filenameBase: string;
  contentType: string;
}): string {
  const extension = extensionFromContentType(input.contentType);
  const safeBase = sanitizePathSegment(input.filenameBase) || "file";
  const safeSegments = input.segments
    .map((segment) => sanitizePathSegment(segment))
    .filter(Boolean);
  return [...safeSegments, `${Date.now()}-${safeBase}.${extension}`].join("/");
}

export async function uploadBlobFromBuffer(input: {
  pathname: string;
  contentType: string;
  access: BlobAccess;
  buffer: Buffer;
  cacheControlMaxAge?: number;
}): Promise<{ url: string; pathname: string }> {
  requireBlobToken();
  try {
    const result = await put(input.pathname, input.buffer, {
      access: input.access,
      contentType: input.contentType,
      addRandomSuffix: true,
      ...(typeof input.cacheControlMaxAge === "number"
        ? { cacheControlMaxAge: input.cacheControlMaxAge }
        : {}),
    });
    return { url: result.url, pathname: result.pathname };
  } catch (error) {
    if (input.access !== "public" || !isPrivateStorePublicAccessError(error)) {
      throw error;
    }

    const fallbackResult = await put(input.pathname, input.buffer, {
      access: "private",
      contentType: input.contentType,
      addRandomSuffix: true,
      ...(typeof input.cacheControlMaxAge === "number"
        ? { cacheControlMaxAge: input.cacheControlMaxAge }
        : {}),
    });
    return { url: fallbackResult.url, pathname: fallbackResult.pathname };
  }
}

export async function downloadBlobToBuffer(input: {
  urlOrPathname: string;
  access: BlobAccess;
  useCache?: boolean;
}): Promise<{ buffer: Buffer; contentType: string | null } | null> {
  requireBlobToken();
  const result = await get(input.urlOrPathname, {
    access: input.access,
    useCache: input.useCache ?? true,
  });
  if (!result || result.statusCode !== 200 || !result.stream) {
    return null;
  }

  const arrayBuffer = await new Response(result.stream).arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    contentType: result.blob.contentType,
  };
}

export async function downloadBlobToBufferWithAccessFallback(input: {
  urlOrPathname: string;
  useCache?: boolean;
}): Promise<{ buffer: Buffer; contentType: string | null } | null> {
  const accessOrder: BlobAccess[] = ["private", "public"];

  for (const access of accessOrder) {
    try {
      const downloaded = await downloadBlobToBuffer({
        urlOrPathname: input.urlOrPathname,
        access,
        useCache: input.useCache,
      });
      if (downloaded) {
        return downloaded;
      }
    } catch {
      // Try the next access mode.
    }
  }

  return null;
}

export async function deleteBlobUrls(urls: string[]): Promise<void> {
  if (urls.length === 0) {
    return;
  }

  requireBlobToken();
  const uniqueUrls = Array.from(
    new Set(
      urls
        .map((url) => url.trim())
        .filter(Boolean),
    ),
  );
  if (uniqueUrls.length === 0) {
    return;
  }

  await del(uniqueUrls);
}

export async function safeDeleteBlobUrls(urls: string[]): Promise<void> {
  if (urls.length === 0) {
    return;
  }

  try {
    await deleteBlobUrls(urls);
  } catch {
    // Best-effort cleanup. Main request flow should not fail on cleanup issues.
  }
}
