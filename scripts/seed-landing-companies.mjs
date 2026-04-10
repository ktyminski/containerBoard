import { MongoClient } from "mongodb";

const mongoUri = process.env.MONGODB_URI;
const mongoDb = process.env.MONGODB_DB;

if (!mongoUri || !mongoDb) {
  throw new Error("Missing MONGODB_URI or MONGODB_DB in environment");
}

const TARGET_COUNT = Number.parseInt(process.env.LANDING_COMPANIES_COUNT ?? "220", 10);
const DEMO_TAG = "landing-demo";

const CATEGORY_VALUES = [
  "warehouse",
  "transport",
  "freight-forwarding",
  "logistics",
  "staffing-agency",
  "other",
];

const OPERATING_AREAS = ["local", "poland", "eu", "international"];
const COMM_LANGS = ["polish", "english", "german", "ukrainian", "french", "italian", "spanish"];

const SPECIALIZATION_POOL = {
  warehouse: [
    "ecommerce-fulfillment",
    "contract-logistics",
    "cross-docking",
    "temperature-controlled-storage",
    "bonded-warehouse",
    "returns-handling",
    "pallet-distribution",
  ],
  transport: [
    "domestic-transport",
    "international-transport",
    "full-truckload",
    "less-than-truckload",
    "express-transport",
    "container-transport",
    "last-mile-delivery",
    "adr-transport",
  ],
  "freight-forwarding": [
    "international-transport",
    "intermodal-transport",
    "sea-freight",
    "air-freight",
    "rail-freight",
    "customs-clearance",
    "port-logistics",
    "project-cargo",
  ],
  logistics: [
    "contract-logistics",
    "cross-docking",
    "intermodal-transport",
    "customs-clearance",
    "ecommerce-fulfillment",
    "automotive-logistics",
    "pharma-logistics",
  ],
  "staffing-agency": [
    "last-mile-delivery",
    "contract-logistics",
    "warehouse",
    "domestic-transport",
    "pallet-distribution",
  ].filter((entry) => entry !== "warehouse"),
  other: [
    "express-transport",
    "heavy-cargo",
    "project-cargo",
    "oversize-transport",
    "tanker-transport",
    "livestock-transport",
    "hazardous-storage",
  ],
};

const TAG_POOL = [
  "road",
  "ftl",
  "ltl",
  "distribution",
  "cross-dock",
  "warehouse",
  "cold-chain",
  "intermodal",
  "customs",
  "ecommerce",
  "port",
  "rail",
  "air",
  "sea",
  "staffing",
  "express",
  "fleet",
  "logistics",
];

const SERVICE_POOL = [
  "linehaul",
  "warehousing",
  "cross-docking",
  "customs support",
  "pick-pack",
  "returns",
  "express service",
  "last-mile",
  "intermodal service",
  "fleet management",
  "route planning",
  "temperature control",
];

