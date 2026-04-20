"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, type FocusEvent } from "react";
import { FormProvider, useForm } from "react-hook-form";
import maplibregl, { type GeoJSONSource } from "maplibre-gl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MAP_STYLE_URL } from "@/components/map-shared";
import {
  getContainerConditionLabel,
  getContainerFeatureLabel,
  getContainerShortLabelLocalized,
  type ContainerListingsMessages,
} from "@/components/container-listings-i18n";
import { ContainerListingsFilters } from "@/components/container-listings-filters";
import { ContainerListingsResults } from "@/components/container-listings-results";
import { useToast } from "@/components/toast-provider";
import { usePageScrollLock } from "@/components/use-page-scroll-lock";
import {
  FILTER_FORM_DEFAULTS,
  areNonLocationFiltersEqual,
  pickNonLocationFilters,
  type AppliedFilters,
  type FiltersFormValues,
  type ListingKind,
  type NonLocationFilters,
} from "@/components/container-listings-shared";
import {
  buildAppliedBaseFromFormValues,
  buildContainersApiUrl,
  getCoordinateKey,
} from "@/components/container-listings-utils";
import type {
  ContainerListingItem,
  ContainerListingMapPoint,
} from "@/lib/container-listings";
import {
  PRICE_CURRENCY_LABEL,
  type ContainerCondition,
  type ListingType,
} from "@/lib/container-listing-types";
import { LOCALE_HEADER_NAME, type AppLocale } from "@/lib/i18n";

type ContainersListApiResponse = {
  items?: ContainerListingItem[];
  meta?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  error?: string;
};

type ContainersMapApiResponse = {
  items?: ContainerListingMapPoint[];
  meta?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    truncated?: boolean;
  };
  error?: string;
};

type ContainerPopupDetailsApiResponse = {
  items?: ContainerListingItem[];
  error?: string;
};

type GeocodeSearchApiResponse = {
  item?: {
    lat: number;
    lng: number;
    label: string;
    shortLabel?: string;
  } | null;
  error?: string;
};

type FavoritesSummaryApiResponse = {
  total?: number;
  hasAny?: boolean;
  error?: string;
};

type ContainerListingsBoardProps = {
  locale: AppLocale;
  messages: ContainerListingsMessages;
  isLoggedIn: boolean;
  initialKind?: ListingKind;
  initialTab?: "all" | "favorites";
  initialMine?: boolean;
  hiddenCompanySlug?: string;
  initialCity?: string;
  initialCountry?: string;
  initialCountryCode?: string;
};

type MapFeature = {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
  properties: {
    id: string;
    type: ListingType;
    quantity: number;
  };
};

type MapFeatureCollection = {
  type: "FeatureCollection";
  features: MapFeature[];
};

const MAP_SOURCE_ID = "containers-list-source";
const MAP_CLUSTER_LAYER_ID = "containers-list-clusters";
const MAP_CLUSTER_COUNT_LAYER_ID = "containers-list-cluster-count";
const MAP_POINT_LAYER_ID = "containers-list-points";
const MAX_CLUSTER_POPUP_ITEMS = 24;
const MAX_POPUP_VISIBLE_ITEMS = 20;
const DEFAULT_MAP_CENTER: [number, number] = [19.1451, 51.9194];
const LIST_PAGE_SIZE = 20;
const GUEST_FAVORITES_STORAGE_KEY = "container-listing-favorites-v1";
const OVERLAY_CLOSE_ANIMATION_MS = 280;
const DARK_BLUE_CTA_BASE_CLASS =
  "border border-[#2f639a] bg-[linear-gradient(180deg,#082650_0%,#0c3466_100%)] text-[#e2efff] transition hover:border-[#67c7ff] hover:text-white";

function normalizeFavoriteListingIds(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const unique = new Set<string>();
  const output: string[] = [];

  for (const value of input) {
    if (typeof value !== "string") {
      continue;
    }
    const normalized = value.trim().toLowerCase();
    if (!/^[a-f0-9]{24}$/.test(normalized) || unique.has(normalized)) {
      continue;
    }
    unique.add(normalized);
    output.push(normalized);
  }

  return output;
}

function readGuestFavoriteListingIds(): string[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(GUEST_FAVORITES_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    return normalizeFavoriteListingIds(JSON.parse(raw));
  } catch {
    return [];
  }
}

function writeGuestFavoriteListingIds(ids: string[]): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      GUEST_FAVORITES_STORAGE_KEY,
      JSON.stringify(normalizeFavoriteListingIds(ids)),
    );
  } catch {
    // Ignore storage write errors in private mode/blocked storage.
  }
}

async function copyTextToClipboard(value: string): Promise<boolean> {
  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function"
  ) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Fallback below.
    }
  }

  if (typeof document === "undefined") {
    return false;
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    document.body.append(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  } catch {
    return false;
  }
}

function fitMapToPoints(
  map: maplibregl.Map,
  points: ContainerListingMapPoint[],
): void {
  if (points.length === 0) {
    map.easeTo({ center: DEFAULT_MAP_CENTER, zoom: 5, duration: 400 });
    return;
  }

  if (points.length === 1) {
    const point = points[0];
    if (point.locationLat !== null && point.locationLng !== null) {
      map.easeTo({
        center: [point.locationLng, point.locationLat],
        zoom: 8,
        duration: 500,
      });
    }
    return;
  }

  const bounds = new maplibregl.LngLatBounds();
  for (const point of points) {
    if (point.locationLat === null || point.locationLng === null) {
      continue;
    }
    bounds.extend([point.locationLng, point.locationLat]);
  }

  if (!bounds.isEmpty()) {
    map.fitBounds(bounds, { padding: 60, maxZoom: 9, duration: 500 });
  }
}

function createLocationFilterMarkerElement(): HTMLDivElement {
  const marker = document.createElement("div");
  marker.setAttribute("aria-hidden", "true");
  marker.style.position = "relative";
  marker.style.width = "26px";
  marker.style.height = "34px";

  const shadow = document.createElement("span");
  shadow.style.position = "absolute";
  shadow.style.left = "50%";
  shadow.style.bottom = "0";
  shadow.style.width = "14px";
  shadow.style.height = "5px";
  shadow.style.transform = "translateX(-50%)";
  shadow.style.borderRadius = "9999px";
  shadow.style.background = "rgba(15, 23, 42, 0.22)";
  shadow.style.filter = "blur(1px)";

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "26");
  svg.setAttribute("height", "34");
  svg.style.position = "relative";
  svg.style.display = "block";
  svg.style.overflow = "visible";
  svg.style.filter = "drop-shadow(0 10px 14px rgba(154, 52, 18, 0.25))";

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute(
    "d",
    "M12 2.25c-4.97 0-9 4.03-9 9 0 6.364 7.5 10.5 8.096 10.819a1.875 1.875 0 0 0 1.808 0C13.5 21.75 21 17.614 21 11.25c0-4.97-4.03-9-9-9Z",
  );
  path.setAttribute("fill", "#f97316");
  path.setAttribute("stroke", "#ffffff");
  path.setAttribute("stroke-width", "1.5");

  const center = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  center.setAttribute("cx", "12");
  center.setAttribute("cy", "11.25");
  center.setAttribute("r", "3.25");
  center.setAttribute("fill", "#fff7ed");

  svg.append(path, center);
  marker.append(shadow, svg);
  return marker;
}

