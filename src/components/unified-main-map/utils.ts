import maplibregl from "maplibre-gl";
import { JOB_RATE_PERIOD, type JobRatePeriod } from "@/lib/job-announcement";
import { OFFER_TYPE, type OfferType } from "@/lib/offer-type";
import type { AppLocale, AppMessages } from "@/lib/i18n";
import type { CompanyMapItem } from "@/types/company";
import type { CompanyCategory } from "@/types/company-category";
import { toCityCountryLocationLabel } from "@/lib/location-label";
import type { JobAnnouncementMapItem, OfferMapItem, ActiveMapView } from "@/components/unified-main-map/types";
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

export const CATEGORY_META: Record<CompanyCategory, { background: string }> = {
  warehouse: { background: "#2563eb" },
  transport: { background: "#059669" },
  "freight-forwarding": { background: "#dc2626" },
  logistics: { background: "#7c3aed" },
  "staffing-agency": { background: "#881337" },
  other: { background: "#ca8a04" },
};

export function toAnnouncementFeatureCollection(
  items: JobAnnouncementMapItem[],
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

export function categoryIconId(category: CompanyCategory, isPremium = false): string {
  return `category-icon-${category}${isPremium ? "-premium" : ""}`;
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
        categoryIconId: categoryIconId(company.category, company.isPremium),
      },
    }));
  });
}

export function categoryIconBody(category: CompanyCategory): string {
  switch (category) {
    case "warehouse":
      return [
        '<path d="M11 18L22 12L33 18" />',
        '<rect x="12" y="18" width="20" height="12" rx="1.5" />',
        '<path d="M17 30V18" />',
        '<path d="M22 30V18" />',
        '<path d="M27 30V18" />',
      ].join("");
    case "transport":
      return [
        '<rect x="8.8" y="19" width="17.8" height="9.2" rx="1.1" />',
        '<rect x="26.8" y="21" width="6.2" height="7.2" rx="0.9" />',
        '<path d="M26.8 24.6H33" />',
        '<circle cx="14.5" cy="29" r="2.3" />',
        '<circle cx="28.8" cy="29" r="2.3" />',
      ].join("");
    case "freight-forwarding":
      return [
        '<rect x="10.5" y="17.5" width="23" height="11" rx="1.2" />',
        '<path d="M14 18V28.5" />',
        '<path d="M17.5 18V28.5" />',
        '<path d="M21 18V28.5" />',
        '<path d="M24.5 18V28.5" />',
        '<path d="M28 18V28.5" />',
        '<path d="M31.5 18V28.5" />',
      ].join("");
    case "logistics":
      return [
        '<rect x="16" y="18" width="12" height="9" rx="1.4" />',
        '<path d="M16 21.2H28" />',
        '<path d="M22 18V27" />',
        '<path d="M10.5 23C10.5 16.8 14.6 13 20.2 13" />',
        '<path d="M19 11.5L20.8 13L19 14.5" />',
        '<path d="M33.5 22C33.5 28.2 29.4 32 23.8 32" />',
        '<path d="M25 30.5L23.2 32L25 33.5" />',
      ].join("");
    case "staffing-agency":
      return [
        '<circle cx="22" cy="16.8" r="3" />',
        '<path d="M14.5 29.5C14.5 25.5 17.8 22.3 21.8 22.3H22.2C26.2 22.3 29.5 25.5 29.5 29.5" />',
      ].join("");
    case "other":
      return [
        '<rect x="13.5" y="14.5" width="17" height="15" rx="2" />',
        '<path d="M13.5 18H30.5" />',
        '<path d="M17.5 22H26.5" />',
        '<path d="M17.5 26H23.5" />',
      ].join("");
    default:
      return "";
  }
}

export function markerSvg(category: CompanyCategory, isPremium = false): string {
  const background = CATEGORY_META[category].background;
  const premiumRing = isPremium
    ? '<circle cx="22" cy="22" r="19" fill="none" stroke="#f59e0b" stroke-width="2" opacity="0.95"/>'
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 44 44">${premiumRing}<circle cx="22" cy="22" r="16" fill="${background}" stroke="#ffffff" stroke-width="2.2"/><g transform="translate(22 22) scale(0.9) translate(-22 -22)" stroke="#ffffff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">${categoryIconBody(category)}</g></svg>`;
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
  const categories = Object.keys(CATEGORY_META) as CompanyCategory[];

  for (const category of categories) {
    for (const isPremium of [false, true]) {
      const imageId = categoryIconId(category, isPremium);
      if (map.hasImage(imageId)) {
        continue;
      }

      const icon = await loadSvgImage(markerSvg(category, isPremium));
      map.addImage(imageId, icon, { pixelRatio: 2 });
    }
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

export function formatSalaryRange(input: {
  salaryFrom?: number;
  salaryTo?: number;
  salaryRatePeriod: JobRatePeriod;
  locale: AppLocale;
  messages: AppMessages["mapModules"]["announcements"];
  formatTemplate: (template: string, values: Record<string, string>) => string;
}): string {
  const fromValue =
    typeof input.salaryFrom === "number" &&
    Number.isFinite(input.salaryFrom) &&
    input.salaryFrom > 0
      ? input.salaryFrom
      : undefined;
  const toValue =
    typeof input.salaryTo === "number" &&
    Number.isFinite(input.salaryTo) &&
    input.salaryTo > 0
      ? input.salaryTo
      : undefined;

  if (fromValue === undefined && toValue === undefined) {
    return "-";
  }

  const formatter = new Intl.NumberFormat(toIntlLocale(input.locale), {
    maximumFractionDigits: 0,
  });
  const suffix =
    input.salaryRatePeriod === JOB_RATE_PERIOD.HOURLY
      ? input.messages.salarySuffixHourly
      : input.messages.salarySuffixMonthly;

  if (fromValue !== undefined && toValue !== undefined) {
    return input.formatTemplate(input.messages.salaryRangeTemplate, {
      from: formatter.format(fromValue),
      to: formatter.format(toValue),
      suffix,
    });
  }

  if (fromValue !== undefined) {
    return input.formatTemplate(input.messages.salaryFromTemplate, {
      value: formatter.format(fromValue),
      suffix,
    });
  }

  return input.formatTemplate(input.messages.salaryToTemplate, {
    value: formatter.format(toValue as number),
    suffix,
  });
}

export function hasSalaryRange(input: {
  salaryFrom?: number;
  salaryTo?: number;
}): boolean {
  const fromValue =
    typeof input.salaryFrom === "number" &&
    Number.isFinite(input.salaryFrom) &&
    input.salaryFrom > 0;
  const toValue =
    typeof input.salaryTo === "number" &&
    Number.isFinite(input.salaryTo) &&
    input.salaryTo > 0;
  return fromValue || toValue;
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

export function categoryToLabel(
  messages: AppMessages["map"],
  category: CompanyCategory,
): string {
  return messages.categories[category];
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
