export type MainMapView = "offers" | "companies";
export type SearchBBox = [number, number, number, number];
export type SharedMapViewport = {
  center: [number, number];
  zoom: number;
};
export type MainMapInitialFilters = {
  keyword: string;
  location: string;
  distanceKm: DistanceOption;
  locationBbox: SearchBBox | null;
};

export const DEFAULT_MAP_VIEWPORT: SharedMapViewport = {
  center: [19.1451, 51.9194],
  zoom: 4.5,
};

export const DISTANCE_OPTIONS = [10, 20, 25, 30, 35, 50, 100] as const;
export type DistanceOption = (typeof DISTANCE_OPTIONS)[number];

export function parseMainMapView(value: string | undefined): MainMapView | null {
  if (
    value === "offers" ||
    value === "companies"
  ) {
    return value;
  }

  return null;
}

export function buildMainMapPath(view: MainMapView): string {
  void view;
  return "/list";
}

export function resolveMainMapViewFromLocation(input: {
  pathname: string;
  search?: string;
  fallbackView: MainMapView;
}): MainMapView {
  const normalizedPath = input.pathname.replace(/\/+$/, "") || "/";
  const pathParts = normalizedPath.split("/");
  if (pathParts[1] === "maps") {
    const fromPath = parseMainMapView(pathParts[2]);
    if (fromPath) {
      return fromPath;
    }
  }

  if (input.search) {
    const search = new URLSearchParams(input.search.startsWith("?") ? input.search.slice(1) : input.search);
    const fromQuery = parseMainMapView(search.get("view") ?? undefined);
    if (fromQuery) {
      return fromQuery;
    }
  }

  return input.fallbackView;
}

export function toBboxFromRadius(input: {
  lat: number;
  lng: number;
  radiusKm: number;
}): SearchBBox {
  const latDelta = input.radiusKm / 110.574;
  const cosLat = Math.cos((input.lat * Math.PI) / 180);
  const lngDelta = input.radiusKm / (111.32 * Math.max(0.1, Math.abs(cosLat)));

  const minLng = Math.max(-180, input.lng - lngDelta);
  const maxLng = Math.min(180, input.lng + lngDelta);
  const minLat = Math.max(-90, input.lat - latDelta);
  const maxLat = Math.min(90, input.lat + latDelta);

  return [minLng, minLat, maxLng, maxLat];
}

export function toggleSelection<T extends string>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((value) => value !== item) : [...list, item];
}
