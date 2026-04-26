import {
  buildGeocodeAddressParts,
  buildShortAddressLabel,
  type GeocodeAddressParts,
  type NominatimAddress,
} from "@/lib/geocode-address";
import {
  resolveCountryCodeFromInput,
} from "@/lib/country-flags";

type NominatimResult = {
  lat: string;
  lon: string;
  display_name: string;
  address?: NominatimAddress;
};

type CountryGeocodeQuery = {
  countryCode: string;
  query: string;
};

function getLocalityPriority(address?: NominatimAddress): number {
  if (address?.city?.trim()) {
    return 7;
  }
  if (address?.town?.trim()) {
    return 6;
  }
  if (address?.village?.trim()) {
    return 5;
  }
  if (address?.administrative?.trim()) {
    return 4;
  }
  if (address?.municipality?.trim()) {
    return 3;
  }
  if (address?.city_district?.trim()) {
    return 2;
  }
  if (address?.county?.trim()) {
    return 1;
  }
  return 0;
}

function getCountrySearchName(code: string): string {
  if (typeof Intl.DisplayNames !== "function") {
    return code;
  }

  try {
    const displayNames = new Intl.DisplayNames(["en"], { type: "region" });
    return displayNames.of(code) ?? code;
  } catch {
    return code;
  }
}

function resolveCountryGeocodeQuery(query: string): CountryGeocodeQuery | null {
  if (/[,/]/.test(query)) {
    return null;
  }

  const normalized = query.trim();
  if (!normalized) {
    return null;
  }

  const tokenCount = normalized.split(/\s+/).filter(Boolean).length;
  if (tokenCount === 0 || tokenCount > 3) {
    return null;
  }

  const countryCode = resolveCountryCodeFromInput(normalized);
  if (!countryCode) {
    return null;
  }

  return {
    countryCode: countryCode.toLowerCase(),
    query: getCountrySearchName(countryCode),
  };
}

export type GeocodeSearchItem = {
  lat: number;
  lng: number;
  label: string;
  shortLabel: string;
  addressParts: GeocodeAddressParts | null;
  countryCode: string | null;
  matchType: "country" | "place";
};

export async function searchGeocode(input: {
  query: string;
  lang?: string;
  limit?: number;
}): Promise<GeocodeSearchItem[]> {
  const countryQuery = resolveCountryGeocodeQuery(input.query);
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", String(input.limit ?? 1));
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("q", countryQuery?.query ?? input.query);
  if (countryQuery) {
    url.searchParams.set("countrycodes", countryQuery.countryCode);
    url.searchParams.set("featuretype", "country");
  }

  const response = await fetch(url, {
    headers: {
      "Accept-Language": input.lang ?? "pl",
      "User-Agent": "ContainerBoard/1.0 (contact: hello@containerboard.eu)",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Geocoding failed");
  }

  const rows = (await response.json()) as NominatimResult[];
  const sortedRows = countryQuery
    ? rows
    : [...rows].sort((left, right) => {
        const priorityDifference =
          getLocalityPriority(right.address) - getLocalityPriority(left.address);
        if (priorityDifference !== 0) {
          return priorityDifference;
        }
        return 0;
      });
  return sortedRows
    .map((row) => {
      const lat = Number(row.lat);
      const lng = Number(row.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return null;
      }

      return {
        lat,
        lng,
        label: row.display_name,
        shortLabel: buildShortAddressLabel({
          address: row.address,
          fallbackLabel: row.display_name,
        }),
        addressParts: buildGeocodeAddressParts(row.address) ?? null,
        countryCode: row.address?.country_code?.toUpperCase() ?? null,
        matchType: countryQuery ? "country" : "place",
      };
    })
    .filter((item): item is GeocodeSearchItem => Boolean(item));
}
