"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, type FocusEvent } from "react";
import { FormProvider, useForm } from "react-hook-form";
import maplibregl, { type GeoJSONSource } from "maplibre-gl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MAP_STYLE_URL } from "@/components/map-shared";
import { ContainerListingsFilters } from "@/components/container-listings-filters";
import { ContainerListingsResults } from "@/components/container-listings-results";
import { useToast } from "@/components/toast-provider";
import { usePageScrollLock } from "@/components/use-page-scroll-lock";
import {
  FILTER_FORM_DEFAULTS,
  LISTING_TYPE_LABEL,
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
  getContainerListingLocationLabel,
  getCoordinateKey,
} from "@/components/container-listings-utils";
import type {
  ContainerListingItem,
  ContainerListingMapPoint,
} from "@/lib/container-listings";
import {
  getContainerShortLabel,
  type ListingType,
} from "@/lib/container-listing-types";

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

type ContainerListingsBoardProps = {
  isLoggedIn: boolean;
  initialKind?: ListingKind;
  initialTab?: "all" | "favorites";
  initialMine?: boolean;
  hiddenCompanySlug?: string;
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

function buildMapPopupListNode(
  listings: ContainerListingItem[],
  totalItemsCount = listings.length,
  detailsHrefPrefix = "/containers",
  detailsQueryString = "",
): HTMLElement {
  const scroll = document.createElement("div");
  scroll.className = "company-map-popup-scroll max-h-72 overflow-y-auto pr-1";

  const list = document.createElement("div");
  list.className = "company-map-popup-list";

  const visibleItems = listings.slice(0, MAX_POPUP_VISIBLE_ITEMS);

  for (const item of visibleItems) {
    const entry = document.createElement("a");
    entry.href = detailsQueryString
      ? `${detailsHrefPrefix}/${item.id}?${detailsQueryString}`
      : `${detailsHrefPrefix}/${item.id}`;
    entry.className = "company-map-popup-item";

    const card = document.createElement("article");
    card.className = "company-map-popup-card";

    const name = document.createElement("p");
    name.className = "company-map-popup-card__name";
    name.textContent = `${getContainerShortLabel(item.container)} - ${LISTING_TYPE_LABEL[item.type]}`;

    const company = document.createElement("p");
    company.className = "company-map-popup-card__category";
    company.textContent = item.companyName;

    const location = document.createElement("p");
    location.className = "company-map-popup-card__summary";
    location.textContent = getContainerListingLocationLabel(item);

    const meta = document.createElement("p");
    meta.className = "company-map-popup-card__summary";
    meta.textContent = `Ilosc: ${item.quantity}`;

    card.append(name, company, location, meta);
    entry.append(card);
    list.append(entry);
  }

  if (totalItemsCount > MAX_POPUP_VISIBLE_ITEMS) {
    const hint = document.createElement("p");
    hint.className = "company-map-popup-more-hint";
    hint.textContent =
      "Aby zobaczyc wiecej wynikow, zawez filtry lub przybliz mape.";
    list.append(hint);
  }

  scroll.append(list);
  return scroll;
}

function resolvePopupPlacement(
  map: maplibregl.Map,
  point: { y: number },
  itemCount: number,
): { anchor: "top" | "bottom"; offset: number } {
  const mapRect = map.getContainer().getBoundingClientRect();
  const markerViewportY = mapRect.top + point.y;
  const stickyHeader = document.querySelector("header.sticky");
  const stickyHeaderBottom =
    stickyHeader instanceof HTMLElement
      ? stickyHeader.getBoundingClientRect().bottom
      : 0;
  const safeTopEdge = Math.max(8, stickyHeaderBottom + 8);
  const safeBottomEdge = 8;
  const spaceAbove = markerViewportY - safeTopEdge;
  const spaceBelow = window.innerHeight - markerViewportY - safeBottomEdge;
  const estimatedPopupHeight = Math.min(320, 92 + Math.max(0, itemCount - 1) * 62);
  const requiredSpace = estimatedPopupHeight + 12;

  const canOpenAboveMarker = spaceAbove >= requiredSpace;
  const canOpenBelowMarker = spaceBelow >= requiredSpace;

  if (canOpenAboveMarker) {
    return { anchor: "bottom", offset: 8 };
  }

  if (canOpenBelowMarker) {
    return { anchor: "top", offset: 8 };
  }

  return spaceAbove >= spaceBelow
    ? { anchor: "bottom", offset: 8 }
    : { anchor: "top", offset: 8 };
}

function setSourceData(map: maplibregl.Map, data: MapFeatureCollection): void {
  const source = map.getSource(MAP_SOURCE_ID);
  if (source && "setData" in source) {
    (source as maplibregl.GeoJSONSource).setData(data as never);
  }
}

const ListingsMap = memo(function ListingsMap({
  items,
  isVisible,
  detailsHrefPrefix,
  detailsQueryString,
}: {
  items: ContainerListingMapPoint[];
  isVisible: boolean;
  detailsHrefPrefix: string;
  detailsQueryString: string;
}) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
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
  }, []);

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
              "#e2e8f0",
              10,
              "#94a3b8",
              40,
              "#475569",
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
            "text-field": "{point_count_abbreviated}",
            "text-size": 12,
            "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
          },
          paint: {
            "text-color": "#0f172a",
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
            "circle-color": [
              "match",
              ["get", "type"],
              "buy",
              "#78716c",
              "rent",
              "#0ea5e9",
              "#64748b",
            ],
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
            const ids = Array.from(
              new Set(
                clusterFeatures.map((clusterFeature) =>
                  String(clusterFeature.properties?.id ?? ""),
                ),
              ),
            ).filter(Boolean);
            const grouped = await loadPopupDetailsByIds(ids);

            if (requestSeq !== popupRequestSeqRef.current || grouped.length === 0) {
              return;
            }

            const [lng, lat] = (feature.geometry as GeoJSON.Point)
              .coordinates as [number, number];
            const popupPlacement = resolvePopupPlacement(map, clickPoint, grouped.length);
            popupRef.current?.remove();
            popupRef.current = new maplibregl.Popup({
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
                  grouped,
                  Number.isFinite(clusterTotalCount)
                    ? Math.max(clusterTotalCount, grouped.length)
                    : grouped.length,
                  detailsHrefPrefix,
                  detailsQueryString,
                ),
              )
              .addTo(map);
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

        void loadPopupDetailsByIds(groupedIds).then((details) => {
          if (requestSeq !== popupRequestSeqRef.current || details.length === 0) {
            return;
          }

          const popupPlacement = resolvePopupPlacement(map, event.point, details.length);
          popupRef.current?.remove();
          popupRef.current = new maplibregl.Popup({
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
                details,
                groupedIds.length,
                detailsHrefPrefix,
                detailsQueryString,
              ),
            )
            .addTo(map);
        });
      });

      setSourceData(map, featureCollectionRef.current);
    });

    mapRef.current = map;

    return () => {
      popupRef.current?.remove();
      popupRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [detailsHrefPrefix, detailsQueryString, loadPopupDetailsByIds]);

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
    if (!map || !isVisible) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      map.resize();
      if (!hasAutoFittedViewRef.current && points.length > 0) {
        fitMapToPoints(map, points);
        hasAutoFittedViewRef.current = true;
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isVisible, points]);

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
  isLoggedIn,
  initialKind = "all",
  initialTab = "all",
  initialMine = false,
  hiddenCompanySlug,
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
    city: FILTER_FORM_DEFAULTS.city,
    country: FILTER_FORM_DEFAULTS.country,
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
    const params = new URLSearchParams({
      favorites: "1",
      page: "1",
      pageSize: "1",
      sortBy: "createdAt",
      sortDir: "desc",
    });
    if (initialMine) {
      params.set("mine", "1");
    }

    async function resolveFavoritesVisibility() {
      try {
        const response = await fetch(`/api/containers?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = (await response.json().catch(() => null)) as ContainersListApiResponse | null;
        if (!response.ok || controller.signal.aborted) {
          return;
        }
        setHasAnyFavorites((data?.meta?.total ?? 0) > 0);
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
  }, [favoritesPresenceRefreshVersion, initialMine, isLoggedIn]);

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
      setLocationFilterError("Podaj minimum 3 znaki lokalizacji.");
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
        `/api/geocode?q=${encodeURIComponent(trimmedLocationQuery)}&lang=pl&limit=1`,
        { cache: "no-store" },
      );
      const data = (await response.json()) as GeocodeSearchApiResponse;

      if (!response.ok || data.error) {
        throw new Error(data.error ?? `Blad geokodowania (${response.status})`);
      }

      if (!data.item) {
        setLocationFilterError("Nie udalo sie ustalic lokalizacji.");
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
      setLocationFilterError("Nie udalo sie ustalic lokalizacji.");
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
          signal: controller.signal,
        });
        const data = (await response.json()) as ContainersListApiResponse;
        if (!response.ok) {
          throw new Error(data.error ?? `Blad API (${response.status})`);
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
          loadError instanceof Error ? loadError.message : "Nie udalo sie zaladowac kontenerow",
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
          signal: controller.signal,
        });
        const data = (await response.json()) as ContainersMapApiResponse;
        if (!response.ok) {
          throw new Error(data.error ?? `Blad API mapy (${response.status})`);
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
  }, [hasHydratedGuestFavorites, isLoggedIn, mapRequestUrl]);

  const clearAllFilters = useCallback(() => {
    reset(FILTER_FORM_DEFAULTS);
    setAppliedFilters({
      listingKind: "all",
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
          toast.success("Dodano oferte do ulubionych.");
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
          method: isFavorite ? "DELETE" : "POST",
        });

        if (response.status === 401) {
          redirectToLogin();
          return;
        }

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? "Nie udalo sie zaktualizowac ulubionych.");
        }

        const payload = (await response.json().catch(() => null)) as {
          isFavorite?: boolean;
        } | null;
        const nextIsFavorite =
          typeof payload?.isFavorite === "boolean" ? payload.isFavorite : !isFavorite;

        if (nextIsFavorite === true) {
          setHasAnyFavorites(true);
          toast.success("Dodano oferte do ulubionych.");
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
            : "Nie udalo sie zaktualizowac ulubionych.",
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
      toast,
    ],
  );

  const handleCopyListingLink = useCallback(
    async (listingId: string) => {
      const listingUrl = new URL(`/containers/${listingId}`, window.location.origin).toString();
      const copied = await copyTextToClipboard(listingUrl);

      if (copied) {
        toast.info("Link do ogloszenia zostal skopiowany.");
        return;
      }

      toast.error("Nie udalo sie skopiowac linku.");
    },
    [toast],
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
                items={hasLoadedMapDataOnce ? mapItems : items}
                isVisible={isMapOpen}
                detailsHrefPrefix={detailsHrefPrefix}
                detailsQueryString={detailsQueryString}
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
              {isMapOpen ? "Zwin mape" : "Rozwin mape"}
            </button>
          </div>
        </section>

        <div className="mx-auto grid w-full max-w-[1400px] gap-4 px-4 sm:px-6">
          <ContainerListingsFilters
            locationControlsRef={locationControlsRef}
            appliedFilters={appliedFilters}
            restoreAppliedLocationOnBlur={restoreAppliedLocationOnBlur}
            isResolvingLocation={isResolvingLocation}
            locationFilterError={locationFilterError}
            onApplyNonLocationFilters={applyNonLocationFilters}
            clearAllFilters={clearAllFilters}
          >
            <div ref={resultsTopRef} className="scroll-mt-36">
              <ContainerListingsResults
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
                aria-label="Zamknij podglad ogloszenia"
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
                        <span>Powrot do listy</span>
                      </span>
                    </button>
                  </div>

                  <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 text-neutral-600">
                    <span
                      className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-500"
                      aria-label="Ladowanie szczegolow ogloszenia"
                    />
                    <p className="text-sm">Ladowanie szczegolow ogloszenia...</p>
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



