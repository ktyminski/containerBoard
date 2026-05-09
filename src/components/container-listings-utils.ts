import type { ContainerListingItem } from "@/lib/container-listings";
import { parseContainerRalColors } from "@/lib/container-ral-colors";
import type { ContainerListingsMessages } from "@/components/container-listings-i18n";
import {
  FILTER_FORM_DEFAULTS,
  LOCATION_RADIUS_OPTIONS,
  type AppliedFilters,
  type FilterCurrency,
  type FormContainerSize,
  type FormLocationRadiusKm,
  type FiltersFormValues,
  type ListingKind,
  type PriceDisplayCurrency,
  type SortPreset,
  toNormalizedArray,
} from "@/components/container-listings-shared";
import {
  CONTAINER_CONDITIONS,
  CONTAINER_FEATURES,
  CONTAINER_HEIGHTS,
  CONTAINER_TYPES,
  PRICE_CURRENCIES,
  PRICE_TAX_MODES,
} from "@/lib/container-listing-types";
import { getCountryDisplayName } from "@/lib/country-flags";
import { formatTemplate, type AppLocale } from "@/lib/i18n";

type SortParams = {
  sortBy: string;
  sortDir: "asc" | "desc";
};

type BuildContainersApiUrlOptions = {
  appliedFilters: AppliedFilters;
  page?: number;
  pageSize?: number;
  mapView?: boolean;
  favoritesOnly?: boolean;
  localFavoriteIds?: string[];
  mineOnly?: boolean;
  companySlug?: string;
  deliveryReach?: boolean;
};

type PageFiltersParseOptions = {
  initialKind?: ListingKind;
  initialCity?: string;
  initialCountry?: string;
  initialCountryCode?: string;
};

type ParsedPageFilters = {
  formValues: FiltersFormValues;
  appliedFilters: AppliedFilters;
  resolvedLocationMode: "point" | "country" | null;
};

type BuildPageSearchParamsOptions = {
  appliedFilters: AppliedFilters;
  activeTab?: "all" | "favorites";
  mineOnly?: boolean;
  companySlug?: string;
};

const CONTAINER_SIZE_FILTER_VALUES = [
  "10",
  "20",
  "40",
  "45",
  "53",
  "custom",
] as const satisfies readonly FormContainerSize[];
const FILTER_CURRENCIES = [
  "all",
  ...PRICE_CURRENCIES,
] as const satisfies readonly FilterCurrency[];
const PRICE_DISPLAY_CURRENCIES = [
  "original",
  ...PRICE_CURRENCIES,
] as const satisfies readonly PriceDisplayCurrency[];
const SORT_PRESETS = [
  "newest",
  "quantity_desc",
  "quantity_asc",
  "available_asc",
  "price_net_asc",
  "price_net_desc",
] as const satisfies readonly SortPreset[];
const LOCATION_RADIUS_PARAM_VALUES = LOCATION_RADIUS_OPTIONS.map(String) as
  readonly FormLocationRadiusKm[];

function getFirstSearchParam(
  params: URLSearchParams,
  names: string[],
): string | null {
  for (const name of names) {
    const value = params.get(name)?.trim();
    if (value) {
      return value;
    }
  }
  return null;
}

function isAllowedValue<T extends string>(
  values: readonly T[],
  value: string | null,
): value is T {
  return Boolean(value && values.includes(value as T));
}

function parseCsvParam<T extends string>(
  params: URLSearchParams,
  names: string[],
  allowedValues: readonly T[],
): T[] {
  const raw = getFirstSearchParam(params, names);
  if (!raw) {
    return [];
  }

  const allowedSet = new Set<string>(allowedValues);
  return toNormalizedArray(
    raw
      .split(",")
      .map((value) => value.trim())
      .filter((value): value is T => allowedSet.has(value)),
  );
}

