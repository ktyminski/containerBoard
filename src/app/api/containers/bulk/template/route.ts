import { Buffer } from "node:buffer";
import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getCurrentUserFromRequest } from "@/lib/auth-user";
import { formatTemplate, getLocaleFromApiRequest, getMessages } from "@/lib/i18n";
import { getCompaniesCollection } from "@/lib/companies";
import {
  CONTAINER_CONDITIONS,
  CONTAINER_FEATURES,
  CONTAINER_HEIGHTS,
  CONTAINER_SIZE,
  CONTAINER_SIZES,
  CONTAINER_TYPES,
  PRICE_CURRENCIES,
  PRICE_TAX_MODES,
} from "@/lib/container-listing-types";

export const runtime = "nodejs";

function normalizeOptionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
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

export async function GET(request: NextRequest) {
  const locale = getLocaleFromApiRequest(request);
  const messages = getMessages(locale).containerModules.bulkTemplate;
  const user = await getCurrentUserFromRequest(request);
  if (!user?._id) {
    return NextResponse.json({ error: getMessages(locale).containerModules.bulkApi.unauthorized }, { status: 401 });
  }

  const companies = await getCompaniesCollection();
  const ownerCompany = await companies.findOne(
    {
      createdByUserId: user._id,
      isBlocked: { $ne: true },
    },
    {
      projection: { _id: 1, name: 1, email: 1, phone: 1, locations: 1 },
      sort: { updatedAt: -1 },
    },
  );
  if (!ownerCompany?._id || !ownerCompany.name?.trim()) {
    return NextResponse.json(
      { error: messages.companyRequired },
      { status: 403 },
    );
  }

  const firstCompanyLocation = ownerCompany.locations?.[0];
  const locationPrefill =
    normalizeOptionalString(firstCompanyLocation?.addressText) ??
    buildAddressFallbackFromParts({
      street: firstCompanyLocation?.addressParts?.street,
      houseNumber: firstCompanyLocation?.addressParts?.houseNumber,
      postalCode: firstCompanyLocation?.addressParts?.postalCode,
      city: firstCompanyLocation?.addressParts?.city,
      country: firstCompanyLocation?.addressParts?.country,
    }) ??
    "Warszawa, Polska";
  const contactEmailPrefill = normalizeOptionalString(ownerCompany.email) ?? user.email;
  const contactPhonePrefill =
    normalizeOptionalString(ownerCompany.phone) ??
    normalizeOptionalString(user.phone) ??
    "";
  const requiredFields = [
    "type",
    "container_size",
    "container_height",
    "container_type",
    "container_condition",
    "quantity",
    "location_address",
  ];

  const optionalFields = [
    "available_now",
    "container_features",
    "container_feature_1",
    "container_feature_2",
    "container_feature_3",
    "container_feature_4",
    "container_feature_5",
    "container_feature_6",
    "available_from",
    "available_from_approximate",
    "price_amount",
    "price_currency",
    "price_tax_mode",
    "price_vat_rate",
    "price_negotiable",
    "container_colors_ral",
    "production_year",
    "has_csc_plate",
    "has_csc_certification",
    "has_warranty",
    "has_branding",
    "csc_valid_to_month",
    "csc_valid_to_year",
    "logistics_transport_available",
    "logistics_transport_included",
    "logistics_transport_free_distance_km",
    "logistics_unloading_available",
    "logistics_unloading_included",
    "logistics_comment",
    "description",
    "contact_email",
    "contact_phone",
  ];

  const header = [...requiredFields, ...optionalFields];

  const sample = [
    "sell",
    "40",
    "HC",
    "dry",
    "cargo_worthy",
    "2",
    locationPrefill,
    "false",
    "double_door|pallet_wide",
    "double_door",
    "pallet_wide",
    "",
    "",
    "",
    "",
    "2026-05-10",
    "false",
    "12500",
    "PLN",
    "net",
    "23",
    "true",
    "RAL 5010,RAL 7035",
    "2022",
    "true",
    "true",
    "false",
    "false",
    "12",
    "2028",
    "true",
    "true",
    "120",
    "true",
    "false",
    "Transport do uzgodnienia",
    "Kontener gotowy do wydania",
    contactEmailPrefill,
    contactPhonePrefill,
  ];

  const requiredDictionary: Array<[string, string, string]> = [
    ["type", "sell", "Bulk import obsługuje tylko oferty sprzedaży"],
    [
      "container_size",
      [String(CONTAINER_SIZE.CUSTOM), ...CONTAINER_SIZES.map(String)].join(", "),
      "0 = custom",
    ],
    ["container_height", CONTAINER_HEIGHTS.join(", "), ""],
    ["container_type", CONTAINER_TYPES.join(", "), ""],
    ["container_condition", CONTAINER_CONDITIONS.join(", "), ""],
    ["quantity", "1-100000", "Liczba całkowita"],
    ["location_address", "Pełny adres tekstowy", "Np. Marszałkowska 1, Warszawa, Polska"],
  ];
  const optionalDictionary: Array<[string, string, string]> = [
    ["available_now", "true, false, 1, 0, tak, nie, yes, no", ""],
    [
      "container_features",
      CONTAINER_FEATURES.join(", "),
      "Pole tekstowe: wiele wartości rozdzielaj | , ; np. double_door|pallet_wide",
    ],
    ["container_feature_1", CONTAINER_FEATURES.join(", "), "Dropdown: 1 cecha = 1 komórka"],
    ["container_feature_2", CONTAINER_FEATURES.join(", "), "Dropdown: opcjonalnie"],
    ["container_feature_3", CONTAINER_FEATURES.join(", "), "Dropdown: opcjonalnie"],
    ["container_feature_4", CONTAINER_FEATURES.join(", "), "Dropdown: opcjonalnie"],
    ["container_feature_5", CONTAINER_FEATURES.join(", "), "Dropdown: opcjonalnie"],
    ["container_feature_6", CONTAINER_FEATURES.join(", "), "Dropdown: opcjonalnie"],
    ["available_from", "YYYY-MM-DD", "Wymagane tylko gdy available_now=false"],
    ["available_from_approximate", "true, false, 1, 0, tak, nie, yes, no", ""],
    ["price_currency", PRICE_CURRENCIES.join(", "), ""],
    ["price_tax_mode", PRICE_TAX_MODES.join(", "), ""],
    ["price_vat_rate", "0-100", "Liczba, np. 23"],
    ["production_year", "1900-2100", "Liczba całkowita"],
    ["csc_valid_to_month", "1-12", "Podawaj razem z csc_valid_to_year"],
    ["csc_valid_to_year", "1900-2100", "Podawaj razem z csc_valid_to_month"],
    ["container_colors_ral", "RAL XXXX (max 10)", "Np. RAL 5010,RAL 7035"],
    ["contact_email", "poprawny email", "Domyślnie email firmy, fallback: email usera"],
    ["contact_phone", "dowolny numer telefonu", "Domyślnie telefon firmy, fallback: telefon usera"],
    ["limit", "Maks 250 rekordów na import", "Nadmiarowe wiersze zostaną odrzucone"],
  ];

  const dictionaryRows: string[][] = [];
  const maxDictionaryRows = Math.max(requiredDictionary.length, optionalDictionary.length);
  for (let index = 0; index < maxDictionaryRows; index += 1) {
    const requiredRow = requiredDictionary[index] ?? ["", "", ""];
    const optionalRow = optionalDictionary[index] ?? ["", "", ""];
    dictionaryRows.push([requiredRow[0], requiredRow[1], requiredRow[2], "", optionalRow[0], optionalRow[1], optionalRow[2]]);
  }

  const workbook = new ExcelJS.Workbook();
  const importSheet = workbook.addWorksheet("Import");
  const dictionarySheet = workbook.addWorksheet("Słownik");
  const listsSheet = workbook.addWorksheet("Listy");
  listsSheet.state = "hidden";

  importSheet.addRow(header);
  importSheet.addRow(sample);
  importSheet.views = [{ state: "frozen", ySplit: 1 }];
  importSheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: header.length },
  };

  const requiredFieldSet = new Set(requiredFields);
  const headerRow = importSheet.getRow(1);
  header.forEach((columnName, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.font = { bold: true, color: { argb: "FF111827" } };
    cell.fill = requiredFieldSet.has(columnName)
      ? { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDE68A" } }
      : { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
    cell.alignment = { vertical: "middle", horizontal: "left" };
  });

  importSheet.columns = header.map((columnName) => ({
    key: columnName,
    width: Math.max(columnName.length + 2, 18),
  }));

  dictionarySheet.addRow([
    "Wymagane pola",
    "Dozwolone wartości",
    "Uwagi",
    "",
    "Opcjonalne pola",
    "Dozwolone wartości",
    "Uwagi",
  ]);
  for (const row of dictionaryRows) {
    dictionarySheet.addRow(row);
  }
  const dictionaryHeader = dictionarySheet.getRow(1);
  [1, 2, 3].forEach((columnIndex) => {
    const cell = dictionaryHeader.getCell(columnIndex);
    cell.font = { bold: true, color: { argb: "FF111827" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF59E0B" },
    };
  });
  [5, 6, 7].forEach((columnIndex) => {
    const cell = dictionaryHeader.getCell(columnIndex);
    cell.font = { bold: true, color: { argb: "FF111827" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFCBD5E1" },
    };
  });
  dictionarySheet.columns = [
    { width: 34 },
    { width: 46 },
    { width: 40 },
    { width: 4 },
    { width: 34 },
    { width: 46 },
    { width: 40 },
  ];

  const boolValues = ["true", "false", "1", "0", "tak", "nie", "yes", "no"];
  const listDefinitions: Array<{ key: string; values: string[] }> = [
    { key: "type", values: ["sell"] },
    {
      key: "container_size",
      values: [String(CONTAINER_SIZE.CUSTOM), ...CONTAINER_SIZES.map(String)],
    },
    { key: "container_height", values: [...CONTAINER_HEIGHTS] },
    { key: "container_type", values: [...CONTAINER_TYPES] },
    { key: "container_condition", values: [...CONTAINER_CONDITIONS] },
    { key: "container_feature", values: [...CONTAINER_FEATURES] },
    { key: "price_currency", values: [...PRICE_CURRENCIES] },
    { key: "price_tax_mode", values: [...PRICE_TAX_MODES] },
    { key: "bool", values: boolValues },
  ];

  listsSheet.columns = listDefinitions.map((definition) => ({ key: definition.key, width: 24 }));
  const maxListLength = Math.max(...listDefinitions.map((definition) => definition.values.length));
  for (let rowIndex = 0; rowIndex < maxListLength; rowIndex += 1) {
    const rowValues = listDefinitions.map((definition) => definition.values[rowIndex] ?? "");
    listsSheet.addRow(rowValues);
  }

  const columnRefByKey = new Map<string, string>();
  listDefinitions.forEach((definition, index) => {
    const columnLetter = String.fromCharCode("A".charCodeAt(0) + index);
    const rowEnd = Math.max(1, definition.values.length);
    columnRefByKey.set(definition.key, `Listy!$${columnLetter}$1:$${columnLetter}$${rowEnd}`);
  });

  const columnIndexByHeader = new Map<string, number>();
  header.forEach((columnName, index) => {
    columnIndexByHeader.set(columnName, index + 1);
  });

  const validationMap: Array<{ field: string; listKey: string }> = [
    { field: "type", listKey: "type" },
    { field: "container_size", listKey: "container_size" },
    { field: "container_height", listKey: "container_height" },
    { field: "container_type", listKey: "container_type" },
    { field: "container_condition", listKey: "container_condition" },
    { field: "container_feature_1", listKey: "container_feature" },
    { field: "container_feature_2", listKey: "container_feature" },
    { field: "container_feature_3", listKey: "container_feature" },
    { field: "container_feature_4", listKey: "container_feature" },
    { field: "container_feature_5", listKey: "container_feature" },
    { field: "container_feature_6", listKey: "container_feature" },
    { field: "available_now", listKey: "bool" },
    { field: "available_from_approximate", listKey: "bool" },
    { field: "price_currency", listKey: "price_currency" },
    { field: "price_tax_mode", listKey: "price_tax_mode" },
    { field: "price_negotiable", listKey: "bool" },
    { field: "has_csc_plate", listKey: "bool" },
    { field: "has_csc_certification", listKey: "bool" },
    { field: "has_warranty", listKey: "bool" },
    { field: "has_branding", listKey: "bool" },
    { field: "logistics_transport_available", listKey: "bool" },
    { field: "logistics_transport_included", listKey: "bool" },
    { field: "logistics_unloading_available", listKey: "bool" },
    { field: "logistics_unloading_included", listKey: "bool" },
  ];

  const maxTemplateRows = 500;
  for (let rowNumber = 2; rowNumber <= maxTemplateRows; rowNumber += 1) {
    for (const validation of validationMap) {
      const columnIndex = columnIndexByHeader.get(validation.field);
      const formulaRef = columnRefByKey.get(validation.listKey);
      if (!columnIndex || !formulaRef) {
        continue;
      }
      importSheet.getCell(rowNumber, columnIndex).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [formulaRef],
        showErrorMessage: true,
        errorTitle: "Nieprawidlowa wartosc",
        error: "Wybierz wartosc z listy dozwolonych opcji.",
      };
    }
  }

  const output = await workbook.xlsx.writeBuffer();
  const outputBytes = new Uint8Array(Buffer.from(output));

  return new NextResponse(outputBytes, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="container-bulk-upload-template.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
