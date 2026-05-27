import { ObjectId } from "mongodb";
import {
  getContainerListingsCollection,
  mapContainerListingToItem,
  type ContainerListingDocument,
} from "@/lib/container-listings";
import { LISTING_STATUS, LISTING_TYPE } from "@/lib/container-listing-types";
import { getSocialPostDraftsCollection } from "@/lib/social-post-drafts";

const RECENT_USAGE_DAYS = 30;
const PROMOTION_HISTORY_DAYS = 90;
const MAX_CANDIDATES = 250;
const RANDOM_POOL_SIZE = 20;

type ScoredListing = {
  doc: ContainerListingDocument;
  score: number;
};

function daysBetween(later: Date, earlier: Date): number {
  return Math.max(0, (later.getTime() - earlier.getTime()) / (24 * 60 * 60 * 1000));
}

function hasPrice(doc: ContainerListingDocument): boolean {
  return (
    typeof doc.pricing?.original.amount === "number" ||
    typeof doc.priceAmount === "number" ||
    Boolean(doc.price?.trim())
  );
}

function scoreListing(input: {
  doc: ContainerListingDocument;
  now: Date;
  recentlyUsedListingIds: Set<string>;
  promotionCountByListingId: Map<string, number>;
}): number {
  const { doc, now, recentlyUsedListingIds, promotionCountByListingId } = input;
  const listingId = doc._id.toHexString();
  const photoCount = doc.photos?.filter((photo) => photo?.blobUrl || photo?.data).length ?? 0;
  const ageDays = daysBetween(now, doc.createdAt);
  let score = 0;

  if (photoCount > 0) {
    score += 18;
  } else {
    score -= 25;
  }
  if (doc.locationCity?.trim() || doc.locationCountry?.trim()) {
    score += 6;
  }
  if (hasPrice(doc)) {
    score += 8;
  }
  if (ageDays <= 14) {
    score += 8;
  } else if (ageDays <= 30) {
    score += 5;
  } else if (ageDays <= 60) {
    score += 2;
  }
  if (doc.logisticsTransportAvailable || doc.logisticsTransportIncluded) {
    score += 5;
  }
  if (doc.logisticsUnloadingAvailable || doc.logisticsUnloadingIncluded) {
    score += 3;
  }
  if (doc.companyIsVerified) {
    score += 3;
  }
  if (doc.type === LISTING_TYPE.RENT) {
    score += 2;
  }

  if (recentlyUsedListingIds.has(listingId)) {
    score -= 40;
  }

  const promotionCount = promotionCountByListingId.get(listingId) ?? 0;
  score -= promotionCount * 8;

  return score;
}

function weightedPick(scored: ScoredListing[]): ContainerListingDocument | null {
  const ordered = scored
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, RANDOM_POOL_SIZE);

  if (ordered.length === 0) {
    return scored.sort((a, b) => b.score - a.score)[0]?.doc ?? null;
  }

  const lowestScore = Math.min(...ordered.map((entry) => entry.score));
  const weighted = ordered.map((entry) => ({
    ...entry,
    weight: Math.max(1, entry.score - lowestScore + 3),
  }));
  const totalWeight = weighted.reduce((total, entry) => total + entry.weight, 0);
  let cursor = Math.random() * totalWeight;

  for (const entry of weighted) {
    cursor -= entry.weight;
    if (cursor <= 0) {
      return entry.doc;
    }
  }

  return weighted[0]?.doc ?? null;
}

export async function pickListingForSocialPost(now = new Date()): Promise<
  ContainerListingDocument | null
> {
  const listings = await getContainerListingsCollection();
  const drafts = await getSocialPostDraftsCollection();
  const recentlyUsedSince = new Date(
    now.getTime() - RECENT_USAGE_DAYS * 24 * 60 * 60 * 1000,
  );
  const promotionHistorySince = new Date(
    now.getTime() - PROMOTION_HISTORY_DAYS * 24 * 60 * 60 * 1000,
  );

  const usedRows = await drafts
    .find(
      {
        generatedAt: { $gte: promotionHistorySince },
      },
      {
        projection: { listingId: 1, generatedAt: 1 },
      },
    )
    .toArray();

  const recentlyUsedListingIds = new Set<string>();
  const promotionCountByListingId = new Map<string, number>();
  for (const row of usedRows) {
    const listingId = row.listingId.toHexString();
    promotionCountByListingId.set(
      listingId,
      (promotionCountByListingId.get(listingId) ?? 0) + 1,
    );
    if (row.generatedAt >= recentlyUsedSince) {
      recentlyUsedListingIds.add(listingId);
    }
  }

  const rows = await listings
    .find({
      status: LISTING_STATUS.ACTIVE,
      expiresAt: { $gt: now },
      type: { $in: [LISTING_TYPE.SELL, LISTING_TYPE.RENT] },
    })
    .sort({ createdAt: -1 })
    .limit(MAX_CANDIDATES)
    .toArray();

  const scored = rows
    .map((doc) => ({
      doc,
      score: scoreListing({
        doc,
        now,
        recentlyUsedListingIds,
        promotionCountByListingId,
      }),
    }))
    .filter((entry) => {
      const item = mapContainerListingToItem(entry.doc);
      return !item.isExpired;
    });

  return weightedPick(scored);
}

export function getListingPublicUrl(listingId: ObjectId): string {
  return `/containers/${listingId.toHexString()}`;
}

