import { MongoClient } from "mongodb";

const mongoUri = process.env.MONGODB_URI;
const mongoDb = process.env.MONGODB_DB;

if (!mongoUri || !mongoDb) {
  throw new Error("Missing MONGODB_URI or MONGODB_DB in environment");
}

const now = new Date();

const seedCompanies = [
  {
    name: "Baltic Freight Hub",
    slug: "baltic-freight-hub",
    description: "Cross-dock and regional distribution near Gdansk port.",
    website: "https://example.com/baltic-freight-hub",
    email: "hello@baltic-freight-hub.example.com",
    phone: "+48 58 100 10 10",
    category: "logistics",
    tags: ["port", "cross-dock", "fcl"],
    services: ["warehousing", "customs support", "linehaul"],
    locations: [
      {
        label: "Gdansk Terminal",
        addressText: "ul. Portowa 10, Gdansk",
        point: { type: "Point", coordinates: [18.6466, 54.352] },
      },
    ],
    createdAt: now,
    updatedAt: now,
  },
  {
    name: "Silesia Cargo Systems",
    slug: "silesia-cargo-systems",
    description: "Industrial logistics and contract warehousing in Upper Silesia.",
    website: "https://example.com/silesia-cargo-systems",
    email: "sales@silesia-cargo.example.com",
    phone: "+48 32 100 22 22",
    category: "warehouse",
    tags: ["contract-logistics", "automotive", "warehouse"],
    services: ["warehousing", "kitting", "milk-run"],
    locations: [
      {
        label: "Katowice DC",
        addressText: "ul. Przemyslowa 3, Katowice",
        point: { type: "Point", coordinates: [19.0238, 50.2649] },
      },
    ],
    createdAt: now,
    updatedAt: now,
  },
  {
    name: "Mazovia Express Lines",
    slug: "mazovia-express-lines",
    description: "National LTL and parcel distribution around Warsaw.",
    website: "https://example.com/mazovia-express-lines",
    email: "ops@mazovia-express.example.com",
    phone: "+48 22 100 33 33",
    category: "transport",
    tags: ["ltl", "parcel", "ecommerce"],
    services: ["linehaul", "last-mile", "returns"],
    locations: [
      {
        label: "Warsaw Hub",
        addressText: "ul. Logistyczna 21, Warszawa",
        point: { type: "Point", coordinates: [21.0122, 52.2297] },
      },
    ],
    createdAt: now,
    updatedAt: now,
  },
  {
    name: "Western Gate Logistics",
    slug: "western-gate-logistics",
    description: "Cross-border trucking and consolidation near Poznan.",
    website: "https://example.com/western-gate-logistics",
    email: "contact@western-gate.example.com",
    phone: "+48 61 200 44 44",
    category: "transport",
    tags: ["road", "cross-border", "ftl"],
    services: ["ftl", "ltl", "consolidation"],
    locations: [
      {
        label: "Poznan Yard",
        addressText: "ul. Transportowa 5, Poznan",
        point: { type: "Point", coordinates: [16.9252, 52.4064] },
      },
    ],
    createdAt: now,
    updatedAt: now,
  },
  {
    name: "NorthSea Fulfillment",
    slug: "northsea-fulfillment",
    description: "E-commerce fulfillment for Benelux and DACH.",
    website: "https://example.com/northsea-fulfillment",
    email: "biz@northsea-fulfillment.example.com",
    phone: "+31 10 100 55 55",
    category: "warehouse",
    tags: ["fulfillment", "ecommerce", "returns"],
    services: ["pick-pack", "returns", "inventory"],
    locations: [
      {
        label: "Rotterdam FC",
        addressText: "Port District, Rotterdam",
        point: { type: "Point", coordinates: [4.4777, 51.9244] },
      },
    ],
    createdAt: now,
    updatedAt: now,
  },
  {
    name: "Prague Rail Connect",
    slug: "prague-rail-connect",
    description: "Rail-road multimodal operations for Central Europe.",
    website: "https://example.com/prague-rail-connect",
    email: "team@prague-rail-connect.example.com",
    phone: "+420 2 100 66 66",
    category: "logistics",
    tags: ["rail", "multimodal", "container"],
    services: ["intermodal", "rail", "container drayage"],
    locations: [
      {
        label: "Prague Intermodal",
        addressText: "Rail Logistics Park, Praha",
        point: { type: "Point", coordinates: [14.4378, 50.0755] },
      },
    ],
    createdAt: now,
    updatedAt: now,
  },
  {
    name: "Danube Chain Logistics",
    slug: "danube-chain-logistics",
    description: "Regional warehousing and transport in Vienna-Bratislava corridor.",
    website: "https://example.com/danube-chain-logistics",
    email: "hello@danube-chain.example.com",
    phone: "+43 1 100 77 77",
    category: "logistics",
    tags: ["warehouse", "regional", "distribution"],
    services: ["warehousing", "distribution", "cross-dock"],
    locations: [
      {
        label: "Vienna South DC",
        addressText: "Logistikzone, Wien",
        point: { type: "Point", coordinates: [16.3738, 48.2082] },
      },
    ],
    createdAt: now,
    updatedAt: now,
  },
  {
    name: "Nordic Route Cargo",
    slug: "nordic-route-cargo",
    description: "Temperature-controlled transport for FMCG and pharma.",
    website: "https://example.com/nordic-route-cargo",
    email: "cold@nordic-route.example.com",
    phone: "+46 8 100 88 88",
    category: "transport",
    tags: ["cold-chain", "fmcg", "pharma"],
    services: ["reefer", "linehaul", "monitoring"],
    locations: [
      {
        label: "Stockholm Hub",
        addressText: "Transport Center, Stockholm",
        point: { type: "Point", coordinates: [18.0686, 59.3293] },
      },
    ],
    createdAt: now,
    updatedAt: now,
  },
  {
    name: "Iberia Link Transit",
    slug: "iberia-link-transit",
    description: "International road freight between Iberia and CEE.",
    website: "https://example.com/iberia-link-transit",
    email: "road@iberia-link.example.com",
    phone: "+34 91 100 99 99",
    category: "transport",
    tags: ["road", "international", "ftl"],
    services: ["ftl", "ltl", "customs support"],
    locations: [
      {
        label: "Madrid Hub",
        addressText: "Cargo Zone, Madrid",
        point: { type: "Point", coordinates: [-3.7038, 40.4168] },
      },
    ],
    createdAt: now,
    updatedAt: now,
  },
  {
    name: "Alpine Freight Group",
    slug: "alpine-freight-group",
    description: "High-value cargo and expedited transport in Alpine region.",
    website: "https://example.com/alpine-freight-group",
    email: "expedite@alpine-freight.example.com",
    phone: "+41 44 200 11 11",
    category: "other",
    tags: ["high-value", "expedited", "road"],
    services: ["express", "security transport", "tracking"],
    locations: [
      {
        label: "Zurich Operations",
        addressText: "Cargo Terminal, Zurich",
        point: { type: "Point", coordinates: [8.5417, 47.3769] },
      },
    ],
    createdAt: now,
    updatedAt: now,
  },
];

async function run() {
  const client = new MongoClient(mongoUri);
  await client.connect();

  const db = client.db(mongoDb);
  const companies = db.collection("companies");

  await companies.createIndex({ "locations.point": "2dsphere" });
  await companies.createIndex({ slug: 1 }, { unique: true });
  await companies.createIndex({ tags: 1 });
  await companies.createIndex({ category: 1 });

  for (const company of seedCompanies) {
    const { createdAt, ...updatableFields } = company;
    await companies.updateOne(
      { slug: company.slug },
      { $set: updatableFields, $setOnInsert: { createdAt } },
      { upsert: true },
    );
  }

  console.log(`Seed complete. Upserted ${seedCompanies.length} companies.`);
  await client.close();
}

run().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
