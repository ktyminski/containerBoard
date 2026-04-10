import { ObjectId, type Collection } from "mongodb";
import { getDb } from "@/lib/mongodb";
import {
  LEAD_REQUEST_STATUS,
  type LeadRequestStatus,
  type LeadRequestTransportMode,
  type LeadRequestType,
} from "@/lib/lead-request-types";

export type LeadRequestDocument = {
  _id: ObjectId;
  leadType: LeadRequestType;
  description: string;
  originLocation?: string;
  destinationLocation?: string;
  originCountryCode?: string;
  destinationCountryCode?: string;
  transportMode?: LeadRequestTransportMode;
  contactEmail?: string;
  contactPhone?: string;
  status: LeadRequestStatus;
  expiresAt?: Date;
  createdByUserId: ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

let indexesReadyPromise: Promise<void> | null = null;

export async function getLeadRequestsCollection(): Promise<
  Collection<LeadRequestDocument>
> {
  const db = await getDb();
  return db.collection<LeadRequestDocument>("leadRequests");
}

export async function ensureLeadRequestsIndexes(): Promise<void> {
  if (!indexesReadyPromise) {
    indexesReadyPromise = (async () => {
      const leadRequests = await getLeadRequestsCollection();
      await leadRequests.createIndex({ status: 1, createdAt: -1 });
      await leadRequests.createIndex({ leadType: 1, createdAt: -1 });
      await leadRequests.createIndex({ expiresAt: 1, status: 1 });
      await leadRequests.createIndex({ createdByUserId: 1, createdAt: -1 });
    })();
  }

  return indexesReadyPromise;
}

export function addDays(input: Date, days: number): Date {
  const next = new Date(input);
  next.setDate(next.getDate() + days);
  return next;
}

export async function expireLeadRequests(now = new Date()): Promise<void> {
  const leadRequests = await getLeadRequestsCollection();
  await leadRequests.updateMany(
    {
      status: {
        $in: [LEAD_REQUEST_STATUS.ACTIVE, LEAD_REQUEST_STATUS.PENDING],
      },
      expiresAt: { $lte: now },
    },
    {
      $set: {
        status: LEAD_REQUEST_STATUS.EXPIRED,
        updatedAt: now,
      },
    },
  );
}
