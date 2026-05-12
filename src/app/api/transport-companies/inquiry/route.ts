import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserFromRequest } from "@/lib/auth-user";
import {
  ensureTransportCompaniesIndexes,
  getTransportCompaniesCollection,
} from "@/lib/transport-companies";
import { sendTransportCompanyInquiryEmail } from "@/lib/mailer";
import { enforceRateLimitOrResponse } from "@/lib/request-rate-limit";
import { logError } from "@/lib/server-logger";
import { getRequestIp, isTurnstileEnabled, verifyTurnstileToken } from "@/lib/turnstile";

export const runtime = "nodejs";

const inquirySchema = z
  .object({
    companyId: z.string().trim().regex(/^[a-f0-9]{24}$/i),
    email: z.string().trim().email().max(180).optional().or(z.literal("")),
    phone: z.string().trim().max(80).optional().or(z.literal("")),
    message: z.string().trim().min(10).max(2000),
    turnstileToken: z.string().trim().optional().default(""),
  })
  .refine(
    (value) => Boolean(value.email?.trim() || value.phone?.trim()),
    "Email or phone is required",
  );

function normalizeOptional(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await enforceRateLimitOrResponse({
      request,
      scope: "transport-companies:inquiry:ip",
      limit: 5,
      windowMs: 60_000,
      onError: "block",
    });
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const parsed = inquirySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          issues: parsed.error.issues.map((issue) => issue.message),
        },
        { status: 400 },
      );
    }

    const currentUser = await getCurrentUserFromRequest(request);
    const isGuest = !currentUser?._id;
    const turnstileEnabled = isTurnstileEnabled();
    if (isGuest && turnstileEnabled && !parsed.data.turnstileToken) {
      return NextResponse.json({ error: "TURNSTILE_REQUIRED" }, { status: 400 });
    }
    if (isGuest && turnstileEnabled) {
      const turnstileResult = await verifyTurnstileToken({
        token: parsed.data.turnstileToken,
        remoteIp: getRequestIp(request.headers),
      });
      if (!turnstileResult.ok) {
        return NextResponse.json({ error: "TURNSTILE_FAILED" }, { status: 400 });
      }
    }

    await ensureTransportCompaniesIndexes();
    const collection = await getTransportCompaniesCollection();
    const company = await collection.findOne({
      _id: new ObjectId(parsed.data.companyId),
      isActive: true,
    });
    if (!company?._id) {
      return NextResponse.json({ error: "Transport company not found" }, { status: 404 });
    }

    const requesterEmail = normalizeOptional(parsed.data.email);
    const requesterPhone = normalizeOptional(parsed.data.phone);
    const sendResult = await sendTransportCompanyInquiryEmail({
      to: company.email,
      transportCompanyName: company.name,
      transportCompanyLocation: company.location.label,
      requesterEmail,
      requesterPhone,
      message: parsed.data.message.trim(),
    });

    if (!sendResult.ok) {
      logError("Failed to send transport company inquiry email", {
        companyId: company._id.toHexString(),
        error: sendResult.error,
        status: sendResult.status,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    logError("Unhandled API error", {
      route: "/api/transport-companies/inquiry",
      error,
    });
    return NextResponse.json({ error: "Transport inquiry failed" }, { status: 500 });
  }
}
