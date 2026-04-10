"use client";

import NextImage from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource } from "maplibre-gl";
import { useToast } from "@/components/toast-provider";
import {
  formatTemplate,
  withLang,
  type AppLocale,
  type AppMessages,
} from "@/lib/i18n";
import {
  JOB_RATE_PERIOD,
  type JobContractType,
  type JobRatePeriod,
  type JobWorkModel,
} from "@/lib/job-announcement";
import {
  applyBaseMapLanguage,
  MAP_STYLE_URL,
  POLAND_BOUNDS,
  tupleBboxToQuery,
} from "@/components/map-shared";
import { toCityCountryLocationLabel } from "@/lib/location-label";

type JobAnnouncementMapItem = {
  id: string;
  companyName: string;
  companySlug: string;
  companyLogoUrl: string | null;
  title: string;
  locationLabel: string;
  locationCity?: string;
  locationCountry?: string;
  salaryRatePeriod: JobRatePeriod;
  salaryFrom?: number;
  salaryTo?: number;
  tags: string[];
  planTier: "basic" | "plus" | "premium";
  mainPoint: [number, number];
  isFavorite?: boolean;
};

type AnnouncementsApiResponse = {
  items: JobAnnouncementMapItem[];
  meta: {
    count: number;
    limit: number;
    hasMore: boolean;
    canFavorite?: boolean;
  };
};

type JobAnnouncementsMapProps = {
  locale: AppLocale;
  messages: AppMessages["mapModules"]["announcements"];
  showOnMapLabel: string;
  keyword?: string;
  contractTypes?: JobContractType[];
  workModels?: JobWorkModel[];
  locationBbox?: [number, number, number, number] | null;
  onLocationFilterRelease?: () => void;
  isActive?: boolean;
  mapViewport?: MapViewport;
  onMapViewportChange?: (viewport: MapViewport) => void;
};

const FOCUS_ZOOM = 10;
const FOCUS_FLYTO_DURATION_MS = 1800;
const MOVE_END_DEBOUNCE_MS = 350;
const MOVE_END_RETRY_MS = 120;
const MAX_CLUSTER_POPUP_ITEMS = 30;
const EMPTY_CONTRACT_TYPES: JobContractType[] = [];
const EMPTY_WORK_MODELS: JobWorkModel[] = [];
type MapViewport = {
  center: [number, number];
  zoom: number;
};

function areViewportsEqual(first: MapViewport, second: MapViewport): boolean {
  const sameCenter =
    Math.abs(first.center[0] - second.center[0]) < 0.000001 &&
    Math.abs(first.center[1] - second.center[1]) < 0.000001;
  const sameZoom = Math.abs(first.zoom - second.zoom) < 0.0001;
  return sameCenter && sameZoom;
}
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

function matchAnnouncementsByIds(
  ids: string[],
  byId: Map<string, JobAnnouncementMapItem>,
): JobAnnouncementMapItem[] {
  const output: JobAnnouncementMapItem[] = [];
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

function toFeatureCollection(
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
    },
  }));
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getCompanyInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

function getCompanyFallbackColor(seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }

  return COMPANY_FALLBACK_COLORS[hash % COMPANY_FALLBACK_COLORS.length];
}

