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
      $or: [
        { logisticsLoadingAvailable: { $exists: true } },
        { logisticsLoadingIncluded: { $exists: true } },
      ],
    },
    [
      {
        $set: {
          logisticsUnloadingAvailable: {
            $ifNull: ["$logisticsUnloadingAvailable", "$logisticsLoadingAvailable"],
          },
          logisticsUnloadingIncluded: {
            $ifNull: ["$logisticsUnloadingIncluded", "$logisticsLoadingIncluded"],
          },
        },
      },
      {
        $unset: ["logisticsLoadingAvailable", "logisticsLoadingIncluded"],
      },
    ],
  );

  console.log(
    `Migration complete. Matched: ${result.matchedCount}, modified: ${result.modifiedCount}.`,
  );
} finally {
  await client.close();
}
