import { ObjectId, type Collection } from "mongodb";
import { getDb } from "@/lib/mongodb";

export const CONTACT_ACTIVITY_TYPE = {
  INQUIRY_SENT: "inquiry_sent",
  CONTACT_REVEALED: "contact_revealed",
} as const;

export type ContactActivityType =
  (typeof CONTACT_ACTIVITY_TYPE)[keyof typeof CONTACT_ACTIVITY_TYPE];

export type ContactActivityDocument = {
  _id: ObjectId;
  type: ContactActivityType;
  listingId: ObjectId;
  listingType?: string;
  listingSummary: string;
  listingCompanyName?: string;
  actorUserId?: ObjectId;
  actorIsGuest: boolean;
  actorName?: string;
  actorEmail?: string;
  actorPhone?: string;
  actorAccountName?: string;
  actorAccountEmail?: string;
  actorIp?: string;
  actorUserAgent?: string;
  recipientUserId?: ObjectId;
  recipientCompanyName?: string;
  recipientEmail?: string;
  recipientPhone?: string;
  inquiryMessage?: string;
  requestedQuantity?: number;
  offeredPrice?: string;
  createdAt: Date;
};

let contactActivityIndexesReadyPromise: Promise<void> | null = null;

export async function getContactActivityCollection(): Promise<Collection<ContactActivityDocument>> {
  const db = await getDb();
  return db.collection<ContactActivityDocument>("contact_activity");
}

export async function ensureContactActivityIndexes(): Promise<void> {
  if (!contactActivityIndexesReadyPromise) {
    contactActivityIndexesReadyPromise = (async () => {
      const collection = await getContactActivityCollection();
      await collection.createIndex({ createdAt: -1 });
      await collection.createIndex({ type: 1, createdAt: -1 });
      await collection.createIndex({ listingId: 1, createdAt: -1 });
      await collection.createIndex({ actorUserId: 1, createdAt: -1 });
      await collection.createIndex({ recipientUserId: 1, createdAt: -1 });
      await collection.createIndex({ recipientEmail: 1, createdAt: -1 });
    })();
  }

  await contactActivityIndexesReadyPromise;
}

export async function recordContactActivity(
  input: Omit<ContactActivityDocument, "_id" | "createdAt"> & {
    createdAt?: Date;
  },
): Promise<void> {
  await ensureContactActivityIndexes();
  const collection = await getContactActivityCollection();
  await collection.insertOne({
    _id: new ObjectId(),
    ...input,
    createdAt: input.createdAt ?? new Date(),
  });
}

