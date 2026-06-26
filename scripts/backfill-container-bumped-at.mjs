import { MongoClient } from "mongodb";

const mongoUri = process.env.MONGODB_URI;
const mongoDb = process.env.MONGODB_DB;

if (!mongoUri || !mongoDb) {
  throw new Error("Missing MONGODB_URI or MONGODB_DB in environment");
}

const client = new MongoClient(mongoUri);

try {
  await client.connect();
  const db = client.db(mongoDb);
  const listings = db.collection("container_listings");

  const result = await listings.updateMany(
    {
      bumpedAt: { $exists: false },
      createdAt: { $type: "date" },
    },
    [
      {
        $set: {
          bumpedAt: "$createdAt",
        },
      },
    ],
  );

  console.log(
    `Backfill complete. Matched: ${result.matchedCount}, modified: ${result.modifiedCount}.`,
  );
} finally {
  await client.close();
}
