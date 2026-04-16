import { MongoClient, ObjectId } from "mongodb";

const mongoUri = process.env.MONGODB_URI;
const mongoDb = process.env.MONGODB_DB;

if (!mongoUri || !mongoDb) {
  throw new Error("Missing MONGODB_URI or MONGODB_DB in environment");
}

const TOTAL_LISTINGS = 220;
const TTL_DAYS = 14;
const SYSTEM_USER_ID = new ObjectId("0000000000000000000000c0");

const LISTING_TYPES = ["sell", "rent", "buy"];
const CONTAINER_FEATURES = [
  "double_door",
  "pallet_wide",
  "insulated",
  "ventilated",
  "dangerous_goods",
  "food_grade",
  "open_side_full",
  "crane_lugs",
  "forklift_pockets",
  "removable_roof",
  "high_security_lockbox",
  "extra_vents",
];
const RAL_PALETTE = [
  { ral: "RAL 5010", hex: "#0E294B" },
  { ral: "RAL 7016", hex: "#293133" },
  { ral: "RAL 7035", hex: "#CBD0CC" },
  { ral: "RAL 9005", hex: "#0A0A0D" },
  { ral: "RAL 9010", hex: "#F1F0EA" },
  { ral: "RAL 6018", hex: "#4B9B3D" },
  { ral: "RAL 3020", hex: "#C1121C" },
  { ral: "RAL 2004", hex: "#E25E08" },
  { ral: "RAL 1023", hex: "#F9A900" },
  { ral: "RAL 5015", hex: "#2271B3" },
];
const FX = {
  EUR: { PLN: 4.3, USD: 1.1 },
  PLN: { EUR: 1 / 4.3, USD: 1.1 / 4.3 },
  USD: { EUR: 1 / 1.1, PLN: 4.3 / 1.1 },
};
const LOGISTICS_COMMENTS = [
  "Mozliwy odbior transportem drogowym po uzgodnieniu.",
  "Transport organizowany przez sprzedajacego po potwierdzeniu terminu.",
  "Rozladunek / HDS realizowany na terminalu w godzinach pracy magazynu.",
  "Wsparcie przy rozladunku / HDS i dokumentach po stronie operatora placu.",
  "Koszt transportu zalezy od dystansu i ilosci kontenerow.",
  "Priorytet dla odbiorow calopojazdowych.",
];

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
  { city: "Rotterdam", country: "Holandia", street: "Havenweg", lat: 51.9244, lng: 4.4777 },
  { city: "Antwerpia", country: "Belgia", street: "Kaaienlaan", lat: 51.2194, lng: 4.4025 },
  { city: "Le Havre", country: "Francja", street: "Rue du Port", lat: 49.4944, lng: 0.1079 },
  { city: "Barcelona", country: "Hiszpania", street: "Carrer del Port", lat: 41.3851, lng: 2.1734 },
  { city: "Lizbona", country: "Portugalia", street: "Rua do Porto", lat: 38.7223, lng: -9.1393 },
  { city: "Mediolan", country: "Wlochy", street: "Via Container", lat: 45.4642, lng: 9.19 },
  { city: "Ateny", country: "Grecja", street: "Leoforos Limaniou", lat: 37.9838, lng: 23.7275 },
  { city: "Bukareszt", country: "Rumunia", street: "Strada Terminal", lat: 44.4268, lng: 26.1025 },
  { city: "Praga", country: "Czechy", street: "Pristavni", lat: 50.0755, lng: 14.4378 },
  { city: "Kopenhaga", country: "Dania", street: "Havnevej", lat: 55.6761, lng: 12.5683 },
  { city: "Sztokholm", country: "Szwecja", street: "Hamnvagen", lat: 59.3293, lng: 18.0686 },
  { city: "Londyn", country: "Wielka Brytania", street: "Harbor Lane", lat: 51.5074, lng: -0.1278 },
  { city: "Paryz", country: "Francja", street: "Rue Logistique", lat: 48.8566, lng: 2.3522 },
  { city: "Berlin", country: "Niemcy", street: "Logistikallee", lat: 52.52, lng: 13.405 },
  { city: "Warszawa", country: "Polska", street: "Terminalowa", lat: 52.2297, lng: 21.0122 },
  { city: "Wroclaw", country: "Polska", street: "Dokowa", lat: 51.1079, lng: 17.0385 },
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

function pickWeighted(choices) {
  const total = choices.reduce((sum, choice) => sum + choice.weight, 0);
  let cursor = Math.random() * total;
  for (const choice of choices) {
    cursor -= choice.weight;
    if (cursor <= 0) {
      return choice.value;
    }
  }
  return choices[choices.length - 1].value;
}

