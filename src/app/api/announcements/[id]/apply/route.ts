import { Buffer } from "node:buffer";
import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAnnouncementsCollection } from "@/lib/announcements";
import { getCurrentUserFromRequest } from "@/lib/auth-user";
import { downloadBlobToBuffer } from "@/lib/blob-storage";
import { getCompaniesCollection } from "@/lib/companies";
import { JOB_WORK_LOCATION_MODE } from "@/lib/job-announcement";
import { sendAnnouncementApplicationEmail } from "@/lib/mailer";
import { getUserCvCollection } from "@/lib/user-cv";
import { logError } from "@/lib/server-logger";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const applySchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(220),
  phone: z.string().trim().max(60).optional().default(""),
  message: z.string().optional().transform((value) => value?.trim() ?? ""),
});

const MAX_CV_BYTES = 8 * 1024 * 1024;
const ALLOWED_CV_EXTENSIONS = new Set(["pdf", "doc", "docx"]);
const ALLOWED_CV_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function resolveBranchIndex(input: {
  branchIndex?: number;
  locationLabel: string;
  companyLocations: Array<{ label: string; addressText: string }>;
}): number | null {
  if (
    typeof input.branchIndex === "number" &&
    Number.isInteger(input.branchIndex) &&
    input.branchIndex >= 0 &&
    input.branchIndex < input.companyLocations.length
  ) {
    return input.branchIndex;
  }

  const inferredIndex = input.companyLocations.findIndex(
    (location) => `${location.label} - ${location.addressText}` === input.locationLabel,
  );

  return inferredIndex >= 0 ? inferredIndex : null;
}

function normalizeRecipientEmail(email: string): string | null {
  const parsed = z.string().trim().email().safeParse(email.trim());
  return parsed.success ? parsed.data : null;
}

function dedupeEmails(emails: string[]): string[] {
  const unique = new Map<string, string>();
  for (const email of emails) {
    const normalizedEmail = normalizeRecipientEmail(email);
    if (!normalizedEmail) {
      continue;
    }

    const normalized = normalizedEmail.toLowerCase();
    if (!unique.has(normalized)) {
      unique.set(normalized, normalizedEmail);
    }
  }
  return Array.from(unique.values());
}

function getCvExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot < 0) {
    return "";
  }
  return filename.slice(lastDot + 1).toLowerCase();
}