function toIntlLocale(locale: AppLocale): string {
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

function formatSalaryRange(input: {
  salaryFrom?: number;
  salaryTo?: number;
  salaryRatePeriod: JobRatePeriod;
  locale: AppLocale;
  messages: AppMessages["mapModules"]["announcements"];
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
    return formatTemplate(input.messages.salaryRangeTemplate, {
      from: formatter.format(fromValue),
      to: formatter.format(toValue),
      suffix,
    });
  }

  if (fromValue !== undefined) {
    return formatTemplate(input.messages.salaryFromTemplate, {
      value: formatter.format(fromValue),
      suffix,
    });
  }

  return formatTemplate(input.messages.salaryToTemplate, {
    value: formatter.format(toValue as number),
    suffix,
  });
}

function hasSalaryRange(input: {
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

function toShortLocationLabel(item: JobAnnouncementMapItem): string {
  return toCityCountryLocationLabel({
    city: item.locationCity,
    country: item.locationCountry,
    fallbackLabel: item.locationLabel,
  });
}

function popupCard(
  announcement: JobAnnouncementMapItem,
  messages: AppMessages["mapModules"]["announcements"],
  locale: AppLocale,
): string {
  const showSalary = hasSalaryRange({
    salaryFrom: announcement.salaryFrom,
    salaryTo: announcement.salaryTo,
  });
  const salaryText = showSalary
    ? formatSalaryRange({
        salaryFrom: announcement.salaryFrom,
        salaryTo: announcement.salaryTo,
        salaryRatePeriod: announcement.salaryRatePeriod,
        locale,
        messages,
      })
    : "";
  const fallbackColor = getCompanyFallbackColor(
    announcement.companySlug || announcement.companyName,
  );
  const logo = announcement.companyLogoUrl
    ? `<img src="${escapeHtml(announcement.companyLogoUrl)}" alt="${escapeHtml(announcement.companyName)}" style="width:100%;height:100%;object-fit:contain;" />`
    : `<div style="display:flex;height:100%;width:100%;align-items:center;justify-content:center;background:${fallbackColor};font-size:13px;font-weight:700;color:#fff;">${escapeHtml(getCompanyInitial(announcement.companyName))}</div>`;

  return `<article class="company-map-popup-item">
    <div class="company-map-popup-card" style="padding:6px 8px;">
      <div class="company-map-popup-card__row">
        <div class="company-map-popup-card__logo">
          ${logo}
        </div>
        <div class="company-map-popup-card__content" style="line-height:1.15;">
          <div style="font-size:13px; font-weight:600; color:#f8fafc; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(announcement.title)}</div>
          <div style="margin-top:0; font-size:12px; color:#cbd5e1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(announcement.companyName)}</div>
          ${
            showSalary
              ? `<div style="margin-top:0; font-size:12px; color:#34d399; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(salaryText)}</div>`
              : ""
          }
        </div>
      </div>
    </div>
  </article>`;
}

function openPopup(
  map: maplibregl.Map,
  announcements: JobAnnouncementMapItem[],
  messages: AppMessages["mapModules"]["announcements"],
  locale: AppLocale,
  lngLat: [number, number],
): maplibregl.Popup {
  const body = announcements.map((item) => popupCard(item, messages, locale)).join("");

  return new maplibregl.Popup({
    closeButton: false,
    closeOnClick: true,
    className: "company-map-popup",
  })
    .setLngLat(lngLat)
    .setHTML(
      `<div style="font-family: sans-serif; min-width:260px; max-width:380px; background:#0f172a; color:#e2e8f0; border-radius:10px; overflow:hidden;">
        <div class="company-map-popup-scroll" style="max-height:220px; overflow-y:auto;">
          <div class="company-map-popup-list" style="padding:4px 6px 4px 4px;">
            ${body}
          </div>
        </div>
      </div>`,
    )
    .addTo(map);
}

export function JobAnnouncementsMap({
  locale,
  messages,
  showOnMapLabel,
  keyword = "",
  contractTypes,
  workModels,
  locationBbox = null,
  onLocationFilterRelease,
  isActive = true,
  mapViewport,
  onMapViewportChange,
}: JobAnnouncementsMapProps) {
  const toast = useToast();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const itemsByIdRef = useRef<Map<string, JobAnnouncementMapItem>>(new Map());
  const loadAbortRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userInteractionRef = useRef(false);
  const isProgrammaticMoveRef = useRef(false);
  const pendingViewportEchoRef = useRef<MapViewport | null>(null);
  const activeContractTypes = contractTypes ?? EMPTY_CONTRACT_TYPES;
  const activeWorkModels = workModels ?? EMPTY_WORK_MODELS;

  const [items, setItems] = useState<JobAnnouncementMapItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMapReady, setIsMapReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [canFavorite, setCanFavorite] = useState(false);
  const [pendingFavoriteId, setPendingFavoriteId] = useState<string | null>(
    null,
  );
  const loginRedirectHref = withLang(
    `/login?next=${encodeURIComponent("/maps/announcements")}`,
    locale,
  );

  useEffect(() => {
    itemsByIdRef.current = new Map(items.map((item) => [item.id, item]));
  }, [items]);

  const updateSourceData = useCallback(
    (nextItems: JobAnnouncementMapItem[]) => {
      const map = mapRef.current;
      if (!map) {
        return;
      }

      const source = map.getSource("announcements") as
        | GeoJSONSource
        | undefined;
      if (!source) {
        return;
      }

      source.setData({
        type: "FeatureCollection",
        features: toFeatureCollection(nextItems),
      });
    },
    [],
  );

  const loadAnnouncements = useCallback(async () => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    loadAbortRef.current?.abort();
    const requestId = requestSeqRef.current + 1;
    requestSeqRef.current = requestId;
    const controller = new AbortController();
    loadAbortRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const searchParams = new URLSearchParams();
      const bbox = locationBbox ? tupleBboxToQuery(locationBbox) : null;
      const query = keyword.trim();
      if (bbox) {
        searchParams.set("bbox", bbox);
      }
      searchParams.set("limit", "500");
      if (query.length > 0) {
        searchParams.set("q", query);
      }
      if (activeContractTypes.length > 0) {
        searchParams.set("contractTypes", activeContractTypes.join(","));
      }
      if (activeWorkModels.length > 0) {
        searchParams.set("workModels", activeWorkModels.join(","));
      }

      const response = await fetch(
        `/api/announcements?${searchParams.toString()}`,
        {
          cache: "no-store",
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = (await response.json()) as AnnouncementsApiResponse;
      if (controller.signal.aborted || requestId !== requestSeqRef.current) {
        return;
      }

      setItems(data.items);
      setHasMore(data.meta.hasMore);
      setCanFavorite(data.meta.canFavorite === true);
      updateSourceData(data.items);
    } catch (loadError) {
      if (controller.signal.aborted) {
        return;
      }

      setError(
        loadError instanceof Error ? loadError.message : messages.unknownError,
      );
    } finally {
      if (!controller.signal.aborted && requestId === requestSeqRef.current) {
        setIsLoading(false);
      }
    }
  }, [
    activeContractTypes,
    activeWorkModels,
    keyword,
    locationBbox,
    messages.unknownError,
    updateSourceData,
  ]);

  const toggleFavorite = useCallback(
    async (announcementId: string, isFavorite: boolean) => {
      if (pendingFavoriteId) {
        return;
      }

      if (!canFavorite) {
        window.location.href = loginRedirectHref;
        return;
      }

      setPendingFavoriteId(announcementId);
      setItems((current) =>
        current.map((item) =>
          item.id === announcementId
            ? { ...item, isFavorite: !isFavorite }
            : item,
        ),
      );

      try {
        const response = await fetch(
          `/api/announcements/${announcementId}/favorite`,
          {
            method: isFavorite ? "DELETE" : "POST",
          },
        );

        if (response.status === 401) {
          window.location.href = loginRedirectHref;
          return;
        }

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(payload?.error || messages.unknownError);
        }

        const payload = (await response.json().catch(() => null)) as {
          isFavorite?: boolean;
        } | null;
        let resolvedIsFavorite = !isFavorite;
        if (typeof payload?.isFavorite === "boolean") {
          resolvedIsFavorite = payload.isFavorite;
          setItems((current) =>
            current.map((item) =>
              item.id === announcementId
                ? { ...item, isFavorite: payload.isFavorite }
                : item,
            ),
          );
        }
        if (!isFavorite && resolvedIsFavorite) {
          toast.success(messages.favoriteAddedNotice);
        }
      } catch {
        setItems((current) =>
          current.map((item) =>
            item.id === announcementId ? { ...item, isFavorite } : item,
          ),
        );
        setError(messages.unknownError);
      } finally {
        setPendingFavoriteId(null);
      }
    },
    [
      canFavorite,
      loginRedirectHref,
      messages.favoriteAddedNotice,
      messages.unknownError,
      pendingFavoriteId,
      toast,
    ],
  );

  const focusAnnouncementOnMap = useCallback(
    (item: JobAnnouncementMapItem) => {
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
      popupRef.current = openPopup(map, [item], messages, locale, item.mainPoint);
    },
    [locale, messages],
  );

  const loadAnnouncementsRef = useRef(loadAnnouncements);
  const locationBboxRef = useRef(locationBbox);
  const onLocationFilterReleaseRef = useRef(onLocationFilterRelease);
  const isActiveRef = useRef(isActive);
  const mapViewportRef = useRef(mapViewport);
  const onMapViewportChangeRef = useRef(onMapViewportChange);

  useEffect(() => {
    loadAnnouncementsRef.current = loadAnnouncements;
  }, [loadAnnouncements]);

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
      const message =
        event.error instanceof Error
          ? event.error.message
          : messages.mapRenderError;
      setError(message);
      setIsMapReady(true);
    });

    map.on("load", () => {
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

      applyBaseMapLanguage(map, locale, ["announcements"]);

      map.addSource("announcements", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterRadius: 22,
        clusterMaxZoom: 12,
      });

      map.addLayer({
        id: "announcements-clusters",
        type: "circle",
        source: "announcements",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#38bdf8",
          "circle-radius": ["step", ["get", "point_count"], 18, 10, 24, 30, 30],
          "circle-stroke-width": 1,
          "circle-stroke-color": "#ffffff",
        },
      });

      map.addLayer({
        id: "announcements-cluster-count",
        type: "symbol",
        source: "announcements",
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
        id: "announcements-point",
        type: "circle",
        source: "announcements",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": "#38bdf8",
          "circle-radius": 7,
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#ffffff",
        },
      });

      map.on("click", "announcements-clusters", (event) => {
        const features = map.queryRenderedFeatures(event.point, {
          layers: ["announcements-clusters"],
        });
        const feature = features[0];
        if (
          !feature ||
          !feature.geometry ||
          feature.geometry.type !== "Point"
        ) {
          return;
        }

        const clusterId = feature.properties?.cluster_id as number | undefined;
        if (clusterId === undefined) {
          return;
        }

      const source = map.getSource("announcements") as GeoJSONSource;
      void source
          .getClusterLeaves(clusterId, MAX_CLUSTER_POPUP_ITEMS, 0)
          .then((clusterFeatures) => {
            const ids = Array.from(
              new Set(
                clusterFeatures.map((item) =>
                  String(item.properties?.id ?? ""),
                ),
              ),
            ).filter(Boolean);
            const matchingItems = matchAnnouncementsByIds(
              ids,
              itemsByIdRef.current,
            );
            if (matchingItems.length === 0) {
              return;
            }

            const geometry = feature.geometry as GeoJSON.Point;
            popupRef.current?.remove();
            popupRef.current = openPopup(
              map,
              matchingItems,
              messages,
              locale,
              geometry.coordinates as [number, number],
            );
          })
          .catch(() => {
            setError(messages.unknownError);
          });
      });

      map.on("click", "announcements-point", (event) => {
        const features = map.queryRenderedFeatures(event.point, {
          layers: ["announcements-point"],
        });
        if (features.length === 0) {
          return;
        }

        const ids = Array.from(
          new Set(
            features.map((feature) => String(feature.properties?.id ?? "")),
          ),
        ).filter(Boolean);
        const matchingItems = matchAnnouncementsByIds(
          ids,
          itemsByIdRef.current,
        );
        if (matchingItems.length === 0) {
          return;
        }

        const popupLngLat: [number, number] = [
          event.lngLat.lng,
          event.lngLat.lat,
        ];
        popupRef.current?.remove();
        popupRef.current = openPopup(map, matchingItems, messages, locale, popupLngLat);
      });

      setIsMapReady(true);
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
          const nextViewport: MapViewport = {
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
          return;
        }
      };

      debounceRef.current = setTimeout(processMoveEnd, MOVE_END_DEBOUNCE_MS);
    });

    mapRef.current = map;

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      loadAbortRef.current?.abort();
      popupRef.current?.remove();
      popupRef.current = null;
      map.remove();
      mapRef.current = null;
      setIsMapReady(false);
    };
  }, [locale, messages, messages.mapRenderError]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
      return;
    }

    applyBaseMapLanguage(map, locale, ["announcements"]);
  }, [locale]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isActive || !isMapReady) {
      return;
    }

    void loadAnnouncements();
  }, [isActive, isMapReady, loadAnnouncements]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isActive) {
      return;
    }

    map.resize();
  }, [isActive]);

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
    const currentViewport: MapViewport = {
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

  return (
    <section className="flex h-full min-h-0 flex-col border border-slate-800 bg-slate-950/40">
      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-0 lg:grid-cols-[minmax(380px,46%)_minmax(0,1fr)] lg:grid-rows-1">
        <aside className="map-results-scroll order-1 min-h-0 overflow-y-auto overflow-x-hidden border-t border-slate-800 bg-slate-900/70 lg:h-full lg:border-r lg:border-t-0">
          <div className="flex min-h-full flex-col p-3">
            {error ? (
              <p className="mt-2 text-sm text-red-300">{error}</p>
            ) : null}
            {items.length === 0 && !isLoading ? (
              <p className="mt-3 text-sm text-slate-400">{messages.empty}</p>
            ) : null}
            <ul className="space-y-2 pr-2 text-sm">
              {items.map((item) => {
                const showSalary = hasSalaryRange({
                  salaryFrom: item.salaryFrom,
                  salaryTo: item.salaryTo,
                });
                const salaryText = showSalary
                  ? formatSalaryRange({
                      salaryFrom: item.salaryFrom,
                      salaryTo: item.salaryTo,
                      salaryRatePeriod: item.salaryRatePeriod,
                      locale,
                      messages,
                    })
                  : "";

                return (
                  <li key={item.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      className="w-full cursor-pointer rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-left transition hover:border-sky-300/60"
                      onClick={() => {
                        focusAnnouncementOnMap(item);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          focusAnnouncementOnMap(item);
                        }
                      }}
                    >
                      <div className="flex min-h-[5.25rem] items-center gap-3">
                        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-slate-800 bg-slate-900">
                          {item.companyLogoUrl ? (
                            <NextImage
                              src={item.companyLogoUrl}
                              alt={item.companyName}
                              fill
                              sizes="64px"
                              className="object-contain"
                            />
                          ) : (
                            <div
                              className="flex h-full w-full items-center justify-center text-sm font-semibold text-white"
                              style={{
                                backgroundColor: getCompanyFallbackColor(
                                  item.companySlug || item.companyName,
                                ),
                              }}
                            >
                              {getCompanyInitial(item.companyName)}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center min-w-0 gap-2">
                            <p className="min-w-0 flex-1 truncate font-medium text-slate-100">
                              {item.title}
                            </p>
                            <div className="flex shrink-0 items-center gap-2">
                              {showSalary ? (
                                <span className="inline-flex items-center rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-300">
                                  {salaryText}
                                </span>
                              ) : null}
                              <button
                                type="button"
                                className={`rounded-full border p-1.5 ${
                                  item.isFavorite
                                    ? "border-rose-600 text-rose-300"
                                    : "border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"
                                } disabled:cursor-not-allowed disabled:opacity-60`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void toggleFavorite(
                                    item.id,
                                    item.isFavorite === true,
                                  );
                                }}
                                aria-label={
                                  item.isFavorite
                                    ? messages.favoriteRemove
                                    : messages.favoriteAdd
                                }
                                title={
                                  item.isFavorite
                                    ? messages.favoriteRemove
                                    : messages.favoriteAdd
                                }
                                disabled={pendingFavoriteId === item.id}
                              >
                                <svg
                                  className="h-4 w-4"
                                  viewBox="0 0 24 24"
                                  fill={
                                    item.isFavorite ? "currentColor" : "none"
                                  }
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  aria-hidden="true"
                                >
                                  <path d="M12 21s-6.7-4.35-9.25-8.09C.83 10.09 1.64 6.1 4.68 4.3a5.46 5.46 0 0 1 6.24.46L12 5.66l1.08-.9a5.46 5.46 0 0 1 6.24-.46c3.04 1.8 3.85 5.8 1.93 8.61C18.7 16.65 12 21 12 21Z" />
                                </svg>
                              </button>
                            </div>
                          </div>
                          <p className="truncate text-xs text-slate-400">
                            {item.companyName}
                          </p>
                          <p className="truncate text-xs text-slate-300">
                            {toShortLocationLabel(item)}
                          </p>
                          <div className="mt-1 flex items-center gap-3 text-xs font-medium">
                            <a
                              href={withLang(
                                `/announcements/${item.id}`,
                                locale,
                              )}
                              className="text-slate-400 transition hover:text-sky-300"
                              onClick={(event) => {
                                event.stopPropagation();
                              }}
                              onKeyDown={(event) => {
                                event.stopPropagation();
                              }}
                            >
                              {messages.openAnnouncement}
                            </a>
                            <a
                              href={withLang(
                                `/companies/${item.companySlug}`,
                                locale,
                              )}
                              className="text-slate-400 transition hover:text-sky-300"
                              onClick={(event) => {
                                event.stopPropagation();
                              }}
                              onKeyDown={(event) => {
                                event.stopPropagation();
                              }}
                            >
                              {messages.openCompany}
                            </a>
                            <button
                              type="button"
                              className="text-slate-400 transition hover:text-sky-300"
                              onClick={(event) => {
                                event.stopPropagation();
                                focusAnnouncementOnMap(item);
                              }}
                            >
                              {showOnMapLabel}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>
        <div className="order-2 relative min-h-0 overflow-hidden">
          <div ref={mapContainerRef} className="h-full min-h-0 w-full" />
          {!isMapReady ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/95">
              <div
                className="h-8 w-8 animate-spin rounded-full border-2 border-slate-500 border-t-sky-400"
                aria-label={messages.loading}
                role="status"
              />
            </div>
          ) : null}
        </div>
      </div>
      {hasMore ? (
        <p className="border-t border-slate-800 px-3 py-2 text-xs text-amber-300">
          {messages.tooManyResults}
        </p>
      ) : null}
    </section>
  );
}
