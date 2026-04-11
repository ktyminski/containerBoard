"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { NAV_HISTORY_STACK_KEY } from "@/components/in-app-navigation-history-tracker";
import type { Map as MapLibreMap } from "maplibre-gl";
import { useToast } from "@/components/toast-provider";
import { AnnouncementsList, CompaniesList, OffersList } from "@/components/unified-main-map/list-sections";
import {
  openAnnouncementsPopup,
  openCompaniesPopup,
  openOffersPopup,
} from "@/components/unified-main-map/popups";
import {
  EMPTY_COMMUNICATION_LANGUAGES,
  EMPTY_COMPANY_CATEGORIES,
  EMPTY_COMPANY_SPECIALIZATIONS,
  EMPTY_CONTRACT_TYPES,
  EMPTY_OPERATING_AREAS,
  EMPTY_WORK_MODELS,
  type JobAnnouncementMapItem,
  type OfferMapItem,
  type UnifiedMainMapProps,
} from "@/components/unified-main-map/types";
import { useUnifiedMainMapData } from "@/components/unified-main-map/use-unified-main-map-data";
import { useUnifiedMainMapEngine } from "@/components/unified-main-map/use-unified-main-map-engine";
import {
  resolveTooManyResultsLabel,
  UNIFIED_MAP_VIEW_CONFIG,
} from "@/components/unified-main-map/view-config";
import type { CompanyMapItem } from "@/types/company";

