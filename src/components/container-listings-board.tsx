"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import maplibregl, { type GeoJSONSource } from "maplibre-gl";
import { MAP_STYLE_URL } from "@/components/map-shared";
import type {
  ContainerListingItem,
  ContainerListingMapPoint,
} from "@/lib/container-listings";
import {
  CONTAINER_CONDITIONS,
  CONTAINER_CONDITION_LABEL,
  CONTAINER_FEATURES,
  CONTAINER_FEATURE_LABEL,
  CONTAINER_HEIGHTS,
  CONTAINER_HEIGHT_LABEL,
  CONTAINER_SIZES,
  CONTAINER_TYPES,
  DEAL_TYPES,
  CONTAINER_TYPE_LABEL,
  getContainerShortLabel,
  type ContainerCondition,
  type ContainerFeature,
  type ContainerHeight,
  type ContainerSize,
  type ContainerType,
  type DealType,
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
  initialKind?: "all" | ListingType;
};

type SortPreset = "newest" | "quantity_desc" | "quantity_asc" | "available_asc";
type FormContainerSize = "all" | "10" | "20" | "40" | "45" | "53";
type FormLocationRadiusKm = "20" | "50" | "100" | "200";

type FiltersFormValues = {
  locationInput: string;
  locationRadiusKmInput: FormLocationRadiusKm;
  containerSize: FormContainerSize;
  containerHeight: "all" | ContainerHeight;
  containerType: "all" | ContainerType;
  containerCondition: "all" | ContainerCondition;
  containerFeature: "all" | ContainerFeature;
  dealType: "all" | DealType;
  city: string;
  country: string;
  sortPreset: SortPreset;
};

