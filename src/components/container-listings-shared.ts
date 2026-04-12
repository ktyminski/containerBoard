import {
  CONTAINER_CONDITIONS,
  CONTAINER_CONDITION_LABEL,
  CONTAINER_FEATURES,
  CONTAINER_FEATURE_LABEL,
  CONTAINER_HEIGHTS,
  CONTAINER_HEIGHT_LABEL,
  CONTAINER_SIZES,
  CONTAINER_TYPES,
  CONTAINER_TYPE_LABEL,
  type ContainerCondition,
  type ContainerFeature,
  type ContainerHeight,
  type ContainerType,
  type Currency,
  type ListingType,
  type PriceType,
  type PriceUnit,
  type TaxMode,
} from "@/lib/container-listing-types";

export type ListingKind = "all" | ListingType | "rent";
export type SortPreset =
  | "newest"
  | "quantity_desc"
  | "quantity_asc"
  | "available_asc"
  | "price_net_asc"
  | "price_net_desc";
export type FormContainerSize = "10" | "20" | "40" | "45" | "53";
export type FormLocationRadiusKm = "20" | "50" | "100" | "200";
export type FilterPriceType = "all" | PriceType;
export type FilterPriceUnit = "all" | PriceUnit;
export type FilterTaxMode = TaxMode;
export type FilterCurrency = "all" | Currency;

export type FiltersFormValues = {
  listingKind: ListingKind;
  locationInput: string;
  locationRadiusKmInput: FormLocationRadiusKm;
  containerSizes: FormContainerSize[];
  containerHeights: ContainerHeight[];
  containerTypes: ContainerType[];
  containerConditions: ContainerCondition[];
  containerFeatures: ContainerFeature[];
  priceNegotiableOnly: boolean;
  logisticsTransportOnly: boolean;
  logisticsUnloadingOnly: boolean;
  hasCscPlateOnly: boolean;
  hasCscCertificationOnly: boolean;
  priceType: FilterPriceType;
  priceUnit: FilterPriceUnit;
  priceCurrency: FilterCurrency;
  priceTaxMode: FilterTaxMode;
  priceMinInput: string;
  priceMaxInput: string;
  productionYearInput: string;
  city: string;
  country: string;
  sortPreset: SortPreset;
};

export type AppliedFilters = {
  listingKind: ListingKind;
  locationQuery: string;
  locationCenter: { lat: number; lng: number } | null;
  locationRadiusKm: FormLocationRadiusKm;
  containerSizes: FormContainerSize[];
  containerHeights: ContainerHeight[];
  containerTypes: ContainerType[];
  containerConditions: ContainerCondition[];
  containerFeatures: ContainerFeature[];
  priceNegotiableOnly: boolean;
  logisticsTransportOnly: boolean;
  logisticsUnloadingOnly: boolean;
  hasCscPlateOnly: boolean;
  hasCscCertificationOnly: boolean;
  priceType: FilterPriceType;
  priceUnit: FilterPriceUnit;
  priceCurrency: FilterCurrency;
  priceTaxMode: FilterTaxMode;
  priceMinInput: string;
  priceMaxInput: string;
  productionYearInput: string;
  city: string;
  country: string;
  sortPreset: SortPreset;
};

export type MultiFilterKey = "sizes" | "heights" | "types" | "conditions" | "features";

export const LOCATION_RADIUS_OPTIONS = [20, 50, 100, 200] as const;
export type LocationRadiusKm = (typeof LOCATION_RADIUS_OPTIONS)[number];
export const AUTO_APPLY_FILTERS_DEBOUNCE_MS = 450;
export const AUTO_APPLY_TYPED_FILTERS_DEBOUNCE_MS = 800;

export const LISTING_TYPE_LABEL: Record<ListingType, string> = {
  available: "Oferta",
  wanted: "Buy request",
};

export const CONTAINER_CONDITION_COLOR_TOKENS: Record<
  ContainerCondition,
  { badgeClassName: string; dotClassName: string }