function jitterCoordinate(value, spread) {
  return Number((value + randomFloat(-spread, spread)).toFixed(6));
}

function round2(value) {
  return Number(value.toFixed(2));
}

function amountInAllCurrencies(amount, currency) {
  if (currency === "EUR") {
    return {
      amountEur: round2(amount),
      amountPln: round2(amount * FX.EUR.PLN),
      amountUsd: round2(amount * FX.EUR.USD),
    };
  }
  if (currency === "PLN") {
    return {
      amountPln: round2(amount),
      amountEur: round2(amount * FX.PLN.EUR),
      amountUsd: round2(amount * FX.PLN.USD),
    };
  }
  return {
    amountUsd: round2(amount),
    amountEur: round2(amount * FX.USD.EUR),
    amountPln: round2(amount * FX.USD.PLN),
  };
}

function hexToRgb(hex) {
  const normalized = hex.replace(/^#/, "");
  const parsed = Number.parseInt(normalized, 16);
  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255,
  };
}

function pickContainer() {
  const type = pickWeighted([
    { value: "dry", weight: 35 },
    { value: "reefer", weight: 14 },
    { value: "open_top", weight: 10 },
    { value: "flat_rack", weight: 10 },
    { value: "tank", weight: 8 },
    { value: "side_open", weight: 8 },
    { value: "hard_top", weight: 6 },
    { value: "platform", weight: 5 },
    { value: "bulk", weight: 4 },
  ]);
  const size = pickWeighted([
    { value: 10, weight: 4 },
    { value: 20, weight: 28 },
    { value: 40, weight: 40 },
    { value: 45, weight: 16 },
    { value: 53, weight: 12 },
  ]);
  const height =
    size === 10
      ? "standard"
      : pickWeighted([
          { value: "standard", weight: 58 },
          { value: "HC", weight: 42 },
        ]);
  const condition = pickWeighted([
    { value: "new", weight: 16 },
    { value: "one_trip", weight: 24 },
    { value: "cargo_worthy", weight: 34 },
    { value: "wind_water_tight", weight: 18 },
    { value: "as_is", weight: 8 },
  ]);

  const featureCount = randomInt(0, 3);
  const shuffled = [...CONTAINER_FEATURES].sort(() => Math.random() - 0.5);
  const features = shuffled.slice(0, featureCount);

  return {
    size,
    height,
    type,
    condition,
    features,
  };
}

function pickContainerColors() {
  const count = pickWeighted([
    { value: 0, weight: 58 },
    { value: 1, weight: 24 },
    { value: 2, weight: 14 },
    { value: 3, weight: 4 },
  ]);
  if (count === 0) {
    return [];
  }

  return shuffle(RAL_PALETTE)
    .slice(0, count)
    .map((color) => ({
      ral: color.ral,
      hex: color.hex,
      rgb: hexToRgb(color.hex),
    }));
}

function estimateBaseAmount({ container, unit }) {
  const sizeMultiplier = container.size / 20;
  const typeMultiplier = container.type === "reefer" ? 1.45 : container.type === "tank" ? 1.35 : 1.0;
  const conditionMultiplier =
    container.condition === "new"
      ? 1.35
      : container.condition === "one_trip"
        ? 1.18
        : container.condition === "cargo_worthy"
          ? 1.0
          : container.condition === "wind_water_tight"
            ? 0.82
            : 0.65;

  if (unit === "per_month") {
    return round2((220 + randomFloat(40, 620)) * sizeMultiplier * typeMultiplier * conditionMultiplier);
  }

  return round2((1200 + randomFloat(300, 5200)) * sizeMultiplier * typeMultiplier * conditionMultiplier);
}

