import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import sanitizeHtml from "sanitize-html";
import { read, utils } from "xlsx";
import { getCurrentUserFromRequest } from "@/lib/auth-user";
import { getCompaniesCollection } from "@/lib/companies";
import {
  ensureContainerListingsIndexes,
  getContainerListingsCollection,
  getDefaultListingExpiration,
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
import { getRichTextLength, hasRichTextContent } from "@/lib/listing-rich-text";
import { enforceRateLimitOrResponse } from "@/lib/request-rate-limit";
import { logError } from "@/lib/server-logger";

export const runtime = "nodejs";

const MAX_BULK_ROWS = 250;
const MAX_CSV_CHARS = 1_000_000;
const DESCRIPTION_MAX_TEXT_LENGTH = 1000;
const DESCRIPTION_ALLOWED_TAGS = ["p", "br", "strong", "em", "u", "ul", "li", "div"];

type BulkRowFailure = {
  rowNumber: number;
  error: string;
};

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

function normalizeOptionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeAddressQueryKey(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
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

function normalizeOptionalDescriptionHtml(value?: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || !hasRichTextContent(trimmed)) {
    return undefined;
  }
  const normalizedListsMarkup = trimmed
    .replace(/<ol(\s[^>]*)?>/gi, (_match, attrs: string | undefined) => `<ul${attrs ?? ""}>`)
    .replace(/<\/ol>/gi, "</ul>");
  const sanitized = sanitizeHtml(normalizedListsMarkup, {
    allowedTags: DESCRIPTION_ALLOWED_TAGS,
    allowedAttributes: {},
  }).trim();
  if (!sanitized || !hasRichTextContent(sanitized)) {
    return undefined;
  }
  return sanitized;
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
  return row[index];
}

function parseBulkRow(input: {
  row: string[];
  headerIndex: Map<string, number>;
  fallbackContactEmail: string;
  fallbackContactPhone?: string;
  fallbackLocationAddress?: string;
}): { value?: ParsedBulkRow; error?: string } {
  const get = (key: string) => getCellValue(input.row, input.headerIndex, key);

  const parsedType = normalizeOptionalString(get("type"))
    ? parseListingType(get("type"))
    : "sell";
  if (parsedType !== "sell") {
    return { error: "Bulk import obsluguje tylko oferty typu sell" };
  }
  const containerSize = parseContainerSize(get("container_size"));
  if (containerSize === undefined) {
    return { error: "Nieprawidlowy rozmiar kontenera (container_size)" };
  }
  const containerHeight = parseContainerHeight(get("container_height"));
  if (!containerHeight) {
    return { error: "Nieprawidlowa wysokosc kontenera (container_height)" };
  }
  const containerType = parseContainerType(get("container_type"));
  if (!containerType) {
    return { error: "Nieprawidlowy typ kontenera (container_type)" };
  }
  const containerCondition = parseContainerCondition(get("container_condition"));
  if (!containerCondition) {
    return { error: "Nieprawidlowy stan kontenera (container_condition)" };
  }

  const quantity = parseInteger(get("quantity"));
  if (quantity === undefined || quantity < 1 || quantity > 100_000) {
    return { error: "Nieprawidlowa ilosc (quantity)" };
  }

  const locationAddressQuery =
    normalizeOptionalString(get("location_address")) ??
    normalizeOptionalString(input.fallbackLocationAddress);
  if (!locationAddressQuery || locationAddressQuery.length < 3) {
    return { error: "Nieprawidlowy adres (location_address)" };
  }

  const parsedAvailableNow = parseBooleanFlag(get("available_now"));
  const availableFromDate = parseDateString(get("available_from"));
  const availableNow = parsedAvailableNow !== undefined ? parsedAvailableNow : !availableFromDate;
  if (!availableNow && !availableFromDate) {
    return { error: "Podaj available_from albo ustaw available_now=true" };
  }
  const availableFromApproximate = parseBooleanFlag(get("available_from_approximate")) === true;

  const priceAmount = parseInteger(get("price_amount"));
  const rawPriceAmount = normalizeOptionalString(get("price_amount"));
  if (rawPriceAmount && (priceAmount === undefined || priceAmount < 0 || priceAmount > 100_000_000)) {
    return { error: "Nieprawidlowa kwota (price_amount)" };
  }

  const parsedCurrency = parseCurrency(get("price_currency"));
  const parsedTaxMode = parseTaxMode(get("price_tax_mode"));
  const parsedVatRate = parseNumber(get("price_vat_rate"));
  if (
    normalizeOptionalString(get("price_vat_rate")) &&
    (parsedVatRate === undefined || parsedVatRate < 0 || parsedVatRate > 100)
  ) {
    return { error: "Nieprawidlowa stawka VAT (price_vat_rate)" };
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
    return { error: "Nieprawidlowy rok produkcji (production_year)" };
  }

  const cscValidToMonth = parseInteger(get("csc_valid_to_month"));
  const cscValidToYear = parseInteger(get("csc_valid_to_year"));
  const hasCscMonth = cscValidToMonth !== undefined;
  const hasCscYear = cscValidToYear !== undefined;
  if (hasCscMonth !== hasCscYear) {
    return { error: "Podaj jednoczesnie csc_valid_to_month i csc_valid_to_year" };
  }
  if (hasCscMonth && (cscValidToMonth < 1 || cscValidToMonth > 12)) {
    return { error: "Nieprawidlowy miesiac CSC (csc_valid_to_month)" };
  }
  if (hasCscYear && (cscValidToYear < 1900 || cscValidToYear > 2100)) {
    return { error: "Nieprawidlowy rok CSC (csc_valid_to_year)" };
  }

  const logisticsTransportIncluded = parseBooleanFlag(get("logistics_transport_included")) === true;
  const logisticsTransportAvailable =
    parseBooleanFlag(get("logistics_transport_available")) === true || logisticsTransportIncluded;
  const logisticsTransportFreeDistanceKm = parseInteger(get("logistics_transport_free_distance_km"));
  if (
    logisticsTransportIncluded &&
    (logisticsTransportFreeDistanceKm === undefined || logisticsTransportFreeDistanceKm < 1)
  ) {
    return { error: "Dla transport included podaj logistics_transport_free_distance_km" };
  }
  const logisticsUnloadingIncluded = parseBooleanFlag(get("logistics_unloading_included")) === true;
  const logisticsUnloadingAvailable =
    parseBooleanFlag(get("logistics_unloading_available")) === true || logisticsUnloadingIncluded;

  const containerFeatures = splitMultiValueField(get("container_features"))
    .map((feature) => feature.toLowerCase())
    .filter((feature): feature is ContainerFeature =>
      CONTAINER_FEATURES.includes(feature as ContainerFeature),
    );

  const hasCscPlate = parseBooleanFlag(get("has_csc_plate")) === true;
  const hasCscCertification = parseBooleanFlag(get("has_csc_certification")) === true;
  const hasWarranty = parseBooleanFlag(get("has_warranty")) === true;
  const hasBranding = parseBooleanFlag(get("has_branding")) === true;

  const description = normalizeOptionalDescriptionHtml(get("description"));
  if (description && getRichTextLength(description) > DESCRIPTION_MAX_TEXT_LENGTH) {
    return { error: `Opis przekracza ${DESCRIPTION_MAX_TEXT_LENGTH} znakow` };
  }

  const contactEmail = normalizeOptionalString(get("contact_email")) ?? input.fallbackContactEmail;
  if (!contactEmail || !isValidEmail(contactEmail)) {
    return { error: "Nieprawidlowy contact_email" };
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

async function parseBulkRequestBody(request: NextRequest): Promise<{ csv: string }> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    throw new Error("Import obsluguje tylko plik Excel (multipart/form-data)");
  }

  const formData = await request.formData();
  const uploadFile = formData.get("file");
  if (!(uploadFile instanceof File)) {
    throw new Error("Brak pliku Excel do importu");
  }

  const filename = uploadFile.name.trim().toLowerCase();
  const isSpreadsheet =
    filename.endsWith(".xlsx") ||
    filename.endsWith(".xls") ||
    uploadFile.type.includes("spreadsheet") ||
    uploadFile.type.includes("excel");

  if (!isSpreadsheet) {
    throw new Error("Dozwolone sa tylko pliki Excel (.xlsx, .xls)");
  }

  const buffer = Buffer.from(await uploadFile.arrayBuffer());
  const workbook = read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("Plik Excel nie zawiera arkuszy");
  }
  const firstSheet = workbook.Sheets[firstSheetName];
  const csv = utils.sheet_to_csv(firstSheet, { FS: ";", RS: "\n" }).trim();
  if (!csv) {
    throw new Error("Pierwszy arkusz Excela jest pusty");
  }
  return { csv };
}

