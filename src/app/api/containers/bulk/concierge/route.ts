import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/auth-user";
import {
  ensureBulkConciergeRequestIndexes,
  getBulkConciergeRequestsCollection,
  type BulkConciergeRequestDocument,
} from "@/lib/bulk-concierge-requests";
import { buildBlobPath, uploadBlobFromBuffer } from "@/lib/blob-storage";
import { getCompaniesCollection } from "@/lib/companies";
import { getEnv } from "@/lib/env";
import { sendConciergeStockUploadNotificationEmail } from "@/lib/mailer";
import { enforceRateLimitOrResponse } from "@/lib/request-rate-limit";
import { logError } from "@/lib/server-logger";

export const runtime = "nodejs";

const MAX_CONCIERGE_FILE_BYTES = 25 * 1024 * 1024;
const MAX_NOTE_LENGTH = 2_000;

function normalizeOptionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

async function parseConciergeRequestBody(request: NextRequest): Promise<{
  stockFile: File;
  note?: string;
}> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    throw new Error("Wysylka concierge obsluguje multipart/form-data");
  }

  const formData = await request.formData();
  const stockFile = formData.get("stockFile");
  if (!(stockFile instanceof File)) {
    throw new Error("Brak pliku stock do wyslania");
  }
  if (stockFile.size <= 0) {
    throw new Error("Plik stock jest pusty");
  }
  if (stockFile.size > MAX_CONCIERGE_FILE_BYTES) {
    throw new Error("Plik stock przekracza limit 25 MB");
  }

  const rawNote = formData.get("note");
  const note =
    typeof rawNote === "string" ? normalizeOptionalString(rawNote) : undefined;
  if (note && note.length > MAX_NOTE_LENGTH) {
    throw new Error(`Notatka moze miec maksymalnie ${MAX_NOTE_LENGTH} znakow`);
  }

  return { stockFile, note };
}

