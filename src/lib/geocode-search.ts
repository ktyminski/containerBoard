import {
  buildGeocodeAddressParts,
  buildShortAddressLabel,
  type GeocodeAddressParts,
  type NominatimAddress,
} from "@/lib/geocode-address";
import {
  resolveCountryCodeFromInput,
  resolveCountryCodeFromInputApprox,
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

  const exactCountryCode = resolveCountryCodeFromInput(normalized);
  const countryCode =
    exactCountryCode ??
    (tokenCount <= 2 ? resolveCountryCodeFromInputApprox(normalized) : null);
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
      "User-Agent": "ContainerBoard/1.0 (contact: support@containerboard.local)",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Geocoding failed");
  }

  const rows = (await response.json()) as NominatimResult[];
  return rows
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
      };
    })
    .filter((item): item is GeocodeSearchItem => Boolean(item));
}
