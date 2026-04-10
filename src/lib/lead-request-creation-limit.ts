import { ObjectId, type Collection } from "mongodb";
import type { LeadRequestDocument } from "@/lib/lead-requests";

export const LEAD_REQUEST_CREATION_LIMIT = 10;
export const LEAD_REQUEST_CREATION_WINDOW_HOURS = 48;

const LEAD_REQUEST_CREATION_WINDOW_MS =
  LEAD_REQUEST_CREATION_WINDOW_HOURS * 60 * 60 * 1000;

export type LeadRequestCreationLimitState = {
  limit: number;
  windowHours: number;
  createdInWindow: number;
  isLimited: boolean;
  nextAllowedAt: Date | null;
  retryAfterMs: number;
};

export async function getLeadRequestCreationLimitState(input: {
  leadRequests: Collection<LeadRequestDocument>;
  userId: ObjectId;
  now?: Date;
}): Promise<LeadRequestCreationLimitState> {
  const now = input.now ?? new Date();
  const windowStart = new Date(now.getTime() - LEAD_REQUEST_CREATION_WINDOW_MS);
  const rows = await input.leadRequests
    .find(
      {
        createdByUserId: input.userId,
        createdAt: { $gte: windowStart },
      },
      {
        projection: { createdAt: 1 },
        sort: { createdAt: 1 },
        limit: LEAD_REQUEST_CREATION_LIMIT + 10,
      },
    )
    .toArray();

  const createdInWindow = rows.length;
  const isLimited = createdInWindow >= LEAD_REQUEST_CREATION_LIMIT;
  const nextAllowedAt =
    isLimited && rows[0]?.createdAt
      ? new Date(rows[0].createdAt.getTime() + LEAD_REQUEST_CREATION_WINDOW_MS)
      : null;
  const retryAfterMs = nextAllowedAt
    ? Math.max(0, nextAllowedAt.getTime() - now.getTime())
    : 0;

  return {
    limit: LEAD_REQUEST_CREATION_LIMIT,
    windowHours: LEAD_REQUEST_CREATION_WINDOW_HOURS,
    createdInWindow,
    isLimited,
    nextAllowedAt,
    retryAfterMs,
  };
}
