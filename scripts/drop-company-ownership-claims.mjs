import { MongoClient } from "mongodb";

const mongoUri = process.env.MONGODB_URI;
const mongoDb = process.env.MONGODB_DB;

if (!mongoUri || !mongoDb) {
  throw new Error("Missing MONGODB_URI or MONGODB_DB in environment");
}

async function run() {
  const client = new MongoClient(mongoUri);
  await client.connect();

  const db = client.db(mongoDb);
  const collections = await db
    .listCollections({ name: "company_ownership_claims" })
    .toArray();

  if (collections.length === 0) {
    console.log('Collection "company_ownership_claims" does not exist. Nothing to drop.');
    await client.close();
    return;
  }

  await db.collection("company_ownership_claims").drop();
  console.log('Dropped collection "company_ownership_claims".');

  await client.close();
}

run().catch((error) => {
  console.error("Failed to drop company ownership claims collection:", error);
  process.exit(1);
});