function parseCsvStrings(params: URLSearchParams, names: string[]): string[] {
  const raw = getFirstSearchParam(params, names);
  if (!raw) {
    return [];
  }

  return toNormalizedArray(
    raw
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function parseBooleanParam(params: URLSearchParams, names: string[]): boolean {
  const raw = getFirstSearchParam(params, names)?.toLowerCase();
  return raw === "1" || raw === "true";
}

function parseFiniteParam(params: URLSearchParams, name: string): number | null {
  const raw = params.get(name);
  if (!raw) {
    return null;
  }

  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function parseListingKind(value: string | null, fallback: ListingKind): ListingKind {
  return value === "sell" || value === "rent" || value === "buy"
    ? value
    : fallback;
}

function parseSortPreset(
  params: URLSearchParams,
): SortPreset {
  const raw = getFirstSearchParam(params, ["sort", "sortPreset"]);
  if (isAllowedValue(SORT_PRESETS, raw)) {
    return raw;
  }

  const sortBy = params.get("sortBy");
  const sortDir = params.get("sortDir");
  if (sortBy === "priceNet" && sortDir === "asc") {
    return "price_net_asc";
  }
  if (sortBy === "priceNet" && sortDir === "desc") {
    return "price_net_desc";
  }
  if (sortBy === "quantity" && sortDir === "asc") {
    return "quantity_asc";
  }
  if (sortBy === "quantity" && sortDir === "desc") {
    return "quantity_desc";
  }
  if (sortBy === "availableFrom" && sortDir === "asc") {
    return "available_asc";
  }
  return FILTER_FORM_DEFAULTS.sortPreset;
}

function setCsvParam<T extends string>(
  params: URLSearchParams,
  name: string,
  values: T[],
): void {
  if (values.length > 0) {
    params.set(name, values.join(","));
  }
}

function formatLocationCoordinate(value: number): string {
  return value.toFixed(4);
}

export function getSortParams(preset: SortPreset): SortParams {
  if (preset === "price_net_asc") {
    return { sortBy: "priceNet", sortDir: "asc" };
  }
  if (preset === "price_net_desc") {
    return { sortBy: "priceNet", sortDir: "desc" };
  }
  if (preset === "quantity_desc") {
    return { sortBy: "quantity", sortDir: "desc" };
  }
  if (preset === "quantity_asc") {
    return { sortBy: "quantity", sortDir: "asc" };
  }
  if (preset === "available_asc") {
    return { sortBy: "availableFrom", sortDir: "asc" };
  }
  return { sortBy: "createdAt", sortDir: "desc" };
}

export function parseContainerListingsPageFilters(
  params: URLSearchParams,
  options: PageFiltersParseOptions = {},
): ParsedPageFilters {
  const fallbackKind = options.initialKind ?? FILTER_FORM_DEFAULTS.listingKind;
  const listingKind = parseListingKind(
    getFirstSearchParam(params, ["kind", "type"]),
    fallbackKind,
  );
  const radiusParam = getFirstSearchParam(params, [
    "radiusKm",
    "locationRadiusKm",
  ]);
  const locationRadiusKm = isAllowedValue(
    LOCATION_RADIUS_PARAM_VALUES,
    radiusParam,
  )
    ? radiusParam
    : FILTER_FORM_DEFAULTS.locationRadiusKmInput;
  const locationQuery = getFirstSearchParam(params, ["q", "location"]) ?? "";
  const locationLat = parseFiniteParam(params, "locationLat");
  const locationLng = parseFiniteParam(params, "locationLng");
  const locationCenter =
    locationLat !== null && locationLng !== null
      ? { lat: locationLat, lng: locationLng }
      : null;
  const city =
    getFirstSearchParam(params, ["city"]) ??
    options.initialCity ??
    FILTER_FORM_DEFAULTS.city;
  const country =
    getFirstSearchParam(params, ["country"]) ??
    options.initialCountry ??
    FILTER_FORM_DEFAULTS.country;
  const countryCode = (
    getFirstSearchParam(params, ["countryCode"]) ??
    options.initialCountryCode ??
    FILTER_FORM_DEFAULTS.countryCode
  )
    .trim()
    .toUpperCase();
  const visibleLocationInput =
    locationQuery ||
    [city, country].filter((value) => value.trim().length > 0).join(", ");
  const containerRalColors = parseCsvStrings(params, ["containerRal"]);
  const rawPriceCurrency = getFirstSearchParam(params, ["priceCurrency"]);
  const rawPriceDisplayCurrency = getFirstSearchParam(params, [
    "priceDisplayCurrency",
    "displayCurrency",
  ]);
  const rawPriceTaxMode = getFirstSearchParam(params, ["priceTaxMode"]);
  const priceCurrency = isAllowedValue(FILTER_CURRENCIES, rawPriceCurrency)
    ? rawPriceCurrency
    : FILTER_FORM_DEFAULTS.priceCurrency;
  const priceDisplayCurrency = isAllowedValue(
    PRICE_DISPLAY_CURRENCIES,
    rawPriceDisplayCurrency,
  )
    ? rawPriceDisplayCurrency
    : FILTER_FORM_DEFAULTS.priceDisplayCurrency;
  const priceTaxMode = isAllowedValue(PRICE_TAX_MODES, rawPriceTaxMode)
    ? rawPriceTaxMode
    : FILTER_FORM_DEFAULTS.priceTaxMode;
  const priceMinInput =
    getFirstSearchParam(params, ["priceMin"]) ??
    FILTER_FORM_DEFAULTS.priceMinInput;
  const priceMaxInput =
    getFirstSearchParam(params, ["priceMax"]) ??
    FILTER_FORM_DEFAULTS.priceMaxInput;
  const productionYearInput =
    getFirstSearchParam(params, ["productionYear"]) ??
    FILTER_FORM_DEFAULTS.productionYearInput;
  const sortPreset = parseSortPreset(params);
  const resolvedLocationMode = locationCenter
    ? "point"
    : city || country || countryCode
      ? "country"
      : null;

  const formValues: FiltersFormValues = {
    ...FILTER_FORM_DEFAULTS,
    listingKind,
    locationInput: visibleLocationInput,
    locationRadiusKmInput: locationRadiusKm,
    containerSizes: parseCsvParam(params, ["containerSize"], CONTAINER_SIZE_FILTER_VALUES),
    containerHeights: parseCsvParam(params, ["containerHeight"], CONTAINER_HEIGHTS),
    containerTypes: parseCsvParam(params, ["containerType"], CONTAINER_TYPES),
    containerConditions: parseCsvParam(
      params,
      ["containerCondition"],
      CONTAINER_CONDITIONS,
    ),
    containerFeatures: parseCsvParam(params, ["containerFeature"], CONTAINER_FEATURES),
    containerRalInput: containerRalColors.join(", "),
    priceNegotiableOnly: parseBooleanParam(params, ["priceNegotiable"]),
    logisticsTransportOnly: parseBooleanParam(params, ["logisticsTransport"]),
    logisticsUnloadingOnly: parseBooleanParam(params, ["logisticsUnloading"]),
    hasCscPlateOnly: parseBooleanParam(params, ["hasCscPlate"]),
    hasCscCertificationOnly: parseBooleanParam(params, ["hasCscCertification"]),
    priceCurrency,
    priceDisplayCurrency,
    priceTaxMode,
    priceMinInput,
    priceMaxInput,
    productionYearInput,
    city,
    country,
    countryCode,
    sortPreset,
  };

  return {
    formValues,
    resolvedLocationMode,
    appliedFilters: {
      listingKind,
      locationQuery: visibleLocationInput,
      locationCenter,
      locationRadiusKm,
      containerSizes: formValues.containerSizes,
      containerHeights: formValues.containerHeights,
      containerTypes: formValues.containerTypes,
      containerConditions: formValues.containerConditions,
      containerFeatures: formValues.containerFeatures,
      containerRalColors,
      priceNegotiableOnly: formValues.priceNegotiableOnly,
      logisticsTransportOnly: formValues.logisticsTransportOnly,
      logisticsUnloadingOnly: formValues.logisticsUnloadingOnly,
      hasCscPlateOnly: formValues.hasCscPlateOnly,
      hasCscCertificationOnly: formValues.hasCscCertificationOnly,
      priceCurrency,
      priceDisplayCurrency,
      priceTaxMode:
        priceMinInput || priceMaxInput ? priceTaxMode : FILTER_FORM_DEFAULTS.priceTaxMode,
      priceMinInput,
      priceMaxInput,
      productionYearInput,
      city,
      country,
      countryCode,
      sortPreset,
    },
  };
}

export function buildContainerListingsPageSearchParams({
  appliedFilters,
  activeTab = "all",
  mineOnly = false,
  companySlug,
}: BuildPageSearchParamsOptions): URLSearchParams {
  const params = new URLSearchParams();

  if (activeTab === "favorites") {
    params.set("tab", "favorites");
  }
  if (mineOnly) {
    params.set("mine", "1");
  }
  if (companySlug?.trim()) {
    params.set("company", companySlug.trim());
  }
  if (appliedFilters.listingKind !== FILTER_FORM_DEFAULTS.listingKind) {
    params.set("kind", appliedFilters.listingKind);
  }

  const city = appliedFilters.city.trim();
  const country = appliedFilters.country.trim();
  const countryCode = appliedFilters.countryCode.trim().toUpperCase();
  const hasAdministrativeLocation = Boolean(city || country || countryCode);
  if (appliedFilters.locationQuery.trim() && !hasAdministrativeLocation) {
    params.set("q", appliedFilters.locationQuery.trim());
  }
  if (appliedFilters.locationCenter && !hasAdministrativeLocation) {
    params.set("locationLat", formatLocationCoordinate(appliedFilters.locationCenter.lat));
    params.set("locationLng", formatLocationCoordinate(appliedFilters.locationCenter.lng));
    params.set("radiusKm", appliedFilters.locationRadiusKm);
  }

  if (city) {
    params.set("city", city);
  }
  if (country) {
    params.set("country", country);
  }
  if (countryCode) {
    params.set("countryCode", countryCode);
  }

  setCsvParam(params, "containerSize", appliedFilters.containerSizes);
  setCsvParam(params, "containerHeight", appliedFilters.containerHeights);
  setCsvParam(params, "containerType", appliedFilters.containerTypes);
  setCsvParam(params, "containerCondition", appliedFilters.containerConditions);
  setCsvParam(params, "containerFeature", appliedFilters.containerFeatures);
  setCsvParam(params, "containerRal", appliedFilters.containerRalColors);
  if (appliedFilters.priceNegotiableOnly) {
    params.set("priceNegotiable", "1");
  }
  if (appliedFilters.logisticsTransportOnly) {
    params.set("logisticsTransport", "1");
  }
  if (appliedFilters.logisticsUnloadingOnly) {
    params.set("logisticsUnloading", "1");
  }
  if (appliedFilters.hasCscPlateOnly) {
    params.set("hasCscPlate", "1");
  }
  if (appliedFilters.hasCscCertificationOnly) {
    params.set("hasCscCertification", "1");
  }
  if (appliedFilters.priceDisplayCurrency !== FILTER_FORM_DEFAULTS.priceDisplayCurrency) {
    params.set("priceDisplayCurrency", appliedFilters.priceDisplayCurrency);
  }

  const hasPriceRange =
    appliedFilters.priceMinInput.trim().length > 0 ||
    appliedFilters.priceMaxInput.trim().length > 0;
  if (hasPriceRange) {
    params.set("priceCurrency", appliedFilters.priceCurrency);
    params.set("priceTaxMode", appliedFilters.priceTaxMode);
  }
  if (appliedFilters.priceMinInput.trim()) {
    params.set("priceMin", appliedFilters.priceMinInput.trim());
  }
  if (appliedFilters.priceMaxInput.trim()) {
    params.set("priceMax", appliedFilters.priceMaxInput.trim());
  }
  if (appliedFilters.productionYearInput.trim()) {
    params.set("productionYear", appliedFilters.productionYearInput.trim());
  }
  if (appliedFilters.sortPreset !== FILTER_FORM_DEFAULTS.sortPreset) {
    params.set("sort", appliedFilters.sortPreset);
  }

  return params;
}

export function getCoordinateKey(lat: number, lng: number): string {
  return `${lat.toFixed(6)}:${lng.toFixed(6)}`;
}

export function getContainerListingLocationLabel(
  item: ContainerListingItem,
  messages?: ContainerListingsMessages["utils"],
  locale?: AppLocale,
): string {
  const primaryLocation = item.locations?.find((location) => location.isPrimary) ?? item.locations?.[0];
  const postalCode =
    primaryLocation?.locationAddressParts?.postalCode?.trim() ||
    item.locationAddressParts?.postalCode?.trim() ||
    "";
  const city =
    primaryLocation?.locationAddressParts?.city?.trim() ||
    primaryLocation?.locationCity?.trim() ||
    item.locationAddressParts?.city?.trim() ||
    item.locationCity.trim();
  const rawCountry =
    primaryLocation?.locationAddressParts?.country?.trim() ||
    primaryLocation?.locationCountry?.trim() ||
    item.locationAddressParts?.country?.trim() ||
    item.locationCountry.trim();
  const countryCode =
    primaryLocation?.locationCountryCode?.trim() ||
    item.locationCountryCode?.trim() ||
    "";
  const country = locale
    ? getCountryDisplayName(countryCode, locale, rawCountry)
    : rawCountry;
  const combined = [postalCode, [city, country].filter(Boolean).join(", ")]
    .filter(Boolean)
    .join(" ");
  const locationLabel = combined || messages?.noLocation || "Nie podano lokalizacji";
  const extraLocationsCount = Math.max(0, (item.locations?.length ?? 0) - 1);

  if (extraLocationsCount <= 0) {
    return locationLabel;
  }

  if (messages?.otherLocationsTemplate) {
    return `${locationLabel} ${formatTemplate(messages.otherLocationsTemplate, {
      count: extraLocationsCount,
    })}`;
  }

  return `${locationLabel} + ${extraLocationsCount} innych`;
}

export function buildAppliedBaseFromFormValues(
  values: FiltersFormValues,
): Omit<AppliedFilters, "locationCenter" | "locationQuery"> {
  const normalizedPriceCurrency: AppliedFilters["priceCurrency"] =
    values.priceCurrency === "all" ? "EUR" : values.priceCurrency;
  const normalizedPriceMinInput =
    values.priceMinInput.trim();
  const normalizedPriceMaxInput =
    values.priceMaxInput.trim();
  const normalizedPriceTaxMode =
    normalizedPriceMinInput.length > 0 || normalizedPriceMaxInput.length > 0
      ? values.priceTaxMode
      : "net";
  const parsedRalColors = parseContainerRalColors(values.containerRalInput ?? "", {
    ignoreIncompleteTrailingToken: true,
  });

  return {
    listingKind: values.listingKind,
    locationRadiusKm: values.locationRadiusKmInput,
    containerSizes: toNormalizedArray(values.containerSizes),
    containerHeights: toNormalizedArray(values.containerHeights),
    containerTypes: toNormalizedArray(values.containerTypes),
    containerConditions: toNormalizedArray(values.containerConditions),
    containerFeatures: toNormalizedArray(values.containerFeatures),
    containerRalColors: toNormalizedArray(
      parsedRalColors.colors.map((color) => color.ral),
    ),
    priceNegotiableOnly: values.priceNegotiableOnly,
    logisticsTransportOnly: values.logisticsTransportOnly,
    logisticsUnloadingOnly: values.logisticsUnloadingOnly,
    hasCscPlateOnly: values.hasCscPlateOnly,
    hasCscCertificationOnly: values.hasCscCertificationOnly,
    priceCurrency: normalizedPriceCurrency,
    priceDisplayCurrency: values.priceDisplayCurrency,
    priceTaxMode: normalizedPriceTaxMode,
    priceMinInput: normalizedPriceMinInput,
    priceMaxInput: normalizedPriceMaxInput,
    productionYearInput: values.productionYearInput.trim(),
    city: values.city,
    country: values.country,
    countryCode: values.countryCode.trim().toUpperCase(),
    sortPreset: values.sortPreset,
  };
}

export function buildContainersApiUrl({
  appliedFilters,
  page,
  pageSize,
  mapView = false,
  favoritesOnly = false,
  localFavoriteIds = [],
  mineOnly = false,
  companySlug,
  deliveryReach = false,
}: BuildContainersApiUrlOptions): string {
  const params = mapView
    ? new URLSearchParams({
        view: "map",
        all: "1",
      })
    : createListQueryParams(appliedFilters, page ?? 1, pageSize ?? 20);

  if (deliveryReach) {
    params.set("deliveryReach", "1");
  }

  applyLocationParams(params, appliedFilters, {
    deliveryReach,
  });
  applyListingKindParams(params, appliedFilters.listingKind);
  applyContainerParams(params, appliedFilters);
  if (favoritesOnly) {
    params.set("favorites", "1");
    if (localFavoriteIds.length > 0) {
      params.set("localFavoriteIds", localFavoriteIds.join(","));
    }
  }
  if (mineOnly) {
    params.set("mine", "1");
  }
  if (companySlug?.trim()) {
    params.set("companySlug", companySlug.trim());
  }

  return `/api/containers?${params.toString()}`;
}

function createListQueryParams(
  appliedFilters: AppliedFilters,
  page: number,
  pageSize: number,
): URLSearchParams {
  const hasPriceRange =
    appliedFilters.priceMinInput.trim().length > 0 ||
    appliedFilters.priceMaxInput.trim().length > 0;
  const resolvedSortParams = getSortParams(appliedFilters.sortPreset);
  const shouldForceCreatedAtSort =
    resolvedSortParams.sortBy === "priceNet" &&
    (!hasPriceRange || appliedFilters.priceCurrency === "all");
  const { sortBy, sortDir } = shouldForceCreatedAtSort
    ? { sortBy: "createdAt", sortDir: "desc" as const }
    : resolvedSortParams;

  return new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    sortBy,
    sortDir,
  });
}

function applyListingKindParams(params: URLSearchParams, listingKind: ListingKind): void {
  params.set("type", listingKind);
}

function applyLocationParams(
  params: URLSearchParams,
  appliedFilters: AppliedFilters,
  options?: {
    deliveryReach?: boolean;
  },
): void {
  if (appliedFilters.locationCenter) {
    params.set("locationLat", formatLocationCoordinate(appliedFilters.locationCenter.lat));
    params.set("locationLng", formatLocationCoordinate(appliedFilters.locationCenter.lng));
    if (options?.deliveryReach !== true) {
      params.set("radiusKm", appliedFilters.locationRadiusKm);
    }
    return;
  }

  const hasAdministrativeLocationFilter =
    appliedFilters.countryCode.trim().length > 0 ||
    appliedFilters.country.trim().length > 0 ||
    appliedFilters.city.trim().length > 0;

  if (
    options?.deliveryReach !== true &&
    appliedFilters.locationQuery &&
    !hasAdministrativeLocationFilter
  ) {
    params.set("q", appliedFilters.locationQuery);
  }
}

function applyContainerParams(
  params: URLSearchParams,
  appliedFilters: AppliedFilters,
): void {
  const hasPriceRange =
    appliedFilters.priceMinInput.trim().length > 0 ||
    appliedFilters.priceMaxInput.trim().length > 0;

  if (appliedFilters.containerSizes.length > 0) {
    params.set("containerSize", appliedFilters.containerSizes.join(","));
  }
  if (appliedFilters.containerHeights.length > 0) {
    params.set("containerHeight", appliedFilters.containerHeights.join(","));
  }
  if (appliedFilters.containerTypes.length > 0) {
    params.set("containerType", appliedFilters.containerTypes.join(","));
  }
  if (appliedFilters.containerConditions.length > 0) {
    params.set("containerCondition", appliedFilters.containerConditions.join(","));
  }
  if (appliedFilters.containerFeatures.length > 0) {
    params.set("containerFeature", appliedFilters.containerFeatures.join(","));
  }
  if (appliedFilters.containerRalColors.length > 0) {
    params.set("containerRal", appliedFilters.containerRalColors.join(","));
  }
  if (appliedFilters.priceNegotiableOnly) {
    params.set("priceNegotiable", "1");
  }
  if (appliedFilters.logisticsTransportOnly) {
    params.set("logisticsTransport", "1");
  }
  if (appliedFilters.logisticsUnloadingOnly) {
    params.set("logisticsUnloading", "1");
  }
  if (appliedFilters.hasCscPlateOnly) {
    params.set("hasCscPlate", "1");
  }
  if (appliedFilters.hasCscCertificationOnly) {
    params.set("hasCscCertification", "1");
  }
  if (hasPriceRange && appliedFilters.priceCurrency !== "all") {
    params.set("priceCurrency", appliedFilters.priceCurrency);
  }
  if (hasPriceRange) {
    params.set("priceTaxMode", appliedFilters.priceTaxMode);
  }
  if (appliedFilters.priceMinInput) {
    params.set("priceMin", appliedFilters.priceMinInput);
  }
  if (appliedFilters.priceMaxInput) {
    params.set("priceMax", appliedFilters.priceMaxInput);
  }
  if (appliedFilters.productionYearInput) {
    params.set("productionYear", appliedFilters.productionYearInput);
  }

  const city = appliedFilters.city.trim();
  if (city) {
    params.set("city", city);
  }

  const country = appliedFilters.country.trim();
  if (country) {
    params.set("country", country);
  }

  const countryCode = appliedFilters.countryCode.trim().toUpperCase();
  if (countryCode) {
    params.set("countryCode", countryCode);
  }
}

