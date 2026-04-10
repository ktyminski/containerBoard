import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserFromRequest } from "@/lib/auth-user";
import { getCompaniesCollection } from "@/lib/companies";
import { getLocaleFromApiRequest } from "@/lib/i18n";
import {
  getLeadRequestsPageData,
  type LeadRequestsBoardTab,
  type LeadRequestsSortOrder,
} from "@/lib/lead-requests-board-data";
import {
  addDays,
  ensureLeadRequestsIndexes,
  getLeadRequestsCollection,
} from "@/lib/lead-requests";
import {
  LEAD_REQUEST_STATUS,
  LEAD_REQUEST_TRANSPORT_MODES,
  LEAD_REQUEST_VALIDITY_DAYS,
  type LeadRequestTransportMode,
  type LeadRequestType,
} from "@/lib/lead-request-types";
import { getLeadRequestCreationLimitState } from "@/lib/lead-request-creation-limit";
import {
  leadRequestInputSchema,
  normalizeLeadRequestDescription,
  normalizeLeadRequestLocation,
  resolveLeadRequestTransportLocation,
} from "@/lib/lead-request-input";
import { COMPANY_VERIFICATION_STATUS } from "@/lib/company-verification";
import { sendLeadRequestPublishedEmail } from "@/lib/mailer";
import {
  getRequestIp,
  isTurnstileEnabled,
  verifyTurnstileToken,
} from "@/lib/turnstile";
import { enforceRateLimitOrResponse } from "@/lib/request-rate-limit";
import { USER_ROLE } from "@/lib/user-roles";
import { logError } from "@/lib/server-logger";

export const runtime = "nodejs";

const createLeadRequestSchema = leadRequestInputSchema.extend({
  turnstileToken: z.string().trim().optional().default(""),
});