> = {
  new: {
    badgeClassName: "border-sky-300 bg-sky-100 text-sky-800",
    dotClassName: "border-sky-300 bg-sky-100",
  },
  one_trip: {
    badgeClassName: "border-teal-300 bg-teal-100 text-teal-800",
    dotClassName: "border-teal-300 bg-teal-100",
  },
  cargo_worthy: {
    badgeClassName: "border-emerald-300 bg-emerald-100 text-emerald-800",
    dotClassName: "border-emerald-300 bg-emerald-100",
  },
  wind_water_tight: {
    badgeClassName: "border-lime-300 bg-lime-100 text-lime-800",
    dotClassName: "border-lime-300 bg-lime-100",
  },
  as_is: {
    badgeClassName: "border-yellow-300 bg-yellow-100 text-yellow-800",
    dotClassName: "border-yellow-300 bg-yellow-100",
  },
};

export const FILTER_FORM_DEFAULTS: FiltersFormValues = {
  listingKind: "all",
  locationInput: "",
  locationRadiusKmInput: "50",
  containerSizes: [],
  containerHeights: [],
  containerTypes: [],
  containerConditions: [],
  containerFeatures: [],
  priceNegotiableOnly: false,
  logisticsTransportOnly: false,
  logisticsUnloadingOnly: false,
  hasCscPlateOnly: false,
  hasCscCertificationOnly: false,
  priceType: "all",
  priceUnit: "all",
  priceCurrency: "EUR",
  priceTaxMode: "net",
  priceMinInput: "",
  priceMaxInput: "",
  productionYearInput: "",
  city: "",
  country: "",
  sortPreset: "newest",
};

export const LISTING_KIND_OPTIONS: Array<{ value: ListingKind; label: string }> = [
  { value: "all", label: "Dowolne" },
  { value: "available", label: "Sell / Oferty" },
  { value: "rent", label: "Wynajem" },
  { value: "wanted", label: "Buy request" },
];

export const SORT_OPTIONS: Array<{ value: SortPreset; label: string }> = [
  { value: "newest", label: "Najnowsze" },
  { value: "quantity_desc", label: "Ilosc malejaco" },
  { value: "quantity_asc", label: "Ilosc rosnaco" },
  { value: "available_asc", label: "Najblizsza dostepnosc" },
  { value: "price_net_asc", label: "Cena netto rosnaco" },
  { value: "price_net_desc", label: "Cena netto malejaco" },
];

export const CONTAINER_SIZE_OPTIONS: Array<{ value: FormContainerSize; label: string }> =
  CONTAINER_SIZES.map((value) => ({
    value: String(value) as FormContainerSize,
    label: `${value} ft`,
  }));

export const CONTAINER_HEIGHT_OPTIONS: Array<{ value: ContainerHeight; label: string }> =
  CONTAINER_HEIGHTS.map((value) => ({
    value,
    label: CONTAINER_HEIGHT_LABEL[value],
  }));

export const CONTAINER_TYPE_OPTIONS: Array<{ value: ContainerType; label: string }> =
  CONTAINER_TYPES.map((value) => ({
    value,
    label: CONTAINER_TYPE_LABEL[value],
  }));

export const CONTAINER_CONDITION_OPTIONS: Array<{ value: ContainerCondition; label: string }> =
  CONTAINER_CONDITIONS.map((value) => ({
    value,
    label: CONTAINER_CONDITION_LABEL[value],
  }));

export const CONTAINER_FEATURE_OPTIONS: Array<{ value: ContainerFeature; label: string }> =
  CONTAINER_FEATURES.map((value) => ({
    value,
    label: CONTAINER_FEATURE_LABEL[value],
  }));

