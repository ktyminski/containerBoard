"use client";

import NextImage from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource } from "maplibre-gl";
import { COMPANY_VERIFICATION_STATUS } from "@/lib/company-verification";
import type { CompanyMapItem } from "@/types/company";
import type { CompanyOperatingArea } from "@/lib/company-operating-area";
import type { CompanyCommunicationLanguage } from "@/types/company-communication-language";
import {
  withLang,
  type AppLocale,
  type AppMessages,
} from "@/lib/i18n";
import {
  applyBaseMapLanguage,
  MAP_STYLE_URL,
  POLAND_BOUNDS,
  tupleBboxToQuery,
} from "@/components/map-shared";

type CompaniesApiResponse = {
  items: CompanyMapItem[];
  meta: {
    count: number;
    limit: number;
    hasMore: boolean;
  };
};

type CompaniesMapProps = {
  locale: AppLocale;
  messages: AppMessages["map"];
  verifiedLabel: AppMessages["companyStatus"]["verified"];
  operatingAreaLabels: AppMessages["mapModules"]["filters"]["operatingAreas"];
  specializationLabels: AppMessages["companyCreate"]["specializationsOptions"];
  keyword?: string;
  operatingAreas?: CompanyOperatingArea[];
  communicationLanguages?: CompanyCommunicationLanguage[];
  mapOnly?: boolean;
  locationBbox?: [number, number, number, number] | null;
  onLocationFilterRelease?: () => void;
  isActive?: boolean;
  mapViewport?: MapViewport;
  onMapViewportChange?: (viewport: MapViewport) => void;
};

const MAX_CLUSTER_POPUP_ITEMS = 30;
const FOCUS_ZOOM = 10;
const FOCUS_FLYTO_DURATION_MS = 1800;
const MOVE_END_DEBOUNCE_MS = 350;
const MOVE_END_RETRY_MS = 120;
const EMPTY_OPERATING_AREAS: CompanyOperatingArea[] = [];
const EMPTY_COMMUNICATION_LANGUAGES: CompanyCommunicationLanguage[] = [];
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