export async function POST(request: NextRequest) {
  try {
    await ensureContainerListingsIndexes();

    const ipRateLimitResponse = await enforceRateLimitOrResponse({
      request,
      scope: "containers:bulk-create:ip",
      limit: 20,
      windowMs: 60_000,
    });
    if (ipRateLimitResponse) {
      return ipRateLimitResponse;
    }

    const user = await getCurrentUserFromRequest(request);
    if (!user?._id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.isBlocked === true) {
      return NextResponse.json(
        { error: "Blocked user cannot create listings" },
        { status: 403 },
      );
    }

    const userRateLimitResponse = await enforceRateLimitOrResponse({
      request,
      scope: "containers:bulk-create:user",
      limit: 5,
      windowMs: 60_000,
      identity: user._id.toHexString(),
    });
    if (userRateLimitResponse) {
      return userRateLimitResponse;
    }

    let body: { csv: string };
    try {
      body = await parseBulkRequestBody(request);
    } catch (parseError) {
      return NextResponse.json(
        {
          error:
            parseError instanceof Error
              ? parseError.message
              : "Nie udalo sie odczytac pliku Excel",
        },
        { status: 400 },
      );
    }
    const csv = body.csv?.trim() ?? "";
    if (!csv) {
      return NextResponse.json({ error: "Arkusz Excel jest pusty" }, { status: 400 });
    }
    if (csv.length > MAX_CSV_CHARS) {
      return NextResponse.json(
        { error: `Dane z Excela sa za duze (max ${MAX_CSV_CHARS} znakow po konwersji)` },
        { status: 400 },
      );
    }

    const parsed = parseCsv(csv);
    if (parsed.headers.length === 0) {
      return NextResponse.json({ error: "Brak naglowkow w pliku Excel" }, { status: 400 });
    }
    if (parsed.rows.length === 0) {
      return NextResponse.json({ error: "Plik Excel nie zawiera danych" }, { status: 400 });
    }
    if (parsed.rows.length > MAX_BULK_ROWS) {
      return NextResponse.json(
        { error: `Plik Excel moze zawierac maksymalnie ${MAX_BULK_ROWS} wierszy` },
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
          { error: `Brak wymaganej kolumny: ${requiredHeader}` },
          { status: 400 },
        );
      }
    }

    const companies = await getCompaniesCollection();
    const ownerCompany = await companies.findOne(
      {
        createdByUserId: user._id,
        isBlocked: { $ne: true },
      },
      {
        projection: { _id: 1, name: 1, slug: 1, email: 1, phone: 1, locations: 1 },
        sort: { updatedAt: -1 },
      },
    );
    if (!ownerCompany?._id || !ownerCompany.name?.trim()) {
      return NextResponse.json(
        { error: "Bulk import jest dostepny tylko dla kont z uzupelniona firma" },
        { status: 403 },
      );
    }
    const firstCompanyLocation = ownerCompany.locations?.[0];
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
      normalizeOptionalString(ownerCompany.email) ?? user.email;
    const fallbackContactPhone =
      normalizeOptionalString(ownerCompany.phone) ??
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
      });
      if (!parsedRow.value) {
        failures.push({
          rowNumber: csvRowNumber,
          error: parsedRow.error ?? "Nieznany blad walidacji",
        });
        continue;
      }

      const rowValue = parsedRow.value;

      const parsedContainerColors = parseContainerRalColors(rowValue.containerColorsRal);
      if (parsedContainerColors.tooMany) {
        failures.push({
          rowNumber: csvRowNumber,
          error: `Maksymalnie ${MAX_CONTAINER_RAL_COLORS} kolorow RAL`,
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
          error: `Nie znaleziono lokalizacji dla: "${rowValue.locationAddressQuery}"`,
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
          error: "Nie udalo sie znormalizowac lokalizacji",
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
      const effectiveCompanyName = ownerCompany.name.trim();
      const effectiveCompanySlug = normalizeOptionalString(ownerCompany.slug);

      const document: ContainerListingDocument = {
        _id: listingId,
        type: rowValue.type,
        container: {
          size: rowValue.containerSize,
          height: rowValue.containerHeight,
          type: rowValue.containerType,
          features: rowValue.containerFeatures,
          condition: rowValue.containerCondition,
        },
        ...(parsedContainerColors.colors.length > 0 ? { containerColors: parsedContainerColors.colors } : {}),
        quantity: rowValue.quantity,
        locationCity: primaryLocation.locationCity,
        locationCountry: primaryLocation.locationCountry,
        locationLat: primaryLocation.locationLat,
        locationLng: primaryLocation.locationLng,
        ...(primaryLocation.locationAddressLabel ? { locationAddressLabel: primaryLocation.locationAddressLabel } : {}),
        ...(primaryLocation.locationAddressParts ? { locationAddressParts: primaryLocation.locationAddressParts } : {}),
        locations: normalizedLocations,
        availableNow: rowValue.availableNow,
        availableFromApproximate: rowValue.availableNow ? false : rowValue.availableFromApproximate,
        availableFrom: rowValue.availableNow ? listingNow : rowValue.availableFrom,
        ...(normalizedPricing ? { pricing: normalizedPricing } : {}),
        ...(typeof rowValue.priceAmount === "number" ? { priceAmount: rowValue.priceAmount } : {}),
        priceNegotiable: normalizedPricing?.original.negotiable === true || rowValue.priceNegotiable,
        logisticsTransportAvailable: rowValue.logisticsTransportAvailable,
        logisticsTransportIncluded: rowValue.logisticsTransportAvailable && rowValue.logisticsTransportIncluded,
        ...(typeof rowValue.logisticsTransportFreeDistanceKm === "number"
          ? { logisticsTransportFreeDistanceKm: rowValue.logisticsTransportFreeDistanceKm }
          : {}),
        logisticsUnloadingAvailable: rowValue.logisticsUnloadingAvailable,
        logisticsUnloadingIncluded: rowValue.logisticsUnloadingAvailable && rowValue.logisticsUnloadingIncluded,
        ...(rowValue.logisticsComment ? { logisticsComment: rowValue.logisticsComment } : {}),
        hasCscPlate: rowValue.hasCscPlate,
        hasCscCertification: rowValue.hasCscCertification,
        hasBranding: rowValue.hasBranding,
        hasWarranty: rowValue.hasWarranty,
        ...(typeof rowValue.cscValidToMonth === "number" && typeof rowValue.cscValidToYear === "number"
          ? { cscValidToMonth: rowValue.cscValidToMonth, cscValidToYear: rowValue.cscValidToYear }
          : {}),
        ...(typeof rowValue.productionYear === "number" ? { productionYear: rowValue.productionYear } : {}),
        ...(typeof rowValue.priceAmount === "number" ? { price: String(rowValue.priceAmount) } : {}),
        ...(rowValue.description ? { description: rowValue.description } : {}),
        companyName: effectiveCompanyName,
        ...(effectiveCompanySlug ? { companySlug: effectiveCompanySlug } : {}),
        publishedAsCompany: true,
        contactEmail: rowValue.contactEmail,
        ...(rowValue.contactPhone ? { contactPhone: rowValue.contactPhone } : {}),
        status: LISTING_STATUS.ACTIVE,
        createdByUserId: user._id,
        createdAt: listingNow,
        updatedAt: listingNow,
        expiresAt: getDefaultListingExpiration(listingNow),
      };

      try {
        await listings.insertOne(document);
        createdIds.push(listingId.toHexString());
      } catch (insertError) {
        failures.push({
          rowNumber: csvRowNumber,
          error: insertError instanceof Error ? insertError.message : "Nie udalo sie zapisac rekordu",
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
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown bulk upload error",
      },
      { status: 500 },
    );
  }
}