type AppliedFilters = {
  locationQuery: string;
  locationCenter: { lat: number; lng: number } | null;
  locationRadiusKm: FormLocationRadiusKm;
  containerSize: FormContainerSize;
  containerHeight: "all" | ContainerHeight;
  containerType: "all" | ContainerType;
  containerCondition: "all" | ContainerCondition;
  containerFeature: "all" | ContainerFeature;
  dealType: "all" | DealType;
  city: string;
  country: string;
  sortPreset: SortPreset;
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
const LOCATION_RADIUS_OPTIONS = [20, 50, 100, 200] as const;
type LocationRadiusKm = (typeof LOCATION_RADIUS_OPTIONS)[number];

const LISTING_TYPE_LABEL: Record<ListingType, string> = {
  available: "Oferta",
  wanted: "Buy request",
};

const DEAL_TYPE_LABEL: Record<DealType, string> = {
  sale: "Sprzedaz",
  rent: "Wynajem",
  one_way: "One way",
  long_term: "Wspolpraca dlugoterminowa",
};

const SORT_OPTIONS: Array<{ value: SortPreset; label: string }> = [
  { value: "newest", label: "Najnowsze" },
  { value: "quantity_desc", label: "Ilosc malejaco" },
  { value: "quantity_asc", label: "Ilosc rosnaco" },
  { value: "available_asc", label: "Najblizsza dostepnosc" },
];
const DARK_BLUE_CTA_BASE_CLASS =
  "border border-[#2f639a] bg-[linear-gradient(180deg,#082650_0%,#0c3466_100%)] text-[#e2efff] transition hover:border-[#67c7ff] hover:text-white";
const FILTER_FORM_DEFAULTS: FiltersFormValues = {
  locationInput: "",
  locationRadiusKmInput: "50",
  containerSize: "all",
  containerHeight: "all",
  containerType: "all",
  containerCondition: "all",
  containerFeature: "all",
  dealType: "all",
  city: "",
  country: "",
  sortPreset: "newest",
};

function getLocationLabel(item: ContainerListingItem): string {
  const label = item.locationAddressLabel?.trim();
  if (label) {
    return label;
  }

  const city =
    item.locationAddressParts?.city?.trim() || item.locationCity.trim();
  const country =
    item.locationAddressParts?.country?.trim() || item.locationCountry.trim();
  const combined = [city, country].filter(Boolean).join(", ");
  return combined || "Nie podano lokalizacji";
}

function getCoordinateKey(lat: number, lng: number): string {
  return `${lat.toFixed(6)}:${lng.toFixed(6)}`;
}

function getSortParams(preset: SortPreset): {
  sortBy: string;
  sortDir: "asc" | "desc";
} {
  if (preset === "quantity_desc") {
    return { sortBy: "quantity", sortDir: "desc" };
  }
  if (preset === "quantity_asc") {
    return { sortBy: "quantity", sortDir: "asc" };
  }
  if (preset === "available_asc") {
    return { sortBy: "availableFrom", sortDir: "asc" };
  }
  return { sortBy: "createdAt", sortDir: "desc" };
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
): HTMLElement {
  const scroll = document.createElement("div");
  scroll.className = "company-map-popup-scroll max-h-72 overflow-y-auto pr-1";

  const list = document.createElement("div");
  list.className = "company-map-popup-list";

  const visibleItems = listings.slice(0, MAX_POPUP_VISIBLE_ITEMS);

  for (const item of visibleItems) {
    const entry = document.createElement("a");
    entry.href = `/containers/${item.id}`;
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
    location.textContent = getLocationLabel(item);

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

function ListingsMap({
  items,
  isVisible,
}: {
  items: ContainerListingMapPoint[];
  isVisible: boolean;
}) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const popupRequestSeqRef = useRef(0);
  const hasAutoFittedViewRef = useRef(false);
  const itemsByIdRef = useRef<Map<string, ContainerListingMapPoint>>(new Map());
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
    const nextById = new Map<string, ContainerListingMapPoint>();
    const nextByCoordinate = new Map<string, ContainerListingMapPoint[]>();

    for (const item of points) {
      nextById.set(item.id, item);
      if (item.locationLat === null || item.locationLng === null) {
        continue;
      }

      const key = getCoordinateKey(item.locationLat, item.locationLng);
      const grouped = nextByCoordinate.get(key) ?? [];
      grouped.push(item);
      nextByCoordinate.set(key, grouped);
    }

    itemsByIdRef.current = nextById;
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
              "wanted",
              "#78716c",
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
        const clickedItem = itemsByIdRef.current.get(listingId);
        if (
          !clickedItem ||
          clickedItem.locationLat === null ||
          clickedItem.locationLng === null
        ) {
          return;
        }

        const key = getCoordinateKey(
          clickedItem.locationLat,
          clickedItem.locationLng,
        );
        const clickedLng = clickedItem.locationLng;
        const clickedLat = clickedItem.locationLat;
        const grouped = (
          itemsByCoordinateRef.current.get(key) ?? [clickedItem]
        ).slice();
        const groupedIds = grouped.map((item) => item.id);

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
            .setDOMContent(buildMapPopupListNode(details, groupedIds.length))
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
  }, [loadPopupDetailsByIds]);

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
}

