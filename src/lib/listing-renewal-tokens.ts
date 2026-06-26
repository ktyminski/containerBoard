import { createHash, randomBytes } from "node:crypto";
import { ObjectId, type Collection } from "mongodb";
import {
  getContainerListingsCollection,
  getDefaultListingExpiration,
  getListingBumpState,
} from "@/lib/container-listings";
import { LISTING_STATUS } from "@/lib/container-listing-types";
import { getDb } from "@/lib/mongodb";

const LISTING_RENEWAL_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 21;

export type ListingRenewalTokenDocument = {
  _id: ObjectId;
  listingId: ObjectId;
  userId: ObjectId;
  tokenHash: string;
  issuedForExpiresAt: Date;
  createdAt: Date;
  expiresAt: Date;
  renewedAt?: Date;
  renewedExpiresAt?: Date;
};

export type ListingRenewalResult =
  | {
      ok: true;
      status: "renewed" | "already-renewed";
      listingId: string;
      expiresAt: Date;
    }
  | {
      ok: false;
      status: "invalid-token" | "listing-not-found" | "listing-closed";
    };

let indexesReadyPromise: Promise<void> | null = null;

export async function getListingRenewalTokensCollection(): Promise<
  Collection<ListingRenewalTokenDocument>
> {
  const db = await getDb();
  return db.collection<ListingRenewalTokenDocument>("listingRenewalTokens");
}

export async function ensureListingRenewalTokenIndexes(): Promise<void> {
  if (!indexesReadyPromise) {
    indexesReadyPromise = (async () => {
      const tokens = await getListingRenewalTokensCollection();
      await tokens.createIndex({ tokenHash: 1 }, { unique: true });
      await tokens.createIndex({ listingId: 1, createdAt: -1 });
      await tokens.createIndex({ userId: 1, createdAt: -1 });
      await tokens.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    })();
  }

  return indexesReadyPromise;
}

function hashListingRenewalToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createListingRenewalToken(input: {
  listingId: ObjectId;
  userId: ObjectId;
  issuedForExpiresAt: Date;
  now?: Date;
}): Promise<{ token: string; expiresAt: Date }> {
  await ensureListingRenewalTokenIndexes();
  const tokens = await getListingRenewalTokensCollection();
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashListingRenewalToken(token);
  const now = input.now ?? new Date();
  const expiresAt = new Date(now.getTime() + LISTING_RENEWAL_TOKEN_TTL_MS);

  await tokens.deleteMany({
    listingId: input.listingId,
    userId: input.userId,
    renewedAt: { $exists: false },
  });
  await tokens.insertOne({
    _id: new ObjectId(),
    listingId: input.listingId,
    userId: input.userId,
    tokenHash,
    issuedForExpiresAt: input.issuedForExpiresAt,
    createdAt: now,
    expiresAt,
  });

  return { token, expiresAt };
}

export async function renewListingWithToken(token: string): Promise<ListingRenewalResult> {
  const trimmedToken = token.trim();
  if (!trimmedToken) {
    return { ok: false, status: "invalid-token" };
  }

  await ensureListingRenewalTokenIndexes();
  const tokens = await getListingRenewalTokensCollection();
  const now = new Date();
  const tokenHash = hashListingRenewalToken(trimmedToken);
  const renewalToken = await tokens.findOne({
    tokenHash,
    expiresAt: { $gt: now },
  });

  if (!renewalToken) {
    return { ok: false, status: "invalid-token" };
  }

  if (renewalToken.renewedAt && renewalToken.renewedExpiresAt) {
    return {
      ok: true,
      status: "already-renewed",
      listingId: renewalToken.listingId.toHexString(),
      expiresAt: renewalToken.renewedExpiresAt,
    };
  }

  const listings = await getContainerListingsCollection();
  const listing = await listings.findOne(
    {
      _id: renewalToken.listingId,
      createdByUserId: renewalToken.userId,
    },
    {
      projection: {
        _id: 1,
        status: 1,
        expiresAt: 1,
        createdAt: 1,
        bumpedAt: 1,
      },
    },
  );

  if (!listing?._id) {
    return { ok: false, status: "listing-not-found" };
  }
  if (listing.status === LISTING_STATUS.CLOSED) {
    return { ok: false, status: "listing-closed" };
  }

  const defaultExpiresAt = getDefaultListingExpiration(now);
  const currentExpiresAt =
    listing.expiresAt instanceof Date &&
    listing.expiresAt.getTime() > defaultExpiresAt.getTime()
      ? listing.expiresAt
      : defaultExpiresAt;
  const bumpState = getListingBumpState(listing, now);
  const setPatch: {
    status: typeof LISTING_STATUS.ACTIVE;
    expiresAt: Date;
    updatedAt: Date;
    bumpedAt?: Date;
  } = {
    status: LISTING_STATUS.ACTIVE,
    expiresAt: currentExpiresAt,
    updatedAt: now,
  };
  if (bumpState.canBump) {
    setPatch.bumpedAt = now;
  }

  await listings.updateOne(
    {
      _id: renewalToken.listingId,
      createdByUserId: renewalToken.userId,
      status: { $ne: LISTING_STATUS.CLOSED },
    },
    {
      $set: setPatch,
      $unset: {
        expiryReminder7dSentAt: "",
        expiryReminder2dSentAt: "",
      },
    },
  );

  await tokens.updateOne(
    {
      _id: renewalToken._id,
      renewedAt: { $exists: false },
    },
    {
      $set: {
        renewedAt: now,
        renewedExpiresAt: currentExpiresAt,
      },
    },
  );

  return {
    ok: true,
    status: "renewed",
    listingId: renewalToken.listingId.toHexString(),
    expiresAt: currentExpiresAt,
  };
}
