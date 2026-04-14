export type NominatimAddress = {
  house_number?: string;
  postcode?: string;
  road?: string;
  pedestrian?: string;
  footway?: string;
  path?: string;
  cycleway?: string;
  residential?: string;
  neighbourhood?: string;
  suburb?: string;
  quarter?: string;
  hamlet?: string;
  village?: string;
  town?: string;
  city?: string;
  municipality?: string;
  city_district?: string;
  county?: string;
  state?: string;
  country?: string;
  country_code?: string;
};

export type GeocodeAddressParts = {
  street?: string;
  houseNumber?: string;
  postalCode?: string;
  city?: string;
  country?: string;
};

function firstNonEmpty(values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return undefined;
}

function normalizeAddressPart(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function normalizeGeocodeAddressParts(
  parts: GeocodeAddressParts | null | undefined,
): GeocodeAddressParts | undefined {
  if (!parts) {
    return undefined;
  }

  const normalized: GeocodeAddressParts = {
    street: normalizeAddressPart(parts.street),
    houseNumber: normalizeAddressPart(parts.houseNumber),
    postalCode: normalizeAddressPart(parts.postalCode),
    city: normalizeAddressPart(parts.city),
    country: normalizeAddressPart(parts.country),
  };

  return normalized.street ||
    normalized.houseNumber ||
    normalized.postalCode ||
    normalized.city ||
    normalized.country
    ? normalized
    : undefined;
}

export function buildGeocodeAddressParts(
  address: NominatimAddress | undefined,
): GeocodeAddressParts | undefined {
  const normalized = normalizeGeocodeAddressParts({
    street: firstNonEmpty([
      address?.road,
      address?.pedestrian,
      address?.footway,
      address?.path,
      address?.cycleway,
      address?.residential,
    ]),
    houseNumber: address?.house_number,
    postalCode: address?.postcode,
    city: firstNonEmpty([
      address?.city,
      address?.town,
      address?.village,
      address?.municipality,
      address?.city_district,
      address?.county,
      address?.state,
      address?.hamlet,
    ]),
    country: address?.country,
  });

  return normalized;
}

export function buildShortAddressLabelFromParts(input: {
  parts?: GeocodeAddressParts | null;
  fallbackLabel?: string;
}): string {
  const parts = normalizeGeocodeAddressParts(input.parts);
  const street = parts?.street
    ? [parts.street, parts.houseNumber].filter(Boolean).join(" ")
    : undefined;
  const city = parts?.city;
  const country = parts?.country;

  const seen = new Set<string>();
  const compact = [street, city, country].filter((part): part is string => {
    if (!part) {
      return false;
    }
    const key = part.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });

  if (compact.length >= 2) {
    return compact.join(", ");
  }
  return input.fallbackLabel?.trim() ?? "";
}

export function buildShortAddressLabel(input: {
  address?: NominatimAddress;
  fallbackLabel?: string;
}): string {
  return buildShortAddressLabelFromParts({
    parts: buildGeocodeAddressParts(input.address),
    fallbackLabel: input.fallbackLabel,
  });
}
