import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import maplibregl, { type GeoJSONSource } from "maplibre-gl";
import {
  applyBaseMapLanguage,
  MAP_STYLE_URL,
  POLAND_BOUNDS,
} from "@/components/map-shared";
import type {
  ActiveMapView,
  OfferMapItem,
} from "@/components/unified-main-map/types";
import {
  COMPANIES_CLUSTER_LAYER_ID,
  COMPANIES_POINT_LAYER_ID,
  COMPANIES_SOURCE_ID,
  FOCUS_FLYTO_DURATION_MS,
  FOCUS_ZOOM,
  MAX_CLUSTER_POPUP_ITEMS,
  MOVE_END_DEBOUNCE_MS,
  MOVE_END_RETRY_MS,
  OFFERS_CLUSTER_LAYER_ID,
  OFFERS_POINT_LAYER_ID,
  OFFERS_SOURCE_ID,
} from "@/components/unified-main-map/types";
import {
  ensureCategoryIcons,
  matchByIds,
  setViewLayerVisibility,
  toCompanyFeatureCollection,
  toOfferFeatureCollection,
} from "@/components/unified-main-map/utils";
import type { CompanyMapItem } from "@/types/company";
import type { AppLocale } from "@/lib/i18n";
import type { SearchBBox, SharedMapViewport } from "@/components/main-map-modules/shared";

type UseUnifiedMainMapEngineParams = {
  locale: AppLocale;
  activeMapView: ActiveMapView;
  isActive: boolean;
  mapViewport?: SharedMapViewport;
  locationBbox: SearchBBox | null;
  onMapViewportChange?: (viewport: SharedMapViewport) => void;
  onLocationFilterRelease?: () => void;
  mapRenderErrorMessage: string;
  offersUnknownError: string;
  companiesUnknownError: string;
  offersByIdRef: MutableRefObject<Map<string, OfferMapItem>>;
  companiesByIdRef: MutableRefObject<Map<string, CompanyMapItem>>;
  renderOffersPopup: (
    map: maplibregl.Map,
    items: OfferMapItem[],
    lngLat: [number, number],
  ) => maplibregl.Popup;
  renderCompaniesPopup: (
    map: maplibregl.Map,
    items: CompanyMapItem[],
    lngLat: [number, number],
  ) => maplibregl.Popup;
  onOffersError: (message: string) => void;
  onCompaniesError: (message: string) => void;
};

type UseUnifiedMainMapEngineResult = {
  mapContainerRef: MutableRefObject<HTMLDivElement | null>;
  isMapReady: boolean;
  mapError: string | null;
  resizeMap: () => void;
  setOffersSource: (items: OfferMapItem[]) => void;
  setCompaniesSource: (items: CompanyMapItem[]) => void;
  focusOfferOnMap: (item: OfferMapItem) => void;
  focusCompanyOnMap: (item: CompanyMapItem) => void;
};

function areViewportsEqual(
  first: SharedMapViewport,
  second: SharedMapViewport,
): boolean {
  const sameCenter =
    Math.abs(first.center[0] - second.center[0]) < 0.000001 &&
    Math.abs(first.center[1] - second.center[1]) < 0.000001;
  const sameZoom = Math.abs(first.zoom - second.zoom) < 0.0001;
  return sameCenter && sameZoom;
}

