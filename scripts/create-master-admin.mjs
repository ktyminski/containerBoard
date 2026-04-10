import bcrypt from "bcryptjs";
import { MongoClient } from "mongodb";

const mongoUri = process.env.MONGODB_URI;
const mongoDb = process.env.MONGODB_DB;

if (!mongoUri || !mongoDb) {
  throw new Error("Missing MONGODB_URI or MONGODB_DB in environment");
}

const email = process.env.MASTER_ADMIN_EMAIL || "master.admin@containerboard.local";
const password = process.env.MASTER_ADMIN_PASSWORD || "Admin123!ChangeMe";
const name = process.env.MASTER_ADMIN_NAME || "Master Admin";

const now = new Date();
const emailNormalized = email.trim().toLowerCase();

async function run() {
  const client = new MongoClient(mongoUri);
  await client.connect();

  const db = client.db(mongoDb);
  const users = db.collection("users");
  await users.createIndex({ emailNormalized: 1 }, { unique: true });

  const passwordHash = await bcrypt.hash(password, 12);
  await users.updateOne(
    { emailNormalized },
    {
      $setOnInsert: { createdAt: now },
      $set: {
        email,
        emailNormalized,
        name,
        passwordHash,
        role: "admin",
        authProvider: "local",
        updatedAt: now,
      },
    },
    { upsert: true },
  );

  console.log("Master admin ready:");
  console.log(`email=${email}`);
  console.log(`password=${password}`);
  console.log("Change password after first login.");

  await client.close();
}

run().catch((error) => {
  console.error("Failed to create master admin:", error);
  process.exit(1);
});