const CITY_POOL = [
  { city: "Warszawa", country: "Poland", lat: 52.2297, lng: 21.0122, weight: 18, dial: "+48" },
  { city: "Krakow", country: "Poland", lat: 50.0647, lng: 19.945, weight: 14, dial: "+48" },
  { city: "Lodz", country: "Poland", lat: 51.7592, lng: 19.456, weight: 10, dial: "+48" },
  { city: "Wroclaw", country: "Poland", lat: 51.1079, lng: 17.0385, weight: 11, dial: "+48" },
  { city: "Poznan", country: "Poland", lat: 52.4064, lng: 16.9252, weight: 11, dial: "+48" },
  { city: "Gdansk", country: "Poland", lat: 54.352, lng: 18.6466, weight: 10, dial: "+48" },
  { city: "Szczecin", country: "Poland", lat: 53.4285, lng: 14.5528, weight: 8, dial: "+48" },
  { city: "Bydgoszcz", country: "Poland", lat: 53.1235, lng: 18.0084, weight: 7, dial: "+48" },
  { city: "Lublin", country: "Poland", lat: 51.2465, lng: 22.5684, weight: 7, dial: "+48" },
  { city: "Bialystok", country: "Poland", lat: 53.1325, lng: 23.1688, weight: 6, dial: "+48" },
  { city: "Katowice", country: "Poland", lat: 50.2649, lng: 19.0238, weight: 7, dial: "+48" },
  { city: "Gdynia", country: "Poland", lat: 54.5189, lng: 18.5305, weight: 5, dial: "+48" },
  { city: "Czestochowa", country: "Poland", lat: 50.8118, lng: 19.1203, weight: 5, dial: "+48" },
  { city: "Radom", country: "Poland", lat: 51.4027, lng: 21.1471, weight: 5, dial: "+48" },
  { city: "Torun", country: "Poland", lat: 53.0138, lng: 18.5984, weight: 4, dial: "+48" },
  { city: "Kielce", country: "Poland", lat: 50.8661, lng: 20.6286, weight: 4, dial: "+48" },
  { city: "Rzeszow", country: "Poland", lat: 50.0412, lng: 21.9991, weight: 4, dial: "+48" },
  { city: "Olsztyn", country: "Poland", lat: 53.7784, lng: 20.48, weight: 4, dial: "+48" },
  { city: "Opole", country: "Poland", lat: 50.6751, lng: 17.9213, weight: 4, dial: "+48" },
  { city: "Zielona Gora", country: "Poland", lat: 51.9356, lng: 15.5062, weight: 4, dial: "+48" },
  { city: "Plock", country: "Poland", lat: 52.5463, lng: 19.7065, weight: 3, dial: "+48" },
  { city: "Elblag", country: "Poland", lat: 54.1522, lng: 19.4088, weight: 3, dial: "+48" },
  { city: "Wloclawek", country: "Poland", lat: 52.6482, lng: 19.0677, weight: 3, dial: "+48" },
  { city: "Tarnow", country: "Poland", lat: 50.0121, lng: 20.9858, weight: 3, dial: "+48" },
  { city: "Kalisz", country: "Poland", lat: 51.7611, lng: 18.091, weight: 3, dial: "+48" },
  { city: "Koszalin", country: "Poland", lat: 54.1944, lng: 16.1722, weight: 3, dial: "+48" },
  { city: "Legnica", country: "Poland", lat: 51.207, lng: 16.155, weight: 3, dial: "+48" },
  { city: "Grudziadz", country: "Poland", lat: 53.4841, lng: 18.7537, weight: 3, dial: "+48" },
  { city: "Slupsk", country: "Poland", lat: 54.4641, lng: 17.0287, weight: 3, dial: "+48" },
  { city: "Jelenia Gora", country: "Poland", lat: 50.9044, lng: 15.7194, weight: 3, dial: "+48" },
  { city: "Siedlce", country: "Poland", lat: 52.1677, lng: 22.2901, weight: 3, dial: "+48" },
  { city: "Przemysl", country: "Poland", lat: 49.7833, lng: 22.7678, weight: 3, dial: "+48" },
  { city: "Suwalki", country: "Poland", lat: 54.1118, lng: 22.93, weight: 3, dial: "+48" },
  { city: "Nowy Sacz", country: "Poland", lat: 49.6244, lng: 20.6972, weight: 3, dial: "+48" },
  { city: "Konin", country: "Poland", lat: 52.223, lng: 18.251, weight: 3, dial: "+48" },
  { city: "Inowroclaw", country: "Poland", lat: 52.7968, lng: 18.2635, weight: 2, dial: "+48" },
  { city: "Chelm", country: "Poland", lat: 51.1431, lng: 23.4712, weight: 2, dial: "+48" },
  { city: "Zamosc", country: "Poland", lat: 50.7231, lng: 23.2519, weight: 2, dial: "+48" },
  { city: "Bielsko-Biala", country: "Poland", lat: 49.8224, lng: 19.0469, weight: 2, dial: "+48" },
  { city: "Gorzow Wielkopolski", country: "Poland", lat: 52.7368, lng: 15.2288, weight: 2, dial: "+48" },
  { city: "Prague", country: "Czechia", lat: 50.0755, lng: 14.4378, weight: 3, dial: "+420" },
  { city: "Brno", country: "Czechia", lat: 49.1951, lng: 16.6068, weight: 2, dial: "+420" },
  { city: "Ostrava", country: "Czechia", lat: 49.8209, lng: 18.2625, weight: 2, dial: "+420" },
  { city: "Olomouc", country: "Czechia", lat: 49.5938, lng: 17.2509, weight: 2, dial: "+420" },
  { city: "Liberec", country: "Czechia", lat: 50.7671, lng: 15.0562, weight: 1, dial: "+420" },
  { city: "Hradec Kralove", country: "Czechia", lat: 50.2092, lng: 15.8328, weight: 1, dial: "+420" },
  { city: "Pardubice", country: "Czechia", lat: 50.0343, lng: 15.7812, weight: 1, dial: "+420" },
  { city: "Ceske Budejovice", country: "Czechia", lat: 48.9747, lng: 14.4749, weight: 1, dial: "+420" },
  { city: "Zilina", country: "Slovakia", lat: 49.2232, lng: 18.7394, weight: 1, dial: "+421" },
  { city: "Poprad", country: "Slovakia", lat: 49.0557, lng: 20.297, weight: 1, dial: "+421" },
  { city: "Cottbus", country: "Germany", lat: 51.7563, lng: 14.3329, weight: 1, dial: "+49" },
  { city: "Frankfurt Oder", country: "Germany", lat: 52.3471, lng: 14.5506, weight: 1, dial: "+49" },
  { city: "Gorlitz", country: "Germany", lat: 51.1526, lng: 14.9885, weight: 1, dial: "+49" },
  { city: "Kaunas", country: "Lithuania", lat: 54.8985, lng: 23.9036, weight: 1, dial: "+370" },
  { city: "Brest", country: "Belarus", lat: 52.0976, lng: 23.7341, weight: 1, dial: "+375" },
  { city: "Grodno", country: "Belarus", lat: 53.6693, lng: 23.8131, weight: 1, dial: "+375" },
  { city: "Lviv", country: "Ukraine", lat: 49.8397, lng: 24.0297, weight: 1, dial: "+380" },
];