function buildMapPopupListNode(
  locale: AppLocale,
  messages: ContainerListingsMessages,
  listings: ContainerListingItem[],
  totalItemsCount = listings.length,
  detailsHrefPrefix = "/containers",
  detailsQueryString = "",
  locationHintsByListingId?: Map<string, { lat: number; lng: number }>,
): HTMLElement {
  const scroll = document.createElement("div");
  scroll.className = "company-map-popup-scroll max-h-72 overflow-y-auto pr-1";

  const list = document.createElement("div");
  list.className = "company-map-popup-list";

  const visibleItems = listings.slice(0, MAX_POPUP_VISIBLE_ITEMS);

  for (const item of visibleItems) {
    const detailsHref = detailsQueryString
      ? `${detailsHrefPrefix}/${item.id}?${detailsQueryString}`
      : `${detailsHrefPrefix}/${item.id}`;
    const entry = document.createElement("article");
    entry.className = "company-map-popup-item";

    const card = document.createElement("article");
    card.className = "company-map-popup-card";

    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.alignItems = "flex-start";
    header.style.justifyContent = "space-between";
    header.style.gap = "8px";

    const titleLink = document.createElement("a");
    titleLink.className = "company-map-popup-card__name";
    titleLink.href = detailsHref;
    titleLink.style.flex = "1 1 auto";
    titleLink.style.minWidth = "0";
    titleLink.style.overflow = "hidden";
    titleLink.style.textOverflow = "ellipsis";
    titleLink.style.whiteSpace = "nowrap";
    const titleBase = document.createElement("span");
    titleBase.textContent = getContainerShortLabelLocalized(messages, item.container);
    const titleSeparator = document.createElement("span");
    titleSeparator.textContent = " | ";
    titleSeparator.style.color = "#94a3b8";
    const titleCondition = document.createElement("span");
    titleCondition.textContent = getContainerConditionLabel(messages, item.container.condition);
    titleCondition.style.color = getPopupConditionColor(item.container.condition);
    titleLink.append(titleBase, titleSeparator, titleCondition);

    const priceDisplay = getPopupPriceDisplay(locale, messages, item);
    if (priceDisplay) {
      const price = document.createElement("div");
      price.className = "company-map-popup-card__summary";
      price.style.marginLeft = "auto";
      price.style.flex = "0 0 auto";
      price.style.textAlign = "right";
      price.style.whiteSpace = "nowrap";
      price.style.lineHeight = "1.05";

      const amount = document.createElement("span");
      amount.textContent = priceDisplay.amountLabel;
      amount.style.display = "block";
      amount.style.fontSize = "13px";
      amount.style.fontWeight = "800";
      amount.style.color = "#b45309";

      const unit = document.createElement("span");
      unit.textContent = priceDisplay.unitLabel;
      unit.style.display = "block";
      unit.style.marginTop = "2px";
      unit.style.fontSize = "10px";
      unit.style.fontWeight = "700";
      unit.style.color = "#b45309";

      price.append(amount, unit);
      header.append(titleLink, price);
    } else {
      header.append(titleLink);
    }

    const company = document.createElement("p");
    company.className = "company-map-popup-card__category";
    company.textContent = item.companyName;

    const location = document.createElement("p");
    location.className = "company-map-popup-card__summary";
    location.textContent = getPopupLocationLabel(
      messages,
      item,
      locationHintsByListingId?.get(item.id),
    );

    const meta = document.createElement("p");
    meta.className = "company-map-popup-card__summary";
    const featureLabels = item.container.features
      .map((feature) => getContainerFeatureLabel(messages, feature))
      .filter((label) => label.trim().length > 0);
    const metaParts = [`${messages.map.quantityLabel}: ${item.quantity}`];
    if (featureLabels.length > 0) {
      metaParts.push(featureLabels.join(", "));
    }
    meta.textContent = metaParts.join(" | ");

    card.append(header, company, location, meta);
    entry.append(card);
    list.append(entry);
  }

  if (totalItemsCount > MAX_POPUP_VISIBLE_ITEMS) {
    const hint = document.createElement("p");
    hint.className = "company-map-popup-more-hint";
    hint.textContent = messages.map.moreResultsHint;
    list.append(hint);
  }

  scroll.append(list);
  return scroll;
}

function getPopupPriceDisplay(
  locale: AppLocale,
  messages: ContainerListingsMessages,
  item: ContainerListingItem,
):
  | { amountLabel: string; unitLabel: string }
  | undefined {
  const pricingAmount = item.pricing?.original.amount;
  const pricingCurrency = item.pricing?.original.currency;
  const pricingTaxMode = item.pricing?.original.taxMode;
  if (
    typeof pricingAmount === "number" &&
    Number.isFinite(pricingAmount) &&
    pricingAmount >= 0
  ) {
    const currencyLabel = pricingCurrency
      ? PRICE_CURRENCY_LABEL[pricingCurrency]
      : "PLN";
    return {
      amountLabel: `${Math.round(pricingAmount).toLocaleString(locale)}`,
      unitLabel:
        pricingTaxMode === "gross"
          ? currencyLabel
          : `${currencyLabel} ${messages.map.plusVatSuffix}`,
    };
  }

  if (
    typeof item.priceAmount === "number" &&
    Number.isFinite(item.priceAmount) &&
    item.priceAmount >= 0
  ) {
    return {
      amountLabel: `${Math.round(item.priceAmount).toLocaleString(locale)}`,
      unitLabel: `PLN ${messages.map.plusVatSuffix}`,
    };
  }

  return undefined;
}

function getPopupConditionColor(condition: ContainerCondition): string {
  if (condition === "new") {
    return "#1e3a8a";
  }
  if (condition === "one_trip") {
    return "#115e59";
  }
  if (condition === "cargo_worthy") {
    return "#065f46";
  }
  if (condition === "wind_water_tight") {
    return "#3f6212";
  }
  return "#854d0e";
}

function getPopupLocationLabel(
  messages: ContainerListingsMessages,
  item: ContainerListingItem,
  hint?: { lat: number; lng: number },
): string {
  const locations = item.locations ?? [];
  const locationToDisplay =
    locations.length > 0
      ? resolveBestLocationByHint(locations, hint)
      : null;

  const postalCode =
    locationToDisplay?.locationAddressParts?.postalCode?.trim() ||
    item.locationAddressParts?.postalCode?.trim() ||
    "";
  const city =
    locationToDisplay?.locationAddressParts?.city?.trim() ||
    locationToDisplay?.locationCity?.trim() ||
    item.locationAddressParts?.city?.trim() ||
    item.locationCity.trim();
  const country =
    locationToDisplay?.locationAddressParts?.country?.trim() ||
    locationToDisplay?.locationCountry?.trim() ||
    item.locationAddressParts?.country?.trim() ||
    item.locationCountry.trim();

  const parts = [postalCode, city, country].filter((value): value is string => {
    return Boolean(value && value.trim().length > 0);
  });
  return parts.length > 0 ? parts.join(" ") : messages.map.noLocation;
}

function resolveBestLocationByHint(
  locations: NonNullable<ContainerListingItem["locations"]>,
  hint?: { lat: number; lng: number },
) {
  if (!hint || !Number.isFinite(hint.lat) || !Number.isFinite(hint.lng)) {
    return locations.find((location) => location.isPrimary) ?? locations[0];
  }

  const epsilon = 0.00001;
  const exact = locations.find((location) => {
    return (
      Math.abs(location.locationLat - hint.lat) <= epsilon &&
      Math.abs(location.locationLng - hint.lng) <= epsilon
    );
  });
  if (exact) {
    return exact;
  }

  let closest = locations[0];
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const location of locations) {
    const latDiff = location.locationLat - hint.lat;
    const lngDiff = location.locationLng - hint.lng;
    const distance = latDiff * latDiff + lngDiff * lngDiff;
    if (distance < closestDistance) {
      closestDistance = distance;
      closest = location;
    }
  }

  return closest;
}

type PopupAnchor =
  | "top"
  | "bottom"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

function resolvePopupPlacement(
  map: maplibregl.Map,
  point: { x: number; y: number },
  itemCount: number,
): { anchor: PopupAnchor; offset: number } {
  const mapRect = map.getContainer().getBoundingClientRect();
  const markerViewportX = mapRect.left + point.x;
  const markerViewportY = mapRect.top + point.y;
  const stickyHeader = document.querySelector("header.sticky");
  const stickyHeaderBottom =
    stickyHeader instanceof HTMLElement
      ? stickyHeader.getBoundingClientRect().bottom
      : 0;
  const safeTopEdge = Math.max(8, stickyHeaderBottom + 8);
  const safeBottomEdge = 8;
  const safeHorizontalEdge = 12;
  const spaceAbove = markerViewportY - safeTopEdge;
  const spaceBelow = window.innerHeight - markerViewportY - safeBottomEdge;
  const spaceLeft = markerViewportX - mapRect.left - safeHorizontalEdge;
  const spaceRight = mapRect.right - markerViewportX - safeHorizontalEdge;
  const estimatedPopupWidth = 336;
  const estimatedPopupHeight = Math.min(320, 92 + Math.max(0, itemCount - 1) * 62);
  const requiredVerticalSpace = estimatedPopupHeight + 12;

  const canOpenAboveMarker = spaceAbove >= requiredVerticalSpace;
  const canOpenBelowMarker = spaceBelow >= requiredVerticalSpace;
  const verticalAnchor: "top" | "bottom" =
    canOpenAboveMarker || (!canOpenBelowMarker && spaceAbove >= spaceBelow)
      ? "bottom"
      : "top";

  const canCenterHorizontally =
    spaceLeft >= estimatedPopupWidth && spaceRight >= estimatedPopupWidth;
  if (canCenterHorizontally) {
    return { anchor: verticalAnchor, offset: 8 };
  }

  const shouldOpenRight = spaceRight >= spaceLeft;
  if (verticalAnchor === "bottom") {
    return { anchor: shouldOpenRight ? "bottom-left" : "bottom-right", offset: 8 };
  }
  return { anchor: shouldOpenRight ? "top-left" : "top-right", offset: 8 };
}