export type NonLocationFilters = Pick<
  AppliedFilters,
  | "listingKind"
  | "containerSizes"
  | "containerHeights"
  | "containerTypes"
  | "containerConditions"
  | "containerFeatures"
  | "priceNegotiableOnly"
  | "logisticsTransportOnly"
  | "logisticsUnloadingOnly"
  | "hasCscPlateOnly"
  | "hasCscCertificationOnly"
  | "priceType"
  | "priceUnit"
  | "priceCurrency"
  | "priceTaxMode"
  | "priceMinInput"
  | "priceMaxInput"
  | "productionYearInput"
  | "city"
  | "country"
  | "sortPreset"
>;

export function toggleMultiValue<T extends string>(values: T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

export function toNormalizedArray<T extends string>(values: T[]): T[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b)) as T[];
}

export function areArraysEqual<T extends string>(left: T[], right: T[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}

export function areNonLocationFiltersEqual(
  left: NonLocationFilters,
  right: NonLocationFilters,
): boolean {
  return (
    left.listingKind === right.listingKind &&
    areArraysEqual(left.containerSizes, right.containerSizes) &&
    areArraysEqual(left.containerHeights, right.containerHeights) &&
    areArraysEqual(left.containerTypes, right.containerTypes) &&
    areArraysEqual(left.containerConditions, right.containerConditions) &&
    areArraysEqual(left.containerFeatures, right.containerFeatures) &&
    left.priceNegotiableOnly === right.priceNegotiableOnly &&
    left.logisticsTransportOnly === right.logisticsTransportOnly &&
    left.logisticsUnloadingOnly === right.logisticsUnloadingOnly &&
    left.hasCscPlateOnly === right.hasCscPlateOnly &&
    left.hasCscCertificationOnly === right.hasCscCertificationOnly &&
    left.priceType === right.priceType &&
    left.priceUnit === right.priceUnit &&
    left.priceCurrency === right.priceCurrency &&
    left.priceTaxMode === right.priceTaxMode &&
    left.priceMinInput === right.priceMinInput &&
    left.priceMaxInput === right.priceMaxInput &&
    left.productionYearInput === right.productionYearInput &&
    left.city === right.city &&
    left.country === right.country &&
    left.sortPreset === right.sortPreset
  );
}

export function pickNonLocationFilters(filters: AppliedFilters): NonLocationFilters {
  const normalizedPriceMinInput = filters.priceMinInput.trim();
  const normalizedPriceMaxInput = filters.priceMaxInput.trim();
  const hasPriceRange =
    normalizedPriceMinInput.length > 0 || normalizedPriceMaxInput.length > 0;
  return {
    listingKind: filters.listingKind,
    containerSizes: toNormalizedArray(filters.containerSizes),
    containerHeights: toNormalizedArray(filters.containerHeights),
    containerTypes: toNormalizedArray(filters.containerTypes),
    containerConditions: toNormalizedArray(filters.containerConditions),
    containerFeatures: toNormalizedArray(filters.containerFeatures),
    priceNegotiableOnly: filters.priceNegotiableOnly,
    logisticsTransportOnly: filters.logisticsTransportOnly,
    logisticsUnloadingOnly: filters.logisticsUnloadingOnly,
    hasCscPlateOnly: filters.hasCscPlateOnly,
    hasCscCertificationOnly: filters.hasCscCertificationOnly,
    priceType: filters.priceType,
    priceUnit: filters.priceUnit,
    priceCurrency: filters.priceCurrency,
    priceTaxMode: hasPriceRange ? filters.priceTaxMode : "net",
    priceMinInput: normalizedPriceMinInput,
    priceMaxInput: normalizedPriceMaxInput,
    productionYearInput: filters.productionYearInput.trim(),
    city: filters.city,
    country: filters.country,
    sortPreset: filters.sortPreset,
  };
}

export function shouldUseTypedDebounce(
  draft: NonLocationFilters,
  applied: NonLocationFilters,
): boolean {
  return (
    draft.productionYearInput !== applied.productionYearInput ||
    draft.priceMinInput !== applied.priceMinInput ||
    draft.priceMaxInput !== applied.priceMaxInput
  );
}

