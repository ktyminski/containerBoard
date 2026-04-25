import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import sanitizeHtml from "sanitize-html";
import { read, utils } from "xlsx";
import { getCurrentUserFromRequest } from "@/lib/auth-user";
import { getCompaniesCollection } from "@/lib/companies";
import {
  ensureContainerListingsIndexes,
  getContainerListingsCollection,
  type ContainerListingDocument,
} from "@/lib/container-listings";
import {
  CONTAINER_CONDITIONS,
  CONTAINER_FEATURES,
  CONTAINER_SIZE,
  CONTAINER_SIZES,
  CONTAINER_TYPES,
  LISTING_STATUS,
  PRICE_CURRENCIES,
  PRICE_TAX_MODES,
  type ContainerCondition,
  type ContainerFeature,
  type ContainerHeight,
  type ContainerSize,
  type ContainerType,
  type Currency,
  type ListingType,
  type TaxMode,
} from "@/lib/container-listing-types";
import {
  buildLegacyListingPrice,
  normalizeListingPrice,
  type ListingPriceInput,
} from "@/lib/listing-price";
import { searchGeocode, type GeocodeSearchItem } from "@/lib/geocode-search";
import { normalizeGeocodeAddressParts } from "@/lib/geocode-address";
import { MAX_LISTING_LOCATIONS, normalizeListingLocations } from "@/lib/listing-locations";
import { parseContainerRalColors, MAX_CONTAINER_RAL_COLORS } from "@/lib/container-ral-colors";
import { getLatestFxContext } from "@/lib/fx-rates";
import { getRichTextLength } from "@/lib/listing-rich-text";
import {
  LISTING_DESCRIPTION_MAX_TEXT_LENGTH,
  normalizeOptionalListingDescriptionHtml,
} from "@/lib/listing-description-html";
import {
  buildContainerListingDocument,
  normalizeOptionalString,
} from "@/lib/container-listing-write";
import { formatTemplate, getLocaleFromApiRequest, getMessages } from "@/lib/i18n";
import { enforceRateLimitOrResponse } from "@/lib/request-rate-limit";
import { logError } from "@/lib/server-logger";
import { USER_ROLE } from "@/lib/user-roles";

export const runtime = "nodejs";

const MAX_BULK_ROWS = 250;
const MAX_CSV_CHARS = 1_000_000;
const BULK_CONTROL_CHARS_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const CONTAINER_FEATURE_SLOT_KEYS = [
  "container_feature_1",
  "container_feature_2",
  "container_feature_3",
  "container_feature_4",
  "container_feature_5",
  "container_feature_6",
] as const;

type BulkRowFailure = {
  rowNumber: number;
  error: string;
};

type BulkApiMessages = ReturnType<typeof getMessages>["containerModules"]["bulkApi"];

type ParsedCsv = {
  headers: string[];
  rows: string[][];
};

type ParsedBulkRow = {
  type: ListingType;
  containerSize: ContainerSize;
  containerHeight: ContainerHeight;
  containerType: ContainerType;
  containerCondition: ContainerCondition;
  containerFeatures: ContainerFeature[];
  quantity: number;
  locationAddressQuery: string;
  availableNow: boolean;
  availableFromApproximate: boolean;
  availableFrom: Date;
  pricing: ListingPriceInput;
  priceAmount?: number;
  priceNegotiable: boolean;
  containerColorsRal?: string;
  productionYear?: number;
  hasCscPlate: boolean;
  hasCscCertification: boolean;
  hasWarranty: boolean;
  hasBranding: boolean;
  cscValidToMonth?: number;
  cscValidToYear?: number;
  logisticsTransportAvailable: boolean;
  logisticsTransportIncluded: boolean;
  logisticsTransportFreeDistanceKm?: number;
  logisticsUnloadingAvailable: boolean;
  logisticsUnloadingIncluded: boolean;
  logisticsComment?: string;
  description?: string;
  contactEmail: string;
  contactPhone?: string;
};