function buildPricing({ listingType, container, now }) {
  const maybeRequest =
    listingType === "buy"
      ? Math.random() < 0.56
      : listingType === "rent"
        ? Math.random() < 0.18
        : Math.random() < 0.12;
  if (maybeRequest) {
    return {
      pricing: {
        original: {
          amount: null,
          currency: null,
          taxMode: null,
          vatRate: null,
          negotiable: true,
        },
        normalized: {
          net: { amountPln: null, amountEur: null, amountUsd: null },
          gross: { amountPln: null, amountEur: null, amountUsd: null },
          fxDate: now.toISOString().slice(0, 10),
          fxSource: "seed-fixed",
        },
      },
      priceAmount: undefined,
      priceText: "Zapytaj o cene",
      priceNegotiable: true,
    };
  }

  const currency = pickWeighted([
    { value: "EUR", weight: 54 },
    { value: "PLN", weight: 31 },
    { value: "USD", weight: 15 },
  ]);
  const taxMode = pickWeighted([
    { value: "net", weight: 70 },
    { value: "gross", weight: 30 },
  ]);
  const unit =
    listingType === "rent"
      ? "per_month"
      : Math.random() < 0.25
        ? "per_month"
        : "per_container";
  const vatRate = currency === "USD" ? 0 : 23;
  const negotiable = Math.random() < 0.34;

  const originalAmount = estimateBaseAmount({ container, unit });
  const netAmount = taxMode === "net" ? originalAmount : round2(originalAmount / (1 + vatRate / 100));
  const grossAmount = taxMode === "gross" ? originalAmount : round2(originalAmount * (1 + vatRate / 100));

  const normalizedNet = amountInAllCurrencies(netAmount, currency);
  const normalizedGross = amountInAllCurrencies(grossAmount, currency);

  const suffix = unit === "per_month" ? "/mies." : "/kont.";
  const taxSuffix = taxMode === "gross" ? "brutto" : "netto";
  const priceText = `${originalAmount} ${currency} ${suffix} ${taxSuffix}`;

  return {
    pricing: {
      original: {
        amount: originalAmount,
        currency,
        taxMode,
        vatRate,
        negotiable,
      },
      normalized: {
        net: normalizedNet,
        gross: normalizedGross,
        fxDate: now.toISOString().slice(0, 10),
        fxSource: "seed-fixed",
      },
    },
    priceAmount: originalAmount,
    priceText,
    priceNegotiable: negotiable,
  };
}

