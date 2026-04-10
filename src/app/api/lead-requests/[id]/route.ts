import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserFromRequest } from "@/lib/auth-user";
import { getLocaleFromApiRequest } from "@/lib/i18n";
import { USER_ROLE } from "@/lib/user-roles";
import {
  addDays,
  ensureLeadRequestsIndexes,
  getLeadRequestsCollection,
} from "@/lib/lead-requests";
import {
  LEAD_REQUEST_STATUS,
  LEAD_REQUEST_VALIDITY_DAYS,
  type LeadRequestTransportMode,
  type LeadRequestType,
} from "@/lib/lead-request-types";
import {
  leadRequestInputSchema,
  normalizeLeadRequestDescription,
  normalizeLeadRequestLocation,
  resolveLeadRequestTransportLocation,
} from "@/lib/lead-request-input";
import { logError } from "@/lib/server-logger";

export const runtime = "nodejs";

const updateLeadRequestSchema = leadRequestInputSchema;

const extendLeadRequestSchema = z.object({
  action: z.literal("extend"),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function assertAccess(input: {
  requestId: ObjectId;
  userId: ObjectId;
  isAdmin: boolean;
}) {
  const leadRequests = await getLeadRequestsCollection();
  const existing = await leadRequests.findOne(
    { _id: input.requestId },
    {
      projection: {
        _id: 1,
        createdByUserId: 1,
        status: 1,
        expiresAt: 1,
      },
    },
  );

  if (!existing?._id) {
    return { error: "Quote request not found" as const, status: 404 };
  }

  if (!input.isAdmin && existing.createdByUserId.toHexString() !== input.userId.toHexString()) {
    return { error: "Forbidden for this quote request" as const, status: 403 };
  }

  return { leadRequests, existing };
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid quote request id" }, { status: 400 });
    }

    const user = await getCurrentUserFromRequest(request);
    if (!user || !user._id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.isBlocked === true) {
      return NextResponse.json(
        { error: "Blocked user cannot edit quote requests" },
        { status: 403 },
      );
    }

    await ensureLeadRequestsIndexes();
    const now = new Date();

    const requestId = new ObjectId(id);
    const isAdmin = user.role === USER_ROLE.ADMIN;
    const access = await assertAccess({
      requestId,
      userId: user._id,
      isAdmin,
    });
    if ("error" in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const payload = await request.json();
    const locale = getLocaleFromApiRequest(request);
    const extendParsed = extendLeadRequestSchema.safeParse(payload);
    if (extendParsed.success) {
      const canExtend =
        access.existing.status === LEAD_REQUEST_STATUS.EXPIRED ||
        Boolean(access.existing.expiresAt && access.existing.expiresAt <= now);
      if (!canExtend) {
        return NextResponse.json(
          { error: "Only expired quote request can be extended" },
          { status: 400 },
        );
      }

      const updateResult = await access.leadRequests.updateOne(
        { _id: requestId },
        {
          $set: {
            status: LEAD_REQUEST_STATUS.ACTIVE,
            expiresAt: addDays(now, LEAD_REQUEST_VALIDITY_DAYS),
            updatedAt: now,
          },
        },
      );
      if (updateResult.matchedCount === 0) {
        return NextResponse.json({ error: "Quote request not found" }, { status: 404 });
      }
      return NextResponse.json({ id: requestId.toHexString() });
    }

    const parsed = updateLeadRequestSchema.safeParse(payload);
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

    const isTransportRequest = parsed.data.leadType === "transport";
    const unsetFields: Record<string, ""> = {
      ...(!contactEmail ? { contactEmail: "" } : {}),
      ...(!contactPhone ? { contactPhone: "" } : {}),
      ...(!isTransportRequest ? { originCountryCode: "" } : {}),
      ...(!isTransportRequest ? { destinationCountryCode: "" } : {}),
      ...(!isTransportRequest
        ? {
            originLocation: "",
            destinationLocation: "",
            transportMode: "",
          }
        : {}),
    };
    const updateResult = await access.leadRequests.updateOne(
      { _id: requestId },
      {
        $set: {
          leadType: parsed.data.leadType as LeadRequestType,
          description,
          ...(isTransportRequest
            ? {
                originLocation: resolvedOrigin?.locationLabel ?? originLocation,
                destinationLocation: resolvedDestination?.locationLabel ?? destinationLocation,
                ...(resolvedOrigin?.countryCode
                  ? { originCountryCode: resolvedOrigin.countryCode }
                  : {}),
                ...(resolvedDestination?.countryCode
                  ? { destinationCountryCode: resolvedDestination.countryCode }
                  : {}),
                transportMode: parsed.data.transportMode as LeadRequestTransportMode,
              }
            : {}),
          ...(contactEmail ? { contactEmail } : {}),
          ...(contactPhone ? { contactPhone } : {}),
          updatedAt: now,
        },
        ...(Object.keys(unsetFields).length > 0 ? { $unset: unsetFields } : {}),
      },
    );

    if (updateResult.matchedCount === 0) {
      return NextResponse.json({ error: "Quote request not found" }, { status: 404 });
    }

    return NextResponse.json({ id: requestId.toHexString() });
  } catch (error) {
    logError("Unhandled API error", { route: "/api/lead-requests/[id]", error });
    return NextResponse.json(
      {
        error: "Internal server error",
        message:
          error instanceof Error ? error.message : "Unknown update quote request error",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid quote request id" }, { status: 400 });
    }

    const user = await getCurrentUserFromRequest(request);
    if (!user || !user._id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.isBlocked === true) {
      return NextResponse.json(
        { error: "Blocked user cannot delete quote requests" },
        { status: 403 },
      );
    }

    await ensureLeadRequestsIndexes();
    const requestId = new ObjectId(id);
    const isAdmin = user.role === USER_ROLE.ADMIN;
    const access = await assertAccess({
      requestId,
      userId: user._id,
      isAdmin,
    });
    if ("error" in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const deleteResult = await access.leadRequests.deleteOne({ _id: requestId });
    if (deleteResult.deletedCount === 0) {
      return NextResponse.json({ error: "Quote request not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    logError("Unhandled API error", { route: "/api/lead-requests/[id]", error });
    return NextResponse.json(
      {
        error: "Internal server error",
        message:
          error instanceof Error ? error.message : "Unknown delete quote request error",
      },
      { status: 500 },
    );
  }
}