const HEADER_ALIASES: Record<string, string> = {
  type: "type",
  listing_type: "type",
  rodzaj_ogloszenia: "type",
  container_size: "container_size",
  size: "container_size",
  rozmiar: "container_size",
  container_height: "container_height",
  height: "container_height",
  wysokosc: "container_height",
  container_type: "container_type",
  kind: "container_type",
  typ: "container_type",
  container_condition: "container_condition",
  condition: "container_condition",
  stan: "container_condition",
  container_features: "container_features",
  features: "container_features",
  cechy: "container_features",
  container_feature_1: "container_feature_1",
  container_feature_2: "container_feature_2",
  container_feature_3: "container_feature_3",
  container_feature_4: "container_feature_4",
  container_feature_5: "container_feature_5",
  container_feature_6: "container_feature_6",
  feature_1: "container_feature_1",
  feature_2: "container_feature_2",
  feature_3: "container_feature_3",
  feature_4: "container_feature_4",
  feature_5: "container_feature_5",
  feature_6: "container_feature_6",
  cecha_1: "container_feature_1",
  cecha_2: "container_feature_2",
  cecha_3: "container_feature_3",
  cecha_4: "container_feature_4",
  cecha_5: "container_feature_5",
  cecha_6: "container_feature_6",
  quantity: "quantity",
  ilosc: "quantity",
  location_address: "location_address",
  location_query: "location_address",
  location: "location_address",
  location_label: "location_address",
  location_address_label: "location_address",
  adres: "location_address",
  lokalizacja: "location_address",
  available_now: "available_now",
  dostepny_teraz: "available_now",
  available_from: "available_from",
  dostepny_od: "available_from",
  available_from_approximate: "available_from_approximate",
  available_approximate: "available_from_approximate",
  price_amount: "price_amount",
  amount: "price_amount",
  kwota: "price_amount",
  price_currency: "price_currency",
  currency: "price_currency",
  waluta: "price_currency",
  price_tax_mode: "price_tax_mode",
  tax_mode: "price_tax_mode",
  tryb_vat: "price_tax_mode",
  price_vat_rate: "price_vat_rate",
  vat_rate: "price_vat_rate",
  vat: "price_vat_rate",
  price_negotiable: "price_negotiable",
  negotiable: "price_negotiable",
  container_colors_ral: "container_colors_ral",
  ral: "container_colors_ral",
  kolory_ral: "container_colors_ral",
  production_year: "production_year",
  year: "production_year",
  rok_produkcji: "production_year",
  has_csc_plate: "has_csc_plate",
  csc_plate: "has_csc_plate",
  has_csc_certification: "has_csc_certification",
  csc_certification: "has_csc_certification",
  has_warranty: "has_warranty",
  warranty: "has_warranty",
  gwarancja: "has_warranty",
  has_branding: "has_branding",
  branding: "has_branding",
  branded: "has_branding",
  csc_valid_to_month: "csc_valid_to_month",
  csc_month: "csc_valid_to_month",
  csc_valid_to_year: "csc_valid_to_year",
  csc_year: "csc_valid_to_year",
  logistics_transport_available: "logistics_transport_available",
  transport_available: "logistics_transport_available",
  logistics_transport_included: "logistics_transport_included",
  transport_included: "logistics_transport_included",
  logistics_transport_free_distance_km: "logistics_transport_free_distance_km",
  transport_free_distance_km: "logistics_transport_free_distance_km",
  logistics_unloading_available: "logistics_unloading_available",
  unloading_available: "logistics_unloading_available",
  logistics_unloading_included: "logistics_unloading_included",
  unloading_included: "logistics_unloading_included",
  logistics_comment: "logistics_comment",
  transport_comment: "logistics_comment",
  description: "description",
  opis: "description",
  contact_email: "contact_email",
  email: "contact_email",
  contact_phone: "contact_phone",
  phone: "contact_phone",
};

function normalizeCsvHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^\p{L}\p{N}_]+/gu, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeAddressQueryKey(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function sanitizeBulkRawCellValue(value: string): string {
  return value
    .replace(/^\uFEFF/, "")
    .replace(BULK_CONTROL_CHARS_REGEX, " ");
}

function sanitizeBulkPlainTextValue(value?: string): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const sanitized = sanitizeHtml(sanitizeBulkRawCellValue(value), {
    allowedTags: [],
    allowedAttributes: {},
  }).trim();
  return sanitized || undefined;
}

function buildAddressFallbackFromParts(parts: {
  street?: string;
  houseNumber?: string;
  postalCode?: string;
  city?: string;
  country?: string;
}): string | undefined {
  const street = normalizeOptionalString(parts.street);
  const houseNumber = normalizeOptionalString(parts.houseNumber);
  const postalCode = normalizeOptionalString(parts.postalCode);
  const city = normalizeOptionalString(parts.city);
  const country = normalizeOptionalString(parts.country);
  const streetLine = [street, houseNumber].filter(Boolean).join(" ");
  const cityLine = [postalCode, city].filter(Boolean).join(" ");
  const label = [streetLine, cityLine, country].filter(Boolean).join(", ");
  return label || undefined;
}

