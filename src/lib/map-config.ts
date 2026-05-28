const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_API_KEY?.trim();
const MAP_STYLE_URL_FROM_ENV = process.env.NEXT_PUBLIC_MAP_STYLE_URL?.trim();

function appendMapTilerKeyIfMissing(url: string, key?: string): string {
  if (!key) {
    return url;
  }

  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has("key")) {
      parsed.searchParams.set("key", key);
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

export const MAP_STYLE_URL = MAP_STYLE_URL_FROM_ENV
  ? appendMapTilerKeyIfMissing(MAP_STYLE_URL_FROM_ENV, MAPTILER_KEY)
  : "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

export const POLAND_BOUNDS: [[number, number], [number, number]] = [
  [14.07, 49.0],
  [24.15, 54.9],
];

export function tupleBboxToQuery(bbox: [number, number, number, number]): string {
  return bbox.map((value) => value.toFixed(6)).join(",");
}
