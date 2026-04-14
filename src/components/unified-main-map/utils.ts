import maplibregl from "maplibre-gl";
import { OFFER_TYPE, type OfferType } from "@/lib/offer-type";
import type { AppLocale, AppMessages } from "@/lib/i18n";
import type { CompanyMapItem } from "@/types/company";
import { toCityCountryLocationLabel } from "@/lib/location-label";
import type { OfferMapItem, ActiveMapView } from "@/components/unified-main-map/types";
import { ALL_MAP_LAYER_IDS, VIEW_LAYER_IDS } from "@/components/unified-main-map/types";

const COMPANY_FALLBACK_COLORS = [
  "#0f766e",
  "#0369a1",
  "#7c3aed",
  "#b45309",
  "#be123c",
  "#15803d",
  "#1d4ed8",
  "#c2410c",
];

const COMPANY_MARKER = {
  standard: {
    id: "company-icon",
    background: "#0ea5e9",
  },
  premium: {
    id: "company-icon-premium",
    background: "#14b8a6",
  },
} as const;

export function toOfferFeatureCollection(
  items: OfferMapItem[],
): GeoJSON.Feature<GeoJSON.Point>[] {
  return items.map((item) => ({
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: item.mainPoint,
    },
    properties: {
      id: item.id,
      companyIsPremium: item.companyIsPremium === true,
    },
  }));
}

function companyIconId(isPremium = false): string {
  return isPremium ? COMPANY_MARKER.premium.id : COMPANY_MARKER.standard.id;
}

export function toCompanyFeatureCollection(
  companies: CompanyMapItem[],
): GeoJSON.Feature<GeoJSON.Point>[] {
  return companies.flatMap((company) => {
    const points =
      company.mapPoints && company.mapPoints.length > 0
        ? company.mapPoints
        : [
            {
              id: `${company.id}:0`,
              coordinates: company.mainPoint,
              isMain: true,
            },
          ];

    return points.map((point) => ({
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: point.coordinates,
      },
      properties: {
        id: point.id,
        companyId: company.id,
        locationLabel: point.label ?? "",
        isMainLocation: point.isMain,
        categoryIconId: companyIconId(company.isPremium),
      },
    }));
  });
}

function markerSvg(isPremium = false): string {
  const background = isPremium ? COMPANY_MARKER.premium.background : COMPANY_MARKER.standard.background;
  const premiumRing = isPremium
    ? '<circle cx="22" cy="22" r="19" fill="none" stroke="#f59e0b" stroke-width="2" opacity="0.95"/>'
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 44 44">${premiumRing}<circle cx="22" cy="22" r="16" fill="${background}" stroke="#ffffff" stroke-width="2.2"/><g transform="translate(22 22) scale(0.9) translate(-22 -22)" stroke="#ffffff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="11.5" y="14.8" width="21" height="14.4" rx="2.2" /><path d="M11.5 19.5H32.5" /><path d="M17 24H27.5" /><path d="M17 27.8H24.5" /></g></svg>`;
}

function loadSvgImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to decode SVG icon"));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

export async function ensureCategoryIcons(map: maplibregl.Map): Promise<void> {
  for (const isPremium of [false, true]) {
    const imageId = companyIconId(isPremium);
    if (map.hasImage(imageId)) {
      continue;
    }

    const icon = await loadSvgImage(markerSvg(isPremium));
    map.addImage(imageId, icon, { pixelRatio: 2 });
  }
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function getCompanyInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

export function getCompanyFallbackColor(seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }

  return COMPANY_FALLBACK_COLORS[hash % COMPANY_FALLBACK_COLORS.length];
}

export function toIntlLocale(locale: AppLocale): string {
  if (locale === "en") {
    return "en-US";
  }
  if (locale === "de") {
    return "de-DE";
  }
  if (locale === "uk") {
    return "uk-UA";
  }
  return "pl-PL";
}

export function toShortLocationLabel(input: {
  locationLabel: string;
  locationCity?: string;
  locationCountry?: string;
}): string {
  return toCityCountryLocationLabel({
    city: input.locationCity,
    country: input.locationCountry,
    fallbackLabel: input.locationLabel,
  });
}

export function getOfferTypeLabel(
  offerType: OfferType,
  messages: AppMessages["mapModules"]["offers"],
): string {
  return offerType === OFFER_TYPE.TRANSPORT
    ? messages.offerTypes.transport
    : messages.offerTypes.cooperation;
}

export function formatSpecializationsSummary(
  company: CompanyMapItem,
  mapMessages: AppMessages["map"],
  specializationLabels: AppMessages["companyCreate"]["specializationsOptions"],
): string | null {
  if (company.specializations.length === 0) {
    return null;
  }

  const labels = company.specializations
    .slice(0, 3)
    .map((specialization) => specializationLabels[specialization]);
  return company.specializations.length > 3
    ? `${labels.join(", ")} ${mapMessages.summaryAndOthers}`
    : labels.join(", ");
}

export function formatCompanySummary(
  company: CompanyMapItem,
  mapMessages: AppMessages["map"],
  operatingAreaLabels: AppMessages["mapModules"]["filters"]["operatingAreas"],
  specializationLabels: AppMessages["companyCreate"]["specializationsOptions"],
): string {
  const specializations = formatSpecializationsSummary(company, mapMessages, specializationLabels);
  if (specializations) {
    return specializations;
  }

  return `${mapMessages.summaryOperatingAreaPrefix}: ${operatingAreaLabels[company.operatingArea]}`;
}

export function matchByIds<T extends { id: string }>(
  ids: string[],
  byId: Map<string, T>,
): T[] {
  const output: T[] = [];
  const seen = new Set<string>();

  for (const id of ids) {
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    const item = byId.get(id);
    if (item) {
      output.push(item);
    }
  }

  return output;
}

export function setViewLayerVisibility(map: maplibregl.Map, view: ActiveMapView): void {
  const visible = new Set(VIEW_LAYER_IDS[view]);

  for (const layerId of ALL_MAP_LAYER_IDS) {
    if (!map.getLayer(layerId)) {
      continue;
    }

    map.setLayoutProperty(layerId, "visibility", visible.has(layerId) ? "visible" : "none");
  }
}
