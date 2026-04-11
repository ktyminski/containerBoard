import { MongoClient, ObjectId } from "mongodb";

const mongoUri = process.env.MONGODB_URI;
const mongoDb = process.env.MONGODB_DB;

if (!mongoUri || !mongoDb) {
  throw new Error("Missing MONGODB_URI or MONGODB_DB in environment");
}

const SEED_PREFIX = "[seed-eu]";
const TOTAL_LISTINGS = 200;
const TTL_DAYS = 14;
const SYSTEM_USER_ID = new ObjectId("0000000000000000000000c0");

const containerTypes = ["20DV", "40DV", "40HC", "reefer", "open_top", "flat_rack", "other"];
const dealTypes = ["sale", "rent", "one_way", "long_term"];

const companies = [
  "North Harbor Logistics",
  "Blue Anchor Depot",
  "EuroBox Terminal",
  "Baltic Container Hub",
  "RailPort Connect",
  "OpenGate Freight",
  "Civic Marine Cargo",
  "Summit Yard Services",
  "Dockline Partners",
  "TransEuro Container",
  "Atlas Port Solutions",
  "Meridian Freight Park",
  "Terminal One Cargo",
  "Gateway Dry Box",
  "Continental Box Exchange",
  "Harborline Storage",
  "Metropolis Freight Group",
  "Intermodal Avenue",
  "EastWest Box Market",
  "Portside Logistics",
];

