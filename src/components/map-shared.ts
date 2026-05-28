import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl, { type StyleLayer } from "maplibre-gl";
import type { AppLocale } from "@/lib/i18n";
export { MAP_STYLE_URL, POLAND_BOUNDS, tupleBboxToQuery } from "@/lib/map-config";

const ROAD_LABEL_LAYER_HINTS = [
  "road",
  "highway",
  "motorway",
  "transport",
  "route",
  "shield",
  "street",
];

function getMapNameField(locale: AppLocale): string {
  switch (locale) {
    case "en":
      return "name:en";
    case "de":
      return "name:de";
    case "uk":
      return "name:uk";
    case "pl":
    default:
      return "name:pl";
  }
}

function collectGetFields(
  expression: unknown,
  output: Set<string> = new Set(),
): Set<string> {
  if (!Array.isArray(expression)) {
    return output;
  }

  if (
    expression.length >= 2 &&
    expression[0] === "get" &&
    typeof expression[1] === "string"
  ) {
    output.add(expression[1]);
  }

  for (const part of expression) {
    collectGetFields(part, output);
  }

  return output;
}

function shouldOverrideTextField(layerId: string, textField: unknown): boolean {
  const normalizedLayerId = layerId.toLowerCase();
  if (
    ROAD_LABEL_LAYER_HINTS.some((hint) =>
      normalizedLayerId.includes(hint),
    )
  ) {
    return false;
  }

  if (typeof textField === "string") {
    return textField.includes("name");
  }

  const fields = Array.from(collectGetFields(textField));
  if (fields.length === 0) {
    return false;
  }

  const hasNameField = fields.some(
    (field) =>
      field === "name" || field.startsWith("name:") || field.startsWith("name_"),
  );
  if (!hasNameField) {
    return false;
  }

  const hasRouteField = fields.some(
    (field) =>
      field === "ref" ||
      field.startsWith("ref:") ||
      field === "network" ||
      field.startsWith("route") ||
      field.includes("shield"),
  );

  return !hasRouteField;
}

export function applyBaseMapLanguage(
  map: maplibregl.Map,
  locale: AppLocale,
  excludedSources: string[] = [],
): void {
  const excluded = new Set(excludedSources);
  const nameField = getMapNameField(locale);
  const layers = map.getStyle()?.layers ?? [];

  for (const layer of layers) {
    const currentLayer = layer as StyleLayer & { source?: string };
    if (currentLayer.type !== "symbol") {
      continue;
    }
    if (currentLayer.source && excluded.has(currentLayer.source)) {
      continue;
    }

    const textField = map.getLayoutProperty(currentLayer.id, "text-field");
    if (!shouldOverrideTextField(currentLayer.id, textField)) {
      continue;
    }

    try {
      map.setLayoutProperty(currentLayer.id, "text-field", [
        "coalesce",
        ["get", nameField],
        ["get", "name"],
        ["get", "name:en"],
      ]);
    } catch {
      // ignore layers that don't support text-field overrides
    }
  }
}