function ensurePopupVisibility(map: maplibregl.Map, popup: maplibregl.Popup): void {
  const popupElement = popup.getElement();
  const mapRect = map.getContainer().getBoundingClientRect();
  const popupRect = popupElement.getBoundingClientRect();
  const edgePadding = 12;

  const overflowLeft = Math.max(0, mapRect.left + edgePadding - popupRect.left);
  const overflowRight = Math.max(0, popupRect.right - (mapRect.right - edgePadding));
  const overflowTop = Math.max(0, mapRect.top + edgePadding - popupRect.top);
  const overflowBottom = Math.max(
    0,
    popupRect.bottom - (window.innerHeight - edgePadding),
  );

  const panX = overflowLeft > 0 ? overflowLeft : overflowRight > 0 ? -overflowRight : 0;
  const panY = overflowTop > 0 ? overflowTop : overflowBottom > 0 ? -overflowBottom : 0;

  if (Math.abs(panX) < 1 && Math.abs(panY) < 1) {
    return;
  }

  map.panBy([panX, panY], {
    duration: 180,
    easing: (value) => value,
  });
}

function setSourceData(map: maplibregl.Map, data: MapFeatureCollection): void {
  const source = map.getSource(MAP_SOURCE_ID);
  if (source && "setData" in source) {
    (source as maplibregl.GeoJSONSource).setData(data as never);
  }
}