function validateCvFile(cvFile: File): { ok: true } | { ok: false; error: string } {
  const filename = cvFile.name?.trim();
  if (!filename) {
    return { ok: false, error: "CV file is required" };
  }

  if (cvFile.size <= 0) {
    return { ok: false, error: "CV file is required" };
  }

  if (cvFile.size > MAX_CV_BYTES) {
    return { ok: false, error: "CV file is too large" };
  }

  const extension = getCvExtension(filename);
  if (!ALLOWED_CV_EXTENSIONS.has(extension)) {
    return { ok: false, error: "Unsupported CV file type" };
  }

  const normalizedType = (cvFile.type || "").toLowerCase();
  if (normalizedType && !ALLOWED_CV_MIME_TYPES.has(normalizedType)) {
    return { ok: false, error: "Unsupported CV file type" };
  }

  return { ok: true };
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid announcement id" }, { status: 400 });
    }

    const formData = await request.formData();
    const parsed = applySchema.safeParse({
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      message: String(formData.get("message") ?? ""),
    });
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          issues: parsed.error.issues.map((issue) => issue.message),
        },
        { status: 400 },
      );
    }

    const cvRaw = formData.get("cv");
    const useStoredCv = String(formData.get("useStoredCv") ?? "") === "1";
    let cvFilename = "";
    let cvContentType: string | undefined;
    let cvBuffer: Buffer | null = null;

    if (cvRaw instanceof File) {
      const cvValidation = validateCvFile(cvRaw);
      if (!cvValidation.ok) {
        return NextResponse.json({ error: cvValidation.error }, { status: 400 });
      }
      cvFilename = cvRaw.name;
      cvContentType = cvRaw.type || undefined;
      cvBuffer = Buffer.from(await cvRaw.arrayBuffer());
    } else if (useStoredCv) {
      const currentUser = await getCurrentUserFromRequest(request);
      if (!currentUser?._id) {
        return NextResponse.json({ error: "Stored CV requires authentication" }, { status: 401 });
      }
      const userCv = await (await getUserCvCollection()).findOne(
        { userId: currentUser._id },
        {
          projection: {
            filename: 1,
            contentType: 1,
            blobUrl: 1,
            data: 1,
          },
        },
      );
      if (!userCv?.filename) {
        return NextResponse.json({ error: "Stored CV not found" }, { status: 400 });
      }
      if (userCv.blobUrl) {
        const downloadedCv = await downloadBlobToBuffer({
          urlOrPathname: userCv.blobUrl,
          access: "private",
          useCache: false,
        });
        if (!downloadedCv) {
          return NextResponse.json({ error: "Stored CV not found" }, { status: 400 });
        }
        cvFilename = userCv.filename;
        cvContentType = userCv.contentType || downloadedCv.contentType || undefined;
        cvBuffer = downloadedCv.buffer;
      } else if (userCv.data?.buffer) {
        cvFilename = userCv.filename;
        cvContentType = userCv.contentType || undefined;
        cvBuffer = Buffer.from(userCv.data.buffer);
      } else {
        return NextResponse.json({ error: "Stored CV not found" }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: "CV file is required" }, { status: 400 });
    }

    const announcementId = new ObjectId(id);
    const announcements = await getAnnouncementsCollection();
    const announcement = await announcements.findOne(
      { _id: announcementId, isPublished: true },
      {
        projection: {
          _id: 1,
          companyId: 1,
          companyName: 1,
          title: 1,
          location: 1,
          branchIndex: 1,
          contactPersons: 1,
          applicationEmail: 1,
        },
      },
    );

    if (!announcement) {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
    }

    const companies = await getCompaniesCollection();
    const company = await companies.findOne(
      { _id: announcement.companyId },
      {
        projection: {
          _id: 1,
          email: 1,
          "locations.label": 1,
          "locations.addressText": 1,
          "locations.email": 1,
        },
      },
    );

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const customApplicationEmail = normalizeRecipientEmail(
      announcement.applicationEmail?.trim() || "",
    );
    const companyEmail = normalizeRecipientEmail(company.email?.trim() || "");
    let primaryRecipient = customApplicationEmail ?? companyEmail ?? "";
    if (!customApplicationEmail && announcement.location.mode === JOB_WORK_LOCATION_MODE.BRANCH) {
      const branchIndex = resolveBranchIndex({
        branchIndex: announcement.branchIndex,
        locationLabel: announcement.location.label,
        companyLocations: (company.locations ?? []).map((location) => ({
          label: location.label,
          addressText: location.addressText,
        })),
      });

      if (branchIndex !== null) {
        const branchEmail = normalizeRecipientEmail(
          company.locations?.[branchIndex]?.email?.trim() || "",
        );
        primaryRecipient = branchEmail ?? companyEmail ?? "";
      }
    }

    const recipients = dedupeEmails([
      primaryRecipient,
      ...(announcement.contactPersons ?? []).map((person) => person.email?.trim() || ""),
    ]);

    if (recipients.length === 0) {
      return NextResponse.json(
        { error: "No recipients configured for this announcement" },
        { status: 409 },
      );
    }

    if (!cvBuffer) {
      return NextResponse.json({ error: "CV file is required" }, { status: 400 });
    }
    const mailResult = await sendAnnouncementApplicationEmail({
      to: recipients,
      announcementTitle: announcement.title,
      companyName: announcement.companyName,
      locationLabel: announcement.location.label,
      applicantName: parsed.data.name,
      applicantEmail: parsed.data.email,
      applicantPhone: parsed.data.phone || undefined,
      applicantMessage: parsed.data.message,
      cvFilename,
      cvAttachment: {
        filename: cvFilename,
        content: cvBuffer.toString("base64"),
        contentType: cvContentType,
      },
    });

    if (!mailResult.ok) {
      logError("Announcement application failed");
      return NextResponse.json({ error: "Something went wrong" }, { status: 502 });
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    logError("Unhandled API error", { route: "/api/announcements/[id]/apply", error });
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
