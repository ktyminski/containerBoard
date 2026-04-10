export function parseBbox(value?: string): [number, number, number, number] | undefined {
  if (!value) {
    return undefined;
  }

  const parts = value.split(",").map((item) => Number(item.trim()));
  if (parts.length !== 4 || parts.some((item) => Number.isNaN(item))) {
    return undefined;
  }

  const [minLng, minLat, maxLng, maxLat] = parts;
  if (minLng < -180 || maxLng > 180 || minLat < -90 || maxLat > 90) {
    return undefined;
  }
  if (minLng >= maxLng || minLat >= maxLat) {
    return undefined;
  }

  return parts as [number, number, number, number];
}