export function ContainerListingsBoard({
  isLoggedIn,
  initialKind = "all",
}: ContainerListingsBoardProps) {
  const [items, setItems] = useState<ContainerListingItem[]>([]);
  const [mapItems, setMapItems] = useState<ContainerListingMapPoint[]>([]);
  const [hasLoadedMapDataOnce, setHasLoadedMapDataOnce] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [isMapOpen, setIsMapOpen] = useState(true);

  const [isResolvingLocation, setIsResolvingLocation] = useState(false);
  const [locationFilterError, setLocationFilterError] = useState<string | null>(null);
  const [type, setType] = useState<"all" | ListingType>(initialKind);
  const {
    register,
    handleSubmit,
    reset,
    getValues,
  } = useForm<FiltersFormValues>({
    defaultValues: FILTER_FORM_DEFAULTS,
  });

  const [appliedFilters, setAppliedFilters] = useState<AppliedFilters>({
    locationQuery: "",
    locationCenter: null,
    locationRadiusKm: FILTER_FORM_DEFAULTS.locationRadiusKmInput,
    containerSize: FILTER_FORM_DEFAULTS.containerSize,
    containerHeight: FILTER_FORM_DEFAULTS.containerHeight,
    containerType: FILTER_FORM_DEFAULTS.containerType,
    containerCondition: FILTER_FORM_DEFAULTS.containerCondition,
    containerFeature: FILTER_FORM_DEFAULTS.containerFeature,
    dealType: FILTER_FORM_DEFAULTS.dealType,
    city: FILTER_FORM_DEFAULTS.city,
    country: FILTER_FORM_DEFAULTS.country,
    sortPreset: FILTER_FORM_DEFAULTS.sortPreset,
  });

  const submitFilters = handleSubmit(async (values) => {
    const trimmedLocationQuery = values.locationInput.trim();
    const nextBase: Omit<AppliedFilters, "locationCenter" | "locationQuery"> = {
      locationRadiusKm: values.locationRadiusKmInput,
      containerSize: values.containerSize,
      containerHeight: values.containerHeight,
      containerType: values.containerType,
      containerCondition: values.containerCondition,
      containerFeature: values.containerFeature,
      dealType: values.dealType,
      city: values.city,
      country: values.country,
      sortPreset: values.sortPreset,
    };

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
        setLocationFilterError("Nie znaleziono lokalizacji. Uzywam dopasowania tekstowego.");
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
      setLocationFilterError("Nie udalo sie ustalic punktu na mapie. Uzywam dopasowania tekstowego.");
      setAppliedFilters({
        ...nextBase,
        locationQuery: trimmedLocationQuery,
        locationCenter: null,
      });
    } finally {
      setIsResolvingLocation(false);
    }
  });

  const requestUrl = useMemo(() => {
    const { sortBy, sortDir } = getSortParams(appliedFilters.sortPreset);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "20",
      sortBy,
      sortDir,
    });

    if (appliedFilters.locationCenter) {
      params.set("locationLat", appliedFilters.locationCenter.lat.toFixed(6));
      params.set("locationLng", appliedFilters.locationCenter.lng.toFixed(6));
      params.set("radiusKm", appliedFilters.locationRadiusKm);
    } else if (appliedFilters.locationQuery) {
      params.set("q", appliedFilters.locationQuery);
    }
    if (type !== "all") {
      params.set("type", type);
    }
    if (appliedFilters.containerSize !== "all") {
      params.set("containerSize", appliedFilters.containerSize);
    }
    if (appliedFilters.containerHeight !== "all") {
      params.set("containerHeight", appliedFilters.containerHeight);
    }
    if (appliedFilters.containerType !== "all") {
      params.set("containerType", appliedFilters.containerType);
    }
    if (appliedFilters.containerCondition !== "all") {
      params.set("containerCondition", appliedFilters.containerCondition);
    }
    if (appliedFilters.containerFeature !== "all") {
      params.set("containerFeature", appliedFilters.containerFeature);
    }
    if (appliedFilters.dealType !== "all") {
      params.set("dealType", appliedFilters.dealType);
    }
    if (appliedFilters.city.trim()) {
      params.set("city", appliedFilters.city.trim());
    }
    if (appliedFilters.country.trim()) {
      params.set("country", appliedFilters.country.trim());
    }

    return `/api/containers?${params.toString()}`;
  }, [
    appliedFilters,
    page,
    type,
  ]);

  const mapRequestUrl = useMemo(() => {
    const params = new URLSearchParams({
      view: "map",
      all: "1",
    });

    if (appliedFilters.locationCenter) {
      params.set("locationLat", appliedFilters.locationCenter.lat.toFixed(6));
      params.set("locationLng", appliedFilters.locationCenter.lng.toFixed(6));
      params.set("radiusKm", appliedFilters.locationRadiusKm);
    } else if (appliedFilters.locationQuery) {
      params.set("q", appliedFilters.locationQuery);
    }
    if (type !== "all") {
      params.set("type", type);
    }
    if (appliedFilters.containerSize !== "all") {
      params.set("containerSize", appliedFilters.containerSize);
    }
    if (appliedFilters.containerHeight !== "all") {
      params.set("containerHeight", appliedFilters.containerHeight);
    }
    if (appliedFilters.containerType !== "all") {
      params.set("containerType", appliedFilters.containerType);
    }
    if (appliedFilters.containerCondition !== "all") {
      params.set("containerCondition", appliedFilters.containerCondition);
    }
    if (appliedFilters.containerFeature !== "all") {
      params.set("containerFeature", appliedFilters.containerFeature);
    }
    if (appliedFilters.dealType !== "all") {
      params.set("dealType", appliedFilters.dealType);
    }
    if (appliedFilters.city.trim()) {
      params.set("city", appliedFilters.city.trim());
    }
    if (appliedFilters.country.trim()) {
      params.set("country", appliedFilters.country.trim());
    }

    return `/api/containers?${params.toString()}`;
  }, [
    appliedFilters,
    type,
  ]);

  useEffect(() => {
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

        setError(null);
        setItems(data.items ?? []);
        setTotalPages(data.meta?.totalPages ?? 1);
        setTotal(data.meta?.total ?? 0);
      } catch (loadError) {
        if (controller.signal.aborted) {
          return;
        }
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Nie udalo sie zaladowac kontenerow",
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
  }, [requestUrl]);

  useEffect(() => {
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
  }, [mapRequestUrl]);

  function clearSidebarFilters() {
    const current = getValues();
    reset({
      ...current,
      containerSize: "all",
      containerHeight: "all",
      containerType: "all",
      containerCondition: "all",
      containerFeature: "all",
      dealType: "all",
      city: "",
      country: "",
      sortPreset: "newest",
    });
    setLocationFilterError(null);
  }

  function renderPaginationControls(extraClassName?: string) {
    const className = [
      "flex items-center justify-end gap-2",
      extraClassName ?? "",
    ]
      .join(" ")
      .trim();

    return (
      <div className={className}>
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage((current) => Math.max(1, current - 1))}
          className="rounded-md border border-sky-200 px-3 py-1.5 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Poprzednia
        </button>
        <span className="text-xs text-slate-500">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() =>
            setPage((current) => Math.min(totalPages, current + 1))
          }
          className="rounded-md border border-sky-200 px-3 py-1.5 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Nastepna
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={submitFilters}
      className="grid gap-4"
    >
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
            className={`pointer-events-auto inline-flex min-h-10 items-center rounded-full px-5 text-sm font-semibold shadow-[0_10px_24px_-12px_rgba(5,36,79,0.8)] ${DARK_BLUE_CTA_BASE_CLASS}`}
          >
            {isMapOpen ? "Zwin mape" : "Rozwin mape"}
          </button>
        </div>
      </section>

      <div className="mx-auto grid w-full max-w-[1400px] gap-4 px-4 sm:px-6">
        <section className="sticky top-[4.5rem] z-30 rounded-2xl border border-sky-200 bg-white/95 p-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/88">
          <div className="grid gap-2 lg:grid-cols-[290px_110px_120px_130px_minmax(0,1fr)]">
            <div className="inline-flex rounded-md border border-sky-200 bg-sky-50 p-1 text-sm">
              <button
                type="button"
                onClick={() => {
                  setType("all");
                  setPage(1);
                }}
                className={
                  type === "all"
                    ? `rounded px-3 py-1 font-medium ${DARK_BLUE_CTA_BASE_CLASS}`
                    : "rounded border border-transparent px-3 py-1 text-slate-700 hover:border-sky-200 hover:bg-sky-100"
                }
              >
                Wszystkie
              </button>
              <button
                type="button"
                onClick={() => {
                  setType("available");
                  setPage(1);
                }}
                className={
                  type === "available"
                    ? `rounded px-3 py-1 font-medium ${DARK_BLUE_CTA_BASE_CLASS}`
                    : "rounded border border-transparent px-3 py-1 text-slate-700 hover:border-sky-200 hover:bg-sky-100"
                }
              >
                Sell / Oferty
              </button>
              <button
                type="button"
                onClick={() => {
                  setType("wanted");
                  setPage(1);
                }}
                className={
                  type === "wanted"
                    ? `rounded px-3 py-1 font-medium ${DARK_BLUE_CTA_BASE_CLASS}`
                    : "rounded border border-transparent px-3 py-1 text-slate-700 hover:border-sky-200 hover:bg-sky-100"
                }
              >
                Buy request
              </button>
            </div>

            <select
              {...register("containerSize")}
              className="rounded-md border border-sky-200 bg-white px-3 py-2 text-sm text-slate-900"
            >
              <option value="all">Rozmiar</option>
              {CONTAINER_SIZES.map((value) => (
                <option key={value} value={String(value)}>
                  {value} ft
                </option>
              ))}
            </select>

            <select
              {...register("containerHeight")}
              className="rounded-md border border-sky-200 bg-white px-3 py-2 text-sm text-slate-900"
            >
              <option value="all">Wysokosc</option>
              {CONTAINER_HEIGHTS.map((value) => (
                <option key={value} value={value}>
                  {CONTAINER_HEIGHT_LABEL[value]}
                </option>
              ))}
            </select>

            <select
              {...register("containerType")}
              className="rounded-md border border-sky-200 bg-white px-3 py-2 text-sm text-slate-900"
            >
              <option value="all">Typ kontenera</option>
              {CONTAINER_TYPES.map((value) => (
                <option key={value} value={value}>
                  {CONTAINER_TYPE_LABEL[value]}
                </option>
              ))}
            </select>

            <div className="flex overflow-hidden rounded-md border border-sky-200 bg-white">
              <input
                {...register("locationInput")}
                placeholder="Dowolna lokalizacja"
                className="w-full border-0 bg-transparent px-3 py-2 text-sm text-slate-900 outline-none"
              />
              <div className="flex items-center gap-1 border-l border-sky-200 bg-slate-50 px-2">
                <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  +km
                </span>
                <select
                  {...register("locationRadiusKmInput")}
                  className="min-w-[84px] border-0 bg-transparent py-2 pl-1 pr-0 text-sm text-slate-900 outline-none"
                >
                  {LOCATION_RADIUS_OPTIONS.map((value) => (
                    <option key={value} value={String(value)}>
                      +{value} km
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={isResolvingLocation}
                className="shrink-0 whitespace-nowrap border-l border-rose-500 bg-gradient-to-r from-rose-500 to-fuchsia-500 px-3.5 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:from-rose-600 hover:to-fuchsia-600 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isResolvingLocation ? "Szukam..." : "Szukaj"}
              </button>
            </div>
          </div>
          {locationFilterError ? (
            <p className="mt-2 text-xs text-amber-700">{locationFilterError}</p>
          ) : null}
          {appliedFilters.locationCenter && appliedFilters.locationQuery ? (
            <p className="mt-2 text-xs text-slate-600">
              Filtr lokalizacji: +{appliedFilters.locationRadiusKm} km od &quot;{appliedFilters.locationQuery}&quot;.
            </p>
          ) : null}
        </section>
        
        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="h-fit rounded-2xl border border-sky-200 bg-white/95 p-4 shadow-sm lg:sticky lg:top-[11rem] lg:z-20">
            <h2 className="text-lg font-semibold text-slate-900">Filtry</h2>

            <div className="mt-3 grid gap-3">
              <label className="grid gap-1 text-sm">
                <span className="text-slate-600">Transakcja</span>
                <select
                  {...register("dealType")}
                  className="rounded-md border border-sky-200 bg-white px-3 py-2 text-slate-900"
                >
                  <option value="all">Wszystkie</option>
                  {DEAL_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {DEAL_TYPE_LABEL[value]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-sm">
                <span className="text-slate-600">Stan kontenera</span>
                <select
                  {...register("containerCondition")}
                  className="rounded-md border border-sky-200 bg-white px-3 py-2 text-slate-900"
                >
                  <option value="all">Wszystkie</option>
                  {CONTAINER_CONDITIONS.map((value) => (
                    <option key={value} value={value}>
                      {CONTAINER_CONDITION_LABEL[value]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-sm">
                <span className="text-slate-600">Cecha</span>
                <select
                  {...register("containerFeature")}
                  className="rounded-md border border-sky-200 bg-white px-3 py-2 text-slate-900"
                >
                  <option value="all">Wszystkie</option>
                  {CONTAINER_FEATURES.map((value) => (
                    <option key={value} value={value}>
                      {CONTAINER_FEATURE_LABEL[value]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-sm">
                <span className="text-slate-600">Miasto</span>
                <input
                  {...register("city")}
                  placeholder="np. Gdansk"
                  className="rounded-md border border-sky-200 bg-white px-3 py-2 text-slate-900"
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span className="text-slate-600">Kraj</span>
                <input
                  {...register("country")}
                  placeholder="np. Polska"
                  className="rounded-md border border-sky-200 bg-white px-3 py-2 text-slate-900"
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span className="text-slate-600">Sortowanie</span>
                <select
                  {...register("sortPreset")}
                  className="rounded-md border border-sky-200 bg-white px-3 py-2 text-slate-900"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                onClick={clearSidebarFilters}
                className="rounded-md border border-sky-200 px-3 py-2 text-sm font-medium text-slate-700 hover:border-sky-400"
              >
                Wyczysc filtry boczne
              </button>
            </div>
          </aside>

          <section className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-sky-200 bg-white/95 p-3 shadow-sm">
              <p className="text-sm text-slate-700">
                Wyniki wyszukiwania:{" "}
                <span className="font-semibold">{total}</span>
              </p>
              <div className="flex items-center gap-4">
                <p className="text-xs text-slate-500">
                  Strona {page} z {totalPages}
                </p>
                {renderPaginationControls()}
              </div>
            </div>

            <div className="relative rounded-2xl border border-sky-200 bg-white/95 p-3 shadow-sm">
              {error ? <p className="text-sm text-rose-600">{error}</p> : null}
              {isLoading ? (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/60 backdrop-blur-[1px]">
                  <span
                    className="h-7 w-7 animate-spin rounded-full border-2 border-slate-300 border-t-slate-500"
                    aria-label="Ladowanie kontenerow"
                  />
                </div>
              ) : null}

              {!isLoading && items.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Brak kontenerow dla aktualnych filtrow.
                </p>
              ) : null}

              <ul className="space-y-3">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-xl border border-sky-100 bg-white p-4 shadow-sm transition-colors hover:bg-slate-50/80"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500">
                          {item.companyName}
                        </p>
                        <h3 className="mt-1 text-xl font-semibold text-slate-900">
                          {getContainerShortLabel(item.container)} -{" "}
                          {LISTING_TYPE_LABEL[item.type]}
                        </h3>
                        <p className="mt-1 text-sm text-slate-600">
                          {getLocationLabel(item)}
                        </p>
                      </div>
                      <span
                        className={
                          item.type === "available"
                            ? "rounded-md border border-slate-300 bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700"
                            : "rounded-md border border-stone-300 bg-stone-100 px-2 py-1 text-xs font-medium text-stone-700"
                        }
                      >
                        {LISTING_TYPE_LABEL[item.type]}
                      </span>
                    </div>

                    <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2 lg:grid-cols-4">
                      <p>
                        Ilosc:{" "}
                        <span className="font-medium text-slate-900">
                          {item.quantity}
                        </span>
                      </p>
                      <p>
                        Transakcja:{" "}
                        <span className="font-medium text-slate-900">
                          {DEAL_TYPE_LABEL[item.dealType]}
                        </span>
                      </p>
                      <p>
                        Dostepny od:{" "}
                        <span className="font-medium text-slate-900">
                          {new Date(item.availableFrom).toLocaleDateString(
                            "pl-PL",
                          )}
                        </span>
                      </p>
                      <p>
                        Wygasa:{" "}
                        <span className="font-medium text-slate-900">
                          {new Date(item.expiresAt).toLocaleDateString("pl-PL")}
                        </span>
                      </p>
                    </div>

                    {item.description ? (
                      <p className="mt-3 line-clamp-2 text-sm text-slate-600">
                        {item.description}
                      </p>
                    ) : null}

                    <div className="mt-3 flex items-center justify-end">
                      <Link
                        href={`/containers/${item.id}`}
                        className={`rounded-md px-3 py-2 text-sm font-medium ${DARK_BLUE_CTA_BASE_CLASS}`}
                      >
                        Szczegoly i zapytanie
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>

              {renderPaginationControls("mt-4")}
            </div>
          </section>
        </div>
      </div>
    </form>
  );
}