const BRAND_LEFT = [
  "Atlas",
  "Baltic",
  "Blue",
  "Bridge",
  "Cargo",
  "Delta",
  "Fleet",
  "Global",
  "Green",
  "Horizon",
  "Logis",
  "Meridian",
  "Metro",
  "Nord",
  "Prime",
  "Rapid",
  "Silver",
  "Solid",
  "Transit",
  "Vector",
];

const STREET_POOL = [
  "Logistyczna",
  "Przemyslowa",
  "Transportowa",
  "Towarowa",
  "Magazynowa",
  "Portowa",
  "Spedycyjna",
  "Kurierska",
  "Dystrybucyjna",
  "Terminalowa",
  "Hubowa",
  "Flotowa",
];

function mulberry32(seed) {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pickOne(array, rng) {
  return array[Math.floor(rng() * array.length)];
}

function pickManyUnique(array, count, rng) {
  const source = [...array];
  const picked = [];
  while (source.length > 0 && picked.length < count) {
    const idx = Math.floor(rng() * source.length);
    picked.push(source[idx]);
    source.splice(idx, 1);
  }
  return picked;
}

function pickWeightedCity(rng) {
  const total = CITY_POOL.reduce((sum, item) => sum + item.weight, 0);
  let roll = rng() * total;
  for (const city of CITY_POOL) {
    roll -= city.weight;
    if (roll <= 0) {
      return city;
    }
  }
  return CITY_POOL[CITY_POOL.length - 1];
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function companySuffix(category) {
  switch (category) {
    case "warehouse":
      return "Fulfillment";
    case "transport":
      return "Transport";
    case "freight-forwarding":
      return "Forwarding";
    case "logistics":
      return "Logistics";
    case "staffing-agency":
      return "Staffing";
    default:
      return "Services";
  }
}

function jitter(base, maxDelta, rng) {
  const delta = (rng() * 2 - 1) * maxDelta;
  return Number((base + delta).toFixed(6));
}

function buildPhone(prefix, rng) {
  const digits = Array.from({ length: 9 }, () => Math.floor(rng() * 10)).join("");
  return `${prefix} ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`;
}

function buildCompany(index, rng) {
  const city = pickWeightedCity(rng);
  const category = pickOne(CATEGORY_VALUES, rng);
  const left = pickOne(BRAND_LEFT, rng);
  const suffix = companySuffix(category);
  const baseName = `${left} ${city.city} ${suffix}`;
  const name = `${baseName} ${index + 1}`;
  const slug = slugify(`landing-demo-${name}`);
  const mainSpecs = SPECIALIZATION_POOL[category];
  const specializationCount = 2 + Math.floor(rng() * 2);
  const specializations = pickManyUnique(mainSpecs, specializationCount, rng);
  const tags = pickManyUnique(TAG_POOL, 3 + Math.floor(rng() * 2), rng);
  const services = pickManyUnique(SERVICE_POOL, 3, rng);
  const operatingArea = pickOne(OPERATING_AREAS, rng);
  const verificationStatus = rng() < 0.78 ? "verified" : "not_verified";
  const communicationLanguages = pickManyUnique(
    COMM_LANGS,
    1 + Math.floor(rng() * 3),
    rng,
  );
  if (!communicationLanguages.includes("polish") && rng() < 0.7) {
    communicationLanguages[0] = "polish";
  }

  const street = pickOne(STREET_POOL, rng);
  const houseNo = `${1 + Math.floor(rng() * 89)}${rng() < 0.25 ? String.fromCharCode(65 + Math.floor(rng() * 3)) : ""}`;
  const countrySuffix = city.country === "Poland" ? "" : `, ${city.country}`;
  const lng = jitter(city.lng, city.country === "Poland" ? 0.18 : 0.1, rng);
  const lat = jitter(city.lat, city.country === "Poland" ? 0.12 : 0.08, rng);

  return {
    name,
    slug,
    description: `${name} provides reliable ${category.replace("-", " ")} services for TSL clients across Central Europe.`,
    website: `https://${slug}.example.com`,
    email: `kontakt@${slug}.example.com`,
    phone: buildPhone(city.dial, rng),
    category,
    verificationStatus,
    operatingArea,
    communicationLanguages,
    tags: Array.from(new Set([DEMO_TAG, ...tags])),
    services,
    specializations,
    locations: [
      {
        label: `${city.city} Hub`,
        addressText: `ul. ${street} ${houseNo}, ${city.city}${countrySuffix}`,
        addressParts: {
          street: street,
          houseNumber: houseNo,
          city: city.city,
          country: city.country,
        },
        point: {
          type: "Point",
          coordinates: [lng, lat],
        },
      },
    ],
    isBlocked: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

async function run() {
  if (!Number.isFinite(TARGET_COUNT) || TARGET_COUNT < 1) {
    throw new Error("LANDING_COMPANIES_COUNT must be a positive integer");
  }

  const client = new MongoClient(mongoUri);
  await client.connect();

  try {
    const db = client.db(mongoDb);
    const companies = db.collection("companies");
    await companies.createIndex({ "locations.point": "2dsphere" });
    await companies.createIndex({ slug: 1 }, { unique: true });
    await companies.createIndex({ tags: 1 });
    await companies.createIndex({ category: 1 });

    const cleanup = await companies.deleteMany({ tags: DEMO_TAG });

    const rng = mulberry32(20260319);
    const docs = Array.from({ length: TARGET_COUNT }, (_, index) => buildCompany(index, rng));
    await companies.insertMany(docs, { ordered: false });

    const categoryCounts = docs.reduce((acc, doc) => {
      acc[doc.category] = (acc[doc.category] ?? 0) + 1;
      return acc;
    }, {});

    const countryCounts = docs.reduce((acc, doc) => {
      const country = doc.locations[0]?.addressParts?.country ?? "Unknown";
      acc[country] = (acc[country] ?? 0) + 1;
      return acc;
    }, {});

    console.log(`Landing companies seed complete.`);
    console.log(`Removed old demo companies: ${cleanup.deletedCount}`);
    console.log(`Inserted demo companies: ${docs.length}`);
    console.log(`Category split: ${JSON.stringify(categoryCounts)}`);
    console.log(`Country split: ${JSON.stringify(countryCounts)}`);
  } finally {
    await client.close();
  }
}

run().catch((error) => {
  console.error("Landing companies seed failed:", error);
  process.exit(1);
});