const ListingsMap = memo(function ListingsMap({
  locale,
  messages,
  items,
  isVisible,
  detailsHrefPrefix,
  detailsQueryString,
  activeLocation,
  activeLocationLabel,
}: {
  locale: AppLocale;
  messages: ContainerListingsMessages;
  items: ContainerListingMapPoint[];
  isVisible: boolean;
  detailsHrefPrefix: string;
  detailsQueryString: string;
  activeLocation: { lat: number; lng: number } | null;
  activeLocationLabel?: string;
}) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const activeLocationMarkerRef = useRef<maplibregl.Marker | null>(null);
  const lastCenteredActiveLocationKeyRef = useRef<string | null>(null);
  const previousActiveLocationKeyRef = useRef<string | null>(null);
  const suppressNextAutoFitRef = useRef(false);
  const wasVisibleRef = useRef(false);
  const popupRequestSeqRef = useRef(0);
  const hasAutoFittedViewRef = useRef(false);
  const itemsByCoordinateRef = useRef<Map<string, ContainerListingMapPoint[]>>(
    new Map(),
  );
  const detailsByIdRef = useRef<Map<string, ContainerListingItem>>(new Map());
  const featureCollectionRef = useRef<MapFeatureCollection>({
    type: "FeatureCollection",
    features: [],
  });

  const points = useMemo(
    () =>
      items.filter(
        (item) =>
          Number.isFinite(item.locationLat) &&
          Number.isFinite(item.locationLng) &&
          item.locationLat !== null &&
          item.locationLng !== null,
      ),
    [items],
  );
  const requestHeaders = useMemo(
    () => ({
      [LOCALE_HEADER_NAME]: locale,
      "Accept-Language": locale,
    }),
    [locale],
  );

  const featureCollection = useMemo<MapFeatureCollection>(
    () => ({
      type: "FeatureCollection",
      features: points.map((item) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [item.locationLng as number, item.locationLat as number],
        },
        properties: {
          id: item.id,
          type: item.type,
          quantity: item.quantity,
        },
      })),
    }),
    [points],
  );

  const loadPopupDetailsByIds = useCallback(async (ids: string[]) => {
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
    if (uniqueIds.length === 0) {
      return [];
    }

    const cached = detailsByIdRef.current;
    const missingIds = uniqueIds.filter((id) => !cached.has(id));

    if (missingIds.length > 0) {
      try {
        const params = new URLSearchParams({
          ids: missingIds.join(","),
        });
        const response = await fetch(`/api/containers?${params.toString()}`, {
          cache: "no-store",
          headers: requestHeaders,
        });
        const data = (await response.json()) as ContainerPopupDetailsApiResponse;
        if (response.ok) {
          for (const item of data.items ?? []) {
            cached.set(item.id, item);
          }
        }
      } catch {
        // Ignore popup detail loading errors; keeping interaction responsive.
      }
    }

    return uniqueIds
      .map((id) => cached.get(id))
      .filter((item): item is ContainerListingItem => Boolean(item));
  }, [requestHeaders]);

  useEffect(() => {
    const nextByCoordinate = new Map<string, ContainerListingMapPoint[]>();

    for (const item of points) {
      if (item.locationLat === null || item.locationLng === null) {
        continue;
      }

      const key = getCoordinateKey(item.locationLat, item.locationLng);
      const grouped = nextByCoordinate.get(key) ?? [];
      grouped.push(item);
      nextByCoordinate.set(key, grouped);
    }

    itemsByCoordinateRef.current = nextByCoordinate;
    featureCollectionRef.current = featureCollection;
  }, [featureCollection, points]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE_URL,
      center: DEFAULT_MAP_CENTER,
      zoom: 5,
      maxZoom: 18,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("load", () => {
      if (!map.getSource(MAP_SOURCE_ID)) {
        map.addSource(MAP_SOURCE_ID, {
          type: "geojson",
          data: featureCollectionRef.current,
          cluster: true,
          clusterProperties: {
            containerCount: ["+", ["get", "quantity"]],
          },
          clusterMaxZoom: 12,
          clusterRadius: 52,
        });
      }

      if (!map.getLayer(MAP_CLUSTER_LAYER_ID)) {
        map.addLayer({
          id: MAP_CLUSTER_LAYER_ID,
          type: "circle",
          source: MAP_SOURCE_ID,
          filter: ["has", "point_count"],
          paint: {
            "circle-color": [
              "step",
              ["get", "point_count"],
              "#d1d5db",
              10,
              "#64748b",
              40,
              "#334155",
            ],
            "circle-radius": [
              "step",
              ["get", "point_count"],
              16,
              10,
              22,
              40,
              28,
            ],
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          },
        });
      }

      if (!map.getLayer(MAP_CLUSTER_COUNT_LAYER_ID)) {
        map.addLayer({
          id: MAP_CLUSTER_COUNT_LAYER_ID,
          type: "symbol",
          source: MAP_SOURCE_ID,
          filter: ["has", "point_count"],
          layout: {
            "text-field": [
              "to-string",
              ["coalesce", ["get", "containerCount"], ["get", "point_count"]],
            ],
            "text-size": 12,
            "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
          },
          paint: {
            "text-color": ["step", ["get", "point_count"], "#0f172a", 10, "#f8fafc"],
            "text-halo-color": [
              "step",
              ["get", "point_count"],
              "rgba(255, 255, 255, 0.9)",
              10,
              "rgba(15, 23, 42, 0.55)",
            ],
            "text-halo-width": 1,
          },
        });
      }

      if (!map.getLayer(MAP_POINT_LAYER_ID)) {
        map.addLayer({
          id: MAP_POINT_LAYER_ID,
          type: "circle",
          source: MAP_SOURCE_ID,
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-radius": 7,
            "circle-color": "#64748b",
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          },
        });
      }

      map.on("mouseenter", MAP_CLUSTER_LAYER_ID, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", MAP_CLUSTER_LAYER_ID, () => {
        map.getCanvas().style.cursor = "";
      });
      map.on("mouseenter", MAP_CLUSTER_COUNT_LAYER_ID, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", MAP_CLUSTER_COUNT_LAYER_ID, () => {
        map.getCanvas().style.cursor = "";
      });
      map.on("mouseenter", MAP_POINT_LAYER_ID, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", MAP_POINT_LAYER_ID, () => {
        map.getCanvas().style.cursor = "";
      });

      const handleClusterClick = (event: maplibregl.MapLayerMouseEvent) => {
        const requestSeq = ++popupRequestSeqRef.current;
        const clickPoint = event.point;
        const feature =
          event.features?.[0] ??
          map.queryRenderedFeatures(clickPoint, {
            layers: [MAP_CLUSTER_LAYER_ID, MAP_CLUSTER_COUNT_LAYER_ID],
          })[0];
        if (!feature || feature.geometry.type !== "Point") {
          return;
        }

        const clusterIdRaw = feature.properties?.cluster_id;
        const clusterId = Number(clusterIdRaw);
        const clusterTotalCount = Number(feature.properties?.point_count ?? 0);
        if (!Number.isFinite(clusterId)) {
          return;
        }

        const source = map.getSource(MAP_SOURCE_ID) as
          | GeoJSONSource
          | undefined;
        if (!source) {
          return;
        }

        void source
          .getClusterLeaves(clusterId, MAX_CLUSTER_POPUP_ITEMS, 0)
          .then(async (clusterFeatures) => {
            const idsSet = new Set<string>();
            const locationHintsByListingId = new Map<
              string,
              { lat: number; lng: number }
            >();
            for (const clusterFeature of clusterFeatures) {
              const id = String(clusterFeature.properties?.id ?? "");
              if (!id) {
                continue;
              }
              idsSet.add(id);
              if (locationHintsByListingId.has(id)) {
                continue;
              }
              if (clusterFeature.geometry.type !== "Point") {
                continue;
              }
              const [lng, lat] = clusterFeature.geometry.coordinates;
              if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                continue;
              }
              locationHintsByListingId.set(id, { lat, lng });
            }
            const ids = Array.from(idsSet);
            const grouped = await loadPopupDetailsByIds(ids);

            if (requestSeq !== popupRequestSeqRef.current || grouped.length === 0) {
              return;
            }

            const [lng, lat] = (feature.geometry as GeoJSON.Point)
              .coordinates as [number, number];
            const popupPlacement = resolvePopupPlacement(map, clickPoint, grouped.length);
            popupRef.current?.remove();
            const nextPopup = new maplibregl.Popup({
              offset: popupPlacement.offset,
              anchor: popupPlacement.anchor,
              className: "company-map-popup",
              closeButton: false,
              closeOnClick: true,
              maxWidth: "340px",
            })
              .setLngLat([lng, lat])
              .setDOMContent(
                buildMapPopupListNode(
                  locale,
                  messages,
                  grouped,
                  Number.isFinite(clusterTotalCount)
                    ? Math.max(clusterTotalCount, grouped.length)
                    : grouped.length,
                  detailsHrefPrefix,
                  detailsQueryString,
                  locationHintsByListingId,
                ),
              )
              .addTo(map);
            popupRef.current = nextPopup;
            window.requestAnimationFrame(() => {
              if (popupRef.current === nextPopup) {
                ensurePopupVisibility(map, nextPopup);
              }
            });
          })
          .catch(() => {
            // Ignore cluster popup errors and keep map interaction responsive.
          });
      };

      map.on("click", MAP_CLUSTER_LAYER_ID, handleClusterClick);
      map.on("click", MAP_CLUSTER_COUNT_LAYER_ID, handleClusterClick);

      map.on("click", MAP_POINT_LAYER_ID, (event) => {
        const requestSeq = ++popupRequestSeqRef.current;
        const feature =
          event.features?.[0] ??
          map.queryRenderedFeatures(event.point, {
            layers: [MAP_POINT_LAYER_ID],
          })[0];
        if (!feature || feature.geometry.type !== "Point") {
          return;
        }

        const listingId = String(feature.properties?.id ?? "");
        const coordinates = (feature.geometry as GeoJSON.Point)
          .coordinates as [number, number];
        const clickedLng = Number(coordinates[0]);
        const clickedLat = Number(coordinates[1]);
        if (!Number.isFinite(clickedLng) || !Number.isFinite(clickedLat)) {
          return;
        }

        const key = getCoordinateKey(clickedLat, clickedLng);
        const featureTypeRaw =
          typeof feature.properties?.type === "string"
            ? feature.properties.type
            : "";
        const grouped = (
          itemsByCoordinateRef.current.get(key) ?? [
            {
              id: listingId,
              type:
                featureTypeRaw === "buy"
                  ? "buy"
                  : featureTypeRaw === "rent"
                    ? "rent"
                    : "sell",
              quantity: 1,
              locationLat: clickedLat,
              locationLng: clickedLng,
            } satisfies ContainerListingMapPoint,
          ]
        ).slice();
        const groupedIds = grouped
          .map((item) => item.id)
          .filter(Boolean);
        if (groupedIds.length === 0 && listingId) {
          groupedIds.push(listingId);
        }
        const locationHintsByListingId = new Map<string, { lat: number; lng: number }>();
        for (const groupedItem of grouped) {
          if (
            groupedItem.locationLat === null ||
            groupedItem.locationLng === null ||
            !Number.isFinite(groupedItem.locationLat) ||
            !Number.isFinite(groupedItem.locationLng)
          ) {
            continue;
          }
          if (locationHintsByListingId.has(groupedItem.id)) {
            continue;
          }
          locationHintsByListingId.set(groupedItem.id, {
            lat: groupedItem.locationLat,
            lng: groupedItem.locationLng,
          });
        }
        if (listingId && !locationHintsByListingId.has(listingId)) {
          locationHintsByListingId.set(listingId, {
            lat: clickedLat,
            lng: clickedLng,
          });
        }

        void loadPopupDetailsByIds(groupedIds).then((details) => {
          if (requestSeq !== popupRequestSeqRef.current || details.length === 0) {
            return;
          }

          const popupPlacement = resolvePopupPlacement(map, event.point, details.length);
          popupRef.current?.remove();
          const nextPopup = new maplibregl.Popup({
            offset: popupPlacement.offset,
            anchor: popupPlacement.anchor,
            className: "company-map-popup",
            closeButton: false,
            closeOnClick: true,
            maxWidth: "340px",
          })
            .setLngLat([clickedLng, clickedLat])
            .setDOMContent(
              buildMapPopupListNode(
                locale,
                messages,
                details,
                groupedIds.length,
                detailsHrefPrefix,
                detailsQueryString,
                locationHintsByListingId,
              ),
            )
            .addTo(map);
          popupRef.current = nextPopup;
          window.requestAnimationFrame(() => {
            if (popupRef.current === nextPopup) {
              ensurePopupVisibility(map, nextPopup);
            }
          });
        });
      });

      setSourceData(map, featureCollectionRef.current);
    });

    mapRef.current = map;

    return () => {
      popupRef.current?.remove();
      popupRef.current = null;
      activeLocationMarkerRef.current?.remove();
      activeLocationMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [detailsHrefPrefix, detailsQueryString, loadPopupDetailsByIds, locale, messages]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
      return;
    }

    popupRef.current?.remove();
    popupRef.current = null;
    setSourceData(map, featureCollection);
  }, [featureCollection]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
      return;
    }

    if (
      !activeLocation ||
      !Number.isFinite(activeLocation.lat) ||
      !Number.isFinite(activeLocation.lng)
    ) {
      activeLocationMarkerRef.current?.remove();
      activeLocationMarkerRef.current = null;
      return;
    }

    const popup = new maplibregl.Popup({
      closeButton: false,
      offset: 18,
      className: "company-map-popup",
    }).setText(activeLocationLabel?.trim() || messages.map.selectedLocation);

    if (activeLocationMarkerRef.current) {
      activeLocationMarkerRef.current
        .setLngLat([activeLocation.lng, activeLocation.lat])
        .setPopup(popup);
      return;
    }

    activeLocationMarkerRef.current = new maplibregl.Marker({
      element: createLocationFilterMarkerElement(),
      anchor: "bottom",
    })
      .setLngLat([activeLocation.lng, activeLocation.lat])
      .setPopup(popup)
      .addTo(map);
  }, [activeLocation, activeLocationLabel, messages.map.selectedLocation]);

  useEffect(() => {
    hasAutoFittedViewRef.current = false;
  }, [points]);

  useEffect(() => {
    const becameVisible = isVisible && !wasVisibleRef.current;
    wasVisibleRef.current = isVisible;

    if (
      !activeLocation ||
      !Number.isFinite(activeLocation.lat) ||
      !Number.isFinite(activeLocation.lng)
    ) {
      lastCenteredActiveLocationKeyRef.current = null;
      return;
    }

    const nextLocationKey = `${activeLocation.lat.toFixed(6)}:${activeLocation.lng.toFixed(6)}`;
    previousActiveLocationKeyRef.current = nextLocationKey;
    const locationChanged = lastCenteredActiveLocationKeyRef.current !== nextLocationKey;
    lastCenteredActiveLocationKeyRef.current = nextLocationKey;

    const map = mapRef.current;
    if (!map || !isVisible || (!becameVisible && !locationChanged)) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      map.resize();
      map.easeTo({
        center: [activeLocation.lng, activeLocation.lat],
        zoom: map.getZoom(),
        duration: 500,
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeLocation, isVisible]);

  useEffect(() => {
    if (
      activeLocation &&
      Number.isFinite(activeLocation.lat) &&
      Number.isFinite(activeLocation.lng)
    ) {
      return;
    }

    if (previousActiveLocationKeyRef.current) {
      suppressNextAutoFitRef.current = true;
    }

    previousActiveLocationKeyRef.current = null;
  }, [activeLocation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isVisible) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      map.resize();
      if (
        activeLocation &&
        Number.isFinite(activeLocation.lat) &&
        Number.isFinite(activeLocation.lng)
      ) {
        return;
      }

      if (suppressNextAutoFitRef.current) {
        suppressNextAutoFitRef.current = false;
        hasAutoFittedViewRef.current = true;
        return;
      }

      if (!hasAutoFittedViewRef.current && points.length > 0) {
        fitMapToPoints(map, points);
        hasAutoFittedViewRef.current = true;
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeLocation, isVisible, points]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent): void {
      const popup = popupRef.current;
      if (!popup) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (mapContainerRef.current?.contains(target)) {
        return;
      }

      popup.remove();
      popupRef.current = null;
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  return (
    <div className="relative">
      <div
        ref={mapContainerRef}
        className="container-listings-map h-[320px] w-full overflow-visible md:h-[420px]"
      />
    </div>
  );
});
ListingsMap.displayName = "ListingsMap";

export function ContainerListingsBoard({
  locale,
  messages,
  isLoggedIn,
  initialKind = "sell",
  initialTab = "all",
  initialMine = false,
  hiddenCompanySlug,
  initialCity,
  initialCountry,
  initialCountryCode,
}: ContainerListingsBoardProps) {
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const detailsHrefPrefix = pathname.startsWith("/list")
    ? "/list/containers"
    : "/containers";
  const detailsQueryString = searchParams.toString();
  const isDetailsOverlayRouteActive = pathname.startsWith("/list/containers/");

  const [items, setItems] = useState<ContainerListingItem[]>([]);
  const [mapItems, setMapItems] = useState<ContainerListingMapPoint[]>([]);
  const [hasLoadedMapDataOnce, setHasLoadedMapDataOnce] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [activeTab, setActiveTab] = useState<"all" | "favorites">(initialTab);
  const [pendingFavoriteId, setPendingFavoriteId] = useState<string | null>(null);
  const [hasAnyFavorites, setHasAnyFavorites] = useState(false);
  const [hasResolvedFavoritesVisibility, setHasResolvedFavoritesVisibility] = useState(false);
  const [favoritesPresenceRefreshVersion, setFavoritesPresenceRefreshVersion] = useState(0);
  const [guestFavoriteListingIds, setGuestFavoriteListingIds] = useState<string[]>([]);
  const [hasHydratedGuestFavorites, setHasHydratedGuestFavorites] = useState(isLoggedIn);

  const [isMapOpen, setIsMapOpen] = useState(true);
  const [pendingDetailsNavigation, setPendingDetailsNavigation] = useState<{
    listHref: string;
  } | null>(null);
  const [isPendingOverlayClosing, setIsPendingOverlayClosing] = useState(false);
  const pendingOverlayCloseTimeoutRef = useRef<number | null>(null);
  const pendingOverlayOpenRafRef = useRef<number | null>(null);
  const cancelledPendingOverlayListHrefRef = useRef<string | null>(null);
  const locationControlsRef = useRef<HTMLDivElement | null>(null);
  const resultsTopRef = useRef<HTMLDivElement | null>(null);
  const hasSeenFirstAppliedFiltersRef = useRef(false);

  const [isResolvingLocation, setIsResolvingLocation] = useState(false);
  const [locationFilterError, setLocationFilterError] = useState<string | null>(null);

  const formMethods = useForm<FiltersFormValues>({
    defaultValues: {
      ...FILTER_FORM_DEFAULTS,
      listingKind: initialKind,
      city: initialCity ?? FILTER_FORM_DEFAULTS.city,
      country: initialCountry ?? FILTER_FORM_DEFAULTS.country,
      countryCode: initialCountryCode ?? FILTER_FORM_DEFAULTS.countryCode,
    },
  });
  const { handleSubmit, reset, getValues, setValue } = formMethods;

  const [appliedFilters, setAppliedFilters] = useState<AppliedFilters>({
    listingKind: initialKind,
    locationQuery: "",
    locationCenter: null,
    locationRadiusKm: FILTER_FORM_DEFAULTS.locationRadiusKmInput,
    containerSizes: FILTER_FORM_DEFAULTS.containerSizes,
    containerHeights: FILTER_FORM_DEFAULTS.containerHeights,
    containerTypes: FILTER_FORM_DEFAULTS.containerTypes,
    containerConditions: FILTER_FORM_DEFAULTS.containerConditions,
    containerFeatures: FILTER_FORM_DEFAULTS.containerFeatures,
    containerRalColors: [],
    priceNegotiableOnly: FILTER_FORM_DEFAULTS.priceNegotiableOnly,
    logisticsTransportOnly: FILTER_FORM_DEFAULTS.logisticsTransportOnly,
    logisticsUnloadingOnly: FILTER_FORM_DEFAULTS.logisticsUnloadingOnly,
    hasCscPlateOnly: FILTER_FORM_DEFAULTS.hasCscPlateOnly,
    hasCscCertificationOnly: FILTER_FORM_DEFAULTS.hasCscCertificationOnly,
    priceCurrency: FILTER_FORM_DEFAULTS.priceCurrency,
    priceDisplayCurrency: FILTER_FORM_DEFAULTS.priceDisplayCurrency,
    priceTaxMode: FILTER_FORM_DEFAULTS.priceTaxMode,
    priceMinInput: FILTER_FORM_DEFAULTS.priceMinInput,
    priceMaxInput: FILTER_FORM_DEFAULTS.priceMaxInput,
    productionYearInput: FILTER_FORM_DEFAULTS.productionYearInput,
    city: initialCity ?? FILTER_FORM_DEFAULTS.city,
    country: initialCountry ?? FILTER_FORM_DEFAULTS.country,
    countryCode: initialCountryCode ?? FILTER_FORM_DEFAULTS.countryCode,
    sortPreset: FILTER_FORM_DEFAULTS.sortPreset,
  });
  const isFavoritesTab = activeTab === "favorites";
  const shouldShowFavoritesToggle = hasResolvedFavoritesVisibility && hasAnyFavorites;
  const guestFavoriteListingIdSet = useMemo(
    () => new Set(guestFavoriteListingIds),
    [guestFavoriteListingIds],
  );
  const localFavoriteIdsForApi = useMemo(
    () => (isLoggedIn ? [] : guestFavoriteListingIds),
    [guestFavoriteListingIds, isLoggedIn],
  );

  const isLocationApplied = appliedFilters.locationQuery.trim().length > 0;
  const isDetailsOverlayPending = pendingDetailsNavigation !== null;
  usePageScrollLock(isDetailsOverlayPending && !isDetailsOverlayRouteActive);
  const currentListHref = useMemo(() => {
    const params = searchParams.toString();
    return params ? `${pathname}?${params}` : pathname;
  }, [pathname, searchParams]);
  const requestHeaders = useMemo(
    () => ({
      [LOCALE_HEADER_NAME]: locale,
      "Accept-Language": locale,
    }),
    [locale],
  );

  const redirectToLogin = useCallback(() => {
    const query = searchParams.toString();
    const nextPath = query ? `${pathname}?${query}` : pathname;
    window.location.href = `/login?next=${encodeURIComponent(nextPath)}`;
  }, [pathname, searchParams]);

  useEffect(() => {
    return () => {
      if (pendingOverlayCloseTimeoutRef.current !== null) {
        window.clearTimeout(pendingOverlayCloseTimeoutRef.current);
      }
      if (pendingOverlayOpenRafRef.current !== null) {
        window.cancelAnimationFrame(pendingOverlayOpenRafRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isDetailsOverlayRouteActive) {
      return;
    }
    if (cancelledPendingOverlayListHrefRef.current) {
      const cancelledListHref = cancelledPendingOverlayListHrefRef.current;
      cancelledPendingOverlayListHrefRef.current = null;
      if (pendingOverlayOpenRafRef.current !== null) {
        window.cancelAnimationFrame(pendingOverlayOpenRafRef.current);
        pendingOverlayOpenRafRef.current = null;
      }
      if (pendingOverlayCloseTimeoutRef.current !== null) {
        window.clearTimeout(pendingOverlayCloseTimeoutRef.current);
        pendingOverlayCloseTimeoutRef.current = null;
      }
      setPendingDetailsNavigation(null);
      setIsPendingOverlayClosing(false);
      router.replace(cancelledListHref, { scroll: false });
      return;
    }
    if (pendingOverlayCloseTimeoutRef.current !== null) {
      window.clearTimeout(pendingOverlayCloseTimeoutRef.current);
      pendingOverlayCloseTimeoutRef.current = null;
    }
    if (pendingOverlayOpenRafRef.current !== null) {
      window.cancelAnimationFrame(pendingOverlayOpenRafRef.current);
      pendingOverlayOpenRafRef.current = null;
    }
    setPendingDetailsNavigation(null);
    setIsPendingOverlayClosing(false);
  }, [isDetailsOverlayRouteActive, router]);

  useEffect(() => {
    if (!isDetailsOverlayPending || isDetailsOverlayRouteActive) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setPendingDetailsNavigation(null);
      setIsPendingOverlayClosing(false);
    }, 10000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isDetailsOverlayPending, isDetailsOverlayRouteActive]);

  useEffect(() => {
    if (isLoggedIn) {
      setHasHydratedGuestFavorites(true);
      setGuestFavoriteListingIds([]);
      setHasResolvedFavoritesVisibility(false);
      return;
    }

    setGuestFavoriteListingIds(readGuestFavoriteListingIds());
    setHasHydratedGuestFavorites(true);
    setHasResolvedFavoritesVisibility(true);
  }, [isLoggedIn]);

  useEffect(() => {
    if (isLoggedIn || !hasHydratedGuestFavorites) {
      return;
    }

    setHasAnyFavorites(guestFavoriteListingIds.length > 0);
  }, [guestFavoriteListingIds, hasHydratedGuestFavorites, isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) {
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams();
    if (initialMine) {
      params.set("mine", "1");
    }

    async function resolveFavoritesVisibility() {
      try {
        const response = await fetch(`/api/containers/favorites/summary?${params.toString()}`, {
          cache: "no-store",
          headers: requestHeaders,
          signal: controller.signal,
        });
        const data = (await response.json().catch(() => null)) as FavoritesSummaryApiResponse | null;
        if (!response.ok || controller.signal.aborted) {
          return;
        }
        setHasAnyFavorites(data?.hasAny === true || (data?.total ?? 0) > 0);
      } catch {
        if (!controller.signal.aborted) {
          setHasAnyFavorites(false);
        }
      } finally {
        if (!controller.signal.aborted) {
          setHasResolvedFavoritesVisibility(true);
        }
      }
    }

    void resolveFavoritesVisibility();
    return () => {
      controller.abort();
    };
  }, [favoritesPresenceRefreshVersion, initialMine, isLoggedIn, requestHeaders]);

  useEffect(() => {
    if (activeTab !== "favorites" || !hasResolvedFavoritesVisibility || hasAnyFavorites) {
      return;
    }

    setActiveTab("all");
    setPage(1);
  }, [activeTab, hasAnyFavorites, hasResolvedFavoritesVisibility]);

  const restoreAppliedLocationOnBlur = useCallback(
    (event: FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
      if (!isLocationApplied) {
        return;
      }

      const nextFocused = event.relatedTarget;
      if (nextFocused instanceof Node && locationControlsRef.current?.contains(nextFocused)) {
        return;
      }

      const currentLocationInput = getValues("locationInput").trim();
      const currentRadius = getValues("locationRadiusKmInput");
      if (currentLocationInput !== appliedFilters.locationQuery) {
        setValue("locationInput", appliedFilters.locationQuery, {
          shouldDirty: false,
          shouldTouch: true,
        });
      }
      if (currentRadius !== appliedFilters.locationRadiusKm) {
        setValue("locationRadiusKmInput", appliedFilters.locationRadiusKm, {
          shouldDirty: false,
          shouldTouch: true,
        });
      }
    },
    [
      appliedFilters.locationQuery,
      appliedFilters.locationRadiusKm,
      getValues,
      isLocationApplied,
      setValue,
    ],
  );

  const clearLocationFilter = useCallback(() => {
    setValue("locationInput", "", {
      shouldDirty: true,
      shouldTouch: true,
    });
    setLocationFilterError(null);
    setPage(1);
    setAppliedFilters((current) => ({
      ...current,
      locationQuery: "",
      locationCenter: null,
    }));
  }, [setValue]);

  const applyNonLocationFilters = useCallback((nextFilters: NonLocationFilters) => {
    setPage(1);
    setAppliedFilters((current) => {
      const currentNonLocationFilters = pickNonLocationFilters(current);
      if (areNonLocationFiltersEqual(nextFilters, currentNonLocationFilters)) {
        return current;
      }

      return {
        ...current,
        ...nextFilters,
      };
    });
  }, []);

  const submitFilters = handleSubmit(async (values) => {
    const trimmedLocationQuery = values.locationInput.trim();
    const nextBase = buildAppliedBaseFromFormValues(values);

    setPage(1);
    setLocationFilterError(null);

    if (!trimmedLocationQuery) {
      setAppliedFilters({
        ...nextBase,
        locationQuery: "",
        locationCenter: null,
      });
      return;
    }

    if (trimmedLocationQuery.length < 3) {
      setLocationFilterError(messages.filters.locationMinChars);
      setAppliedFilters({
        ...nextBase,
        locationQuery: "",
        locationCenter: null,
      });
      return;
    }

    setIsResolvingLocation(true);

    try {
      const response = await fetch(
        `/api/geocode?q=${encodeURIComponent(trimmedLocationQuery)}&lang=${encodeURIComponent(locale)}&limit=1`,
        {
          cache: "no-store",
          headers: requestHeaders,
        },
      );
      const data = (await response.json()) as GeocodeSearchApiResponse;

      if (!response.ok || data.error) {
        throw new Error(data.error ?? `Blad geokodowania (${response.status})`);
      }

      if (!data.item) {
        setLocationFilterError(messages.filters.locationResolveError);
        setAppliedFilters({
          ...nextBase,
          locationQuery: trimmedLocationQuery,
          locationCenter: null,
        });
        return;
      }

      setAppliedFilters({
        ...nextBase,
        locationQuery: trimmedLocationQuery,
        locationCenter: { lat: data.item.lat, lng: data.item.lng },
      });
    } catch {
      setLocationFilterError(messages.filters.locationResolveError);
      setAppliedFilters({
        ...nextBase,
        locationQuery: trimmedLocationQuery,
        locationCenter: null,
      });
    } finally {
      setIsResolvingLocation(false);
    }
  });

  const requestUrl = useMemo(
    () =>
      buildContainersApiUrl({
        appliedFilters,
        page,
        favoritesOnly: isFavoritesTab,
        localFavoriteIds: localFavoriteIdsForApi,
        mineOnly: initialMine,
        companySlug: hiddenCompanySlug,
      }),
    [
      appliedFilters,
      hiddenCompanySlug,
      initialMine,
      isFavoritesTab,
      localFavoriteIdsForApi,
      page,
    ],
  );

  const mapRequestUrl = useMemo(
    () =>
      buildContainersApiUrl({
        appliedFilters,
        mapView: true,
        favoritesOnly: isFavoritesTab,
        localFavoriteIds: localFavoriteIdsForApi,
        mineOnly: initialMine,
        companySlug: hiddenCompanySlug,
      }),
    [appliedFilters, hiddenCompanySlug, initialMine, isFavoritesTab, localFavoriteIdsForApi],
  );

  useEffect(() => {
    if (!hasSeenFirstAppliedFiltersRef.current) {
      hasSeenFirstAppliedFiltersRef.current = true;
      return;
    }

    const targetElement = resultsTopRef.current;
    if (!targetElement) {
      return;
    }

    const targetTop = targetElement.getBoundingClientRect().top + window.scrollY;
    const shouldScrollToResults = window.scrollY > targetTop - 140;
    if (!shouldScrollToResults) {
      return;
    }

    window.requestAnimationFrame(() => {
      targetElement.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, [appliedFilters]);

  useEffect(() => {
    if (!isLoggedIn && !hasHydratedGuestFavorites) {
      return;
    }

    const controller = new AbortController();

    async function loadContainers() {
      setIsLoading(true);

      try {
        const response = await fetch(requestUrl, {
          cache: "no-store",
          headers: requestHeaders,
          signal: controller.signal,
        });
        const data = (await response.json()) as ContainersListApiResponse;
        if (!response.ok) {
          throw new Error(data.error ?? `${messages.board.apiErrorPrefix} (${response.status})`);
        }

        if (controller.signal.aborted) {
          return;
        }

        const baseItems = data.items ?? [];
        const nextItems = isLoggedIn
          ? baseItems
          : baseItems.map((item) => ({
              ...item,
              isFavorite: guestFavoriteListingIdSet.has(item.id),
            }));

        setError(null);
        setItems(nextItems);
        setTotalPages(data.meta?.totalPages ?? 1);
        setTotal(data.meta?.total ?? 0);
      } catch (loadError) {
        if (controller.signal.aborted) {
          return;
        }
        setError(
          loadError instanceof Error ? loadError.message : messages.board.loadError,
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadContainers();

    return () => {
      controller.abort();
    };
  }, [
    guestFavoriteListingIdSet,
    hasHydratedGuestFavorites,
    isLoggedIn,
    messages.board.apiErrorPrefix,
    messages.board.loadError,
    requestHeaders,
    requestUrl,
  ]);

  useEffect(() => {
    if (!isLoggedIn && !hasHydratedGuestFavorites) {
      return;
    }

    const controller = new AbortController();

    async function loadMapContainers() {
      try {
        const response = await fetch(mapRequestUrl, {
          cache: "no-store",
          headers: requestHeaders,
          signal: controller.signal,
        });
        const data = (await response.json()) as ContainersMapApiResponse;
        if (!response.ok) {
          throw new Error(data.error ?? `${messages.board.mapApiErrorPrefix} (${response.status})`);
        }

        if (controller.signal.aborted) {
          return;
        }

        setMapItems(data.items ?? []);
        setHasLoadedMapDataOnce(true);
      } catch {
        if (controller.signal.aborted) {
          return;
        }
        setMapItems([]);
      }
    }

    void loadMapContainers();

    return () => {
      controller.abort();
    };
  }, [hasHydratedGuestFavorites, isLoggedIn, mapRequestUrl, messages.board.mapApiErrorPrefix, requestHeaders]);

  const clearAllFilters = useCallback(() => {
    reset(FILTER_FORM_DEFAULTS);
    setAppliedFilters({
      listingKind: "sell",
      locationQuery: "",
      locationCenter: null,
      locationRadiusKm: FILTER_FORM_DEFAULTS.locationRadiusKmInput,
      containerSizes: [],
      containerHeights: [],
      containerTypes: [],
      containerConditions: [],
      containerFeatures: [],
      containerRalColors: [],
      priceNegotiableOnly: false,
      logisticsTransportOnly: false,
      logisticsUnloadingOnly: false,
      hasCscPlateOnly: false,
      hasCscCertificationOnly: false,
      priceCurrency: FILTER_FORM_DEFAULTS.priceCurrency,
      priceDisplayCurrency: FILTER_FORM_DEFAULTS.priceDisplayCurrency,
      priceTaxMode: FILTER_FORM_DEFAULTS.priceTaxMode,
      priceMinInput: FILTER_FORM_DEFAULTS.priceMinInput,
      priceMaxInput: FILTER_FORM_DEFAULTS.priceMaxInput,
      productionYearInput: FILTER_FORM_DEFAULTS.productionYearInput,
      city: FILTER_FORM_DEFAULTS.city,
      country: FILTER_FORM_DEFAULTS.country,
      countryCode: FILTER_FORM_DEFAULTS.countryCode,
      sortPreset: FILTER_FORM_DEFAULTS.sortPreset,
    });
    setPage(1);
    setLocationFilterError(null);
  }, [reset]);

  const goToPreviousPage = useCallback(() => {
    setPage((current) => Math.max(1, current - 1));
  }, []);

  const goToNextPage = useCallback(() => {
    setPage((current) => Math.min(totalPages, current + 1));
  }, [totalPages]);

  const handleTabChange = useCallback(
    (nextTab: "all" | "favorites") => {
      if (nextTab === activeTab) {
        return;
      }

      setActiveTab(nextTab);
      setPage(1);
    },
    [activeTab],
  );

  const removeListingFromFavoritesView = useCallback((listingId: string) => {
    setItems((current) => current.filter((item) => item.id !== listingId));
    setMapItems((current) => current.filter((item) => item.id !== listingId));
    setTotal((currentTotal) => {
      const nextTotal = Math.max(0, currentTotal - 1);
      const nextTotalPages = Math.max(1, Math.ceil(nextTotal / LIST_PAGE_SIZE));
      setTotalPages(nextTotalPages);
      setPage((currentPage) => Math.min(currentPage, nextTotalPages));
      if (!isLoggedIn && nextTotal === 0) {
        setHasAnyFavorites(false);
      }
      return nextTotal;
    });
  }, [isLoggedIn]);

  const handleToggleFavorite = useCallback(
    async (listingId: string, isFavorite: boolean) => {
      if (pendingFavoriteId) {
        return;
      }

      if (!isLoggedIn) {
        const normalizedListingId = listingId.trim().toLowerCase();
        const nextGuestFavoriteIds = isFavorite
          ? guestFavoriteListingIds.filter((id) => id !== normalizedListingId)
          : Array.from(new Set([...guestFavoriteListingIds, normalizedListingId]));

        setGuestFavoriteListingIds(nextGuestFavoriteIds);
        writeGuestFavoriteListingIds(nextGuestFavoriteIds);
        if (isFavoritesTab && isFavorite) {
          removeListingFromFavoritesView(listingId);
        } else {
          setItems((current) =>
            current.map((item) =>
              item.id === listingId ? { ...item, isFavorite: !isFavorite } : item,
            ),
          );
        }
        if (!isFavorite) {
          toast.success(messages.map.favoriteAdded);
        }
        return;
      }

      setPendingFavoriteId(listingId);
      setItems((current) =>
        current.map((item) =>
          item.id === listingId ? { ...item, isFavorite: !isFavorite } : item,
        ),
      );

      try {
        const response = await fetch(`/api/containers/${listingId}/favorite`, {
          headers: requestHeaders,
          method: isFavorite ? "DELETE" : "POST",
        });

        if (response.status === 401) {
          redirectToLogin();
          return;
        }

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? messages.map.favoriteUpdateError);
        }

        const payload = (await response.json().catch(() => null)) as {
          isFavorite?: boolean;
        } | null;
        const nextIsFavorite =
          typeof payload?.isFavorite === "boolean" ? payload.isFavorite : !isFavorite;

        if (nextIsFavorite === true) {
          setHasAnyFavorites(true);
          toast.success(messages.map.favoriteAdded);
          return;
        }

        if (isFavoritesTab) {
          removeListingFromFavoritesView(listingId);
        } else {
          setItems((current) =>
            current.map((item) =>
              item.id === listingId ? { ...item, isFavorite: false } : item,
            ),
          );
        }
        setFavoritesPresenceRefreshVersion((current) => current + 1);
      } catch (favoriteError) {
        setItems((current) =>
          current.map((item) =>
            item.id === listingId ? { ...item, isFavorite } : item,
          ),
        );
        setError(
          favoriteError instanceof Error
            ? favoriteError.message
            : messages.map.favoriteUpdateError,
        );
      } finally {
        setPendingFavoriteId(null);
      }
    },
    [
      guestFavoriteListingIds,
      isFavoritesTab,
      isLoggedIn,
      pendingFavoriteId,
      removeListingFromFavoritesView,
      redirectToLogin,
      requestHeaders,
      messages.map.favoriteAdded,
      messages.map.favoriteUpdateError,
      toast,
    ],
  );

  const handleCopyListingLink = useCallback(
    async (listingId: string) => {
      const listingUrl = new URL(`/containers/${listingId}`, window.location.origin).toString();
      const copied = await copyTextToClipboard(listingUrl);

      if (copied) {
        toast.info(messages.map.linkCopied);
        return;
      }

      toast.error(messages.map.copyError);
    },
    [messages.map.copyError, messages.map.linkCopied, toast],
  );

  const handleOpenDetails = useCallback((targetHref: string) => {
    const listHref = currentListHref;
    cancelledPendingOverlayListHrefRef.current = null;
    if (pendingOverlayCloseTimeoutRef.current !== null) {
      window.clearTimeout(pendingOverlayCloseTimeoutRef.current);
      pendingOverlayCloseTimeoutRef.current = null;
    }
    if (pendingOverlayOpenRafRef.current !== null) {
      window.cancelAnimationFrame(pendingOverlayOpenRafRef.current);
      pendingOverlayOpenRafRef.current = null;
    }
    setIsPendingOverlayClosing(false);
    setPendingDetailsNavigation({ listHref });

    pendingOverlayOpenRafRef.current = window.requestAnimationFrame(() => {
      pendingOverlayOpenRafRef.current = null;
      router.push(targetHref, { scroll: false });
    });
  }, [currentListHref, router]);

  const cancelPendingDetailsNavigation = useCallback(() => {
    if (!pendingDetailsNavigation || isPendingOverlayClosing) {
      return;
    }

    const { listHref } = pendingDetailsNavigation;
    cancelledPendingOverlayListHrefRef.current = listHref;
    if (pendingOverlayOpenRafRef.current !== null) {
      window.cancelAnimationFrame(pendingOverlayOpenRafRef.current);
      pendingOverlayOpenRafRef.current = null;
    }
    if (pendingOverlayCloseTimeoutRef.current !== null) {
      window.clearTimeout(pendingOverlayCloseTimeoutRef.current);
      pendingOverlayCloseTimeoutRef.current = null;
    }
    setIsPendingOverlayClosing(true);
    pendingOverlayCloseTimeoutRef.current = window.setTimeout(() => {
      setPendingDetailsNavigation(null);
      setIsPendingOverlayClosing(false);
      router.replace(listHref, { scroll: false });
    }, OVERLAY_CLOSE_ANIMATION_MS);
  }, [isPendingOverlayClosing, pendingDetailsNavigation, router]);

  return (
    <FormProvider {...formMethods}>
      <form onSubmit={submitFilters} className="grid gap-4">
        <section className="w-full">
          <div className="relative overflow-visible">
            <div
              id="containers-listings-map-panel"
              className={`w-full transition-[max-height,opacity] duration-300 ease-out ${
                isMapOpen
                  ? "max-h-[520px] overflow-visible opacity-100"
                  : "pointer-events-none max-h-0 overflow-hidden opacity-0"
              }`}
            >
              <ListingsMap
                locale={locale}
                messages={messages}
                items={hasLoadedMapDataOnce ? mapItems : items}
                isVisible={isMapOpen}
                detailsHrefPrefix={detailsHrefPrefix}
                detailsQueryString={detailsQueryString}
                activeLocation={appliedFilters.locationCenter}
                activeLocationLabel={appliedFilters.locationQuery}
              />
            </div>
          </div>
          <div
            className={`pointer-events-none relative z-10 flex justify-center ${
              isMapOpen ? "-mt-2.5" : "mt-1"
            }`}
          >
            <button
              type="button"
              onClick={() => setIsMapOpen((current) => !current)}
              aria-expanded={isMapOpen}
              aria-controls="containers-listings-map-panel"
              className={`pointer-events-auto inline-flex min-h-10 items-center rounded-md px-5 text-sm font-semibold shadow-[0_10px_24px_-12px_rgba(5,36,79,0.8)] ${DARK_BLUE_CTA_BASE_CLASS}`}
            >
              {isMapOpen ? messages.map.collapseMap : messages.map.expandMap}
            </button>
          </div>
        </section>

        <div className="mx-auto grid w-full max-w-[1400px] gap-4 px-4 sm:px-6">
          <ContainerListingsFilters
            messages={messages}
            locationControlsRef={locationControlsRef}
            appliedFilters={appliedFilters}
            restoreAppliedLocationOnBlur={restoreAppliedLocationOnBlur}
            isResolvingLocation={isResolvingLocation}
            locationFilterError={locationFilterError}
            onApplyNonLocationFilters={applyNonLocationFilters}
            clearLocationFilter={clearLocationFilter}
            clearAllFilters={clearAllFilters}
          >
            <div ref={resultsTopRef} className="scroll-mt-36">
              <ContainerListingsResults
                locale={locale}
                messages={messages}
                items={items}
                total={total}
                page={page}
                totalPages={totalPages}
                isLoading={isLoading}
                error={error}
                activeTab={activeTab}
                showFavoritesToggle={shouldShowFavoritesToggle}
                darkBlueCtaClass={DARK_BLUE_CTA_BASE_CLASS}
                pendingFavoriteId={pendingFavoriteId}
                onTabChange={handleTabChange}
                onToggleFavorite={handleToggleFavorite}
                onCopyListingLink={handleCopyListingLink}
                onPreviousPage={goToPreviousPage}
                onNextPage={goToNextPage}
                onOpenDetails={handleOpenDetails}
                detailsHrefPrefix={detailsHrefPrefix}
                detailsQueryString={detailsQueryString}
                priceDisplayCurrency={appliedFilters.priceDisplayCurrency}
              />
            </div>
          </ContainerListingsFilters>
        </div>

        {isDetailsOverlayPending && !isDetailsOverlayRouteActive ? (
          <section className="fixed inset-x-0 bottom-0 top-16 z-[35]">
            <div className="relative z-10 flex h-full justify-end overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  cancelPendingDetailsNavigation();
                }}
                onWheel={(event) => {
                  event.preventDefault();
                }}
                aria-label={messages.map.closePreview}
                className="h-full flex-1"
              />
              <div
                className={`cb-overlay-panel-shell h-full w-full max-w-5xl overflow-y-auto ${
                  isPendingOverlayClosing ? "cb-overlay-panel-exit" : "cb-overlay-panel-enter"
                }`}
              >
                <div className="grid gap-4 px-4 py-6 sm:px-6">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        cancelPendingDetailsNavigation();
                      }}
                      className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-200 hover:border-neutral-500"
                    >
                      <span className="inline-flex items-center gap-2">
                        <svg
                          className="h-4 w-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          aria-hidden="true"
                        >
                          <path d="M15 18 9 12l6-6" />
                        </svg>
                        <span>{messages.map.backToList}</span>
                      </span>
                    </button>
                  </div>

                  <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 text-neutral-600">
                    <span
                      className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-500"
                      aria-label={messages.map.loadingDetailsAria}
                    />
                    <p className="text-sm">{messages.map.loadingDetails}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : null}
      </form>
    </FormProvider>
  );
}



