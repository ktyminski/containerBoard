import { randomBytes, createHash } from "node:crypto";
import { ObjectId, type Collection, type WithId } from "mongodb";
import { getDb } from "@/lib/mongodb";

const EMAIL_VERIFICATION_TOKEN_TTL_MS = 1000 * 60 * 60 * 24;

export type EmailVerificationTokenDocument = {
  _id: ObjectId;
  userId: ObjectId;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  usedAt?: Date;
};

let indexesReadyPromise: Promise<void> | null = null;

export async function getEmailVerificationTokensCollection(): Promise<
  Collection<EmailVerificationTokenDocument>
> {
  const db = await getDb();
  return db.collection<EmailVerificationTokenDocument>("emailVerificationTokens");
}

export async function ensureEmailVerificationTokenIndexes(): Promise<void> {
  if (!indexesReadyPromise) {
    indexesReadyPromise = (async () => {
      const tokens = await getEmailVerificationTokensCollection();
      await tokens.createIndex({ tokenHash: 1 }, { unique: true });
      await tokens.createIndex({ userId: 1, createdAt: -1 });
      await tokens.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    })();
  }

  return indexesReadyPromise;
}

export function hashEmailVerificationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createEmailVerificationToken(
  userId: ObjectId,
): Promise<{ token: string; expiresAt: Date }> {
  await ensureEmailVerificationTokenIndexes();
  const tokens = await getEmailVerificationTokensCollection();
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashEmailVerificationToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + EMAIL_VERIFICATION_TOKEN_TTL_MS);

  await tokens.deleteMany({ userId });
  await tokens.insertOne({
    _id: new ObjectId(),
    userId,
    tokenHash,
    createdAt: now,
    expiresAt,
  });

  return { token, expiresAt };
}

export async function consumeEmailVerificationToken(
  token: string,
): Promise<WithId<EmailVerificationTokenDocument> | null> {
  await ensureEmailVerificationTokenIndexes();
  const tokens = await getEmailVerificationTokensCollection();
  const now = new Date();
  const tokenHash = hashEmailVerificationToken(token);

  const result = await tokens.findOneAndUpdate(
    {
      tokenHash,
      expiresAt: { $gt: now },
      usedAt: { $exists: false },
    },
    {
      $set: {
        usedAt: now,
      },
    },
    { returnDocument: "after" },
  );

  return result;
}

export async function deleteEmailVerificationTokensForUser(
  userId: ObjectId,
): Promise<void> {
  await ensureEmailVerificationTokenIndexes();
  const tokens = await getEmailVerificationTokensCollection();
  await tokens.deleteMany({ userId });
}