function getLeadTypeLabel(leadType: LeadRequestType): string {
  if (leadType === "transport") {
    return "Transport";
  }
  return "Inne";
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    const hasVerifiedOwnedCompany = user?._id
      ? await getCompaniesCollection()
          .then((companies) =>
            companies.findOne(
              {
                createdByUserId: user._id,
                verificationStatus: COMPANY_VERIFICATION_STATUS.VERIFIED,
              },
              { projection: { _id: 1 } },
            ),
          )
          .then((row) => Boolean(row))
      : false;
    const canSeeContact =
      Boolean(user?._id) &&
      (user?.role === USER_ROLE.ADMIN || hasVerifiedOwnedCompany);
    const tab = request.nextUrl.searchParams.get("tab") === "mine" ? "mine" : "all";
    if (tab === "mine" && !user?._id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawPage = Number(request.nextUrl.searchParams.get("page") ?? "1");
    const page = Number.isFinite(rawPage) ? Math.max(1, Math.floor(rawPage)) : 1;
    const pageSize = 20;
    const sortOrder = request.nextUrl.searchParams.get("sort") === "oldest"
      ? "oldest"
      : "newest";
    const transportModes = request.nextUrl.searchParams
      .getAll("transportMode")
      .filter((value): value is typeof LEAD_REQUEST_TRANSPORT_MODES[number] =>
        LEAD_REQUEST_TRANSPORT_MODES.includes(value as typeof LEAD_REQUEST_TRANSPORT_MODES[number]),
      );
    const originCountries = request.nextUrl.searchParams
      .getAll("originCountry")
      .map((value) => value.trim().toUpperCase())
      .filter((value) => /^[A-Z]{2}$/.test(value));
    const destinationCountries = request.nextUrl.searchParams
      .getAll("destinationCountry")
      .map((value) => value.trim().toUpperCase())
      .filter((value) => /^[A-Z]{2}$/.test(value));
    const keyword = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    const now = new Date();

    const pageData = await getLeadRequestsPageData({
      scope: tab as LeadRequestsBoardTab,
      userId: user?._id,
      canSeeContact: tab === "mine" ? true : canSeeContact,
      page,
      pageSize,
      sortOrder: sortOrder as LeadRequestsSortOrder,
      filters: {
        keyword,
        transportModes,
        originCountries,
        destinationCountries,
      },
      now,
    });

    return NextResponse.json(pageData);
  } catch (error) {
    logError("Unhandled API error", { route: "/api/lead-requests", error });
    return NextResponse.json(
      {
        error: "Internal server error",
        message:
          error instanceof Error
            ? error.message
            : "Unknown list quote requests error",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const ipRateLimitResponse = await enforceRateLimitOrResponse({
      request,
      scope: "lead-requests:create:ip",
      limit: 60,
      windowMs: 60_000,
    });
    if (ipRateLimitResponse) {
      return ipRateLimitResponse;
    }

    const user = await getCurrentUserFromRequest(request);
    if (!user || !user._id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRateLimitResponse = await enforceRateLimitOrResponse({
      request,
      scope: "lead-requests:create:user",
      limit: 36,
      windowMs: 60_000,
      identity: user._id.toHexString(),
    });
    if (userRateLimitResponse) {
      return userRateLimitResponse;
    }

    if (user.isBlocked === true) {
      return NextResponse.json(
        { error: "Blocked user cannot add quote requests" },
        { status: 403 },
      );
    }
    if (user.authProvider === "local" && user.isEmailVerified === false) {
      return NextResponse.json(
        { error: "Email verification required" },
        { status: 403 },
      );
    }

    const locale = getLocaleFromApiRequest(request);
    const parsed = createLeadRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          issues: parsed.error.issues.map((issue) => issue.message),
        },
        { status: 400 },
      );
    }

    const description = normalizeLeadRequestDescription(parsed.data.description);
    if (description.length < 20) {
      return NextResponse.json(
        { error: "description is too short after sanitization" },
        { status: 400 },
      );
    }

    const contactEmail = parsed.data.contactEmail.trim().toLowerCase();
    const contactPhone = parsed.data.contactPhone.trim();
    const originLocation = normalizeLeadRequestLocation(parsed.data.originLocation);
    const destinationLocation = normalizeLeadRequestLocation(parsed.data.destinationLocation);
    if (!contactEmail && !contactPhone) {
      return NextResponse.json(
        { error: "At least one contact field is required" },
        { status: 400 },
      );
    }
    if (
      parsed.data.leadType === "transport" &&
      (originLocation.length < 2 || destinationLocation.length < 2)
    ) {
      return NextResponse.json(
        { error: "Origin and destination are required" },
        { status: 400 },
      );
    }

    const resolvedOrigin = parsed.data.leadType === "transport"
      ? await resolveLeadRequestTransportLocation({
          location: originLocation,
          locale,
        })
      : null;
    if (parsed.data.leadType === "transport" && !resolvedOrigin) {
      return NextResponse.json({ error: "ORIGIN_GEOCODE_FAILED" }, { status: 400 });
    }

    const resolvedDestination = parsed.data.leadType === "transport"
      ? await resolveLeadRequestTransportLocation({
          location: destinationLocation,
          locale,
        })
      : null;
    if (parsed.data.leadType === "transport" && !resolvedDestination) {
      return NextResponse.json({ error: "DESTINATION_GEOCODE_FAILED" }, { status: 400 });
    }

    const now = new Date();
    await ensureLeadRequestsIndexes();
    const leadRequests = await getLeadRequestsCollection();
    const limitState = await getLeadRequestCreationLimitState({
      leadRequests,
      userId: user._id,
      now,
    });
    if (limitState.isLimited) {
      const retryAfterSeconds = Math.max(1, Math.ceil(limitState.retryAfterMs / 1000));
      return NextResponse.json(
        {
          error: "Quote request creation limit reached",
          limit: limitState.limit,
          windowHours: limitState.windowHours,
          createdInWindow: limitState.createdInWindow,
          nextAllowedAt: limitState.nextAllowedAt?.toISOString() ?? null,
          retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfterSeconds),
          },
        },
      );
    }
    if (isTurnstileEnabled() && !parsed.data.turnstileToken) {
      return NextResponse.json({ error: "TURNSTILE_REQUIRED" }, { status: 400 });
    }
    const turnstileResult = await verifyTurnstileToken({
      token: parsed.data.turnstileToken,
      remoteIp: getRequestIp(request.headers),
    });
    if (!turnstileResult.ok) {
      return NextResponse.json({ error: "TURNSTILE_FAILED" }, { status: 400 });
    }

    const insertResult = await leadRequests.insertOne({
      _id: new ObjectId(),
      leadType: parsed.data.leadType as LeadRequestType,
      description,
      ...(parsed.data.leadType === "transport"
        ? {
            originLocation: resolvedOrigin?.locationLabel ?? originLocation,
            destinationLocation: resolvedDestination?.locationLabel ?? destinationLocation,
            ...(resolvedOrigin?.countryCode ? { originCountryCode: resolvedOrigin.countryCode } : {}),
            ...(resolvedDestination?.countryCode
              ? { destinationCountryCode: resolvedDestination.countryCode }
              : {}),
            transportMode: parsed.data.transportMode as LeadRequestTransportMode,
          }
        : {}),
      ...(contactEmail ? { contactEmail } : {}),
      ...(contactPhone ? { contactPhone } : {}),
      status: LEAD_REQUEST_STATUS.ACTIVE,
      expiresAt: addDays(now, LEAD_REQUEST_VALIDITY_DAYS),
      createdByUserId: user._id,
      createdAt: now,
      updatedAt: now,
    });
    const leadRequestId = insertResult.insertedId.toHexString();
    const leadBoardUrl = new URL("/list", request.url).toString();
    const publicationMailResult = await sendLeadRequestPublishedEmail({
      to: user.email,
      name: user.name,
      leadTypeLabel: getLeadTypeLabel(parsed.data.leadType as LeadRequestType),
      descriptionPreview: description.slice(0, 180),
      boardUrl: leadBoardUrl,
    });
    if (!publicationMailResult.ok) {
      logError("Failed to send lead-request publication email", {
        leadRequestId,
        userId: user._id.toHexString(),
        error: publicationMailResult.error,
        status: publicationMailResult.status,
      });
    }

    return NextResponse.json(
      {
        id: leadRequestId,
      },
      { status: 201 },
    );
  } catch (error) {
    logError("Unhandled API error", { route: "/api/lead-requests", error });
    return NextResponse.json(
      {
        error: "Internal server error",
        message:
          error instanceof Error
            ? error.message
            : "Unknown create quote request error",
      },
      { status: 500 },
    );
  }
}