const hubs = [
  { city: "Gdansk", country: "Polska", street: "Portowa", lat: 54.352, lng: 18.6466 },
  { city: "Gdynia", country: "Polska", street: "Kontenerowa", lat: 54.5189, lng: 18.5305 },
  { city: "Szczecin", country: "Polska", street: "Nabrzezna", lat: 53.4285, lng: 14.5528 },
  { city: "Hamburg", country: "Niemcy", street: "Hafenstrasse", lat: 53.5511, lng: 9.9937 },
  { city: "Bremerhaven", country: "Niemcy", street: "Dockstrasse", lat: 53.5396, lng: 8.5809 },
  { city: "Rotterdam", country: "Holandia", street: "Havenweg", lat: 51.9244, lng: 4.4777 },
  { city: "Antwerpia", country: "Belgia", street: "Kaaienlaan", lat: 51.2194, lng: 4.4025 },
  { city: "Amsterdam", country: "Holandia", street: "Terminalweg", lat: 52.3676, lng: 4.9041 },
  { city: "Le Havre", country: "Francja", street: "Rue du Port", lat: 49.4944, lng: 0.1079 },
  { city: "Marsylia", country: "Francja", street: "Avenue Maritime", lat: 43.2965, lng: 5.3698 },
  { city: "Barcelona", country: "Hiszpania", street: "Carrer del Port", lat: 41.3851, lng: 2.1734 },
  { city: "Walencja", country: "Hiszpania", street: "Avinguda de Terminal", lat: 39.4699, lng: -0.3763 },
  { city: "Lizbona", country: "Portugalia", street: "Rua do Porto", lat: 38.7223, lng: -9.1393 },
  { city: "Madryt", country: "Hiszpania", street: "Avenida Logistica", lat: 40.4168, lng: -3.7038 },
  { city: "Mediolan", country: "Wlochy", street: "Via Container", lat: 45.4642, lng: 9.19 },
  { city: "Genua", country: "Wlochy", street: "Via del Molo", lat: 44.4056, lng: 8.9463 },
  { city: "Triest", country: "Wlochy", street: "Via Porto Vecchio", lat: 45.6495, lng: 13.7768 },
  { city: "Ateny", country: "Grecja", street: "Leoforos Limaniou", lat: 37.9838, lng: 23.7275 },
  { city: "Pireus", country: "Grecja", street: "Akti Kondili", lat: 37.942, lng: 23.6465 },
  { city: "Sofia", country: "Bulgaria", street: "Bulevard Transport", lat: 42.6977, lng: 23.3219 },
  { city: "Bukareszt", country: "Rumunia", street: "Strada Terminal", lat: 44.4268, lng: 26.1025 },
  { city: "Konstanca", country: "Rumunia", street: "Bulevard Portului", lat: 44.1598, lng: 28.6348 },
  { city: "Budapeszt", country: "Wegry", street: "Rakpart", lat: 47.4979, lng: 19.0402 },
  { city: "Wieden", country: "Austria", street: "Logistikgasse", lat: 48.2082, lng: 16.3738 },
  { city: "Praga", country: "Czechy", street: "Pristavni", lat: 50.0755, lng: 14.4378 },
  { city: "Bratyslawa", country: "Slowacja", street: "Pristavna", lat: 48.1486, lng: 17.1077 },
  { city: "Ljubljana", country: "Slowenia", street: "Kontejnerska", lat: 46.0569, lng: 14.5058 },
  { city: "Koper", country: "Slowenia", street: "Pristaniska", lat: 45.5481, lng: 13.7302 },
  { city: "Zagrzeb", country: "Chorwacja", street: "Luka Ulica", lat: 45.815, lng: 15.9819 },
  { city: "Rijeka", country: "Chorwacja", street: "Obalna", lat: 45.3271, lng: 14.4422 },
  { city: "Tallin", country: "Estonia", street: "Sadama", lat: 59.437, lng: 24.7536 },
  { city: "Ryga", country: "Lotwa", street: "Ostas", lat: 56.9496, lng: 24.1052 },
  { city: "Wilno", country: "Litwa", street: "Terminalo", lat: 54.6872, lng: 25.2797 },
  { city: "Kopenhaga", country: "Dania", street: "Havnevej", lat: 55.6761, lng: 12.5683 },
  { city: "Oslo", country: "Norwegia", street: "Havnsgata", lat: 59.9139, lng: 10.7522 },
  { city: "Sztokholm", country: "Szwecja", street: "Hamnvagen", lat: 59.3293, lng: 18.0686 },
  { city: "Helsinki", country: "Finlandia", street: "Satamatie", lat: 60.1699, lng: 24.9384 },
  { city: "Dublin", country: "Irlandia", street: "Dock Road", lat: 53.3498, lng: -6.2603 },
  { city: "Londyn", country: "Wielka Brytania", street: "Harbor Lane", lat: 51.5074, lng: -0.1278 },
  { city: "Southampton", country: "Wielka Brytania", street: "Container Quay", lat: 50.9097, lng: -1.4044 },
  { city: "Glasgow", country: "Wielka Brytania", street: "Freight Avenue", lat: 55.8642, lng: -4.2518 },
  { city: "Paryz", country: "Francja", street: "Rue Logistique", lat: 48.8566, lng: 2.3522 },
  { city: "Lyon", country: "Francja", street: "Rue du Terminal", lat: 45.764, lng: 4.8357 },
  { city: "Berlin", country: "Niemcy", street: "Logistikallee", lat: 52.52, lng: 13.405 },
  { city: "Monachium", country: "Niemcy", street: "Containerring", lat: 48.1351, lng: 11.582 },
  { city: "Kolonia", country: "Niemcy", street: "Rheinhafen", lat: 50.9375, lng: 6.9603 },
  { city: "Warszawa", country: "Polska", street: "Terminalowa", lat: 52.2297, lng: 21.0122 },
  { city: "Lodz", country: "Polska", street: "Magazynowa", lat: 51.7592, lng: 19.456 },
  { city: "Wroclaw", country: "Polska", street: "Dokowa", lat: 51.1079, lng: 17.0385 },
  { city: "Poznan", country: "Polska", street: "Transportowa", lat: 52.4064, lng: 16.9252 },
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

function jitterCoordinate(value, spread) {
  return Number((value + randomFloat(-spread, spread)).toFixed(6));
}

function buildListing(index, now) {
  const hub = hubs[index % hubs.length];
  const company = `${pick(companies)} ${hub.city}`;

  const lat = jitterCoordinate(hub.lat, 0.23);
  const lng = jitterCoordinate(hub.lng, 0.28);
  const houseNumber = String(randomInt(1, 199));
  const street = hub.street;
  const listingType = Math.random() < 0.62 ? "available" : "wanted";
  const containerType = pick(containerTypes);
  const dealType = pick(dealTypes);
  const quantity = randomInt(1, 120);
  const createdAt = new Date(now.getTime() - randomInt(0, 4) * 24 * 60 * 60 * 1000 - randomInt(0, 720) * 60 * 1000);
  const updatedAt = new Date(createdAt.getTime() + randomInt(5, 96) * 60 * 1000);
  const availableFrom = new Date(now.getTime() + randomInt(0, 25) * 24 * 60 * 60 * 1000);
  const expiresAt = new Date(createdAt.getTime() + TTL_DAYS * 24 * 60 * 60 * 1000);

  const priceValue =
    dealType === "rent"
      ? `${randomInt(45, 380)} EUR / tydz.`
      : `${randomInt(900, 4200)} EUR`;

  return {
    type: listingType,
    containerType,
    quantity,
    locationCity: hub.city,
    locationCountry: hub.country,
    locationLat: lat,
    locationLng: lng,
    locationAddressLabel: `${street} ${houseNumber}, ${hub.city}, ${hub.country}`,
    locationAddressParts: {
      street,
      houseNumber,
      city: hub.city,
      country: hub.country,
    },
    availableFrom,
    dealType,
    price: priceValue,
    description: `${SEED_PREFIX} ${listingType === "available" ? "Oferta" : "Zapytanie"} ${containerType} w lokalizacji ${hub.city}.`,
    companyName: company,
    contactEmail: `containers+${index + 1}@example.com`,
    contactPhone: `+48 600 ${String(100000 + index).slice(-6)}`,
    status: "active",
    createdByUserId: SYSTEM_USER_ID,
    createdAt,
    updatedAt,
    expiresAt,
  };
}

async function run() {
  const client = new MongoClient(mongoUri);
  await client.connect();

  const db = client.db(mongoDb);
  const listings = db.collection("container_listings");

  await listings.createIndex({ status: 1, expiresAt: 1, createdAt: -1 });
  await listings.createIndex({ createdByUserId: 1, createdAt: -1 });
  await listings.createIndex({ type: 1, containerType: 1, dealType: 1, createdAt: -1 });
  await listings.createIndex({ locationCity: 1, locationCountry: 1 });
  await listings.createIndex({ locationLat: 1, locationLng: 1 });
  await listings.createIndex({ expiresAt: 1 });

  const deleted = await listings.deleteMany({
    description: { $regex: /^\[seed-eu\]/i },
  });

  const now = new Date();
  const docs = Array.from({ length: TOTAL_LISTINGS }, (_, index) => buildListing(index, now));
  const inserted = await listings.insertMany(docs, { ordered: false });

  console.log(
    `Seed complete. Removed ${deleted.deletedCount} old seeded listings and inserted ${inserted.insertedCount} new listings.`,
  );

  await client.close();
}

run().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
