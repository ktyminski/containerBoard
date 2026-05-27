import { ObjectId, type Collection, type IndexDescription } from "mongodb";
import { getDb } from "@/lib/mongodb";

export const SOCIAL_PLATFORMS = ["facebook", "instagram"] as const;
export const SOCIAL_POST_DRAFT_STATUSES = ["draft", "posted", "skipped"] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];
export type SocialPostDraftStatus = (typeof SOCIAL_POST_DRAFT_STATUSES)[number];

export type SocialPostDraftDocument = {
  _id: ObjectId;
  listingId: ObjectId;
  platform: SocialPlatform;
  status: SocialPostDraftStatus;
  title: string;
  caption: string;
  imageUrl: string;
  imagePathname?: string;
  listingUrl: string;
  dateKey: string;
  generatedAt: Date;
  updatedAt: Date;
  postedAt?: Date;
  skippedAt?: Date;
};

let indexesReadyPromise: Promise<void> | null = null;

export async function getSocialPostDraftsCollection(): Promise<
  Collection<SocialPostDraftDocument>
> {
  const db = await getDb();
  return db.collection<SocialPostDraftDocument>("social_post_drafts");
}

export async function ensureSocialPostDraftIndexes(): Promise<void> {
  if (!indexesReadyPromise) {
    indexesReadyPromise = (async () => {
      const drafts = await getSocialPostDraftsCollection();
      const indexes: IndexDescription[] = [
        { key: { dateKey: 1, platform: 1 }, unique: true },
        { key: { status: 1, generatedAt: -1 } },
        { key: { platform: 1, status: 1, generatedAt: -1 } },
        { key: { listingId: 1, generatedAt: -1 } },
      ];

      await drafts.createIndexes(indexes);
    })();
  }

  await indexesReadyPromise;
}

export function getWarsawDateKey(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

