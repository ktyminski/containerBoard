import { ObjectId, type Collection } from "mongodb";
import { getDb } from "@/lib/mongodb";

export const COMPANY_OWNERSHIP_CLAIM_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;

export type CompanyOwnershipClaimStatus =
  (typeof COMPANY_OWNERSHIP_CLAIM_STATUS)[keyof typeof COMPANY_OWNERSHIP_CLAIM_STATUS];

export type CompanyOwnershipClaimDocument = {
  _id: ObjectId;
  companyId: ObjectId;
  userId: ObjectId;
  status: CompanyOwnershipClaimStatus;
  createdAt: Date;
  updatedAt: Date;
  reviewedAt?: Date;
  reviewedByUserId?: ObjectId;
};

let indexesReadyPromise: Promise<void> | null = null;

function isNamespaceNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeCode =
    "code" in error ? (error as { code?: unknown }).code : undefined;
  if (maybeCode === 26) {
    return true;
  }

  const maybeMessage =
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message
      : "";
  return maybeMessage.includes("ns does not exist");
}

export async function getCompanyOwnershipClaimsCollection(): Promise<
  Collection<CompanyOwnershipClaimDocument>
> {
  const db = await getDb();
  return db.collection<CompanyOwnershipClaimDocument>(
    "company_ownership_claims",
  );
}

export async function ensureCompanyOwnershipClaimsIndexes(): Promise<void> {
  if (!indexesReadyPromise) {
    indexesReadyPromise = (async () => {
      const claims = await getCompanyOwnershipClaimsCollection();
      let existingIndexes: Array<{ name?: string; unique?: boolean }> = [];
      try {
        existingIndexes = await claims.indexes();
      } catch (error) {
        if (!isNamespaceNotFoundError(error)) {
          throw error;
        }
      }
      const userPendingIndex = existingIndexes.find(
        (index) => index.name === "userId_1_status_1",
      );
      if (userPendingIndex && userPendingIndex.unique !== true) {
        await claims.dropIndex("userId_1_status_1");
      }
      await claims.createIndex({ companyId: 1, status: 1 });
      await claims.createIndex({ userId: 1, status: 1 }, { unique: true });
      await claims.createIndex(
        { companyId: 1, userId: 1, status: 1 },
        { unique: true },
      );
    })().catch((error) => {
      indexesReadyPromise = null;
      throw error;
    });
  }

  return indexesReadyPromise;
}
