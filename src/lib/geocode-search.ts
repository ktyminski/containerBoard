import {
  buildGeocodeAddressParts,
  buildShortAddressLabel,
  type GeocodeAddressParts,
  type NominatimAddress,
} from "@/lib/geocode-address";

type NominatimResult = {
  lat: string;
  lon: string;
  display_name: string;
  address?: NominatimAddress;
};

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
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", String(input.limit ?? 1));
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("q", input.query);

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
