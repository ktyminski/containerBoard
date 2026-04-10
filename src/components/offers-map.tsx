"use client";

import NextImage from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource } from "maplibre-gl";
import { withLang, type AppLocale, type AppMessages } from "@/lib/i18n";
import { OFFER_TYPE, type OfferType } from "@/lib/offer-type";
import type { CompanyOperatingArea } from "@/lib/company-operating-area";
import {
  applyBaseMapLanguage,
  MAP_STYLE_URL,
  POLAND_BOUNDS,
  tupleBboxToQuery,
} from "@/components/map-shared";
import { toCityCountryLocationLabel } from "@/lib/location-label";

type OfferMapItem = {
  id: string;
  companyName: string;
  companySlug: string;
  companyLogoUrl: string | null;
  offerType: OfferType;
  title: string;
  locationLabel: string;
  locationCity?: string;
  locationCountry?: string;
  tags: string[];
  mainPoint: [number, number];
};

type OffersApiResponse = {
  items: OfferMapItem[];
  meta: {
    count: number;
    limit: number;
    hasMore: boolean;
  };
};

type OffersMapProps = {
  locale: AppLocale;
  messages: AppMessages["mapModules"]["offers"];
  showOnMapLabel: string;
  keyword?: string;
  operatingAreas?: CompanyOperatingArea[];
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
const EMPTY_OPERATING_AREAS: CompanyOperatingArea[] = [];
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
const MAX_CLUSTER_POPUP_ITEMS = 30;
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

function matchOffersByIds(
  ids: string[],
  byId: Map<string, OfferMapItem>,
): OfferMapItem[] {
  const output: OfferMapItem[] = [];
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

function getOfferTypeLabel(
  offerType: OfferType,
  messages: AppMessages["mapModules"]["offers"],
): string {
  return offerType === OFFER_TYPE.TRANSPORT
    ? messages.offerTypes.transport
    : messages.offerTypes.cooperation;
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

function toShortLocationLabel(item: OfferMapItem): string {
  return toCityCountryLocationLabel({
    city: item.locationCity,
    country: item.locationCountry,
    fallbackLabel: item.locationLabel,
  });
}

function popupCard(
  offer: OfferMapItem,
  messages: AppMessages["mapModules"]["offers"],
): string {
  const typeLabel = getOfferTypeLabel(offer.offerType, messages);
  const fallbackColor = getCompanyFallbackColor(
    offer.companySlug || offer.companyName,
  );
  const logo = offer.companyLogoUrl
    ? `<img src="${escapeHtml(offer.companyLogoUrl)}" alt="${escapeHtml(offer.companyName)}" style="width:100%;height:100%;object-fit:contain;" />`
    : `<div style="display:flex;height:100%;width:100%;align-items:center;justify-content:center;background:${fallbackColor};font-size:13px;font-weight:700;color:#fff;">${escapeHtml(getCompanyInitial(offer.companyName))}</div>`;

  return `<article class="company-map-popup-item">
    <div class="company-map-popup-card" style="padding:6px 8px;">
      <div class="company-map-popup-card__row">
        <div class="company-map-popup-card__logo">
          ${logo}
        </div>
        <div class="company-map-popup-card__content" style="line-height:1.15;">
          <div style="font-size:13px; font-weight:600; color:#f8fafc; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(offer.title)}</div>
          <div style="margin-top:0; font-size:12px; color:#94a3b8; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(typeLabel)}</div>
          <div style="margin-top:0; font-size:12px; color:#cbd5e1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(offer.companyName)}</div>
        </div>
      </div>
    </div>
  </article>`;
}

function openPopup(
  map: maplibregl.Map,
  offers: OfferMapItem[],
  messages: AppMessages["mapModules"]["offers"],
  lngLat: [number, number],
): maplibregl.Popup {
  const body = offers.map((item) => popupCard(item, messages)).join("");

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

export function OffersMap({
  locale,
  messages,
  showOnMapLabel,
  keyword = "",
  operatingAreas,
  locationBbox = null,
  onLocationFilterRelease,
  isActive = true,
  mapViewport,
  onMapViewportChange,
}: OffersMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const itemsByIdRef = useRef<Map<string, OfferMapItem>>(new Map());
  const loadAbortRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userInteractionRef = useRef(false);
  const isProgrammaticMoveRef = useRef(false);
  const pendingViewportEchoRef = useRef<MapViewport | null>(null);
  const activeOperatingAreas = operatingAreas ?? EMPTY_OPERATING_AREAS;

  const [items, setItems] = useState<OfferMapItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMapReady, setIsMapReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    itemsByIdRef.current = new Map(items.map((item) => [item.id, item]));
  }, [items]);

  const updateSourceData = useCallback((nextItems: OfferMapItem[]) => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const source = map.getSource("offers") as GeoJSONSource | undefined;
    if (!source) {
      return;
    }

    source.setData({
      type: "FeatureCollection",
      features: toFeatureCollection(nextItems),
    });
  }, []);

  const loadOffers = useCallback(async () => {
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
      if (activeOperatingAreas.length > 0) {
        searchParams.set("operatingAreas", activeOperatingAreas.join(","));
      }

      const response = await fetch(`/api/offers?${searchParams.toString()}`, {
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = (await response.json()) as OffersApiResponse;
      if (controller.signal.aborted || requestId !== requestSeqRef.current) {
        return;
      }

      setItems(data.items);
      setHasMore(data.meta.hasMore);
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
    keyword,
    locationBbox,
    messages.unknownError,
    activeOperatingAreas,
    updateSourceData,
  ]);

  const focusOfferOnMap = useCallback(
    (offer: OfferMapItem) => {
      const map = mapRef.current;
      if (!map) {
        return;
      }

      try {
        map.flyTo({
          center: offer.mainPoint,
          zoom: FOCUS_ZOOM,
          duration: FOCUS_FLYTO_DURATION_MS,
          essential: true,
        });
      } catch {
        map.jumpTo({ center: offer.mainPoint, zoom: FOCUS_ZOOM });
      }

      popupRef.current?.remove();
      popupRef.current = openPopup(map, [offer], messages, offer.mainPoint);
    },
    [messages],
  );

  const loadOffersRef = useRef(loadOffers);
  const locationBboxRef = useRef(locationBbox);
  const onLocationFilterReleaseRef = useRef(onLocationFilterRelease);
  const isActiveRef = useRef(isActive);
  const mapViewportRef = useRef(mapViewport);
  const onMapViewportChangeRef = useRef(onMapViewportChange);

  useEffect(() => {
    loadOffersRef.current = loadOffers;
  }, [loadOffers]);

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

      applyBaseMapLanguage(map, locale, ["offers"]);

      map.addSource("offers", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterRadius: 22,
        clusterMaxZoom: 12,
      });

      map.addLayer({
        id: "offers-clusters",
        type: "circle",
        source: "offers",
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
        source: "offers",
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
        id: "offers-point",
        type: "circle",
        source: "offers",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": "#f59e0b",
          "circle-radius": 7,
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#ffffff",
        },
      });

      map.on("click", "offers-clusters", (event) => {
        const features = map.queryRenderedFeatures(event.point, {
          layers: ["offers-clusters"],
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

        const source = map.getSource("offers") as GeoJSONSource;
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
            const matchingItems = matchOffersByIds(
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
              geometry.coordinates as [number, number],
            );
          })
          .catch(() => {
            setError(messages.unknownError);
          });
      });

      map.on("click", "offers-point", (event) => {
        const features = map.queryRenderedFeatures(event.point, {
          layers: ["offers-point"],
        });

        if (features.length === 0) {
          return;
        }

        const ids = Array.from(
          new Set(
            features.map((feature) => String(feature.properties?.id ?? "")),
          ),
        ).filter(Boolean);
        const matchingItems = matchOffersByIds(
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
        popupRef.current = openPopup(map, matchingItems, messages, popupLngLat);
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

    applyBaseMapLanguage(map, locale, ["offers"]);
  }, [locale]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isActive || !isMapReady) {
      return;
    }

    void loadOffers();
  }, [isActive, isMapReady, loadOffers]);

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
              {items.map((item) => (
                <li key={item.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    className="w-full cursor-pointer rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-left transition hover:border-amber-300/60"
                    onClick={() => {
                      focusOfferOnMap(item);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        focusOfferOnMap(item);
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
                          <span className="inline-flex shrink-0 items-center rounded-md border border-sky-500/60 bg-cyan-500/15 px-2 py-0.5 text-[11px] font-semibold text-cyan-200">
                            {getOfferTypeLabel(item.offerType, messages)}
                          </span>
                        </div>
                        <p className="truncate text-xs text-slate-400">
                          {item.companyName}
                        </p>
                        <p className="truncate text-xs text-slate-300">
                          {toShortLocationLabel(item)}
                        </p>
                        <div className="mt-1 flex items-center gap-3 text-xs font-medium">
                          <a
                            href={withLang(`/offers/${item.id}`, locale)}
                            className="text-slate-400 transition hover:text-amber-300"
                            onClick={(event) => {
                              event.stopPropagation();
                            }}
                            onKeyDown={(event) => {
                              event.stopPropagation();
                            }}
                          >
                            {messages.openOffer}
                          </a>
                          <a
                            href={withLang(
                              `/companies/${item.companySlug}`,
                              locale,
                            )}
                            className="text-slate-400 transition hover:text-amber-300"
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
                            className="text-slate-400 transition hover:text-amber-300"
                            onClick={(event) => {
                              event.stopPropagation();
                              focusOfferOnMap(item);
                            }}
                          >
                            {showOnMapLabel}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </aside>
        <div className="order-2 relative min-h-0 overflow-hidden">
          <div ref={mapContainerRef} className="h-full min-h-0 w-full" />
          {!isMapReady ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/95">
              <div
                className="h-8 w-8 animate-spin rounded-full border-2 border-slate-500 border-t-amber-300"
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
