import { MongoClient } from "mongodb";

const mongoUri = process.env.MONGODB_URI;
const mongoDb = process.env.MONGODB_DB;

if (!mongoUri || !mongoDb) {
  throw new Error("Missing MONGODB_URI or MONGODB_DB in environment");
}

function normalizeCountryKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const COUNTRY_NAME_TO_CODE = new Map(
  [
    ["Polska", "PL"],
    ["Poland", "PL"],
    ["Niemcy", "DE"],
    ["Germany", "DE"],
    ["Deutschland", "DE"],
    ["Francja", "FR"],
    ["France", "FR"],
    ["Frankreich", "FR"],
    ["Rumunia", "RO"],
    ["Romania", "RO"],
    ["Czechy", "CZ"],
    ["Czech Republic", "CZ"],
    ["Czechia", "CZ"],
    ["Cesko", "CZ"],
    ["Hiszpania", "ES"],
    ["Spain", "ES"],
    ["Espana", "ES"],
    ["España", "ES"],
    ["Holandia", "NL"],
    ["Niderlandy", "NL"],
    ["Netherlands", "NL"],
    ["Holland", "NL"],
    ["Portugalia", "PT"],
    ["Portugal", "PT"],
    ["Wielka Brytania", "GB"],
    ["Great Britain", "GB"],
    ["United Kingdom", "GB"],
    ["UK", "GB"],
    ["England", "GB"],
    ["Belgia", "BE"],
    ["Belgium", "BE"],
    ["Belgien", "BE"],
    ["Wlochy", "IT"],
    ["Włochy", "IT"],
    ["Italy", "IT"],
    ["Italia", "IT"],
    ["Dania", "DK"],
    ["Denmark", "DK"],
    ["Danmark", "DK"],
    ["Grecja", "GR"],
    ["Greece", "GR"],
    ["Griechenland", "GR"],
    ["Szwecja", "SE"],
    ["Sweden", "SE"],
    ["Sverige", "SE"],
    ["Austria", "AT"],
    ["Österreich", "AT"],
    ["Norwegia", "NO"],
    ["Norway", "NO"],
    ["Norwegen", "NO"],
    ["Finlandia", "FI"],
    ["Finland", "FI"],
    ["Szwajcaria", "CH"],
    ["Switzerland", "CH"],
    ["Schweiz", "CH"],
    ["Slowacja", "SK"],
    ["Slovakia", "SK"],
    ["Slowenia", "SI"],
    ["Slovenia", "SI"],
    ["Wegry", "HU"],
    ["Węgry", "HU"],
    ["Hungary", "HU"],
    ["Chorwacja", "HR"],
    ["Croatia", "HR"],
    ["Litwa", "LT"],
    ["Lithuania", "LT"],
    ["Lotwa", "LV"],
    ["Łotwa", "LV"],
    ["Latvia", "LV"],
    ["Estonia", "EE"],
    ["Ukraina", "UA"],
    ["Ukraine", "UA"],
    ["Bulgaria", "BG"],
    ["Bułgaria", "BG"],
    ["Serbia", "RS"],
    ["Irlandia", "IE"],
    ["Ireland", "IE"],
  ].map(([name, code]) => [normalizeCountryKey(name), code]),
);

function getCurrentCountryCode(value) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim().toUpperCase();
  return trimmed ? trimmed : undefined;
}

function resolveCountryCode(input) {
  const countryName =
    input?.locationAddressParts?.country ??
    input?.locationCountry ??
    "";
  const normalizedKey = normalizeCountryKey(countryName);
  if (!normalizedKey) {
    return undefined;
  }

  return COUNTRY_NAME_TO_CODE.get(normalizedKey);
}

function normalizeLocation(location, index) {
  if (!location || typeof location !== "object") {
    return location;
  }

  const currentCountryCode = getCurrentCountryCode(location.locationCountryCode);
  const nextCountryCode = resolveCountryCode(location) ?? currentCountryCode;
  const isPrimary = index === 0 ? true : location.isPrimary === true;

  return {
    ...location,
    ...(nextCountryCode ? { locationCountryCode: nextCountryCode } : {}),
    isPrimary,
  };
}

function areLocationsEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

const client = new MongoClient(mongoUri);

try {
  await client.connect();
  const db = client.db(mongoDb);
  const listings = db.collection("container_listings");

  const cursor = listings.find(
    {},
    {
      projection: {
        locationCountry: 1,
        locationCountryCode: 1,
        locationAddressParts: 1,
        locations: 1,
      },
    },
  );

  let scanned = 0;
  let updated = 0;
  let updatedRootCodes = 0;
  let updatedNestedLocations = 0;
  const bulkOperations = [];

  for await (const doc of cursor) {
    scanned += 1;

    const currentLocations = Array.isArray(doc.locations) ? doc.locations : [];
    const nextLocations = currentLocations.map((location, index) =>
      normalizeLocation(location, index),
    );

    const primaryLocation = nextLocations.find((location) => location?.isPrimary) ?? nextLocations[0] ?? null;
    const currentRootCountryCode = getCurrentCountryCode(doc.locationCountryCode);
    const nextRootCountryCode =
      resolveCountryCode({
        locationCountry: primaryLocation?.locationCountry ?? doc.locationCountry,
        locationAddressParts: primaryLocation?.locationAddressParts ?? doc.locationAddressParts,
      }) ?? currentRootCountryCode;

    const shouldUpdateLocations = !areLocationsEqual(currentLocations, nextLocations);
    const shouldUpdateRootCountryCode = nextRootCountryCode !== currentRootCountryCode;

    if (!shouldUpdateLocations && !shouldUpdateRootCountryCode) {
      continue;
    }

    const setPatch = {};
    if (shouldUpdateLocations) {
      setPatch.locations = nextLocations;
      updatedNestedLocations += 1;
    }
    if (nextRootCountryCode) {
      setPatch.locationCountryCode = nextRootCountryCode;
    }

    const unsetPatch = {};
    if (!nextRootCountryCode && currentRootCountryCode) {
      unsetPatch.locationCountryCode = "";
    }
    if (shouldUpdateRootCountryCode) {
      updatedRootCodes += 1;
    }

    bulkOperations.push({
      updateOne: {
        filter: { _id: doc._id },
        update: {
          ...(Object.keys(setPatch).length > 0 ? { $set: setPatch } : {}),
          ...(Object.keys(unsetPatch).length > 0 ? { $unset: unsetPatch } : {}),
        },
      },
    });
    updated += 1;

    if (bulkOperations.length >= 200) {
      await listings.bulkWrite(bulkOperations, { ordered: false });
      bulkOperations.length = 0;
    }
  }

  if (bulkOperations.length > 0) {
    await listings.bulkWrite(bulkOperations, { ordered: false });
  }

  console.log(
    JSON.stringify(
      {
        scanned,
        updated,
        updatedRootCodes,
        updatedNestedLocations,
      },
      null,
      2,
    ),
  );
} finally {
  await client.close();
}
