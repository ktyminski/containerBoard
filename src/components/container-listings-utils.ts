import type { ContainerListingItem } from "@/lib/container-listings";
import {
  type AppliedFilters,
  type FiltersFormValues,
  type ListingKind,
  type SortPreset,
  toNormalizedArray,
} from "@/components/container-listings-shared";

type SortParams = {
  sortBy: string;
  sortDir: "asc" | "desc";
};

type BuildContainersApiUrlOptions = {
  appliedFilters: AppliedFilters;
  page?: number;
  mapView?: boolean;
  favoritesOnly?: boolean;
  localFavoriteIds?: string[];
  mineOnly?: boolean;
};

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

export function getCoordinateKey(lat: number, lng: number): string {
  return `${lat.toFixed(6)}:${lng.toFixed(6)}`;
}

export function getContainerListingLocationLabel(item: ContainerListingItem): string {
  const primaryLocation = item.locations?.find((location) => location.isPrimary) ?? item.locations?.[0];
  const city =
    primaryLocation?.locationAddressParts?.city?.trim() ||
    primaryLocation?.locationCity?.trim() ||
    item.locationAddressParts?.city?.trim() ||
    item.locationCity.trim();
  const country =
    primaryLocation?.locationAddressParts?.country?.trim() ||
    primaryLocation?.locationCountry?.trim() ||
    item.locationAddressParts?.country?.trim() ||
    item.locationCountry.trim();
  const combined = [city, country].filter(Boolean).join(", ");
  const locationLabel = combined || "Nie podano lokalizacji";
  const extraLocationsCount = Math.max(0, (item.locations?.length ?? 0) - 1);

  if (extraLocationsCount <= 0) {
    return locationLabel;
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

  return {
    listingKind: values.listingKind,
    locationRadiusKm: values.locationRadiusKmInput,
    containerSizes: toNormalizedArray(values.containerSizes),
    containerHeights: toNormalizedArray(values.containerHeights),
    containerTypes: toNormalizedArray(values.containerTypes),
    containerConditions: toNormalizedArray(values.containerConditions),
    containerFeatures: toNormalizedArray(values.containerFeatures),
    priceNegotiableOnly: values.priceNegotiableOnly,
    logisticsTransportOnly: values.logisticsTransportOnly,
    logisticsUnloadingOnly: values.logisticsUnloadingOnly,
    hasCscPlateOnly: values.hasCscPlateOnly,
    hasCscCertificationOnly: values.hasCscCertificationOnly,
    priceType: values.priceType,
    priceCurrency: normalizedPriceCurrency,
    priceDisplayCurrency: values.priceDisplayCurrency,
    priceTaxMode: normalizedPriceTaxMode,
    priceMinInput: normalizedPriceMinInput,
    priceMaxInput: normalizedPriceMaxInput,
    productionYearInput: values.productionYearInput.trim(),
    city: values.city,
    country: values.country,
    sortPreset: values.sortPreset,
  };
}

export function buildContainersApiUrl({
  appliedFilters,
  page,
  mapView = false,
  favoritesOnly = false,
  localFavoriteIds = [],
  mineOnly = false,
}: BuildContainersApiUrlOptions): string {
  const params = mapView
    ? new URLSearchParams({
        view: "map",
        all: "1",
      })
    : createListQueryParams(appliedFilters, page ?? 1);

  applyLocationParams(params, appliedFilters);
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

  return `/api/containers?${params.toString()}`;
}

function createListQueryParams(appliedFilters: AppliedFilters, page: number): URLSearchParams {
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
    pageSize: "20",
    sortBy,
    sortDir,
  });
}

function applyListingKindParams(params: URLSearchParams, listingKind: ListingKind): void {
  if (listingKind === "rent") {
    params.set("type", "available");
    return;
  }

  if (listingKind === "available" || listingKind === "wanted") {
    params.set("type", listingKind);
    return;
  }
}

function applyLocationParams(params: URLSearchParams, appliedFilters: AppliedFilters): void {
  if (appliedFilters.locationCenter) {
    params.set("locationLat", appliedFilters.locationCenter.lat.toFixed(6));
    params.set("locationLng", appliedFilters.locationCenter.lng.toFixed(6));
    params.set("radiusKm", appliedFilters.locationRadiusKm);
    return;
  }

  if (appliedFilters.locationQuery) {
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
}