function parseBooleanProperty(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

function toPopupCompaniesFromFeatures(
  features: Array<{ properties?: Record<string, unknown> | null }>,
  companiesById: Map<string, CompanyMapItem>,
): CompanyMapItem[] {
  const output: CompanyMapItem[] = [];
  const seenMarkerIds = new Set<string>();

  for (const feature of features) {
    const markerId = String(feature.properties?.id ?? "").trim();
    if (!markerId || seenMarkerIds.has(markerId)) {
      continue;
    }
    seenMarkerIds.add(markerId);

    const fallbackCompanyId =
      markerId.includes(":") ? markerId.slice(0, markerId.indexOf(":")) : markerId;
    const companyId = String(feature.properties?.companyId ?? fallbackCompanyId).trim();
    if (!companyId) {
      continue;
    }

    const company = companiesById.get(companyId);
    if (!company) {
      continue;
    }

    const locationLabelRaw = feature.properties?.locationLabel;
    const locationLabel =
      typeof locationLabelRaw === "string" ? locationLabelRaw.trim() : "";
    const isMainLocation = parseBooleanProperty(feature.properties?.isMainLocation);

    if (!isMainLocation && locationLabel) {
      output.push({
        ...company,
        name: `${company.name} - ${locationLabel}`,
      });
      continue;
    }

    output.push(company);
  }

  return output;
}

export function useUnifiedMainMapEngine(
  params: UseUnifiedMainMapEngineParams,
): UseUnifiedMainMapEngineResult {
  const {
    locale,
    activeMapView,
    isActive,
    mapViewport,
    locationBbox,
    onMapViewportChange,
    onLocationFilterRelease,
    mapRenderErrorMessage,
    offersUnknownError,
    companiesUnknownError,
    offersByIdRef,
    companiesByIdRef,
    renderOffersPopup,
    renderCompaniesPopup,
    onOffersError,
    onCompaniesError,
  } = params;

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userInteractionRef = useRef(false);
  const isProgrammaticMoveRef = useRef(false);
  const pendingViewportEchoRef = useRef<SharedMapViewport | null>(null);
  const locationBboxRef = useRef<SearchBBox | null>(locationBbox);
  const onLocationFilterReleaseRef = useRef(onLocationFilterRelease);
  const isActiveRef = useRef(isActive);
  const mapViewportRef = useRef(mapViewport);
  const onMapViewportChangeRef = useRef(onMapViewportChange);
  const activeMapViewRef = useRef(activeMapView);
  const localeRef = useRef(locale);

  const [isMapReady, setIsMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const resizeMap = useCallback(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    map.resize();
  }, []);

  useEffect(() => {
    localeRef.current = locale;
  }, [locale]);

  useEffect(() => {
    locationBboxRef.current = locationBbox;
  }, [locationBbox]);

  useEffect(() => {
    onLocationFilterReleaseRef.current = onLocationFilterRelease;
  }, [onLocationFilterRelease]);

  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  useEffect(() => {
    mapViewportRef.current = mapViewport;
  }, [mapViewport]);

  useEffect(() => {
    onMapViewportChangeRef.current = onMapViewportChange;
  }, [onMapViewportChange]);

  useEffect(() => {
    activeMapViewRef.current = activeMapView;
  }, [activeMapView]);

  const setOffersSource = useCallback((items: OfferMapItem[]) => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const source = map.getSource(OFFERS_SOURCE_ID) as GeoJSONSource | undefined;
    if (!source) {
      return;
    }

    source.setData({
      type: "FeatureCollection",
      features: toOfferFeatureCollection(items),
    });
  }, []);

  const setCompaniesSource = useCallback((items: CompanyMapItem[]) => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const source = map.getSource(COMPANIES_SOURCE_ID) as GeoJSONSource | undefined;
    if (!source) {
      return;
    }

    source.setData({
      type: "FeatureCollection",
      features: toCompanyFeatureCollection(items),
    });
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE_URL,
      center: mapViewportRef.current?.center ?? [19.1451, 51.9194],
      zoom: mapViewportRef.current?.zoom ?? 6,
      crossSourceCollisions: false,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("error", (event) => {
      const message = event.error instanceof Error ? event.error.message : mapRenderErrorMessage;
      setMapError(message);
      setIsMapReady(true);
    });

    map.on("load", async () => {
      const activeLocationBbox = locationBboxRef.current;
      if (activeLocationBbox) {
        isProgrammaticMoveRef.current = true;
        map.fitBounds(
          [
            [activeLocationBbox[0], activeLocationBbox[1]],
            [activeLocationBbox[2], activeLocationBbox[3]],
          ],
          { padding: 24, duration: 0 },
        );
      } else if (!mapViewportRef.current) {
        map.fitBounds(POLAND_BOUNDS, { padding: 24, duration: 0 });
      }

      applyBaseMapLanguage(map, localeRef.current, [
        OFFERS_SOURCE_ID,
        COMPANIES_SOURCE_ID,
      ]);

      await ensureCategoryIcons(map);

      map.addSource(OFFERS_SOURCE_ID, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterRadius: 22,
        clusterMaxZoom: 12,
      });

      map.addLayer({
        id: OFFERS_CLUSTER_LAYER_ID,
        type: "circle",
        source: OFFERS_SOURCE_ID,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#f59e0b",
          "circle-radius": ["step", ["get", "point_count"], 18, 10, 24, 30, 30],
          "circle-stroke-width": 1,
          "circle-stroke-color": "#ffffff",
        },
      });

      map.addLayer({
        id: "offers-cluster-count",
        type: "symbol",
        source: OFFERS_SOURCE_ID,
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-size": 12,
          "text-anchor": "center",
          "text-justify": "center",
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: {
          "text-color": "#0f172a",
        },
      });

      map.addLayer({
        id: OFFERS_POINT_LAYER_ID,
        type: "circle",
        source: OFFERS_SOURCE_ID,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": [
            "case",
            ["==", ["get", "companyIsPremium"], true],
            "#fbbf24",
            "#f59e0b",
          ],
          "circle-radius": [
            "case",
            ["==", ["get", "companyIsPremium"], true],
            8.5,
            7,
          ],
          "circle-stroke-width": [
            "case",
            ["==", ["get", "companyIsPremium"], true],
            2.6,
            1.5,
          ],
          "circle-stroke-color": [
            "case",
            ["==", ["get", "companyIsPremium"], true],
            "#fef3c7",
            "#ffffff",
          ],
        },
      });

      map.addSource(COMPANIES_SOURCE_ID, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterRadius: 22,
        clusterMaxZoom: 12,
      });

      map.addLayer({
        id: COMPANIES_CLUSTER_LAYER_ID,
        type: "circle",
        source: COMPANIES_SOURCE_ID,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#0ea5e9",
          "circle-radius": ["step", ["get", "point_count"], 18, 10, 24, 30, 30],
          "circle-stroke-width": 1,
          "circle-stroke-color": "#ffffff",
        },
      });

      map.addLayer({
        id: "companies-cluster-count",
        type: "symbol",
        source: COMPANIES_SOURCE_ID,
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-size": 12,
          "text-anchor": "center",
          "text-justify": "center",
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: {
          "text-color": "#0f172a",
        },
      });

      map.addLayer({
        id: COMPANIES_POINT_LAYER_ID,
        type: "symbol",
        source: COMPANIES_SOURCE_ID,
        filter: ["!", ["has", "point_count"]],
        layout: {
          "icon-image": ["get", "categoryIconId"],
          "icon-size": 1.21,
          "icon-allow-overlap": true,
        },
      });

      setViewLayerVisibility(map, activeMapViewRef.current);
      setIsMapReady(true);
    });

    map.on("click", OFFERS_CLUSTER_LAYER_ID, (event) => {
      const feature = map
        .queryRenderedFeatures(event.point, { layers: [OFFERS_CLUSTER_LAYER_ID] })
        .at(0);
      if (!feature || feature.geometry?.type !== "Point") {
        return;
      }

      const clusterId = feature.properties?.cluster_id as number | undefined;
      if (clusterId === undefined) {
        return;
      }

      const source = map.getSource(OFFERS_SOURCE_ID) as GeoJSONSource | undefined;
      if (!source) {
        return;
      }

      void source
        .getClusterLeaves(clusterId, MAX_CLUSTER_POPUP_ITEMS, 0)
        .then((clusterFeatures) => {
          const ids = clusterFeatures
            .map((item) => String(item.properties?.id ?? ""))
            .filter(Boolean);
          const matchingItems = matchByIds(ids, offersByIdRef.current);
          const geometry = feature.geometry as GeoJSON.Point;
          popupRef.current?.remove();
          popupRef.current = renderOffersPopup(
            map,
            matchingItems,
            geometry.coordinates as [number, number],
          );
        })
        .catch(() => {
          onOffersError(offersUnknownError);
        });
    });

    map.on("click", OFFERS_POINT_LAYER_ID, (event) => {
      const ids = map
        .queryRenderedFeatures(event.point, { layers: [OFFERS_POINT_LAYER_ID] })
        .map((feature) => String(feature.properties?.id ?? ""))
        .filter(Boolean);
      const matchingItems = matchByIds(ids, offersByIdRef.current);
      popupRef.current?.remove();
      popupRef.current = renderOffersPopup(map, matchingItems, [event.lngLat.lng, event.lngLat.lat]);
    });

    map.on("click", COMPANIES_CLUSTER_LAYER_ID, (event) => {
      const feature = map
        .queryRenderedFeatures(event.point, { layers: [COMPANIES_CLUSTER_LAYER_ID] })
        .at(0);
      if (!feature || feature.geometry?.type !== "Point") {
        return;
      }

      const clusterId = feature.properties?.cluster_id as number | undefined;
      if (clusterId === undefined) {
        return;
      }

      const source = map.getSource(COMPANIES_SOURCE_ID) as GeoJSONSource | undefined;
      if (!source) {
        return;
      }

      void source
        .getClusterLeaves(clusterId, MAX_CLUSTER_POPUP_ITEMS, 0)
        .then((clusterFeatures) => {
          const matchingItems = toPopupCompaniesFromFeatures(
            clusterFeatures,
            companiesByIdRef.current,
          );
          const geometry = feature.geometry as GeoJSON.Point;
          popupRef.current?.remove();
          popupRef.current = renderCompaniesPopup(
            map,
            matchingItems,
            geometry.coordinates as [number, number],
          );
        })
        .catch(() => {
          onCompaniesError(companiesUnknownError);
        });
    });

    map.on("click", COMPANIES_POINT_LAYER_ID, (event) => {
      const features = map.queryRenderedFeatures(event.point, {
        layers: [COMPANIES_POINT_LAYER_ID],
      });
      const matchingItems = toPopupCompaniesFromFeatures(features, companiesByIdRef.current);
      popupRef.current?.remove();
      popupRef.current = renderCompaniesPopup(map, matchingItems, [event.lngLat.lng, event.lngLat.lat]);
    });

    map.on("dragstart", () => {
      userInteractionRef.current = true;
    });
    map.on("pitchstart", () => {
      userInteractionRef.current = true;
    });
    map.on("rotatestart", () => {
      userInteractionRef.current = true;
    });
    map.on("zoomstart", (event) => {
      const zoomEvent = event as { originalEvent?: Event };
      if (zoomEvent.originalEvent) {
        userInteractionRef.current = true;
      }
    });

    map.on("moveend", () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      const processMoveEnd = () => {
        if (map.isMoving()) {
          debounceRef.current = setTimeout(processMoveEnd, MOVE_END_RETRY_MS);
          return;
        }

        if (isProgrammaticMoveRef.current) {
          isProgrammaticMoveRef.current = false;
          userInteractionRef.current = false;
          return;
        }

        if (isActiveRef.current) {
          const center = map.getCenter();
          const nextViewport: SharedMapViewport = {
            center: [center.lng, center.lat],
            zoom: map.getZoom(),
          };
          pendingViewportEchoRef.current = nextViewport;
          onMapViewportChangeRef.current?.(nextViewport);
        }

        const shouldReleaseLocationFilter =
          userInteractionRef.current && locationBboxRef.current !== null;
        userInteractionRef.current = false;
        if (shouldReleaseLocationFilter) {
          onLocationFilterReleaseRef.current?.();
        }
      };

      debounceRef.current = setTimeout(processMoveEnd, MOVE_END_DEBOUNCE_MS);
    });

    mapRef.current = map;

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      popupRef.current?.remove();
      popupRef.current = null;
      map.remove();
      mapRef.current = null;
      setIsMapReady(false);
    };
  }, [
    companiesByIdRef,
    companiesUnknownError,
    mapRenderErrorMessage,
    offersByIdRef,
    offersUnknownError,
    onCompaniesError,
    onOffersError,
    renderCompaniesPopup,
    renderOffersPopup,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
      return;
    }

    applyBaseMapLanguage(map, locale, [OFFERS_SOURCE_ID, COMPANIES_SOURCE_ID]);
  }, [locale]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady) {
      return;
    }

    setViewLayerVisibility(map, activeMapView);
    popupRef.current?.remove();
    map.resize();
  }, [activeMapView, isMapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isActive) {
      return;
    }

    resizeMap();
  }, [isActive, resizeMap]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapViewport || !isActive) {
      return;
    }

    const pendingViewportEcho = pendingViewportEchoRef.current;
    if (pendingViewportEcho) {
      pendingViewportEchoRef.current = null;
      if (areViewportsEqual(pendingViewportEcho, mapViewport)) {
        return;
      }
    }

    const currentCenter = map.getCenter();
    const currentViewport: SharedMapViewport = {
      center: [currentCenter.lng, currentCenter.lat],
      zoom: map.getZoom(),
    };
    if (areViewportsEqual(currentViewport, mapViewport)) {
      return;
    }

    isProgrammaticMoveRef.current = true;
    map.jumpTo({ center: mapViewport.center, zoom: mapViewport.zoom });
  }, [isActive, mapViewport]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !locationBbox || !isActive) {
      return;
    }

    isProgrammaticMoveRef.current = true;
    map.fitBounds(
      [
        [locationBbox[0], locationBbox[1]],
        [locationBbox[2], locationBbox[3]],
      ],
      { padding: 24, duration: 500 },
    );
  }, [isActive, locationBbox]);

  const focusOfferOnMap = useCallback(
    (item: OfferMapItem) => {
      const map = mapRef.current;
      if (!map) {
        return;
      }

      try {
        map.flyTo({
          center: item.mainPoint,
          zoom: FOCUS_ZOOM,
          duration: FOCUS_FLYTO_DURATION_MS,
          essential: true,
        });
      } catch {
        map.jumpTo({ center: item.mainPoint, zoom: FOCUS_ZOOM });
      }

      popupRef.current?.remove();
      popupRef.current = renderOffersPopup(map, [item], item.mainPoint);
    },
    [renderOffersPopup],
  );

  const focusCompanyOnMap = useCallback(
    (item: CompanyMapItem) => {
      const map = mapRef.current;
      if (!map) {
        return;
      }

      try {
        map.flyTo({
          center: item.mainPoint,
          zoom: FOCUS_ZOOM,
          duration: FOCUS_FLYTO_DURATION_MS,
          essential: true,
        });
      } catch {
        map.jumpTo({ center: item.mainPoint, zoom: FOCUS_ZOOM });
      }

      popupRef.current?.remove();
      popupRef.current = renderCompaniesPopup(map, [item], item.mainPoint);
    },
    [renderCompaniesPopup],
  );

  return {
    mapContainerRef,
    isMapReady,
    mapError,
    resizeMap,
    setOffersSource,
    setCompaniesSource,
    focusOfferOnMap,
    focusCompanyOnMap,
  };
}
