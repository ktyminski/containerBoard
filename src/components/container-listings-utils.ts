import type { ContainerListingItem } from "@/lib/container-listings";
import { parseContainerRalColors } from "@/lib/container-ral-colors";
import type { ContainerListingsMessages } from "@/components/container-listings-i18n";
import {
  type AppliedFilters,
  type FiltersFormValues,
  type ListingKind,
  type SortPreset,
  toNormalizedArray,
} from "@/components/container-listings-shared";
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
    params.set("locationLat", appliedFilters.locationCenter.lat.toFixed(6));
    params.set("locationLng", appliedFilters.locationCenter.lng.toFixed(6));
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

