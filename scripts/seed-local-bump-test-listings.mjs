import { MongoClient, ObjectId } from "mongodb";

const mongoUri = process.env.MONGODB_URI;
const mongoDb = process.env.MONGODB_DB;

if (!mongoUri || !mongoDb) {
  throw new Error("Missing MONGODB_URI or MONGODB_DB in environment");
}

const DAY_MS = 24 * 60 * 60 * 1000;
const now = new Date();

function daysAgo(days) {
  return new Date(now.getTime() - days * DAY_MS);
}

function daysFromNow(days) {
  return new Date(now.getTime() + days * DAY_MS);
}

function buildPricing(amount) {
  return {
    original: {
      amount,
      currency: "PLN",
      taxMode: "net",
      vatRate: 23,
      negotiable: true,
    },
    normalized: {
      net: {
        amountPln: amount,
        amountEur: Math.round(amount / 4.3),
        amountUsd: Math.round(amount / 3.95),
      },
      gross: {
        amountPln: Math.round(amount * 1.23),
        amountEur: Math.round((amount * 1.23) / 4.3),
        amountUsd: Math.round((amount * 1.23) / 3.95),
      },
      fxDate: now.toISOString().slice(0, 10),
      fxSource: "local-test",
    },
  };
}

const CITY_POINTS = {
  Warszawa: { lat: 52.2297, lng: 21.0122 },
  Poznan: { lat: 52.4064, lng: 16.9252 },
  Gdansk: { lat: 54.352, lng: 18.6466 },
  Wroclaw: { lat: 51.1079, lng: 17.0385 },
};

function buildLocation(city) {
  const point = CITY_POINTS[city] ?? CITY_POINTS.Warszawa;
  return {
    locationCity: city,
    locationCountry: "Polska",
    locationCountryCode: "PL",
    locationLat: point.lat,
    locationLng: point.lng,
    locationAddressLabel: `Testowa 12, 00-001 ${city}, Polska`,
    locationAddressParts: {
      street: "Testowa",
      houseNumber: "12",
      postalCode: "00-001",
      city,
      country: "Polska",
      countryCode: "PL",
    },
    isPrimary: true,
  };
}

function buildListing(input, company) {
  const createdAt = daysAgo(input.createdDaysAgo);
  const bumpedAt =
    typeof input.bumpedDaysAgo === "number" ? daysAgo(input.bumpedDaysAgo) : undefined;
  const location = buildLocation(input.city);
  const quantity = input.size === 40 ? 5 : 4;

  return {
    type: "sell",
    container: {
      size: input.size,
      height: "standard",
      type: "dry",
      condition: "cargo_worthy",
      features: ["forklift_pockets", "high_security_lockbox"],
    },
    quantity,
    locationCity: location.locationCity,
    locationCountry: location.locationCountry,
    locationCountryCode: location.locationCountryCode,
    locationLat: location.locationLat,
    locationLng: location.locationLng,
    locationAddressLabel: location.locationAddressLabel,
    locationAddressParts: location.locationAddressParts,
    locations: [location],
    containerTravels: false,
    availableNow: true,
    availableFromApproximate: false,
    availableFrom: now,
    pricing: buildPricing(input.amount),
    priceAmount: input.amount,
    priceNegotiable: true,
    logisticsTransportAvailable: true,
    logisticsTransportIncluded: false,
    logisticsUnloadingAvailable: true,
    logisticsUnloadingIncluded: false,
    hasCscPlate: true,
    hasCscCertification: true,
    hasBranding: false,
    hasWarranty: true,
    containerSerialNumber: input.serial,
    productionYear: 2019,
    price: `${input.amount} PLN netto`,
    description: `[test-bump] ${input.label}`,
    companyName: company.name,
    companySlug: company.slug,
    publishedAsCompany: true,
    adminCreatedForCompanyId: company._id,
    contactEmail: company.email,
    contactPhone: company.phone ?? "+48 600 000 000",
    status: "active",
    createdByUserId: company.createdByUserId,
    createdAt,
    updatedAt: createdAt,
    ...(bumpedAt ? { bumpedAt } : {}),
    expiresAt: daysFromNow(30),
    detailsViewCount: 1,
    contactRevealCount: 0,
  };
}

const scenarios = [
  {
    serial: "TEST-BUMP-OLD-001",
    label: "bumpedAt 25 dni temu, powinno pokazac Przedluz i podbij",
    createdDaysAgo: 25,
    bumpedDaysAgo: 25,
    amount: 6900,
    city: "Warszawa",
    size: 20,
  },
  {
    serial: "TEST-BUMP-RECENT-002",
    label: "bumpedAt 3 dni temu, powinno pokazac tylko Przedluz 30 dni",
    createdDaysAgo: 20,
    bumpedDaysAgo: 3,
    amount: 8200,
    city: "Poznan",
    size: 40,
  },
  {
    serial: "TEST-BUMP-LEGACY-003",
    label: "legacy bez bumpedAt, fallback do createdAt 15 dni temu, powinno pozwolic podbic",
    createdDaysAgo: 15,
    bumpedDaysAgo: null,
    amount: 5400,
    city: "Gdansk",
    size: 20,
  },
  {
    serial: "TEST-BUMP-NEW-004",
    label: "nowe sprzed 2 dni, cooldown jeszcze trwa",
    createdDaysAgo: 2,
    bumpedDaysAgo: 2,
    amount: 11800,
    city: "Wroclaw",
    size: 40,
  },
];

const client = new MongoClient(mongoUri);

try {
  await client.connect();
  const db = client.db(mongoDb);
  const companies = db.collection("companies");
  const listings = db.collection("container_listings");

  const company = await companies.findOne(
    { createdByUserId: { $exists: true }, slug: "firma-axa" },
    {
      projection: {
        name: 1,
        slug: 1,
        createdByUserId: 1,
        email: 1,
        phone: 1,
      },
    },
  );

  if (!company?._id || !company.createdByUserId || !company.slug || !company.email) {
    throw new Error("Local company firma-axa with owner and email was not found");
  }

  let upserted = 0;
  let modified = 0;
  for (const scenario of scenarios) {
    const doc = buildListing(scenario, company);
    const result = await listings.updateOne(
      {
        companySlug: company.slug,
        containerSerialNumber: scenario.serial,
      },
      {
        $set: doc,
        $setOnInsert: {
          _id: new ObjectId(),
        },
      },
      { upsert: true },
    );
    upserted += result.upsertedCount;
    modified += result.modifiedCount;
  }

  const rows = await listings
    .find(
      {
        companySlug: company.slug,
        containerSerialNumber: /^TEST-BUMP-/,
      },
      {
        projection: {
          containerSerialNumber: 1,
          createdAt: 1,
          bumpedAt: 1,
          expiresAt: 1,
          description: 1,
        },
      },
    )
    .sort({ containerSerialNumber: 1 })
    .toArray();

  console.log(
    JSON.stringify(
      {
        companyName: company.name,
        companySlug: company.slug,
        upserted,
        modified,
        rows: rows.map((row) => ({
          serial: row.containerSerialNumber,
          createdAt: row.createdAt,
          bumpedAt: row.bumpedAt ?? null,
          expiresAt: row.expiresAt,
          description: row.description,
        })),
      },
      null,
      2,
    ),
  );
} finally {
  await client.close();
}