function shuffle(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

function buildLocationEntry({ hub, lat, lng, isPrimary }) {
  const houseNumber = String(randomInt(1, 199));
  return {
    locationCity: hub.city,
    locationCountry: hub.country,
    locationLat: lat,
    locationLng: lng,
    locationAddressLabel: `${hub.street} ${houseNumber}, ${hub.city}, ${hub.country}`,
    locationAddressParts: {
      street: hub.street,
      houseNumber,
      city: hub.city,
      country: hub.country,
    },
    isPrimary,
  };
}

function buildListingLocations(primaryHub, primaryLat, primaryLng) {
  const additionalLocationsCount = pickWeighted([
    { value: 0, weight: 62 },
    { value: 1, weight: 24 },
    { value: 2, weight: 12 },
    { value: 3, weight: 2 },
  ]);
  const selectedSecondaryHubs = shuffle(hubs.filter((hub) => hub.city !== primaryHub.city))
    .slice(0, additionalLocationsCount);

  const locations = [
    buildLocationEntry({
      hub: primaryHub,
      lat: primaryLat,
      lng: primaryLng,
      isPrimary: true,
    }),
  ];

  for (const secondaryHub of selectedSecondaryHubs) {
    locations.push(
      buildLocationEntry({
        hub: secondaryHub,
        lat: jitterCoordinate(secondaryHub.lat, 0.2),
        lng: jitterCoordinate(secondaryHub.lng, 0.25),
        isPrimary: false,
      }),
    );
  }

  return locations;
}

function pickProductionYear(containerCondition) {
  if (containerCondition === "new") {
    return randomInt(2023, 2026);
  }
  if (containerCondition === "one_trip") {
    return randomInt(2020, 2025);
  }
  if (containerCondition === "cargo_worthy") {
    return randomInt(2012, 2022);
  }
  if (containerCondition === "wind_water_tight") {
    return randomInt(2007, 2018);
  }
  return randomInt(1998, 2012);
}

function buildDescription({ listingType, container, primaryLocation, quantity }) {
  const intentLabel =
    listingType === "buy"
      ? "Zapotrzebowanie"
      : listingType === "rent"
        ? "Oferta wynajmu"
        : "Oferta sprzedazy";
  const featureLabel =
    container.features.length > 0
      ? `Cechy: ${container.features.join(", ")}.`
      : "Kontener bez dodatkowych cech.";

  return `${intentLabel}. ${quantity} szt. Dostepnosc: ${primaryLocation.locationCity}, ${primaryLocation.locationCountry}. ${featureLabel}`;
}

function buildListing(index, now) {
  const hub = hubs[index % hubs.length];
  const company = `${pick(companies)} ${hub.city}`;
  const container = pickContainer();
  const listingType = pickWeighted([
    { value: LISTING_TYPES[0], weight: 64 },
    { value: LISTING_TYPES[1], weight: 21 },
    { value: LISTING_TYPES[2], weight: 15 },
  ]);
  const quantity = randomInt(1, 120);
  const lat = jitterCoordinate(hub.lat, 0.23);
  const lng = jitterCoordinate(hub.lng, 0.28);
  const locations = buildListingLocations(hub, lat, lng);
  const primaryLocation = locations[0];
  const createdAt = new Date(now.getTime() - randomInt(0, 5) * 24 * 60 * 60 * 1000 - randomInt(0, 720) * 60 * 1000);
  const updatedAt = new Date(createdAt.getTime() + randomInt(5, 96) * 60 * 1000);
  const availableNow = Math.random() < 0.2;
  const availableFromApproximate = !availableNow && Math.random() < 0.3;
  const availableFrom = availableNow
    ? new Date(now.getTime() + randomInt(0, 12) * 60 * 60 * 1000)
    : new Date(now.getTime() + randomInt(0, 28) * 24 * 60 * 60 * 1000);
  const expiresAt = new Date(createdAt.getTime() + TTL_DAYS * 24 * 60 * 60 * 1000);
  const logisticsTransportAvailable = Math.random() < 0.72;
  const logisticsTransportIncluded = logisticsTransportAvailable && Math.random() < 0.38;
  const logisticsTransportFreeDistanceKm = logisticsTransportIncluded
    ? randomInt(25, 450)
    : undefined;
  const logisticsUnloadingAvailable = Math.random() < 0.68;
  const logisticsUnloadingIncluded = logisticsUnloadingAvailable && Math.random() < 0.34;
  const logisticsComment =
    logisticsTransportAvailable || logisticsUnloadingAvailable
      ? Math.random() < 0.55
        ? `${pick(LOGISTICS_COMMENTS)} (${primaryLocation.locationCity})`
        : undefined
      : undefined;
  const hasCscPlate = Math.random() < 0.58;
  const hasCscCertification = Math.random() < 0.46;
  const hasWarranty = Math.random() < 0.31;
  const hasAnyCsc = hasCscPlate || hasCscCertification;
  const cscValidToMonth = hasAnyCsc && Math.random() < 0.72 ? randomInt(1, 12) : undefined;
  const cscValidToYear =
    typeof cscValidToMonth === "number" ? randomInt(2026, 2035) : undefined;
  const containerColors = pickContainerColors();
  const pricingPayload = buildPricing({
    listingType,
    container,
    now,
  });

  return {
    _id: new ObjectId(),
    type: listingType,
    container,
    ...(containerColors.length > 0 ? { containerColors } : {}),
    quantity,
    locationCity: primaryLocation.locationCity,
    locationCountry: primaryLocation.locationCountry,
    locationLat: primaryLocation.locationLat,
    locationLng: primaryLocation.locationLng,
    locationAddressLabel: primaryLocation.locationAddressLabel,
    locationAddressParts: primaryLocation.locationAddressParts,
    locations,
    availableNow,
    availableFromApproximate,
    availableFrom,
    pricing: pricingPayload.pricing,
    priceAmount: pricingPayload.priceAmount,
    priceNegotiable: pricingPayload.priceNegotiable,
    logisticsTransportAvailable,
    logisticsTransportIncluded,
    ...(typeof logisticsTransportFreeDistanceKm === "number"
      ? { logisticsTransportFreeDistanceKm }
      : {}),
    logisticsUnloadingAvailable,
    logisticsUnloadingIncluded,
    ...(logisticsComment ? { logisticsComment } : {}),
    hasCscPlate,
    hasCscCertification,
    hasWarranty,
    ...(typeof cscValidToMonth === "number" && typeof cscValidToYear === "number"
      ? { cscValidToMonth, cscValidToYear }
      : {}),
    productionYear: pickProductionYear(container.condition),
    price: pricingPayload.priceText,
    description: buildDescription({
      listingType,
      container,
      primaryLocation,
      quantity,
    }),
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
  const inquiries = db.collection("container_inquiries");

  const deletedInquiries = await inquiries.deleteMany({});
  const deletedListings = await listings.deleteMany({});

  const now = new Date();
  const docs = Array.from({ length: TOTAL_LISTINGS }, (_, index) => buildListing(index, now));
  const inserted = await listings.insertMany(docs, { ordered: false });

  console.log(
    `Reset complete. Removed ${deletedListings.deletedCount} listings and ${deletedInquiries.deletedCount} inquiries. Inserted ${inserted.insertedCount} listings in current model.`,
  );

  await client.close();
}

run().catch((error) => {
  console.error("Reset seed failed:", error);
  process.exit(1);
});

