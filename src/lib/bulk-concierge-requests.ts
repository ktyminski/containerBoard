import { ObjectId, type Collection } from "mongodb";
import { getDb } from "@/lib/mongodb";

export type ConciergeStockFileAsset = {
  filename: string;
  contentType: string;
  size: number;
  blobUrl: string;
};

export type BulkConciergeRequestStatus = "new" | "completed";

export type BulkConciergeRequestDocument = {
  _id?: ObjectId;
  userId: ObjectId;
  userName: string;
  userEmail: string;
  companyId: ObjectId;
  companyName: string;
  companySlug?: string;
  contactEmail?: string;
  contactPhone?: string;
  note?: string;
  stockFile: ConciergeStockFileAsset;
  notificationEmail: string;
  notificationSentAt?: Date;
  notificationError?: string;
  status: BulkConciergeRequestStatus;
  createdAt: Date;
  updatedAt: Date;
};

let conciergeRequestIndexesReadyPromise: Promise<void> | null = null;

export async function getBulkConciergeRequestsCollection(): Promise<
  Collection<BulkConciergeRequestDocument>
> {
  const db = await getDb();
  return db.collection<BulkConciergeRequestDocument>("bulk_concierge_requests");
}

export async function ensureBulkConciergeRequestIndexes(): Promise<void> {
  if (!conciergeRequestIndexesReadyPromise) {
    conciergeRequestIndexesReadyPromise = (async () => {
      const requests = await getBulkConciergeRequestsCollection();
      await requests.createIndex({ createdAt: -1 });
      await requests.createIndex({ status: 1, createdAt: -1 });
      await requests.createIndex({ companyId: 1, createdAt: -1 });
      await requests.createIndex({ userId: 1, createdAt: -1 });
    })();
  }

  return conciergeRequestIndexesReadyPromise;
}

