import { ObjectId, type Filter } from "mongodb";
import { LISTING_STATUS } from "@/lib/container-listing-types";
import {
  LISTING_REMINDER_FINAL_DAYS,
  LISTING_REMINDER_FIRST_DAYS,
  type ContainerListingDocument,
  getContainerListingsCollection,
} from "@/lib/container-listings";
import { sendListingExpiryReminderEmail } from "@/lib/mailer";
import { logError } from "@/lib/server-logger";
import { getUsersCollection } from "@/lib/users";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const DEFAULT_BASE_URL = "https://containerboard.pl";
const DEFAULT_LIMIT = 1000;

type ReminderStage = "first" | "final";

type ReminderListingCandidate = Pick<
  ContainerListingDocument,
  "_id" | "createdByUserId" | "contactEmail" | "companyName" | "quantity" | "expiresAt"
> & {
  expiryReminder7dSentAt?: Date | null;
  expiryReminder2dSentAt?: Date | null;
};

export type SendListingExpiryRemindersResult = {
  ok: boolean;
  checkedAtIso: string;
  processed: number;
  sentFirstReminder: number;
  sentFinalReminder: number;
  skippedNoRecipient: number;
  failed: number;
  errors: string[];
};

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getReminderStage(
  listing: ReminderListingCandidate,
  nowMs: number,
): ReminderStage | null {
  const expiresAtMs = listing.expiresAt.getTime();
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs) {
    return null;
  }

  const msLeft = expiresAtMs - nowMs;
  const firstThresholdMs = LISTING_REMINDER_FIRST_DAYS * DAY_IN_MS;
  const finalThresholdMs = LISTING_REMINDER_FINAL_DAYS * DAY_IN_MS;
  const firstReminderSent =
    listing.expiryReminder7dSentAt instanceof Date &&
    Number.isFinite(listing.expiryReminder7dSentAt.getTime());
  const finalReminderSent =
    listing.expiryReminder2dSentAt instanceof Date &&
    Number.isFinite(listing.expiryReminder2dSentAt.getTime());

  if (!finalReminderSent && msLeft <= finalThresholdMs) {
    return "final";
  }
  if (!firstReminderSent && msLeft <= firstThresholdMs) {
    return "first";
  }
  return null;
}

function toReminderField(stage: ReminderStage): "expiryReminder7dSentAt" | "expiryReminder2dSentAt" {
  return stage === "first" ? "expiryReminder7dSentAt" : "expiryReminder2dSentAt";
}

export async function sendListingExpiryReminders(input?: {
  now?: Date;
  limit?: number;
  baseUrl?: string;
}): Promise<SendListingExpiryRemindersResult> {
  const now = input?.now ?? new Date();
  const nowMs = now.getTime();
  const limit = Math.max(1, Math.min(input?.limit ?? DEFAULT_LIMIT, 5000));
  const baseUrl = (input?.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const firstReminderUpperBound = new Date(
    nowMs + LISTING_REMINDER_FIRST_DAYS * DAY_IN_MS,
  );
  const remindersFilter: Filter<ContainerListingDocument> = {
    status: LISTING_STATUS.ACTIVE,
    expiresAt: {
      $gt: now,
      $lte: firstReminderUpperBound,
    },
    $or: [
      { expiryReminder7dSentAt: { $exists: false } },
      { expiryReminder2dSentAt: { $exists: false } },
    ],
  };

  const listings = await getContainerListingsCollection();
  const candidates = (await listings
    .find(remindersFilter, {
      projection: {
        _id: 1,
        createdByUserId: 1,
        contactEmail: 1,
        companyName: 1,
        quantity: 1,
        expiresAt: 1,
        expiryReminder7dSentAt: 1,
        expiryReminder2dSentAt: 1,
      },
      sort: { expiresAt: 1 },
      limit,
    })
    .toArray()) as ReminderListingCandidate[];

  if (candidates.length === 0) {
    return {
      ok: true,
      checkedAtIso: now.toISOString(),
      processed: 0,
      sentFirstReminder: 0,
      sentFinalReminder: 0,
      skippedNoRecipient: 0,
      failed: 0,
      errors: [],
    };
  }

  const ownerIds = Array.from(
    new Set(candidates.map((item) => item.createdByUserId.toHexString())),
  );
  const users = await getUsersCollection();
  const owners = await users
    .find(
      {
        _id: {
          $in: ownerIds.map((value) => new ObjectId(value)),
        },
      },
      {
        projection: {
          _id: 1,
          email: 1,
          name: 1,
        },
      },
    )
    .toArray();

  const ownersById = new Map(
    owners.map((owner) => [owner._id?.toHexString() ?? "", owner]),
  );

  let sentFirstReminder = 0;
  let sentFinalReminder = 0;
  let skippedNoRecipient = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const listing of candidates) {
    const stage = getReminderStage(listing, nowMs);
    if (!stage) {
      continue;
    }

    const owner = ownersById.get(listing.createdByUserId.toHexString());
    const recipient =
      normalizeOptionalString(owner?.email) ??
      normalizeOptionalString(listing.contactEmail);
    if (!recipient) {
      skippedNoRecipient += 1;
      continue;
    }

    const listingId = listing._id.toHexString();
    const manageUrl = `${baseUrl}/containers/mine`;
    const editUrl = `${baseUrl}/containers/${listingId}/edit`;
    const sendResult = await sendListingExpiryReminderEmail({
      to: recipient,
      name: normalizeOptionalString(owner?.name) ?? undefined,
      companyName: normalizeOptionalString(listing.companyName) ?? "ContainerBoard",
      quantity:
        typeof listing.quantity === "number" &&
        Number.isFinite(listing.quantity) &&
        listing.quantity > 0
          ? Math.trunc(listing.quantity)
          : 1,
      expiresAtIso: listing.expiresAt.toISOString(),
      reminderDays:
        stage === "first"
          ? LISTING_REMINDER_FIRST_DAYS
          : LISTING_REMINDER_FINAL_DAYS,
      manageUrl,
      editUrl,
    });

    if (!sendResult.ok) {
      failed += 1;
      const errorMessage = `listing:${listingId} ${sendResult.error ?? "send failed"}`;
      errors.push(errorMessage);
      logError("Failed to send listing expiry reminder email", {
        listingId,
        stage,
        sendResult,
      });
      continue;
    }

    const reminderField = toReminderField(stage);
    const markFilter = {
      _id: listing._id,
      [reminderField]: { $exists: false },
    } as Filter<ContainerListingDocument>;

    await listings.updateOne(markFilter, {
      $set: {
        [reminderField]: now,
        updatedAt: now,
      } as Partial<ContainerListingDocument>,
    });

    if (stage === "first") {
      sentFirstReminder += 1;
    } else {
      sentFinalReminder += 1;
    }
  }

  return {
    ok: failed === 0,
    checkedAtIso: now.toISOString(),
    processed: candidates.length,
    sentFirstReminder,
    sentFinalReminder,
    skippedNoRecipient,
    failed,
    errors: errors.slice(0, 50),
  };
}