function matchCompaniesByIds(
  ids: string[],
  byId: Map<string, CompanyMapItem>,
): CompanyMapItem[] {
  const output: CompanyMapItem[] = [];
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

function categoryIconId(isPremium = false): string {
  return isPremium ? COMPANY_MARKER.premium.id : COMPANY_MARKER.standard.id;
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

async function ensureCategoryIcons(map: maplibregl.Map): Promise<void> {
  for (const isPremium of [false, true]) {
    const imageId = categoryIconId(isPremium);
    if (map.hasImage(imageId)) {
      continue;
    }

    const icon = await loadSvgImage(markerSvg(isPremium));
    map.addImage(imageId, icon, { pixelRatio: 2 });
  }
}

function toFeatureCollection(
  companies: CompanyMapItem[],
): GeoJSON.Feature<GeoJSON.Point>[] {
  return companies.map((company) => ({
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: company.mainPoint,
    },
    properties: {
      id: company.id,
      name: company.name,
      slug: company.slug,
      categoryIconId: categoryIconId(company.isPremium),
      locationCount: company.locationCount,
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

function popupCompanyCard(
  company: CompanyMapItem,
  messages: AppMessages["map"],
  verifiedLabel: AppMessages["companyStatus"]["verified"],
  operatingAreaLabels: AppMessages["mapModules"]["filters"]["operatingAreas"],
  specializationLabels: AppMessages["companyCreate"]["specializationsOptions"],
  locale: AppLocale,
): string {
  const summary = escapeHtml(
    formatCompanySummary(company, messages, operatingAreaLabels, specializationLabels),
  );
  const detailsUrl = withLang(`/companies/${company.slug}`, locale);
  const fallbackColor = getCompanyFallbackColor(company.id);
  const premiumCardStyle = company.isPremium
    ? "border:1px solid rgba(245,158,11,0.52);background:linear-gradient(180deg,rgba(51,34,8,0.92),rgba(15,23,42,0.98));box-shadow:inset 0 1px 0 rgba(253,230,138,0.2),0 8px 18px -16px rgba(245,158,11,0.85);"
    : "";
  const premiumLogoStyle = company.isPremium
    ? "box-shadow:0 0 12px rgba(245,158,11,0.25);"
    : "";
  const nameStyle = company.isPremium ? ' style="color:#fef3c7;"' : "";
  const summaryStyle = company.isPremium ? ' style="color:rgba(253,186,116,0.88);"' : "";
  const logo =
    company.logoUrl
      ? `<img src="${escapeHtml(company.logoUrl)}" alt="${escapeHtml(company.name)}" style="width:100%;height:100%;object-fit:contain;" />`
      : `<div style="display:flex;height:100%;width:100%;align-items:center;justify-content:center;background:${fallbackColor};font-size:13px;font-weight:700;color:#fff;">${escapeHtml(getCompanyInitial(company.name))}</div>`;
  const verifiedBadge =
    company.verificationStatus === COMPANY_VERIFICATION_STATUS.VERIFIED
      ? `<svg viewBox="0 0 20 20" fill="none" class="company-map-popup-card__verified-icon" aria-hidden="true" aria-label="${escapeHtml(verifiedLabel)}" title="${escapeHtml(verifiedLabel)}">
          <path d="M5 10.5l3.2 3.2L15 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>`
      : "";

  return `<a href="${detailsUrl}" class="company-map-popup-item">
    <div class="company-map-popup-card"${premiumCardStyle ? ` style="${premiumCardStyle}"` : ""}>
      <div class="company-map-popup-card__row">
      <div class="company-map-popup-card__logo"${premiumLogoStyle ? ` style="${premiumLogoStyle}"` : ""}>
        ${logo}
      </div>
      <div class="company-map-popup-card__content">
        <div class="company-map-popup-card__name-row">
          <span class="company-map-popup-card__name-inline">
            <span class="company-map-popup-card__name"${nameStyle}>${escapeHtml(company.name)}</span>
            ${verifiedBadge}
          </span>
        </div>
        <div class="company-map-popup-card__summary"${summaryStyle}>${summary}</div>
      </div>
    </div>
    </div>
  </a>`;
}

function openPopup(
  map: maplibregl.Map,
  companies: CompanyMapItem[],
  messages: AppMessages["map"],
  verifiedLabel: AppMessages["companyStatus"]["verified"],
  operatingAreaLabels: AppMessages["mapModules"]["filters"]["operatingAreas"],
  specializationLabels: AppMessages["companyCreate"]["specializationsOptions"],
  locale: AppLocale,
  lngLat: [number, number],
): maplibregl.Popup {
  const prioritizedCompanies = [...companies].sort(
    (left, right) => Number(right.isPremium) - Number(left.isPremium),
  );

  const body = prioritizedCompanies
    .map((company) =>
      popupCompanyCard(
        company,
        messages,
        verifiedLabel,
        operatingAreaLabels,
        specializationLabels,
        locale,
      ),
    )
    .join("");

  return new maplibregl.Popup({
    closeButton: false,
    closeOnClick: true,
    className: "company-map-popup",
  })
    .setLngLat(lngLat)
    .setHTML(
      `<div style="font-family: sans-serif; min-width:280px; max-width:448px; background:#0f172a; color:#e2e8f0; border-radius:10px; overflow:hidden;">
        <div class="company-map-popup-scroll" style="max-height:220px; overflow-y:auto;">
          <div class="company-map-popup-list" style="padding:8px 10px 8px 8px;">
            ${body}
          </div>
        </div>
      </div>`,
    )
    .addTo(map);
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

function formatSpecializationsSummary(
  company: CompanyMapItem,
  messages: AppMessages["map"],
  specializationLabels: AppMessages["companyCreate"]["specializationsOptions"],
): string | null {
  if (company.specializations.length === 0) {
    return null;
  }

  const labels = company.specializations
    .slice(0, 3)
    .map((specialization) => specializationLabels[specialization]);
  return company.specializations.length > 3
    ? `${labels.join(", ")} ${messages.summaryAndOthers}`
    : labels.join(", ");
}

function formatCompanySummary(
  company: CompanyMapItem,
  messages: AppMessages["map"],
  operatingAreaLabels: AppMessages["mapModules"]["filters"]["operatingAreas"],
  specializationLabels: AppMessages["companyCreate"]["specializationsOptions"],
): string {
  const specializations = formatSpecializationsSummary(company, messages, specializationLabels);
  if (specializations) {
    return specializations;
  }

  return `${messages.summaryOperatingAreaPrefix}: ${operatingAreaLabels[company.operatingArea]}`;
}

export function CompaniesMap({
  locale,
  messages,
  verifiedLabel,
  operatingAreaLabels,
  specializationLabels,
  keyword = "",
  operatingAreas,
  communicationLanguages,
  mapOnly = false,
  locationBbox = null,
  onLocationFilterRelease,
  isActive = true,
  mapViewport,
  onMapViewportChange,
}: CompaniesMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const companiesByIdRef = useRef<Map<string, CompanyMapItem>>(new Map());
  const loadAbortRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userInteractionRef = useRef(false);
  const isProgrammaticMoveRef = useRef(false);
  const pendingViewportEchoRef = useRef<MapViewport | null>(null);
  const activeOperatingAreas = operatingAreas ?? EMPTY_OPERATING_AREAS;
  const activeCommunicationLanguages =
    communicationLanguages ?? EMPTY_COMMUNICATION_LANGUAGES;

  const [companies, setCompanies] = useState<CompanyMapItem[]>([]);
  const [isMapReady, setIsMapReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    companiesByIdRef.current = new Map(companies.map((item) => [item.id, item]));
  }, [companies]);

  const updateSourceData = useCallback((items: CompanyMapItem[]) => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const source = map.getSource("companies") as GeoJSONSource | undefined;
    if (!source) {
      return;
    }

    source.setData({
      type: "FeatureCollection",
      features: toFeatureCollection(items),
    });
  }, []);

  const loadCompanies = useCallback(async () => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    loadAbortRef.current?.abort();
    const requestId = requestSeqRef.current + 1;
    requestSeqRef.current = requestId;
    const controller = new AbortController();
    loadAbortRef.current = controller;

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
      if (activeCommunicationLanguages.length > 0) {
        searchParams.set(
          "communicationLanguages",
          activeCommunicationLanguages.join(","),
        );
      }

      const response = await fetch(`/api/companies?${searchParams.toString()}`, {
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = (await response.json()) as CompaniesApiResponse;
      if (controller.signal.aborted || requestId !== requestSeqRef.current) {
        return;
      }

      setCompanies(data.items);
      setHasMore(data.meta.hasMore);
      updateSourceData(data.items);
    } catch (loadError) {
      if (controller.signal.aborted) {
        return;
      }

      setError(
        loadError instanceof Error ? loadError.message : messages.unknownError,
      );
    }
  }, [
    keyword,
    locationBbox,
    messages.unknownError,
    activeCommunicationLanguages,
    activeOperatingAreas,
    updateSourceData,
  ]);
  const loadCompaniesRef = useRef(loadCompanies);
  const locationBboxRef = useRef(locationBbox);
  const onLocationFilterReleaseRef = useRef(onLocationFilterRelease);
  const isActiveRef = useRef(isActive);
  const mapViewportRef = useRef(mapViewport);
  const onMapViewportChangeRef = useRef(onMapViewportChange);

  useEffect(() => {
    loadCompaniesRef.current = loadCompanies;
  }, [loadCompanies]);

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

      applyBaseMapLanguage(map, locale, ["companies"]);
      await ensureCategoryIcons(map);

      map.addSource("companies", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterRadius: 22,
        clusterMaxZoom: 12,
      });

      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "companies",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#0ea5e9",
          "circle-radius": ["step", ["get", "point_count"], 18, 10, 24, 30, 30],
          "circle-stroke-width": 1,
          "circle-stroke-color": "#ffffff",
        },
      });

      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "companies",
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
        id: "unclustered-point",
        type: "symbol",
        source: "companies",
        filter: ["!", ["has", "point_count"]],
        layout: {
          "icon-image": ["get", "categoryIconId"],
          "icon-size": 1.21,
          "icon-allow-overlap": true,
        },
      });

      map.on("click", "clusters", (event) => {
        const features = map.queryRenderedFeatures(event.point, {
          layers: ["clusters"],
        });
        const feature = features[0];
        if (!feature) {
          return;
        }

        const clusterId = feature.properties?.cluster_id as number | undefined;
        if (clusterId === undefined) {
          return;
        }

        const source = map.getSource("companies") as GeoJSONSource;
        void source
          .getClusterLeaves(clusterId, MAX_CLUSTER_POPUP_ITEMS, 0)
          .then((clusterFeatures) => {
            const ids = Array.from(
              new Set(
                clusterFeatures.map((item) => String(item.properties?.id ?? "")),
              ),
            ).filter(Boolean);
            const matchingCompanies = matchCompaniesByIds(
              ids,
              companiesByIdRef.current,
            );
            if (matchingCompanies.length === 0 || !feature.geometry) {
              return;
            }

            const geometry = feature.geometry as GeoJSON.Point;
            popupRef.current?.remove();
            popupRef.current = openPopup(
              map,
              matchingCompanies,
              messages,
              verifiedLabel,
              operatingAreaLabels,
              specializationLabels,
              locale,
              geometry.coordinates as [number, number],
            );
          })
          .catch(() => {
            setError(messages.unknownError);
          });
      });

      map.on("click", "unclustered-point", (event) => {
        const features = map.queryRenderedFeatures(event.point, {
          layers: ["unclustered-point"],
        });
        if (features.length === 0) {
          return;
        }

        const ids = Array.from(
          new Set(
            features.map((feature) => String(feature.properties?.id ?? "")),
          ),
        ).filter(Boolean);
        const matchingCompanies = matchCompaniesByIds(ids, companiesByIdRef.current);
        if (matchingCompanies.length === 0) {
          return;
        }

        const popupLngLat: [number, number] = [
          event.lngLat.lng,
          event.lngLat.lat,
        ];
        popupRef.current?.remove();
        popupRef.current = openPopup(
          map,
          matchingCompanies,
          messages,
          verifiedLabel,
          operatingAreaLabels,
          specializationLabels,
          locale,
          popupLngLat,
        );
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
      popupRef.current?.remove();
      popupRef.current = null;
      loadAbortRef.current?.abort();
      map.remove();
      mapRef.current = null;
      setIsMapReady(false);
    };
  }, [
    locale,
    messages,
    messages.mapRenderError,
    operatingAreaLabels,
    specializationLabels,
    verifiedLabel,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
      return;
    }

    applyBaseMapLanguage(map, locale, ["companies"]);
  }, [locale]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isActive || !isMapReady) {
      return;
    }

    void loadCompanies();
  }, [isActive, isMapReady, loadCompanies]);

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

  const focusCompanyOnMap = useCallback(
    (company: CompanyMapItem) => {
      const map = mapRef.current;
      if (!map) {
        return;
      }
      try {
        map.flyTo({
          center: company.mainPoint,
          zoom: FOCUS_ZOOM,
          duration: FOCUS_FLYTO_DURATION_MS,
          essential: true,
        });
      } catch {
        map.jumpTo({ center: company.mainPoint, zoom: FOCUS_ZOOM });
      }
      popupRef.current?.remove();
      popupRef.current = openPopup(
        map,
        [company],
        messages,
        verifiedLabel,
        operatingAreaLabels,
        specializationLabels,
        locale,
        company.mainPoint,
      );
    },
    [locale, messages, operatingAreaLabels, specializationLabels, verifiedLabel],
  );

  return (
    <section className="flex h-full min-h-0 flex-col border border-neutral-800 bg-neutral-950/40">
      {mapOnly ? (
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <div ref={mapContainerRef} className="h-full min-h-0 w-full" />
          {error ? (
            <div className="absolute left-3 top-3 z-20 rounded-md border border-red-500/50 bg-neutral-950/90 px-3 py-2 text-xs text-red-200">
              {error}
            </div>
          ) : null}
          {!isMapReady ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-neutral-900/95">
              <div
                className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-500 border-t-sky-400"
                aria-label={messages.loading}
                role="status"
              />
            </div>
          ) : null}
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-0 lg:grid-cols-[minmax(380px,46%)_minmax(0,1fr)] lg:grid-rows-1">
          <aside className="map-results-scroll order-1 min-h-0 overflow-y-auto overflow-x-hidden border-t border-neutral-800 bg-neutral-900/70 lg:h-full lg:border-r lg:border-t-0">
            <div className="flex min-h-full flex-col p-3">
              {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
              <ul className="mt-1 space-y-2 pr-2 text-sm">
                {companies.map((company) => (
                  <li key={company.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      className={`w-full cursor-pointer rounded-md border px-3 py-2 text-left transition ${
                        company.isPremium
                          ? "border-neutral-800 bg-gradient-to-br from-neutral-950 via-amber-950/25 to-neutral-950 hover:border-amber-300/80"
                          : "border-neutral-800 bg-neutral-950 hover:border-sky-400/60"
                      }`}
                      onClick={() => {
                        focusCompanyOnMap(company);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          focusCompanyOnMap(company);
                        }
                      }}
                    >
                      <div className="flex min-h-[5.25rem] items-center gap-3">
                        <div
                          className={`relative h-16 w-16 shrink-0 rounded-md border bg-neutral-900 ${
                            company.isPremium
                              ? "overflow-visible border-neutral-800 shadow-[0_0_14px_rgba(245,158,11,0.35)]"
                              : "overflow-hidden border-neutral-800"
                          }`}
                        >
                          <div className="relative h-full w-full overflow-hidden rounded-[inherit]">
                            {company.logoUrl ? (
                              <NextImage
                                src={company.logoUrl}
                                alt={company.name}
                                fill
                                sizes="64px"
                                className="object-contain"
                              />
                            ) : (
                              <div
                                className="flex h-full w-full items-center justify-center text-sm font-semibold text-white"
                                style={{ backgroundColor: getCompanyFallbackColor(company.id) }}
                              >
                                {getCompanyInitial(company.name)}
                              </div>
                            )}
                          </div>
                          {company.isPremium ? (
                            <span className="absolute left-0 top-0 z-10 inline-flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-amber-400/80 bg-neutral-950/90 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.35)]">
                              <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" aria-hidden="true">
                                <path
                                  d="M10 2.9l2.15 4.35 4.8.7-3.47 3.38.82 4.78L10 13.95 5.7 16.1l.82-4.78L3.05 7.95l4.8-.7L10 2.9Z"
                                  fill="currentColor"
                                />
                              </svg>
                            </span>
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="min-w-0">
                            <span className="inline-flex max-w-full items-center gap-1.5">
                              <span
                                className={`truncate font-medium ${
                                  company.isPremium ? "text-amber-100" : "text-neutral-100"
                                }`}
                              >
                                {company.name}
                              </span>
                              {company.verificationStatus === COMPANY_VERIFICATION_STATUS.VERIFIED ? (
                                <span
                                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center text-emerald-300"
                                  aria-label={verifiedLabel}
                                  title={verifiedLabel}
                                >
                                  <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
                                    <path
                                      d="M5 10.5l3.2 3.2L15 7"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  </svg>
                                </span>
                              ) : null}
                            </span>
                          </div>
                          <p className={`truncate text-xs ${company.isPremium ? "text-amber-100/80" : "text-neutral-400"}`}>
                            {company.locationCity ? (
                              <strong className={`font-semibold ${company.isPremium ? "text-amber-100" : "text-neutral-200"}`}>
                                {company.locationCity}
                              </strong>
                            ) : null}
                          </p>
                          <p className={`mt-1 truncate text-xs ${company.isPremium ? "text-amber-200/70" : "text-neutral-500"}`}>
                            {formatCompanySummary(
                              company,
                              messages,
                              operatingAreaLabels,
                              specializationLabels,
                            )}
                          </p>
                          <div className="mt-1 flex items-center gap-3 text-xs font-medium">
                            <a
                              href={withLang(`/companies/${company.slug}`, locale)}
                              className={`transition ${company.isPremium ? "text-amber-200/90 hover:text-amber-100" : "text-neutral-400 hover:text-sky-300"}`}
                              onClick={(event) => {
                                event.stopPropagation();
                              }}
                              onKeyDown={(event) => {
                                event.stopPropagation();
                              }}
                            >
                              {messages.openCompanyShort}
                            </a>
                            <button
                              type="button"
                              className={`transition ${company.isPremium ? "text-amber-200/90 hover:text-amber-100" : "text-neutral-400 hover:text-sky-300"}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                focusCompanyOnMap(company);
                              }}
                            >
                              {messages.showOnMapShort}
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
            <div
              ref={mapContainerRef}
              className="h-full min-h-0 w-full"
            />
            {!isMapReady ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-neutral-900/95">
                <div
                  className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-500 border-t-sky-400"
                  aria-label={messages.loading}
                  role="status"
                />
              </div>
            ) : null}
          </div>
        </div>
      )}

      {hasMore ? (
        <p className="border-t border-neutral-800 px-3 py-2 text-xs text-amber-300">
          {messages.tooManyResults}
        </p>
      ) : null}
    </section>
  );
}













