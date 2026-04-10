import { ObjectId, type Collection } from "mongodb";
import type { CompanyDocument } from "@/lib/companies";

export const COMPANY_CREATION_LIMIT = 3;
export const COMPANY_CREATION_WINDOW_HOURS = 48;

const COMPANY_CREATION_WINDOW_MS = COMPANY_CREATION_WINDOW_HOURS * 60 * 60 * 1000;

export type CompanyCreationLimitState = {
  limit: number;
  windowHours: number;
  createdInWindow: number;
  isLimited: boolean;
  nextAllowedAt: Date | null;
  retryAfterMs: number;
};

export async function getCompanyCreationLimitState(input: {
  companies: Collection<CompanyDocument>;
  userId: ObjectId;
  now?: Date;
}): Promise<CompanyCreationLimitState> {
  const now = input.now ?? new Date();
  const windowStart = new Date(now.getTime() - COMPANY_CREATION_WINDOW_MS);
  const rows = await input.companies
    .find(
      {
        createdByUserId: input.userId,
        createdAt: { $gte: windowStart },
      },
      {
        projection: { createdAt: 1 },
        sort: { createdAt: 1 },
        limit: COMPANY_CREATION_LIMIT + 10,
      },
    )
    .toArray();

  const createdInWindow = rows.length;
  const isLimited = createdInWindow >= COMPANY_CREATION_LIMIT;
  const nextAllowedAt =
    isLimited && rows[0]?.createdAt
      ? new Date(rows[0].createdAt.getTime() + COMPANY_CREATION_WINDOW_MS)
      : null;
  const retryAfterMs = nextAllowedAt
    ? Math.max(0, nextAllowedAt.getTime() - now.getTime())
    : 0;

  return {
    limit: COMPANY_CREATION_LIMIT,
    windowHours: COMPANY_CREATION_WINDOW_HOURS,
    createdInWindow,
    isLimited,
    nextAllowedAt,
    retryAfterMs,
  };
}
