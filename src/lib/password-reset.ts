import { createHash, randomBytes } from "node:crypto";
import { ObjectId, type Collection, type WithId } from "mongodb";
import { getDb } from "@/lib/mongodb";

const PASSWORD_RESET_TOKEN_TTL_MS = 1000 * 60 * 60;

export type PasswordResetTokenDocument = {
  _id: ObjectId;
  userId: ObjectId;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  usedAt?: Date;
};

let indexesReadyPromise: Promise<void> | null = null;

export async function getPasswordResetTokensCollection(): Promise<
  Collection<PasswordResetTokenDocument>
> {
  const db = await getDb();
  return db.collection<PasswordResetTokenDocument>("passwordResetTokens");
}

export async function ensurePasswordResetTokenIndexes(): Promise<void> {
  if (!indexesReadyPromise) {
    indexesReadyPromise = (async () => {
      const tokens = await getPasswordResetTokensCollection();
      await tokens.createIndex({ tokenHash: 1 }, { unique: true });
      await tokens.createIndex({ userId: 1, createdAt: -1 });
      await tokens.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    })();
  }

  return indexesReadyPromise;
}

export function hashPasswordResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createPasswordResetToken(
  userId: ObjectId,
): Promise<{ token: string; expiresAt: Date }> {
  await ensurePasswordResetTokenIndexes();
  const tokens = await getPasswordResetTokensCollection();
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashPasswordResetToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + PASSWORD_RESET_TOKEN_TTL_MS);

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

export async function consumePasswordResetToken(
  token: string,
): Promise<WithId<PasswordResetTokenDocument> | null> {
  await ensurePasswordResetTokenIndexes();
  const tokens = await getPasswordResetTokensCollection();
  const now = new Date();
  const tokenHash = hashPasswordResetToken(token);

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

export async function deletePasswordResetTokensForUser(
  userId: ObjectId,
): Promise<void> {
  await ensurePasswordResetTokenIndexes();
  const tokens = await getPasswordResetTokensCollection();
  await tokens.deleteMany({ userId });
}
