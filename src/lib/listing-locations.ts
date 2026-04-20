import {
  normalizeGeocodeAddressParts,
  type GeocodeAddressParts,
} from "@/lib/geocode-address";
import {
  resolveCountryCodeFromInput,
  resolveCountryCodeFromInputApprox,
} from "@/lib/country-flags";

export const MAX_LISTING_LOCATIONS = 10;

export type ListingLocationInput = {
  locationLat?: number | null;
  locationLng?: number | null;
  locationCity?: string;
  locationCountry?: string;
  locationCountryCode?: string;
  locationAddressLabel?: string;
  locationAddressParts?: GeocodeAddressParts | null;
  isPrimary?: boolean;
};

export type ListingLocation = {
  locationLat: number;
  locationLng: number;
  locationCity: string;
  locationCountry: string;
  locationCountryCode?: string;
  locationAddressLabel?: string;
  locationAddressParts?: GeocodeAddressParts;
  isPrimary: boolean;
};

function normalizeOptionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeCoordinate(value: number | null | undefined, min: number, max: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    return null;
  }
  return value;
}

function getDeduplicationKey(location: ListingLocation): string {
  return [
    location.locationLat.toFixed(6),
    location.locationLng.toFixed(6),
    location.locationCity.toLowerCase(),
    location.locationCountry.toLowerCase(),
  ].join("|");
}

export function normalizeListingLocation(
  input: ListingLocationInput | null | undefined,
): ListingLocation | null {
  if (!input) {
    return null;
  }

  const locationLat = normalizeCoordinate(input.locationLat, -90, 90);
  const locationLng = normalizeCoordinate(input.locationLng, -180, 180);
  if (locationLat === null || locationLng === null) {
    return null;
  }

  const locationAddressParts = normalizeGeocodeAddressParts(input.locationAddressParts);
  const locationAddressLabel = normalizeOptionalString(input.locationAddressLabel);
  const locationCity =
    normalizeOptionalString(input.locationCity) ?? locationAddressParts?.city ?? "";
  const locationCountry =
    normalizeOptionalString(input.locationCountry) ?? locationAddressParts?.country ?? "";
  const locationCountryCode =
    normalizeOptionalString(input.locationCountryCode)?.toUpperCase() ??
    resolveCountryCodeFromInput(locationCountry) ??
    resolveCountryCodeFromInputApprox(locationCountry) ??
    undefined;

  return {
    locationLat,
    locationLng,
    locationCity,
    locationCountry,
    ...(locationCountryCode ? { locationCountryCode } : {}),
    ...(locationAddressLabel ? { locationAddressLabel } : {}),
    ...(locationAddressParts ? { locationAddressParts } : {}),
    isPrimary: input.isPrimary === true,
  };
}

export function normalizeListingLocations(input: {
  locations?: ListingLocationInput[] | null;
  fallback?: ListingLocationInput | null;
  max?: number;
}): ListingLocation[] {
  const requestedMax = Math.trunc(input.max ?? MAX_LISTING_LOCATIONS);
  const max = Math.min(MAX_LISTING_LOCATIONS, Math.max(1, requestedMax));
  const output: ListingLocation[] = [];
  const seen = new Set<string>();

  for (const candidate of input.locations ?? []) {
    if (output.length >= max) {
      break;
    }

    const normalized = normalizeListingLocation(candidate);
    if (!normalized) {
      continue;
    }

    const dedupeKey = getDeduplicationKey(normalized);
    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    output.push(normalized);
  }

  if (output.length === 0 && input.fallback) {
    const fallback = normalizeListingLocation({
      ...input.fallback,
      isPrimary: true,
    });
    if (fallback) {
      output.push(fallback);
    }
  }

  if (output.length === 0) {
    return [];
  }

  const primaryIndex = output.findIndex((location) => location.isPrimary);
  const resolvedPrimaryIndex = primaryIndex >= 0 ? primaryIndex : 0;
  const normalizedPrimaryFlags = output.map((location, index) => ({
    ...location,
    isPrimary: index === resolvedPrimaryIndex,
  }));

  if (resolvedPrimaryIndex === 0) {
    return normalizedPrimaryFlags;
  }

  const [primaryLocation] = normalizedPrimaryFlags.splice(resolvedPrimaryIndex, 1);
  return [primaryLocation, ...normalizedPrimaryFlags];
}
