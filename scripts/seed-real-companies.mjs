import fs from "node:fs/promises";
import path from "node:path";
import { MongoClient } from "mongodb";

const mongoUri = process.env.MONGODB_URI;
const mongoDb = process.env.MONGODB_DB;

if (!mongoUri || !mongoDb) {
  throw new Error("Missing MONGODB_URI or MONGODB_DB in environment");
}

const INPUT_PATH = process.env.SEED_FILE_PATH || "seed/containerboard_real_companies_seed.ndjson";
const SEED_TAG = "real-companies-seed";

const ALLOWED_CATEGORIES = new Set([
  "warehouse",
  "transport",
  "freight-forwarding",
  "logistics",
  "staffing-agency",
  "other",
]);

const ALLOWED_OPERATING_AREAS = new Set([
  "local",
  "poland",
  "eu",
  "international",
]);

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeString(value) {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeNullableString(value) {
  if (value === null || value === undefined) {
    return undefined;
  }
  return normalizeString(value);
}

function normalizeCategory(value) {
  if (typeof value !== "string") {
    return "other";
  }
  return ALLOWED_CATEGORIES.has(value) ? value : "other";
}

function normalizeOperatingArea(value) {
  if (typeof value !== "string") {
    return "local";
  }
  return ALLOWED_OPERATING_AREAS.has(value) ? value : "local";
}

function normalizeCoordinates(input) {
  const coordinates = input?.point?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length !== 2) {
    return null;
  }
  const lng = Number(coordinates[0]);
  const lat = Number(coordinates[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    return null;
  }
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
    return null;
  }
  return [lng, lat];
}

function normalizeAddressParts(addressParts) {
  if (!addressParts || typeof addressParts !== "object") {
    return undefined;
  }
  const street = normalizeNullableString(addressParts.street);
  const houseNumber = normalizeNullableString(addressParts.houseNumber);
  const city = normalizeNullableString(addressParts.city);
  const country = normalizeNullableString(addressParts.country);
  if (!street && !houseNumber && !city && !country) {
    return undefined;
  }
  return { street, houseNumber, city, country };
}

function normalizeLocations(input, sourceLabel) {
  if (!Array.isArray(input) || input.length === 0) {
    throw new Error(`${sourceLabel}: missing locations array`);
  }

  const locations = input
    .map((location, index) => {
      const label = normalizeString(location?.label) || `Location ${index + 1}`;
      const addressText = normalizeString(location?.addressText);
      const coordinates = normalizeCoordinates(location);
      if (!addressText || !coordinates) {
        return null;
      }

      const normalized = {
        label,
        addressText,
        point: {
          type: "Point",
          coordinates,
        },
      };

      const addressParts = normalizeAddressParts(location?.addressParts);
      if (addressParts) {
        normalized.addressParts = addressParts;
      }

      return normalized;
    })
    .filter(Boolean);

  if (locations.length === 0) {
    throw new Error(`${sourceLabel}: no valid locations after normalization`);
  }

  return locations;
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(
    new Set(
      value
        .map((entry) => normalizeString(entry))
        .filter(Boolean),
    ),
  );
}

function parseNdjson(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  return lines.map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error(`Invalid JSON at line ${index + 1}: ${error instanceof Error ? error.message : "unknown parse error"}`);
    }
  });
}

async function buildDocuments(records) {
  const now = new Date();
  const seenSlugs = new Set();
  const documents = [];

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const sourceLabel = `record ${index + 1}`;
    const name = normalizeString(record?.name);
    if (!name) {
      throw new Error(`${sourceLabel}: missing name`);
    }

    const description = normalizeString(record?.description);
    if (!description) {
      throw new Error(`${sourceLabel}: missing description`);
    }

    const baseSlug = slugify(name);
    if (!baseSlug) {
      throw new Error(`${sourceLabel}: could not generate slug`);
    }

    let slug = baseSlug;
    let suffix = 2;
    while (seenSlugs.has(slug)) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }
    seenSlugs.add(slug);

    const tags = normalizeStringArray(record?.tags);
    if (!tags.includes(SEED_TAG)) {
      tags.push(SEED_TAG);
    }

    documents.push({
      externalId: normalizeNullableString(record?.externalId),
      name,
      slug,
      description,
      category: normalizeCategory(record?.category),
      operatingArea: normalizeOperatingArea(record?.operatingArea),
      website: normalizeNullableString(record?.website),
      email: normalizeNullableString(record?.email),
      phone: normalizeNullableString(record?.phone),
      verificationStatus: "not_verified",
      isBlocked: false,
      tags,
      services: normalizeStringArray(record?.services),
      locations: normalizeLocations(record?.locations, sourceLabel),
      createdAt: now,
      updatedAt: now,
    });
  }

  return documents;
}

async function run() {
  const absoluteInputPath = path.resolve(INPUT_PATH);
  const raw = await fs.readFile(absoluteInputPath, "utf8");
  const records = parseNdjson(raw);
  const docs = await buildDocuments(records);

  const client = new MongoClient(mongoUri);
  await client.connect();

  try {
    const db = client.db(mongoDb);
    const companies = db.collection("companies");
    await companies.createIndex({ "locations.point": "2dsphere" });
    await companies.createIndex({ slug: 1 }, { unique: true });
    await companies.createIndex({ tags: 1 });
    await companies.createIndex({ category: 1 });

    let upserted = 0;
    let modified = 0;
    for (const company of docs) {
      const createdAt = company.createdAt;
      const updateFields = { ...company };
      delete updateFields.createdAt;

      const result = await companies.updateOne(
        { slug: company.slug },
        {
          $set: {
            ...updateFields,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt,
          },
        },
        { upsert: true },
      );

      if (result.upsertedCount > 0) {
        upserted += 1;
      } else if (result.modifiedCount > 0) {
        modified += 1;
      }
    }

    console.log(`Real companies seed complete.`);
    console.log(`Input file: ${absoluteInputPath}`);
    console.log(`Processed: ${docs.length}`);
    console.log(`Inserted: ${upserted}`);
    console.log(`Updated: ${modified}`);
  } finally {
    await client.close();
  }
}

run().catch((error) => {
  console.error("Real companies seed failed:", error);
  process.exit(1);
});
