import {
  type ContainerCondition,
  type ContainerFeature,
  type ContainerHeight,
  type ContainerType,
  type Currency,
  type ListingType,
  type TaxMode,
} from "@/lib/container-listing-types";

export type ListingKind = ListingType;
export type SortPreset =
  | "newest"
  | "quantity_desc"
  | "quantity_asc"
  | "available_asc"
  | "price_net_asc"
  | "price_net_desc";
export type FormContainerSize = "10" | "20" | "40" | "45" | "53" | "custom";
export const CUSTOM_CONTAINER_SIZE_FILTER_VALUE = "custom";
export type FormLocationRadiusKm = "20" | "50" | "100" | "200" | "400";
export type FilterTaxMode = TaxMode;
export type FilterCurrency = "all" | Currency;
export type PriceDisplayCurrency = "original" | Currency;

export type FiltersFormValues = {
  listingKind: ListingKind;
  locationInput: string;
  locationRadiusKmInput: FormLocationRadiusKm;
  containerSizes: FormContainerSize[];
  containerHeights: ContainerHeight[];
  containerTypes: ContainerType[];
  containerConditions: ContainerCondition[];
  containerFeatures: ContainerFeature[];
  containerRalInput: string;
  priceNegotiableOnly: boolean;
  logisticsTransportOnly: boolean;
  logisticsUnloadingOnly: boolean;
  hasCscPlateOnly: boolean;
  hasCscCertificationOnly: boolean;
  priceCurrency: FilterCurrency;
  priceDisplayCurrency: PriceDisplayCurrency;
  priceTaxMode: FilterTaxMode;
  priceMinInput: string;
  priceMaxInput: string;
  productionYearInput: string;
  city: string;
  country: string;
  countryCode: string;
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
  containerRalColors: string[];
  priceNegotiableOnly: boolean;
  logisticsTransportOnly: boolean;
  logisticsUnloadingOnly: boolean;
  hasCscPlateOnly: boolean;
  hasCscCertificationOnly: boolean;
  priceCurrency: FilterCurrency;
  priceDisplayCurrency: PriceDisplayCurrency;
  priceTaxMode: FilterTaxMode;
  priceMinInput: string;
  priceMaxInput: string;
  productionYearInput: string;
  city: string;
  country: string;
  countryCode: string;
  sortPreset: SortPreset;
};

export type MultiFilterKey =
  | "sizes"
  | "heights"
  | "types"
  | "conditions"
  | "features";

export const LOCATION_RADIUS_OPTIONS = [50, 100, 200, 400] as const;
export type LocationRadiusKm = (typeof LOCATION_RADIUS_OPTIONS)[number];
export const AUTO_APPLY_FILTERS_DEBOUNCE_MS = 450;
export const AUTO_APPLY_TYPED_FILTERS_DEBOUNCE_MS = 800;

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
  listingKind: "sell",
  locationInput: "",
  locationRadiusKmInput: "200",
  containerSizes: [],
  containerHeights: [],
  containerTypes: [],
  containerConditions: [],
  containerFeatures: [],
  containerRalInput: "",
  priceNegotiableOnly: false,
  logisticsTransportOnly: false,
  logisticsUnloadingOnly: false,
  hasCscPlateOnly: false,
  hasCscCertificationOnly: false,
  priceCurrency: "EUR",
  priceDisplayCurrency: "original",
  priceTaxMode: "net",
  priceMinInput: "",
  priceMaxInput: "",
  productionYearInput: "",
  city: "",
  country: "",
  countryCode: "",
  sortPreset: "newest",
};

export type NonLocationFilters = Pick<
  AppliedFilters,
  | "listingKind"
  | "containerSizes"
  | "containerHeights"
  | "containerTypes"
  | "containerConditions"
  | "containerFeatures"
  | "containerRalColors"
  | "priceNegotiableOnly"
  | "logisticsTransportOnly"
  | "logisticsUnloadingOnly"
  | "hasCscPlateOnly"
  | "hasCscCertificationOnly"
  | "priceCurrency"
  | "priceDisplayCurrency"
  | "priceTaxMode"
  | "priceMinInput"
  | "priceMaxInput"
  | "productionYearInput"
  | "city"
  | "country"
  | "countryCode"
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
    areArraysEqual(left.containerRalColors, right.containerRalColors) &&
    left.priceNegotiableOnly === right.priceNegotiableOnly &&
    left.logisticsTransportOnly === right.logisticsTransportOnly &&
    left.logisticsUnloadingOnly === right.logisticsUnloadingOnly &&
    left.hasCscPlateOnly === right.hasCscPlateOnly &&
    left.hasCscCertificationOnly === right.hasCscCertificationOnly &&
    left.priceCurrency === right.priceCurrency &&
    left.priceDisplayCurrency === right.priceDisplayCurrency &&
    left.priceTaxMode === right.priceTaxMode &&
    left.priceMinInput === right.priceMinInput &&
    left.priceMaxInput === right.priceMaxInput &&
    left.productionYearInput === right.productionYearInput &&
    left.city === right.city &&
    left.country === right.country &&
    left.countryCode === right.countryCode &&
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
    containerRalColors: toNormalizedArray(filters.containerRalColors),
    priceNegotiableOnly: filters.priceNegotiableOnly,
    logisticsTransportOnly: filters.logisticsTransportOnly,
    logisticsUnloadingOnly: filters.logisticsUnloadingOnly,
    hasCscPlateOnly: filters.hasCscPlateOnly,
    hasCscCertificationOnly: filters.hasCscCertificationOnly,
    priceCurrency: filters.priceCurrency,
    priceDisplayCurrency: filters.priceDisplayCurrency,
    priceTaxMode: hasPriceRange ? filters.priceTaxMode : "net",
    priceMinInput: normalizedPriceMinInput,
    priceMaxInput: normalizedPriceMaxInput,
    productionYearInput: filters.productionYearInput.trim(),
    city: filters.city,
    country: filters.country,
    countryCode: filters.countryCode.trim().toUpperCase(),
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