export function UnifiedMainMap({
  locale,
  mapMessages,
  companyCreateMessages,
  verifiedLabel,
  operatingAreaLabels,
  announcementsMessages,
  offersMessages,
  companiesListMessages,
  showOnMapLabel,
  initialMobilePane = "list",
  activeMapView,
  keyword = "",
  contractTypes,
  workModels,
  operatingAreas,
  communicationLanguages,
  companyCategories,
  companySpecializations,
  locationBbox = null,
  onLocationFilterRelease,
  isActive = true,
  mapViewport,
  onMapViewportChange,
}: UnifiedMainMapProps) {
  const toast = useToast();
  const [mobilePane, setMobilePane] = useState<"list" | "map">(initialMobilePane);
  const listScrollContainerRef = useRef<HTMLDivElement | null>(null);

  const activeContractTypes = contractTypes ?? EMPTY_CONTRACT_TYPES;
  const activeWorkModels = workModels ?? EMPTY_WORK_MODELS;
  const activeOperatingAreas = operatingAreas ?? EMPTY_OPERATING_AREAS;
  const activeCommunicationLanguages =
    communicationLanguages ?? EMPTY_COMMUNICATION_LANGUAGES;
  const activeCompanyCategories = companyCategories ?? EMPTY_COMPANY_CATEGORIES;
  const activeCompanySpecializations =
    companySpecializations ?? EMPTY_COMPANY_SPECIALIZATIONS;

  const {
    announcementsItems,
    announcementsError,
    announcementsLoading,
    announcementsLoaded,
    announcementsHasMore,
    pendingFavoriteId,
    offersItems,
    offersError,
    offersLoading,
    offersLoaded,
    offersHasMore,
    companiesItems,
    companiesError,
    companiesLoading,
    companiesLoaded,
    companiesHasMore,
    announcementsByIdRef,
    offersByIdRef,
    companiesByIdRef,
    loadAnnouncements,
    loadOffers,
    loadCompanies,
    toggleFavorite,
    reportAnnouncementsError,
    reportOffersError,
    reportCompaniesError,
    abortAll,
  } = useUnifiedMainMapData({
    locale,
    announcementsMessages,
    offersMessages,
    mapMessages,
    keyword,
    contractTypes: activeContractTypes,
    workModels: activeWorkModels,
    operatingAreas: activeOperatingAreas,
    communicationLanguages: activeCommunicationLanguages,
    companyCategories: activeCompanyCategories,
    companySpecializations: activeCompanySpecializations,
    locationBbox,
    onFavoriteAddedNotice: (message) => {
      toast.success(message);
    },
  });

  const renderAnnouncementsPopup = useCallback(
    (map: MapLibreMap, items: JobAnnouncementMapItem[], lngLat: [number, number]) =>
      openAnnouncementsPopup(map, items, announcementsMessages, locale, lngLat),
    [announcementsMessages, locale],
  );

  const renderOffersPopup = useCallback(
    (map: MapLibreMap, items: OfferMapItem[], lngLat: [number, number]) =>
      openOffersPopup(map, items, offersMessages, locale, lngLat),
    [locale, offersMessages],
  );

  const renderCompaniesPopup = useCallback(
    (map: MapLibreMap, items: CompanyMapItem[], lngLat: [number, number]) =>
      openCompaniesPopup(
        map,
        items,
        mapMessages,
        verifiedLabel,
        operatingAreaLabels,
        companyCreateMessages.specializationsOptions,
        locale,
        lngLat,
      ),
    [
      companyCreateMessages.specializationsOptions,
      locale,
      mapMessages,
      operatingAreaLabels,
      verifiedLabel,
    ],
  );

  const {
    mapContainerRef,
    isMapReady,
    mapError,
    resizeMap,
    setAnnouncementsSource,
    setOffersSource,
    setCompaniesSource,
    focusAnnouncementOnMap,
    focusOfferOnMap,
    focusCompanyOnMap,
  } = useUnifiedMainMapEngine({
    locale,
    activeMapView,
    isActive,
    mapViewport,
    locationBbox,
    onMapViewportChange,
    onLocationFilterRelease,
    mapRenderErrorMessage: mapMessages.mapRenderError,
    announcementsUnknownError: announcementsMessages.unknownError,
    offersUnknownError: offersMessages.unknownError,
    companiesUnknownError: mapMessages.unknownError,
    announcementsByIdRef,
    offersByIdRef,
    companiesByIdRef,
    renderAnnouncementsPopup,
    renderOffersPopup,
    renderCompaniesPopup,
    onAnnouncementsError: reportAnnouncementsError,
    onOffersError: reportOffersError,
    onCompaniesError: reportCompaniesError,
  });

  useEffect(() => {
    setAnnouncementsSource(announcementsItems);
  }, [announcementsItems, setAnnouncementsSource]);

  useEffect(() => {
    setOffersSource(offersItems);
  }, [offersItems, setOffersSource]);

  useEffect(() => {
    setCompaniesSource(companiesItems);
  }, [companiesItems, setCompaniesSource]);

  useEffect(() => {
    return () => {
      abortAll();
    };
  }, [abortAll]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncPaneFromUrl = () => {
      const pane = new URLSearchParams(window.location.search).get("pane");
      setMobilePane(pane === "map" ? "map" : "list");
    };

    window.addEventListener("popstate", syncPaneFromUrl);
    window.addEventListener("pageshow", syncPaneFromUrl);
    return () => {
      window.removeEventListener("popstate", syncPaneFromUrl);
      window.removeEventListener("pageshow", syncPaneFromUrl);
    };
  }, []);

  useEffect(() => {
    if (!isMapReady || !isActive) {
      return;
    }

    if (activeMapView === "announcements") {
      void loadAnnouncements();
      return;
    }

    if (activeMapView === "offers") {
      void loadOffers();
      return;
    }

    void loadCompanies();
  }, [
    activeMapView,
    isMapReady,
    isActive,
    loadAnnouncements,
    loadCompanies,
    loadOffers,
  ]);

  useEffect(() => {
    if (mobilePane !== "map" || !isMapReady || !isActive) {
      return;
    }

    resizeMap();
    const rafId = window.requestAnimationFrame(() => {
      resizeMap();
    });
    const timeoutId = window.setTimeout(() => {
      resizeMap();
    }, 360);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
    };
  }, [isActive, isMapReady, mobilePane, resizeMap]);

  const activeError =
    activeMapView === "announcements"
      ? announcementsError
      : activeMapView === "offers"
        ? offersError
        : companiesError;

  const activeLoading =
    activeMapView === "announcements"
      ? announcementsLoading
      : activeMapView === "offers"
        ? offersLoading
        : companiesLoading;

  const activeHasMore =
    activeMapView === "announcements"
      ? announcementsHasMore
      : activeMapView === "offers"
        ? offersHasMore
        : companiesHasMore;

  const activeViewConfig = UNIFIED_MAP_VIEW_CONFIG[activeMapView];
  const activeLoadingLabel =
    activeMapView === "announcements"
      ? announcementsMessages.loading
      : activeMapView === "offers"
        ? offersMessages.loading
        : companiesListMessages.loading;
  const isCompaniesMapView = activeMapView === "companies";
  const isListPaneActiveOnMobile = mobilePane === "list";
  const mobileMapLabel = mapMessages.mobileMapToggle;
  const mobileListLabel = mapMessages.mobileListToggle;
  const shellClassName = isCompaniesMapView
    ? "relative flex h-full min-h-0 flex-col border border-sky-200 bg-gradient-to-b from-sky-50 via-blue-50 to-sky-100/80"
    : "relative flex h-full min-h-0 flex-col border border-slate-800 bg-slate-950/40";
  const listPaneSurfaceClass = isCompaniesMapView
    ? "bg-[linear-gradient(180deg,rgba(239,246,255,0.97)_0%,rgba(224,242,254,0.95)_100%)] lg:border-r lg:border-sky-200 lg:bg-[linear-gradient(180deg,rgba(239,246,255,0.94)_0%,rgba(224,242,254,0.90)_100%)]"
    : "bg-slate-900 lg:border-r lg:border-slate-800 lg:bg-slate-900/70";
  const loadingOverlayClass = isCompaniesMapView ? "bg-sky-100/70" : "bg-slate-900/70";
  const loadingCardClass = isCompaniesMapView
    ? "border-sky-200 bg-white/90"
    : "border-slate-700 bg-slate-950/90";
  const loadingTextClass = isCompaniesMapView ? "text-slate-700" : "text-slate-200";
  const mapLoadingOverlayClass = isCompaniesMapView ? "bg-sky-100/80" : "bg-slate-900/95";
  const mobileMapLoadingOverlayClass = isCompaniesMapView ? "bg-sky-100/70" : "bg-slate-900/70";
  const hasMoreClass = isCompaniesMapView
    ? "border-t border-sky-200 bg-sky-50/90 px-3 py-2 text-xs text-sky-800"
    : "border-t border-slate-800 px-3 py-2 text-xs text-amber-300";

  const setMobilePaneWithUrl = useCallback((nextPane: "list" | "map") => {
    if (typeof window === "undefined") {
      setMobilePane(nextPane);
      return;
    }

    setMobilePane(nextPane);
    const url = new URL(window.location.href);
    if (nextPane === "map") {
      url.searchParams.set("pane", "map");
    } else {
      url.searchParams.delete("pane");
    }
    const nextHref = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(window.history.state, "", nextHref);
    try {
      const raw = window.sessionStorage.getItem(NAV_HISTORY_STACK_KEY);
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      const stack = Array.isArray(parsed)
        ? parsed.filter((entry): entry is string => typeof entry === "string")
        : [];
      if (stack.length === 0) {
        stack.push(nextHref);
      } else {
        stack[stack.length - 1] = nextHref;
      }
      window.sessionStorage.setItem(NAV_HISTORY_STACK_KEY, JSON.stringify(stack));
    } catch {
      // Ignore storage access issues.
    }
  }, []);

  return (
    <section className={shellClassName}>
      <div className="relative min-h-0 flex-1 overflow-hidden lg:grid lg:grid-cols-[minmax(380px,46%)_minmax(0,1fr)]">
        <aside
          ref={listScrollContainerRef}
          className={`map-results-scroll absolute inset-y-0 left-0 z-20 w-full min-h-0 overflow-y-auto overflow-x-hidden transition-transform duration-300 ease-out lg:relative lg:h-full lg:w-auto lg:translate-x-0 lg:transition-none ${listPaneSurfaceClass} ${
            isListPaneActiveOnMobile ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex min-h-full flex-col p-3">
            {mapError ? <p className="mt-2 text-sm text-red-300">{mapError}</p> : null}
            {activeMapView === "announcements" ? (
              <AnnouncementsList
                scrollContainerRef={listScrollContainerRef}
                locale={locale}
                messages={announcementsMessages}
                showOnMapLabel={showOnMapLabel}
                items={announcementsItems}
                isLoading={activeLoading}
                hasLoaded={announcementsLoaded}
                error={activeError}
                pendingFavoriteId={pendingFavoriteId}
                onToggleFavorite={(announcementId, isFavorite) => {
                  void toggleFavorite(announcementId, isFavorite);
                }}
                onFocusMap={(item) => {
                  setMobilePaneWithUrl("map");
                  focusAnnouncementOnMap(item);
                }}
              />
            ) : null}
            {activeMapView === "offers" ? (
              <OffersList
                scrollContainerRef={listScrollContainerRef}
                locale={locale}
                messages={offersMessages}
                showOnMapLabel={showOnMapLabel}
                items={offersItems}
                isLoading={activeLoading}
                hasLoaded={offersLoaded}
                error={activeError}
                onFocusMap={(item) => {
                  setMobilePaneWithUrl("map");
                  focusOfferOnMap(item);
                }}
              />
            ) : null}
            {activeMapView === "companies" ? (
              <CompaniesList
                scrollContainerRef={listScrollContainerRef}
                locale={locale}
                messages={companiesListMessages}
                mapMessages={mapMessages}
                companyCreateMessages={companyCreateMessages}
                operatingAreaLabels={operatingAreaLabels}
                verifiedLabel={verifiedLabel}
                showOnMapLabel={showOnMapLabel}
                items={companiesItems}
                isLoading={activeLoading}
                hasLoaded={companiesLoaded}
                error={activeError}
                onFocusMap={(item) => {
                  setMobilePaneWithUrl("map");
                  focusCompanyOnMap(item);
                }}
              />
            ) : null}
          </div>
          {activeLoading ? (
            <div className={`pointer-events-none absolute inset-0 z-30 flex items-center justify-center ${loadingOverlayClass}`}>
              <div className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 ${loadingCardClass}`}>
                <div
                  className={`h-6 w-6 animate-spin rounded-full border-2 border-slate-500 ${activeViewConfig.spinnerTopBorderClass}`}
                  aria-label={activeLoadingLabel}
                  role="status"
                />
                <span className={`text-xs font-medium ${loadingTextClass}`}>{activeLoadingLabel}</span>
              </div>
            </div>
          ) : null}
        </aside>

        <div className="absolute inset-y-0 left-0 z-10 w-full min-h-0 overflow-hidden lg:static lg:w-auto">
          <div className="relative h-full min-h-0 w-full">
            <div ref={mapContainerRef} className="h-full min-h-0 w-full" />
            {!isMapReady ? (
              <div className={`absolute inset-0 z-10 flex items-center justify-center ${mapLoadingOverlayClass}`}>
                <div
                  className={`h-8 w-8 animate-spin rounded-full border-2 border-slate-500 ${activeViewConfig.spinnerTopBorderClass}`}
                  aria-label={mapMessages.loading}
                  role="status"
                />
              </div>
            ) : null}
            {isMapReady && activeLoading ? (
              <div className={`absolute inset-0 z-10 flex items-center justify-center lg:hidden ${mobileMapLoadingOverlayClass}`}>
                <div className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 ${loadingCardClass}`}>
                  <div
                    className={`h-6 w-6 animate-spin rounded-full border-2 border-slate-500 ${activeViewConfig.spinnerTopBorderClass}`}
                    aria-label={activeLoadingLabel}
                    role="status"
                  />
                  <span className={`text-xs font-medium ${loadingTextClass}`}>{activeLoadingLabel}</span>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 flex justify-center px-3 lg:hidden">
          <button
            type="button"
            className="pointer-events-auto inline-flex items-center gap-2.5 rounded-full border border-[#99c3ea] bg-[linear-gradient(180deg,rgba(248,252,255,0.96)_0%,rgba(229,240,252,0.96)_100%)] px-4 py-2 text-sm font-semibold text-[#0f2b4f] shadow-[0_14px_32px_-16px_rgba(15,23,42,0.65)] backdrop-blur-sm transition-transform duration-150 active:translate-y-px"
            onClick={() => {
              setMobilePaneWithUrl(isListPaneActiveOnMobile ? "map" : "list");
            }}
            aria-label={isListPaneActiveOnMobile ? mobileMapLabel : mobileListLabel}
          >
            {isListPaneActiveOnMobile ? (
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none">
                <path
                  d="M12 21s6-5.3 6-10a6 6 0 1 0-12 0c0 4.7 6 10 6 10Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <circle cx="12" cy="11" r="2.2" fill="currentColor" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none">
                <path
                  d="M5 7h14M5 12h14M5 17h14"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            )}
            <span>{isListPaneActiveOnMobile ? mobileMapLabel : mobileListLabel}</span>
          </button>
        </div>
      </div>

      {activeHasMore ? (
        <p className={hasMoreClass}>
          {resolveTooManyResultsLabel({
            activeMapView,
            announcementsMessages,
            offersMessages,
            mapMessages,
          })}
        </p>
      ) : null}
    </section>
  );
}
