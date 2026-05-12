import { MongoClient, ObjectId } from "mongodb";

const mongoUri = process.env.MONGODB_URI;
const mongoDb = process.env.MONGODB_DB;

if (!mongoUri || !mongoDb) {
  throw new Error("Missing MONGODB_URI or MONGODB_DB in environment");
}

const SEED_PREFIX = "[seed-transport]";
const rawArgs = process.argv.slice(2);
const shouldKeepExistingSeed = rawArgs.includes("--keep");
const requestedCount = rawArgs
  .find((arg) => arg.startsWith("--count="))
  ?.slice("--count=".length);
const parsedCount = requestedCount ? Number.parseInt(requestedCount, 10) : NaN;
const TOTAL_COMPANIES =
  Number.isInteger(parsedCount) && parsedCount > 0 ? parsedCount : 36;

const BASE_LOCATIONS = [
  { city: "Gdansk", country: "Polska", countryCode: "PL", lat: 54.352, lng: 18.6466 },
  { city: "Gdynia", country: "Polska", countryCode: "PL", lat: 54.5189, lng: 18.5305 },
  { city: "Szczecin", country: "Polska", countryCode: "PL", lat: 53.4285, lng: 14.5528 },
  { city: "Warszawa", country: "Polska", countryCode: "PL", lat: 52.2297, lng: 21.0122 },
  { city: "Poznan", country: "Polska", countryCode: "PL", lat: 52.4064, lng: 16.9252 },
  { city: "Wroclaw", country: "Polska", countryCode: "PL", lat: 51.1079, lng: 17.0385 },
  { city: "Lodz", country: "Polska", countryCode: "PL", lat: 51.7592, lng: 19.456 },
  { city: "Katowice", country: "Polska", countryCode: "PL", lat: 50.2649, lng: 19.0238 },
  { city: "Rzeszow", country: "Polska", countryCode: "PL", lat: 50.0412, lng: 21.9991 },
  { city: "Hamburg", country: "Niemcy", countryCode: "DE", lat: 53.5511, lng: 9.9937 },
  { city: "Berlin", country: "Niemcy", countryCode: "DE", lat: 52.52, lng: 13.405 },
  { city: "Drezno", country: "Niemcy", countryCode: "DE", lat: 51.0504, lng: 13.7373 },
  { city: "Bremerhaven", country: "Niemcy", countryCode: "DE", lat: 53.5396, lng: 8.5809 },
  { city: "Rotterdam", country: "Holandia", countryCode: "NL", lat: 51.9244, lng: 4.4777 },
  { city: "Antwerpia", country: "Belgia", countryCode: "BE", lat: 51.2194, lng: 4.4025 },
  { city: "Praga", country: "Czechy", countryCode: "CZ", lat: 50.0755, lng: 14.4378 },
  { city: "Ostrawa", country: "Czechy", countryCode: "CZ", lat: 49.8209, lng: 18.2625 },
  { city: "Brno", country: "Czechy", countryCode: "CZ", lat: 49.1951, lng: 16.6068 },
  { city: "Bratyslawa", country: "Slowacja", countryCode: "SK", lat: 48.1486, lng: 17.1077 },
  { city: "Wieden", country: "Austria", countryCode: "AT", lat: 48.2082, lng: 16.3738 },
  { city: "Budapeszt", country: "Wegry", countryCode: "HU", lat: 47.4979, lng: 19.0402 },
];

const NAME_PARTS = [
  "GreenRoute",
  "ContainerWay",
  "EuroLift",
  "PortBridge",
  "RailBox",
  "RoadCrane",
  "Intermodal",
  "DockRunner",
  "CargoNest",
  "BoxLine",
  "TerminalMove",
  "HubCarrier",
];

const SUFFIXES = [
  "Transport",
  "Logistics",
  "Container Service",
  "HDS",
  "Freight",
  "Cargo",
];

const TERMS = [
  "Wycena po potwierdzeniu terminu, masy kontenera i dostepu dla auta.",
  "Mozliwa obsluga awizacji, dokumentow przewozowych i podstawienia HDS.",
  "Stawka zalezy od trasy, terminu, wymagan rozladunku i czasu postoju.",
  "Obsluga tras krajowych i miedzynarodowych po indywidualnym potwierdzeniu.",
];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

function pick(array) {
  return array[randomInt(0, array.length - 1)];
}

function jitterCoordinate(value, spread = 0.12) {
  return Number((value + randomFloat(-spread, spread)).toFixed(6));
}

function buildPrice(index) {
  const base = 3.8 + (index % 7) * 0.35;
  const minimum = 650 + (index % 6) * 120;
  const hds = 350 + (index % 5) * 90;
  return `od ${base.toFixed(2)} PLN/km, minimum ${minimum} PLN; HDS od ${hds} PLN`;
}

function buildCompany(index, now) {
  const base = BASE_LOCATIONS[index % BASE_LOCATIONS.length];
  const name = `${pick(NAME_PARTS)} ${base.city} ${pick(SUFFIXES)}`;
  const hasUnloading = index % 3 !== 1;
  const hasTransport = index % 8 !== 0 || !hasUnloading;

  return {
    _id: new ObjectId(),
    name,
    description: `${SEED_PREFIX} Przewoznik kontenerowy z baza w okolicy: ${base.city}. Obsluguje przewozy kontenerow morskich, magazynowych i technicznych.`,
    services: {
      transport: hasTransport,
      unloading: hasUnloading,
    },
    terms: pick(TERMS),
    transportPrice: buildPrice(index),
    location: {
      label: `${base.city}, ${base.country}`,
      city: base.city,
      country: base.country,
      countryCode: base.countryCode,
      lat: jitterCoordinate(base.lat),
      lng: jitterCoordinate(base.lng),
    },
    phone: `+48 ${randomInt(500, 799)} ${randomInt(100, 999)} ${randomInt(100, 999)}`,
    email: `transport${index + 1}@seed.containerboard.example`,
    isActive: index % 11 !== 0,
    createdAt: now,
    updatedAt: now,
  };
}

async function main() {
  const client = new MongoClient(mongoUri);
  await client.connect();

  const db = client.db(mongoDb);
  const collection = db.collection("transportCompanies");

  await collection.createIndexes([
    { key: { isActive: 1, name: 1 }, name: "transport_companies_active_name" },
    { key: { "location.lat": 1, "location.lng": 1 }, name: "transport_companies_location" },
    { key: { updatedAt: -1 }, name: "transport_companies_updated_at" },
  ]);

  const deleted = shouldKeepExistingSeed
    ? { deletedCount: 0 }
    : await collection.deleteMany({
        description: { $regex: /^\[seed-transport\]/i },
      });

  const now = new Date();
  const docs = Array.from({ length: TOTAL_COMPANIES }, (_, index) =>
    buildCompany(index, now),
  );
  const inserted = await collection.insertMany(docs, { ordered: false });

  console.log(
    `Transport seed complete. ${
      shouldKeepExistingSeed
        ? "Kept existing seeded transport companies."
        : `Removed ${deleted.deletedCount} old seeded transport companies.`
    } Inserted ${inserted.insertedCount} transport companies.`,
  );

  await client.close();
}

main().catch(async (error) => {
  console.error(error);
  process.exitCode = 1;
});
