import { MongoClient, type Db } from "mongodb";
import { getEnv } from "./env";

type GlobalWithMongo = typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient>;
};

const globalWithMongo = globalThis as GlobalWithMongo;

function createClientPromise(): Promise<MongoClient> {
  const env = getEnv();
  const client = new MongoClient(env.MONGODB_URI);
  return client.connect();
}

export function getMongoClient(): Promise<MongoClient> {
  if (!globalWithMongo._mongoClientPromise) {
    globalWithMongo._mongoClientPromise = createClientPromise();
  }

  return globalWithMongo._mongoClientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getMongoClient();
  const env = getEnv();
  return client.db(env.MONGODB_DB);
}
