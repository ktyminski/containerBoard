import { ObjectId, type Collection } from "mongodb";
import { getDb } from "@/lib/mongodb";

export type AnnouncementFavoriteDocument = {
  _id: ObjectId;
  userId: ObjectId;
  announcementId: ObjectId;
  createdAt: Date;
};

let indexesReadyPromise: Promise<void> | null = null;

export async function getAnnouncementFavoritesCollection(): Promise<
  Collection<AnnouncementFavoriteDocument>
> {
  const db = await getDb();
  return db.collection<AnnouncementFavoriteDocument>("announcementFavorites");
}

export async function ensureAnnouncementFavoritesIndexes(): Promise<void> {
  if (!indexesReadyPromise) {
    indexesReadyPromise = (async () => {
      const favorites = await getAnnouncementFavoritesCollection();
      await favorites.createIndex({ userId: 1, announcementId: 1 }, { unique: true });
      await favorites.createIndex({ userId: 1, createdAt: -1 });
      await favorites.createIndex({ announcementId: 1 });
    })();
  }

  return indexesReadyPromise;
}
