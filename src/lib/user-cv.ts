import { type Collection, type ObjectId, Binary } from "mongodb";
import { getDb } from "@/lib/mongodb";

export type UserCvDocument = {
  _id?: ObjectId;
  userId: ObjectId;
  filename: string;
  contentType: string;
  size: number;
  data?: Binary;
  blobUrl?: string;
  createdAt: Date;
  updatedAt: Date;
};

let userCvIndexesReadyPromise: Promise<void> | null = null;

export async function getUserCvCollection(): Promise<Collection<UserCvDocument>> {
  const db = await getDb();
  return db.collection<UserCvDocument>("userCvFiles");
}

export async function ensureUserCvIndexes(): Promise<void> {
  if (!userCvIndexesReadyPromise) {
    userCvIndexesReadyPromise = (async () => {
      const cvFiles = await getUserCvCollection();
      await cvFiles.createIndex({ userId: 1 }, { unique: true });
    })();
  }

  return userCvIndexesReadyPromise;
}