export async function POST(request: NextRequest) {
  try {
    await ensureBulkConciergeRequestIndexes();

    const ipRateLimitResponse = await enforceRateLimitOrResponse({
      request,
      scope: "containers:bulk-concierge:ip",
      limit: 30,
      windowMs: 60_000,
    });
    if (ipRateLimitResponse) {
      return ipRateLimitResponse;
    }

    const user = await getCurrentUserFromRequest(request);
    if (!user?._id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.isBlocked === true) {
      return NextResponse.json({ error: "Blocked user" }, { status: 403 });
    }

    const userRateLimitResponse = await enforceRateLimitOrResponse({
      request,
      scope: "containers:bulk-concierge:user",
      limit: 8,
      windowMs: 60_000,
      identity: user._id.toHexString(),
    });
    if (userRateLimitResponse) {
      return userRateLimitResponse;
    }

    let body: { stockFile: File; note?: string };
    try {
      body = await parseConciergeRequestBody(request);
    } catch (parseError) {
      return NextResponse.json(
        {
          error:
            parseError instanceof Error
              ? parseError.message
              : "Nie udalo sie odczytac pliku stock",
        },
        { status: 400 },
      );
    }

    const companies = await getCompaniesCollection();
    const ownerCompany = await companies.findOne(
      {
        createdByUserId: user._id,
        isBlocked: { $ne: true },
      },
      {
        projection: { _id: 1, name: 1, slug: 1, email: 1, phone: 1 },
        sort: { updatedAt: -1 },
      },
    );
    if (!ownerCompany?._id || !ownerCompany.name?.trim()) {
      return NextResponse.json(
        {
          error:
            "Konto musi miec uzupelniony profil firmy, aby wyslac stock do concierge",
        },
        { status: 403 },
      );
    }

    const conciergeNotificationEmail = normalizeOptionalString(
      getEnv().CONCIERGE_NOTIFICATION_EMAIL,
    );
    if (!conciergeNotificationEmail) {
      return NextResponse.json(
        { error: "CONCIERGE_NOTIFICATION_EMAIL nie jest skonfigurowany" },
        { status: 500 },
      );
    }

    const listingId = new ObjectId();
    const uploadedAt = new Date();
    const stockFileName =
      normalizeOptionalString(body.stockFile.name) ?? "stock-upload.bin";
    const stockFileContentType =
      normalizeOptionalString(body.stockFile.type) ?? "application/octet-stream";
    const stockBuffer = Buffer.from(await body.stockFile.arrayBuffer());
    const uploaded = await uploadBlobFromBuffer({
      pathname: buildBlobPath({
        segments: [
          "concierge",
          "bulk-stock",
          ownerCompany._id.toHexString(),
          listingId.toHexString(),
        ],
        filenameBase: stockFileName,
        contentType: stockFileContentType,
      }),
      contentType: stockFileContentType,
      access: "private",
      buffer: stockBuffer,
    });

    const nextDocument: BulkConciergeRequestDocument = {
      _id: listingId,
      userId: user._id,
      userName: user.name?.trim() || user.email,
      userEmail: user.email,
      companyId: ownerCompany._id,
      companyName: ownerCompany.name.trim(),
      ...(normalizeOptionalString(ownerCompany.slug)
        ? { companySlug: normalizeOptionalString(ownerCompany.slug) }
        : {}),
      ...(normalizeOptionalString(ownerCompany.email)
        ? { contactEmail: normalizeOptionalString(ownerCompany.email) }
        : {}),
      ...(normalizeOptionalString(ownerCompany.phone)
        ? { contactPhone: normalizeOptionalString(ownerCompany.phone) }
        : {}),
      ...(body.note ? { note: body.note } : {}),
      stockFile: {
        filename: stockFileName,
        contentType: stockFileContentType,
        size: body.stockFile.size,
        blobUrl: uploaded.url,
      },
      notificationEmail: conciergeNotificationEmail,
      status: "new",
      createdAt: uploadedAt,
      updatedAt: uploadedAt,
    };

    const requests = await getBulkConciergeRequestsCollection();
    await requests.insertOne(nextDocument);

    const mailResult = await sendConciergeStockUploadNotificationEmail({
      to: conciergeNotificationEmail,
      companyName: nextDocument.companyName,
      companySlug: nextDocument.companySlug,
      userName: nextDocument.userName,
      userEmail: nextDocument.userEmail,
      contactEmail: nextDocument.contactEmail,
      contactPhone: nextDocument.contactPhone,
      fileName: nextDocument.stockFile.filename,
      fileSizeBytes: nextDocument.stockFile.size,
      fileContentType: nextDocument.stockFile.contentType,
      fileUrl: nextDocument.stockFile.blobUrl,
      note: nextDocument.note,
      requestedAtIso: nextDocument.createdAt.toISOString(),
    });

    if (mailResult.ok) {
      await requests.updateOne(
        { _id: listingId },
        {
          $set: {
            notificationSentAt: new Date(),
            updatedAt: new Date(),
          },
          $unset: {
            notificationError: "",
          },
        },
      );
    } else {
      const notificationError = normalizeOptionalString(mailResult.error) ?? "Unknown mail error";
      await requests.updateOne(
        { _id: listingId },
        {
          $set: {
            notificationError,
            updatedAt: new Date(),
          },
        },
      );
      logError("Failed to send concierge notification email", {
        route: "/api/containers/bulk/concierge",
        requestId: listingId.toHexString(),
        error: mailResult.error,
        status: mailResult.status,
      });
    }

    return NextResponse.json(
      {
        id: listingId.toHexString(),
        filename: nextDocument.stockFile.filename,
        createdAt: nextDocument.createdAt.toISOString(),
        notificationSent: mailResult.ok,
        ...(mailResult.ok
          ? {}
          : {
              warning:
                "Zgloszenie zapisane, ale nie udalo sie wyslac powiadomienia email",
            }),
      },
      { status: 201 },
    );
  } catch (error) {
    logError("Unhandled API error", {
      route: "/api/containers/bulk/concierge",
      error,
    });
    return NextResponse.json(
      {
        error: "Internal server error",
        message:
          error instanceof Error ? error.message : "Unknown concierge bulk upload error",
      },
      { status: 500 },
    );
  }
}