function parseBooleanFlag(value: string | undefined): boolean | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (["1", "true", "tak", "yes", "y"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "nie", "no", "n"].includes(normalized)) {
    return false;
  }
  return undefined;
}

function parseInteger(value: string | undefined): number | undefined {
  if (!value || value.trim().length === 0) {
    return undefined;
  }
  const normalized = value.replace(",", ".").trim();
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    return undefined;
  }
  return parsed;
}

function parseNumber(value: string | undefined): number | undefined {
  if (!value || value.trim().length === 0) {
    return undefined;
  }
  const normalized = value.replace(",", ".").trim();
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return parsed;
}

function parseDateString(value: string | undefined): Date | undefined {
  const normalized = value?.trim();
  if (!normalized || !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return undefined;
  }
  const date = new Date(`${normalized}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime())) {
    return undefined;
  }
  return date;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function splitMultiValueField(value: string | undefined): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(/[|,;]+/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseListingType(value: string | undefined): ListingType | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (normalized === "sell" || normalized === "sprzedaz" || normalized === "sprzedaj") {
    return "sell";
  }
  if (normalized === "rent" || normalized === "wynajem" || normalized === "wynajmij") {
    return "rent";
  }
  if (["buy", "kup", "kupie", "szukam", "szukam_kontenera"].includes(normalized)) {
    return "buy";
  }
  return undefined;
}

function parseContainerSize(value: string | undefined): ContainerSize | undefined {
  const parsed = parseInteger(value);
  if (parsed === undefined) {
    return undefined;
  }
  if (parsed === CONTAINER_SIZE.CUSTOM) {
    return CONTAINER_SIZE.CUSTOM;
  }
  if (CONTAINER_SIZES.includes(parsed as (typeof CONTAINER_SIZES)[number])) {
    return parsed as ContainerSize;
  }
  return undefined;
}

function parseContainerHeight(value: string | undefined): ContainerHeight | undefined {
  const normalized = value?.trim();
  if (!normalized) {
    return undefined;
  }
  if (normalized.toLowerCase() === "hc") {
    return "HC";
  }
  if (normalized.toLowerCase() === "standard") {
    return "standard";
  }
  return undefined;
}

function parseContainerType(value: string | undefined): ContainerType | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  return CONTAINER_TYPES.includes(normalized as ContainerType)
    ? (normalized as ContainerType)
    : undefined;
}

function parseContainerCondition(value: string | undefined): ContainerCondition | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  return CONTAINER_CONDITIONS.includes(normalized as ContainerCondition)
    ? (normalized as ContainerCondition)
    : undefined;
}

function parseCurrency(value: string | undefined): Currency | undefined {
  const normalized = value?.trim().toUpperCase();
  if (!normalized) {
    return undefined;
  }
  return PRICE_CURRENCIES.includes(normalized as Currency)
    ? (normalized as Currency)
    : undefined;
}

function parseTaxMode(value: string | undefined): TaxMode | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  return PRICE_TAX_MODES.includes(normalized as TaxMode)
    ? (normalized as TaxMode)
    : undefined;
}

function parseCsvWithDelimiter(input: string, delimiter: string): ParsedCsv {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (inQuotes) {
      if (char === "\"") {
        const nextChar = input[index + 1];
        if (nextChar === "\"") {
          value += "\"";
          index += 1;
          continue;
        }
        inQuotes = false;
        continue;
      }
      value += char;
      continue;
    }
    if (char === "\"") {
      inQuotes = true;
      continue;
    }
    if (char === delimiter) {
      row.push(value);
      value = "";
      continue;
    }
    if (char === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
      continue;
    }
    if (char === "\r") {
      if (input[index + 1] === "\n") {
        index += 1;
      }
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
      continue;
    }
    value += char;
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value);
    rows.push(row);
  }

  const nonEmptyRows = rows.filter((entry) => entry.some((cell) => cell.trim().length > 0));
  const [headerRow, ...dataRows] = nonEmptyRows;
  return {
    headers: headerRow ?? [],
    rows: dataRows,
  };
}

function parseCsv(input: string): ParsedCsv {
  const normalizedInput = input.replace(/^\uFEFF/, "");
  const firstLine = normalizedInput.split(/\r?\n/, 1)[0] ?? "";
  const semicolonCount = (firstLine.match(/;/g) ?? []).length;
  const commaCount = (firstLine.match(/,/g) ?? []).length;
  const delimiter = semicolonCount >= commaCount ? ";" : ",";
  return parseCsvWithDelimiter(normalizedInput, delimiter);
}

function buildHeaderIndex(headers: string[]): Map<string, number> {
  const result = new Map<string, number>();
  headers.forEach((header, index) => {
    const normalized = normalizeCsvHeader(header);
    const canonical = HEADER_ALIASES[normalized] ?? normalized;
    if (!result.has(canonical)) {
      result.set(canonical, index);
    }
  });
  return result;
}

function getCellValue(row: string[], headerIndex: Map<string, number>, key: string): string | undefined {
  const index = headerIndex.get(key);
  if (index === undefined) {
    return undefined;
  }
  const value = row[index];
  return typeof value === "string" ? sanitizeBulkRawCellValue(value) : undefined;
}

function parseBulkRow(input: {
  row: string[];
  headerIndex: Map<string, number>;
  fallbackContactEmail: string;
  fallbackContactPhone?: string;
  fallbackLocationAddress?: string;
  messages: BulkApiMessages;
}): { value?: ParsedBulkRow; error?: string } {
  const getRaw = (key: string) => getCellValue(input.row, input.headerIndex, key);
  const get = (key: string) => sanitizeBulkPlainTextValue(getRaw(key));
  const messages = input.messages;

  const parsedType = normalizeOptionalString(get("type"))
    ? parseListingType(get("type"))
    : "sell";
  if (parsedType !== "sell") {
    return { error: messages.onlySell };
  }
  const containerSize = parseContainerSize(get("container_size"));
  if (containerSize === undefined) {
    return { error: messages.invalidSize };
  }
  const containerHeight = parseContainerHeight(get("container_height"));
  if (!containerHeight) {
    return { error: messages.invalidHeight };
  }
  const containerType = parseContainerType(get("container_type"));
  if (!containerType) {
    return { error: messages.invalidType };
  }
  const containerCondition = parseContainerCondition(get("container_condition"));
  if (!containerCondition) {
    return { error: messages.invalidCondition };
  }

  const quantity = parseInteger(get("quantity"));
  if (quantity === undefined || quantity < 1 || quantity > 100_000) {
    return { error: messages.invalidQuantity };
  }

  const locationAddressQuery =
    normalizeOptionalString(get("location_address")) ??
    normalizeOptionalString(input.fallbackLocationAddress);
  if (!locationAddressQuery || locationAddressQuery.length < 3) {
    return { error: messages.invalidAddress };
  }

  const parsedAvailableNow = parseBooleanFlag(get("available_now"));
  const availableFromDate = parseDateString(get("available_from"));
  const availableNow = parsedAvailableNow !== undefined ? parsedAvailableNow : !availableFromDate;
  if (!availableNow && !availableFromDate) {
    return { error: messages.availableFromRequired };
  }
  const availableFromApproximate = parseBooleanFlag(get("available_from_approximate")) === true;

  const priceAmount = parseInteger(get("price_amount"));
  const rawPriceAmount = normalizeOptionalString(get("price_amount"));
  if (rawPriceAmount && (priceAmount === undefined || priceAmount < 0 || priceAmount > 100_000_000)) {
    return { error: messages.invalidAmount };
  }

  const parsedCurrency = parseCurrency(get("price_currency"));
  const parsedTaxMode = parseTaxMode(get("price_tax_mode"));
  const parsedVatRate = parseNumber(get("price_vat_rate"));
  if (
    normalizeOptionalString(get("price_vat_rate")) &&
    (parsedVatRate === undefined || parsedVatRate < 0 || parsedVatRate > 100)
  ) {
    return { error: messages.invalidVatRate };
  }

  const priceNegotiable = parseBooleanFlag(get("price_negotiable")) === true;
  const currency = priceAmount === undefined ? null : (parsedCurrency ?? "PLN");
  const taxMode = priceAmount === undefined ? null : (parsedTaxMode ?? "net");
  const vatRate = priceAmount === undefined ? null : (parsedVatRate ?? null);

  const productionYear = parseInteger(get("production_year"));
  if (
    normalizeOptionalString(get("production_year")) &&
    (productionYear === undefined || productionYear < 1900 || productionYear > 2100)
  ) {
    return { error: messages.invalidProductionYear };
  }

  const cscValidToMonth = parseInteger(get("csc_valid_to_month"));
  const cscValidToYear = parseInteger(get("csc_valid_to_year"));
  const hasCscMonth = cscValidToMonth !== undefined;
  const hasCscYear = cscValidToYear !== undefined;
  if (hasCscMonth !== hasCscYear) {
    return { error: messages.cscBothRequired };
  }
  if (hasCscMonth && (cscValidToMonth < 1 || cscValidToMonth > 12)) {
    return { error: messages.invalidCscMonth };
  }
  if (hasCscYear && (cscValidToYear < 1900 || cscValidToYear > 2100)) {
    return { error: messages.invalidCscYear };
  }

  const logisticsTransportIncluded = parseBooleanFlag(get("logistics_transport_included")) === true;
  const logisticsTransportAvailable =
    parseBooleanFlag(get("logistics_transport_available")) === true || logisticsTransportIncluded;
  const logisticsTransportFreeDistanceKm = parseInteger(get("logistics_transport_free_distance_km"));
  if (
    logisticsTransportIncluded &&
    (logisticsTransportFreeDistanceKm === undefined || logisticsTransportFreeDistanceKm < 1)
  ) {
    return { error: messages.transportDistanceRequired };
  }
  const logisticsUnloadingIncluded = parseBooleanFlag(get("logistics_unloading_included")) === true;
  const logisticsUnloadingAvailable =
    parseBooleanFlag(get("logistics_unloading_available")) === true || logisticsUnloadingIncluded;

  const parsedFeatureSlots = CONTAINER_FEATURE_SLOT_KEYS.map((key) =>
    normalizeOptionalString(get(key)),
  )
    .filter((feature): feature is string => Boolean(feature))
    .flatMap((feature) => splitMultiValueField(feature));
  const containerFeatures = [
    ...splitMultiValueField(get("container_features")),
    ...parsedFeatureSlots,
  ]
    .map((feature) => feature.toLowerCase())
    .filter((feature): feature is ContainerFeature =>
      CONTAINER_FEATURES.includes(feature as ContainerFeature),
    );

  const hasCscPlate = parseBooleanFlag(get("has_csc_plate")) === true;
  const hasCscCertification = parseBooleanFlag(get("has_csc_certification")) === true;
  const hasWarranty = parseBooleanFlag(get("has_warranty")) === true;
  const hasBranding = parseBooleanFlag(get("has_branding")) === true;

  const description = normalizeOptionalListingDescriptionHtml(getRaw("description"));
  if (
    description &&
    getRichTextLength(description) > LISTING_DESCRIPTION_MAX_TEXT_LENGTH
  ) {
    return {
      error: formatTemplate(messages.descriptionTooLong, {
        count: LISTING_DESCRIPTION_MAX_TEXT_LENGTH,
      }),
    };
  }

  const contactEmail = normalizeOptionalString(get("contact_email")) ?? input.fallbackContactEmail;
  if (!contactEmail || !isValidEmail(contactEmail)) {
    return { error: messages.invalidContactEmail };
  }
  const contactPhone =
    normalizeOptionalString(get("contact_phone")) ??
    normalizeOptionalString(input.fallbackContactPhone);

  return {
    value: {
      type: "sell",
      containerSize,
      containerHeight,
      containerType,
      containerCondition,
      containerFeatures: Array.from(new Set(containerFeatures)),
      quantity,
      locationAddressQuery,
      availableNow,
      availableFromApproximate: availableNow ? false : availableFromApproximate,
      availableFrom: availableNow ? new Date() : (availableFromDate ?? new Date()),
      pricing: {
        original: {
          amount: priceAmount ?? null,
          currency,
          taxMode,
          vatRate,
          negotiable: priceNegotiable,
        },
      },
      priceAmount,
      priceNegotiable,
      containerColorsRal: normalizeOptionalString(get("container_colors_ral")),
      productionYear,
      hasCscPlate,
      hasCscCertification,
      hasWarranty,
      hasBranding,
      cscValidToMonth: hasCscMonth ? cscValidToMonth : undefined,
      cscValidToYear: hasCscYear ? cscValidToYear : undefined,
      logisticsTransportAvailable,
      logisticsTransportIncluded,
      logisticsTransportFreeDistanceKm:
        logisticsTransportIncluded && logisticsTransportFreeDistanceKm !== undefined
          ? logisticsTransportFreeDistanceKm
          : undefined,
      logisticsUnloadingAvailable,
      logisticsUnloadingIncluded,
      logisticsComment: normalizeOptionalString(get("logistics_comment")),
      description,
      contactEmail,
      contactPhone,
    },
  };
}

async function parseBulkRequestBody(
  request: NextRequest,
  messages: BulkApiMessages,
): Promise<{ csv: string; adminCompanyId?: string }> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    throw new Error(messages.excelMultipartRequired);
  }

  const formData = await request.formData();
  const uploadFile = formData.get("file");
  const adminCompanyIdValue = formData.get("adminCompanyId");
  if (!(uploadFile instanceof File)) {
    throw new Error(messages.excelMissing);
  }

  const filename = uploadFile.name.trim().toLowerCase();
  const isSpreadsheet =
    filename.endsWith(".xlsx") ||
    filename.endsWith(".xls") ||
    uploadFile.type.includes("spreadsheet") ||
    uploadFile.type.includes("excel");

  if (!isSpreadsheet) {
    throw new Error(messages.excelOnly);
  }

  const buffer = Buffer.from(await uploadFile.arrayBuffer());
  const workbook = read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error(messages.noSheets);
  }
  const firstSheet = workbook.Sheets[firstSheetName];
  const csv = utils.sheet_to_csv(firstSheet, { FS: ";", RS: "\n" }).trim();
  if (!csv) {
    throw new Error(messages.firstSheetEmpty);
  }
  return {
    csv,
    adminCompanyId:
      typeof adminCompanyIdValue === "string" && adminCompanyIdValue.trim()
        ? adminCompanyIdValue.trim()
        : undefined,
  };
}

export async function POST(request: NextRequest) {
  const locale = getLocaleFromApiRequest(request);
  const moduleMessages = getMessages(locale).containerModules.bulkApi;
  try {
    await ensureContainerListingsIndexes();

    const ipRateLimitResponse = await enforceRateLimitOrResponse({
      request,
      scope: "containers:bulk-create:ip",
      limit: 20,
      windowMs: 60_000,
      onError: "block",
    });
    if (ipRateLimitResponse) {
      return ipRateLimitResponse;
    }

    const user = await getCurrentUserFromRequest(request);
    if (!user?._id) {
      return NextResponse.json({ error: moduleMessages.unauthorized }, { status: 401 });
    }
    if (user.isBlocked === true) {
      return NextResponse.json(
        { error: moduleMessages.blockedUserCannotCreate },
        { status: 403 },
      );
    }

    const userRateLimitResponse = await enforceRateLimitOrResponse({
      request,
      scope: "containers:bulk-create:user",
      limit: 5,
      windowMs: 60_000,
      identity: user._id.toHexString(),
      onError: "block",
    });
    if (userRateLimitResponse) {
      return userRateLimitResponse;
    }

    let body: { csv: string; adminCompanyId?: string };
    try {
      body = await parseBulkRequestBody(request, moduleMessages);
    } catch (parseError) {
      return NextResponse.json(
        {
          error:
            parseError instanceof Error ? parseError.message : moduleMessages.readExcelError,
        },
        { status: 400 },
      );
    }
    const csv = body.csv?.trim() ?? "";
    if (!csv) {
      return NextResponse.json({ error: moduleMessages.emptySheet }, { status: 400 });
    }
    if (csv.length > MAX_CSV_CHARS) {
      return NextResponse.json(
        {
          error: formatTemplate(moduleMessages.excelTooLarge, { count: MAX_CSV_CHARS }),
        },
        { status: 400 },
      );
    }

    const parsed = parseCsv(csv);
    if (parsed.headers.length === 0) {
      return NextResponse.json({ error: moduleMessages.missingHeaders }, { status: 400 });
    }
    if (parsed.rows.length === 0) {
      return NextResponse.json({ error: moduleMessages.noRows }, { status: 400 });
    }
    if (parsed.rows.length > MAX_BULK_ROWS) {
      return NextResponse.json(
        {
          error: formatTemplate(moduleMessages.tooManyRows, { count: MAX_BULK_ROWS }),
        },
        { status: 400 },
      );
    }

    const headerIndex = buildHeaderIndex(parsed.headers);
    for (const requiredHeader of [
      "container_size",
      "container_height",
      "container_type",
      "container_condition",
      "quantity",
      "location_address",
    ]) {
      if (!headerIndex.has(requiredHeader)) {
        return NextResponse.json(
          { error: formatTemplate(moduleMessages.missingRequiredColumn, { column: requiredHeader }) },
          { status: 400 },
        );
      }
    }

    const companies = await getCompaniesCollection();
    const adminSelectedCompanyId =
      typeof body.adminCompanyId === "string" && ObjectId.isValid(body.adminCompanyId)
        ? new ObjectId(body.adminCompanyId)
        : null;
    if (body.adminCompanyId && !adminSelectedCompanyId) {
      return NextResponse.json({ error: moduleMessages.companyRequired }, { status: 400 });
    }
    if (adminSelectedCompanyId && user.role !== USER_ROLE.ADMIN) {
      return NextResponse.json({ error: moduleMessages.unauthorized }, { status: 403 });
    }
    const companyProjection = {
      _id: 1,
      name: 1,
      slug: 1,
      email: 1,
      phone: 1,
      locations: 1,
      createdByUserId: 1,
    } as const;
    const ownerCompany = !adminSelectedCompanyId ? await companies.findOne(
      {
        createdByUserId: user._id,
        isBlocked: { $ne: true },
      },
      {
        projection: companyProjection,
        sort: { updatedAt: -1 },
      },
    ) : null;
    const adminSelectedCompany = adminSelectedCompanyId
      ? await companies.findOne(
          {
            _id: adminSelectedCompanyId,
            isBlocked: { $ne: true },
          },
          {
            projection: companyProjection,
          },
        )
      : null;
    const effectiveCompany = adminSelectedCompany ?? ownerCompany;
    if (!effectiveCompany?._id || !effectiveCompany.name?.trim()) {
      return NextResponse.json(
        { error: "Bulk import jest dostępny tylko dla kont z uzupełnioną firmą" },
        { status: 403 },
      );
    }
    const firstCompanyLocation = effectiveCompany.locations?.[0];
    const fallbackLocationAddress =
      normalizeOptionalString(firstCompanyLocation?.addressText) ??
      buildAddressFallbackFromParts({
        street: firstCompanyLocation?.addressParts?.street,
        houseNumber: firstCompanyLocation?.addressParts?.houseNumber,
        postalCode: firstCompanyLocation?.addressParts?.postalCode,
        city: firstCompanyLocation?.addressParts?.city,
        country: firstCompanyLocation?.addressParts?.country,
      });
    const fallbackContactEmail =
      normalizeOptionalString(effectiveCompany.email) ?? user.email;
    const fallbackContactPhone =
      normalizeOptionalString(effectiveCompany.phone) ??
      normalizeOptionalString(user.phone);

    const now = new Date();
    const fxContext = await getLatestFxContext(now);
    const listings = await getContainerListingsCollection();
    const failures: BulkRowFailure[] = [];
    const createdIds: string[] = [];
    const geocodeCache = new Map<string, GeocodeSearchItem | null>();

    for (let rowIndex = 0; rowIndex < parsed.rows.length; rowIndex += 1) {
      const row = parsed.rows[rowIndex];
      const csvRowNumber = rowIndex + 2;

      const parsedRow = parseBulkRow({
        row,
        headerIndex,
        fallbackContactEmail,
        fallbackContactPhone,
        fallbackLocationAddress,
        messages: moduleMessages,
      });
      if (!parsedRow.value) {
        failures.push({
          rowNumber: csvRowNumber,
          error: parsedRow.error ?? moduleMessages.unknownValidation,
        });
        continue;
      }

      const rowValue = parsedRow.value;

      const parsedContainerColors = parseContainerRalColors(rowValue.containerColorsRal);
      if (parsedContainerColors.tooMany) {
        failures.push({
          rowNumber: csvRowNumber,
          error: formatTemplate(moduleMessages.tooManyRalColors, { count: MAX_CONTAINER_RAL_COLORS }),
        });
        continue;
      }

      const geocodeKey = normalizeAddressQueryKey(rowValue.locationAddressQuery);
      let geocodeResult = geocodeCache.get(geocodeKey);
      if (geocodeResult === undefined) {
        try {
          const geocodeRows = await searchGeocode({
            query: rowValue.locationAddressQuery,
            lang: "pl",
            limit: 1,
          });
          geocodeResult = geocodeRows[0] ?? null;
        } catch {
          geocodeResult = null;
        }
        geocodeCache.set(geocodeKey, geocodeResult);
      }
      if (!geocodeResult) {
        failures.push({
          rowNumber: csvRowNumber,
          error: formatTemplate(moduleMessages.locationNotFound, { location: rowValue.locationAddressQuery }),
        });
        continue;
      }

      const locationAddressParts = normalizeGeocodeAddressParts(
        geocodeResult.addressParts ?? undefined,
      );
      const normalizedLocations = normalizeListingLocations({
        fallback: {
          locationLat: geocodeResult.lat,
          locationLng: geocodeResult.lng,
          locationAddressLabel:
            normalizeOptionalString(geocodeResult.shortLabel) ??
            normalizeOptionalString(geocodeResult.label) ??
            rowValue.locationAddressQuery,
          locationAddressParts,
          locationCity:
            normalizeOptionalString(locationAddressParts?.city) ??
            normalizeOptionalString(geocodeResult.addressParts?.city),
          locationCountry:
            normalizeOptionalString(locationAddressParts?.country) ??
            normalizeOptionalString(geocodeResult.addressParts?.country),
          isPrimary: true,
        },
        max: MAX_LISTING_LOCATIONS,
      });
      const primaryLocation = normalizedLocations[0];
      if (!primaryLocation) {
        failures.push({
          rowNumber: csvRowNumber,
          error: moduleMessages.normalizeLocationError,
        });
        continue;
      }

      const normalizedPricing =
        rowValue.pricing.original.amount === null
          ? buildLegacyListingPrice({
              amount: undefined,
              negotiable: rowValue.priceNegotiable,
              now,
              fxContext,
            })
          : normalizeListingPrice(rowValue.pricing, now, fxContext);

      const listingId = new ObjectId();
      const listingNow = new Date();
      const effectiveCompanyName = effectiveCompany.name.trim();
      const effectiveCompanySlug = normalizeOptionalString(effectiveCompany.slug);
      const document: ContainerListingDocument = buildContainerListingDocument({
        listingId,
        now: listingNow,
        createdByUserId: effectiveCompany.createdByUserId ?? user._id,
        status: LISTING_STATUS.ACTIVE,
        type: rowValue.type,
        container: {
          size: rowValue.containerSize,
          height: rowValue.containerHeight,
          type: rowValue.containerType,
          features: rowValue.containerFeatures,
          condition: rowValue.containerCondition,
        },
        parsedContainerColors: parsedContainerColors.colors,
        quantity: rowValue.quantity,
        normalizedLocations,
        availableNow: rowValue.availableNow,
        availableFromApproximate:
          rowValue.availableNow ? false : rowValue.availableFromApproximate,
        resolvedAvailableFrom:
          rowValue.availableNow ? listingNow : rowValue.availableFrom,
        normalizedPricing,
        normalizedPriceAmount: rowValue.priceAmount,
        priceNegotiable: rowValue.priceNegotiable,
        logisticsTransportAvailable: rowValue.logisticsTransportAvailable,
        logisticsTransportIncluded: rowValue.logisticsTransportIncluded,
        normalizedLogisticsTransportFreeDistanceKm:
          rowValue.logisticsTransportFreeDistanceKm,
        logisticsUnloadingAvailable: rowValue.logisticsUnloadingAvailable,
        logisticsUnloadingIncluded: rowValue.logisticsUnloadingIncluded,
        normalizedLogisticsComment: rowValue.logisticsComment,
        hasCscPlate: rowValue.hasCscPlate,
        hasCscCertification: rowValue.hasCscCertification,
        hasBranding: rowValue.hasBranding,
        hasWarranty: rowValue.hasWarranty,
        normalizedCscValidToMonth: rowValue.cscValidToMonth,
        normalizedCscValidToYear: rowValue.cscValidToYear,
        productionYear: rowValue.productionYear,
        normalizedDescription: rowValue.description,
        companyName: effectiveCompanyName,
        companySlug: effectiveCompanySlug,
        publishedAsCompany: true,
        contactEmail: rowValue.contactEmail,
        contactPhone: rowValue.contactPhone,
      });

      try {
        await listings.insertOne(document);
        createdIds.push(listingId.toHexString());
      } catch (insertError) {
        failures.push({
          rowNumber: csvRowNumber,
          error: insertError instanceof Error ? insertError.message : moduleMessages.saveRecordError,
        });
      }
    }

    return NextResponse.json({
      createdCount: createdIds.length,
      failedCount: failures.length,
      totalRows: parsed.rows.length,
      maxRows: MAX_BULK_ROWS,
      createdIds,
      failures,
    });
  } catch (error) {
    logError("Unhandled API error", { route: "/api/containers/bulk", error });
    return NextResponse.json(
      {
        error: moduleMessages.internalServerError,
        message: error instanceof Error ? error.message : "Unknown bulk upload error",
      },
      { status: 500 },
    );
  }
}
