"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { NAV_HISTORY_STACK_KEY } from "@/components/in-app-navigation-history-tracker";
import { LeadRequestsBoard } from "@/components/lead-requests-board";
import { UnifiedMainMap } from "@/components/unified-main-map";
import { MainMapFiltersBar } from "@/components/main-map-modules/main-map-filters-bar";
import { MainMapMoreFiltersModal } from "@/components/main-map-modules/main-map-more-filters-modal";
import { MainMapViewTabs } from "@/components/main-map-modules/main-map-view-tabs";
import {
  DEFAULT_MAP_VIEWPORT,
  CONTRACT_TYPE_OPTIONS,
  DISTANCE_OPTIONS,
  WORK_MODEL_OPTIONS,
  buildMainMapPath,
  resolveMainMapViewFromLocation,
  toBboxFromRadius,
  toggleSelection,
  type DistanceOption,
  type MainMapInitialFilters,
  type MainMapView,
  type SearchBBox,
  type SharedMapViewport,
} from "@/components/main-map-modules/shared";
import { LOCALE_HEADER_NAME, type AppLocale, type AppMessages } from "@/lib/i18n";
import { COMPANY_OPERATING_AREAS, type CompanyOperatingArea } from "@/lib/company-operating-area";
import {
  COMPANY_COMMUNICATION_LANGUAGES,
  type CompanyCommunicationLanguage,
} from "@/types/company-communication-language";
import { COMPANY_CATEGORIES, type CompanyCategory } from "@/types/company-category";
import {
  COMPANY_SPECIALIZATIONS,
  type CompanySpecialization,
} from "@/types/company-specialization";
import {
  LEAD_REQUEST_TRANSPORT_MODES,
  type LeadRequestTransportMode,
} from "@/lib/lead-request-types";
import type {
  LeadRequestsBoardData,
  LeadRequestsSortOrder,
  LeadRequestsBoardTab,
} from "@/lib/lead-requests-board-data";
import type { JobContractType, JobWorkModel } from "@/lib/job-announcement";

export type { MainMapView } from "@/components/main-map-modules/shared";

const DESKTOP_MAP_BREAKPOINT = 1024;
const DESKTOP_DEFAULT_MAP_ZOOM = 5.5;
const NAV_HISTORY_STACK_LIMIT = 50;

type CompanySpecializationGroupId =
  | "roadTransport"
  | "specializedTransport"
  | "multimodal"
  | "warehouseOperations"
  | "customsAndStorage"
  | "industrySectors";

const COMPANY_SPECIALIZATION_GROUPS: Array<{
  id: CompanySpecializationGroupId;
  values: CompanySpecialization[];
}> = [
  {
    id: "roadTransport",
    values: [
      "domestic-transport",
      "international-transport",
      "full-truckload",
      "less-than-truckload",
      "express-transport",
      "last-mile-delivery",
      "pallet-distribution",
    ],
  },
  {
    id: "specializedTransport",
    values: [
      "refrigerated-transport",
      "adr-transport",
      "oversize-transport",
      "heavy-cargo",
      "project-cargo",
      "tanker-transport",
      "livestock-transport",
    ],
  },
  {
    id: "multimodal",
    values: [
      "container-transport",
      "intermodal-transport",
      "rail-freight",
      "sea-freight",
      "air-freight",
      "port-logistics",
    ],
  },
  {
    id: "warehouseOperations",
    values: [
      "contract-logistics",
      "cross-docking",
      "ecommerce-fulfillment",
      "returns-handling",
      "temperature-controlled-storage",
    ],
  },
  {
    id: "customsAndStorage",
    values: ["customs-clearance", "bonded-warehouse", "hazardous-storage"],
  },
  {
    id: "industrySectors",
    values: ["automotive-logistics", "pharma-logistics"],
  },
];

function normalizeHrefForHistory(href: string): string {
  const [pathname, query = ""] = href.split("?");
  const search = new URLSearchParams(query);
  search.delete("lang");
  const normalizedQuery = search.toString();
  return normalizedQuery ? `${pathname}?${normalizedQuery}` : pathname;
}

function pushHrefToInAppHistory(href: string): void {
  try {
    const raw = window.sessionStorage.getItem(NAV_HISTORY_STACK_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    const stack = Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string")
      : [];
    const normalizedNextHref = normalizeHrefForHistory(href);
    const last = stack[stack.length - 1];
    const normalizedLastHref = last ? normalizeHrefForHistory(last) : null;

    if (!last || normalizedLastHref !== normalizedNextHref) {
      stack.push(href);
      if (stack.length > NAV_HISTORY_STACK_LIMIT) {
        stack.splice(0, stack.length - NAV_HISTORY_STACK_LIMIT);
      }
    } else if (last !== href) {
      stack[stack.length - 1] = href;
    }

    window.sessionStorage.setItem(NAV_HISTORY_STACK_KEY, JSON.stringify(stack));
  } catch {
    // Ignore storage access issues.
  }
}

function resolveInitialMapViewport(): SharedMapViewport {
  if (typeof window !== "undefined" && window.innerWidth >= DESKTOP_MAP_BREAKPOINT) {
    return { ...DEFAULT_MAP_VIEWPORT, zoom: DESKTOP_DEFAULT_MAP_ZOOM };
  }

  return DEFAULT_MAP_VIEWPORT;
}

type MainMapModulesProps = {
  locale: AppLocale;
  mapMessages: AppMessages["map"];
  companyCreateMessages: AppMessages["companyCreate"];
  verifiedLabel: AppMessages["companyStatus"]["verified"];
  messages: AppMessages["mapModules"];
  initialMobilePane: "list" | "map";
  initialView: MainMapView;
  initialFilters: MainMapInitialFilters;
  leadRequestsMessages: AppMessages["leadRequestsPage"];
  leadRequestsBoardData: LeadRequestsBoardData | null;
  initialLeadRequestsTab: LeadRequestsBoardTab;
  leadRequestsLoginHref: string;
};

export function MainMapModules({
  locale,
  mapMessages,
  companyCreateMessages,
  verifiedLabel,
  messages,
  initialMobilePane,
  initialView,
  initialFilters,
  leadRequestsMessages,
  leadRequestsBoardData,
  initialLeadRequestsTab,
  leadRequestsLoginHref,
}: MainMapModulesProps) {
  const [isClient, setIsClient] = useState(false);
  const [activeView, setActiveView] = useState<MainMapView>(initialView);
  const [activeMapView, setActiveMapView] = useState<Exclude<MainMapView, "lead-requests">>(
    initialView === "lead-requests" ? "companies" : initialView,
  );
  const [mapViewport, setMapViewport] = useState<SharedMapViewport>(() => resolveInitialMapViewport());
  const [keywordInput, setKeywordInput] = useState(initialFilters.keyword);
  const [locationInput, setLocationInput] = useState(initialFilters.location);
  const [distanceKm, setDistanceKm] = useState<DistanceOption>(initialFilters.distanceKm);
  const [keywordFilter, setKeywordFilter] = useState(initialFilters.keyword);
  const [contractTypeFilter, setContractTypeFilter] = useState<JobContractType[]>([]);
  const [workModelFilter, setWorkModelFilter] = useState<JobWorkModel[]>([]);
  const [operatingAreaFilter, setOperatingAreaFilter] = useState<CompanyOperatingArea[]>([]);
  const [communicationLanguageFilter, setCommunicationLanguageFilter] = useState<
    CompanyCommunicationLanguage[]
  >([]);
  const [companyCategoryFilter, setCompanyCategoryFilter] = useState<CompanyCategory[]>([]);
  const [companySpecializationFilter, setCompanySpecializationFilter] = useState<
    CompanySpecialization[]
  >([]);
  const [leadTransportModeFilter, setLeadTransportModeFilter] = useState<LeadRequestTransportMode[]>([]);
  const [leadOriginCountryFilter, setLeadOriginCountryFilter] = useState<string[]>([]);
  const [leadDestinationCountryFilter, setLeadDestinationCountryFilter] = useState<string[]>([]);
  const [leadSortOrder, setLeadSortOrder] = useState<LeadRequestsSortOrder>("newest");
  const [draftLocationInput, setDraftLocationInput] = useState(initialFilters.location);
  const [draftDistanceKm, setDraftDistanceKm] = useState<DistanceOption>(initialFilters.distanceKm);
  const [draftLeadSortOrder, setDraftLeadSortOrder] = useState<LeadRequestsSortOrder>("newest");
  const [draftContractTypeFilter, setDraftContractTypeFilter] = useState<JobContractType[]>([]);
  const [draftWorkModelFilter, setDraftWorkModelFilter] = useState<JobWorkModel[]>([]);
  const [draftOperatingAreaFilter, setDraftOperatingAreaFilter] = useState<CompanyOperatingArea[]>([]);
  const [draftCommunicationLanguageFilter, setDraftCommunicationLanguageFilter] = useState<
    CompanyCommunicationLanguage[]
  >([]);
  const [draftCompanyCategoryFilter, setDraftCompanyCategoryFilter] = useState<CompanyCategory[]>([]);
  const [draftCompanySpecializationFilter, setDraftCompanySpecializationFilter] = useState<
    CompanySpecialization[]
  >([]);
  const [draftLeadTransportModeFilter, setDraftLeadTransportModeFilter] = useState<LeadRequestTransportMode[]>([]);
  const [draftLeadOriginCountryFilter, setDraftLeadOriginCountryFilter] = useState<string[]>([]);
  const [draftLeadDestinationCountryFilter, setDraftLeadDestinationCountryFilter] = useState<string[]>([]);
  const [locationBbox, setLocationBbox] = useState<SearchBBox | null>(initialFilters.locationBbox);
  const [isMoreFiltersModalOpen, setIsMoreFiltersModalOpen] = useState(false);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [isApplyingFilters, setIsApplyingFilters] = useState(false);
  const [hasMountedMap, setHasMountedMap] = useState(initialView !== "lead-requests");
  const [resolvedLeadRequestsBoardData, setResolvedLeadRequestsBoardData] = useState<
    LeadRequestsBoardData | null
  >(leadRequestsBoardData);
  const [isLoadingLeadRequestsBoardData, setIsLoadingLeadRequestsBoardData] = useState(false);
  const [leadRequestsBoardDataError, setLeadRequestsBoardDataError] = useState<string | null>(null);

  const leadCountryOptions = resolvedLeadRequestsBoardData?.countryOptions;

  const handleMapViewportChange = useCallback((nextViewport: SharedMapViewport) => {
    setMapViewport((currentViewport) => {
      const sameCenter =
        Math.abs(currentViewport.center[0] - nextViewport.center[0]) < 0.000001 &&
        Math.abs(currentViewport.center[1] - nextViewport.center[1]) < 0.000001;
      const sameZoom = Math.abs(currentViewport.zoom - nextViewport.zoom) < 0.0001;

      if (sameCenter && sameZoom) {
        return currentViewport;
      }

      return nextViewport;
    });
  }, []);

  const tabs = useMemo(
    () => [
      { id: "announcements" as const, label: messages.tabs.announcements },
      { id: "offers" as const, label: messages.tabs.offers },
      { id: "companies" as const, label: messages.tabs.companies },
      { id: "lead-requests" as const, label: messages.tabs.leadRequests },
    ],
    [
      messages.tabs.announcements,
      messages.tabs.companies,
      messages.tabs.leadRequests,
      messages.tabs.offers,
    ],
  );

  const applyFilters = async () => {
    const trimmedKeyword = keywordInput.trim();
    const trimmedLocation = locationInput.trim();
    setKeywordFilter(trimmedKeyword);
    setFilterError(null);

    if (activeView === "lead-requests") {
      setLocationBbox(null);
      return;
    }

    if (!trimmedLocation) {
      setLocationBbox(null);
      return;
    }

    setIsApplyingFilters(true);
    try {
      const response = await fetch(
        `/api/geocode?q=${encodeURIComponent(trimmedLocation)}&lang=${encodeURIComponent(locale)}`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        throw new Error(messages.filters.locationLookupFailed);
      }

      const data = (await response.json()) as { item?: { lat: number; lng: number } | null };
      if (!data.item) {
        setLocationBbox(null);
        setFilterError(messages.filters.locationNotFound);
        return;
      }

      setLocationBbox(
        toBboxFromRadius({
          lat: data.item.lat,
          lng: data.item.lng,
          radiusKm: distanceKm,
        }),
      );
    } catch {
      setLocationBbox(null);
      setFilterError(messages.filters.locationLookupFailed);
    } finally {
      setIsApplyingFilters(false);
    }
  };

  const clearFilters = () => {
    setKeywordInput("");
    setLocationInput("");
    setDistanceKm(20);
    setLeadSortOrder("newest");
    setKeywordFilter("");
    setContractTypeFilter([]);
    setWorkModelFilter([]);
    setOperatingAreaFilter([]);
    setCommunicationLanguageFilter([]);
    setCompanyCategoryFilter([]);
    setCompanySpecializationFilter([]);
    setLeadTransportModeFilter([]);
    setLeadOriginCountryFilter([]);
    setLeadDestinationCountryFilter([]);
    setDraftLocationInput("");
    setDraftDistanceKm(20);
    setDraftLeadSortOrder("newest");
    setDraftContractTypeFilter([]);
    setDraftWorkModelFilter([]);
    setDraftOperatingAreaFilter([]);
    setDraftCommunicationLanguageFilter([]);
    setDraftCompanyCategoryFilter([]);
    setDraftCompanySpecializationFilter([]);
    setDraftLeadTransportModeFilter([]);
    setDraftLeadOriginCountryFilter([]);
    setDraftLeadDestinationCountryFilter([]);
    setLocationBbox(null);
    setFilterError(null);
  };

  const releaseLocationFilter = () => {
    setLocationBbox(null);
    setFilterError(null);
  };

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || window.innerWidth < DESKTOP_MAP_BREAKPOINT) {
      return;
    }

    setMapViewport((current) => {
      const hasDefaultCenter =
        Math.abs(current.center[0] - DEFAULT_MAP_VIEWPORT.center[0]) < 0.000001 &&
        Math.abs(current.center[1] - DEFAULT_MAP_VIEWPORT.center[1]) < 0.000001;
      const hasMobileDefaultZoom = Math.abs(current.zoom - DEFAULT_MAP_VIEWPORT.zoom) < 0.0001;

      if (!hasDefaultCenter || !hasMobileDefaultZoom) {
        return current;
      }

      return { ...current, zoom: DESKTOP_DEFAULT_MAP_ZOOM };
    });
  }, []);

  useEffect(() => {
    setActiveView(initialView);
    setActiveMapView(initialView === "lead-requests" ? "companies" : initialView);
    setKeywordInput(initialFilters.keyword);
    setLocationInput(initialFilters.location);
    setDistanceKm(initialFilters.distanceKm);
    setKeywordFilter(initialFilters.keyword);
    setContractTypeFilter([]);
    setWorkModelFilter([]);
    setOperatingAreaFilter([]);
    setCommunicationLanguageFilter([]);
    setCompanyCategoryFilter([]);
    setCompanySpecializationFilter([]);
    setLeadTransportModeFilter([]);
    setLeadOriginCountryFilter([]);
    setLeadDestinationCountryFilter([]);
    setLeadSortOrder("newest");
    setDraftLocationInput(initialFilters.location);
    setDraftDistanceKm(initialFilters.distanceKm);
    setDraftLeadSortOrder("newest");
    setDraftContractTypeFilter([]);
    setDraftWorkModelFilter([]);
    setDraftOperatingAreaFilter([]);
    setDraftCommunicationLanguageFilter([]);
    setDraftCompanyCategoryFilter([]);
    setDraftCompanySpecializationFilter([]);
    setDraftLeadTransportModeFilter([]);
    setDraftLeadOriginCountryFilter([]);
    setDraftLeadDestinationCountryFilter([]);
    setLocationBbox(initialFilters.locationBbox);
    setFilterError(null);
    setIsMoreFiltersModalOpen(false);
  }, [initialFilters, initialView]);

  useEffect(() => {
    if (activeView !== "lead-requests") {
      setActiveMapView(activeView);
    }
  }, [activeView]);

  useEffect(() => {
    setResolvedLeadRequestsBoardData(leadRequestsBoardData);
    setLeadRequestsBoardDataError(null);
    setIsLoadingLeadRequestsBoardData(false);
  }, [leadRequestsBoardData]);

  const handleTabChange = useCallback((view: MainMapView) => {
    setActiveView(view);
    if (view !== "lead-requests") {
      setActiveMapView(view);
    }

    if (typeof window === "undefined") {
      return;
    }

    const nextSearch = new URLSearchParams(window.location.search);
    nextSearch.delete("view");
    if (view !== "lead-requests") {
      nextSearch.delete("tab");
    }

    const serialized = nextSearch.toString();
    const nextHref = serialized ? `${buildMainMapPath(view)}?${serialized}` : buildMainMapPath(view);
    window.history.pushState(window.history.state, "", nextHref);
    pushHrefToInAppHistory(nextHref);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handlePopState = () => {
      const nextView = resolveMainMapViewFromLocation({
        pathname: window.location.pathname,
        search: window.location.search,
        fallbackView: initialView,
      });
      setActiveView(nextView);
      if (nextView !== "lead-requests") {
        setActiveMapView(nextView);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [initialView]);

  const isLeadRequestsView = activeView === "lead-requests";
  const isAnnouncementsView = activeView === "announcements";
  const isOffersView = activeView === "offers";
  const isCompaniesView = activeView === "companies";
  const activeAdditionalFiltersCount = isAnnouncementsView
    ? contractTypeFilter.length + workModelFilter.length
    : isOffersView
      ? operatingAreaFilter.length +
        companyCategoryFilter.length +
        companySpecializationFilter.length
      : isCompaniesView
        ? operatingAreaFilter.length +
          communicationLanguageFilter.length +
          companySpecializationFilter.length
      : leadTransportModeFilter.length +
        leadOriginCountryFilter.length +
        leadDestinationCountryFilter.length;
  const hasActiveFilters =
    keywordInput.trim().length > 0 ||
    locationInput.trim().length > 0 ||
    keywordFilter.trim().length > 0 ||
    locationBbox !== null ||
    distanceKm !== 20 ||
    leadSortOrder !== "newest" ||
    activeAdditionalFiltersCount > 0;

  useEffect(() => {
    if (!isLeadRequestsView) {
      setHasMountedMap(true);
    }
  }, [isLeadRequestsView]);

  useEffect(() => {
    if (!isLeadRequestsView || resolvedLeadRequestsBoardData) {
      return;
    }

    const controller = new AbortController();
    setLeadRequestsBoardDataError(null);
    setIsLoadingLeadRequestsBoardData(true);

    void fetch("/api/lead-requests/bootstrap", {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        [LOCALE_HEADER_NAME]: locale,
      },
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(leadRequestsMessages.listLoadError);
        }
        return (await response.json()) as LeadRequestsBoardData;
      })
      .then((data) => {
        if (controller.signal.aborted) {
          return;
        }
        setResolvedLeadRequestsBoardData(data);
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }
        setLeadRequestsBoardDataError(
          error instanceof Error ? error.message : leadRequestsMessages.listLoadError,
        );
      })
      .finally(() => {
        if (controller.signal.aborted) {
          return;
        }
        setIsLoadingLeadRequestsBoardData(false);
      });

    return () => {
      controller.abort();
    };
  }, [
    isLeadRequestsView,
    leadRequestsMessages.listLoadError,
    locale,
    resolvedLeadRequestsBoardData,
  ]);

  const moreFiltersDialogConfig = useMemo(() => {
    if (isAnnouncementsView) {
      return {
        title: messages.filters.modalTitleAnnouncements,
        subtitle: messages.filters.modalSubtitleAnnouncements,
        sections: [
          {
            id: "contract-types",
            title: messages.filters.contractTypesTitle,
            options: CONTRACT_TYPE_OPTIONS.map((type) => ({
              value: type,
              label: messages.filters.contractTypes[type],
            })),
            selectedValues: draftContractTypeFilter,
            onToggle: (value: string) => {
              setDraftContractTypeFilter((current) =>
                toggleSelection(current, value as JobContractType),
              );
            },
          },
          {
            id: "work-models",
            title: messages.filters.workModelsTitle,
            options: WORK_MODEL_OPTIONS.map((model) => ({
              value: model,
              label: messages.filters.workModels[model],
            })),
            selectedValues: draftWorkModelFilter,
            onToggle: (value: string) => {
              setDraftWorkModelFilter((current) =>
                toggleSelection(current, value as JobWorkModel),
              );
            },
          },
        ],
      };
    }

    if (isOffersView) {
      return {
        title: messages.filters.modalTitleOperatingArea,
        subtitle: messages.filters.modalSubtitleOperatingArea,
        sections: [
          {
            id: "company-categories",
            title: companyCreateMessages.category,
            options: COMPANY_CATEGORIES.map((category) => ({
              value: category,
              label: mapMessages.categories[category],
            })),
            selectedValues: draftCompanyCategoryFilter,
            onToggle: (value: string) => {
              setDraftCompanyCategoryFilter((current) =>
                toggleSelection(current, value as CompanyCategory),
              );
            },
          },
          {
            id: "operating-areas",
            title: messages.filters.operatingAreasTitle,
            options: COMPANY_OPERATING_AREAS.map((area) => ({
              value: area,
              label: messages.filters.operatingAreas[area],
            })),
            selectedValues: draftOperatingAreaFilter,
            onToggle: (value: string) => {
              setDraftOperatingAreaFilter((current) =>
                toggleSelection(current, value as CompanyOperatingArea),
              );
            },
          },
          {
            id: "company-specializations",
            title: companyCreateMessages.specializationsTitle,
            activeFiltersLabel: messages.filters.activeFiltersLabel,
            options: COMPANY_SPECIALIZATIONS.map((specialization) => ({
              value: specialization,
              label: companyCreateMessages.specializationsOptions[specialization],
            })),
            groups: COMPANY_SPECIALIZATION_GROUPS.map((group) => ({
              id: group.id,
              title: messages.filters.companySpecializationGroups[group.id],
              options: group.values.map((specialization) => ({
                value: specialization,
                label: companyCreateMessages.specializationsOptions[specialization],
              })),
            })),
            selectedValues: draftCompanySpecializationFilter,
            onToggle: (value: string) => {
              setDraftCompanySpecializationFilter((current) =>
                toggleSelection(current, value as CompanySpecialization),
              );
            },
          },
        ],
      };
    }

    if (isCompaniesView) {
      return {
        title: messages.filters.modalTitleOperatingArea,
        subtitle: messages.filters.modalSubtitleOperatingArea,
        sections: [
          {
            id: "operating-areas",
            title: messages.filters.operatingAreasTitle,
            options: COMPANY_OPERATING_AREAS.map((area) => ({
              value: area,
              label: messages.filters.operatingAreas[area],
            })),
            selectedValues: draftOperatingAreaFilter,
            onToggle: (value: string) => {
              setDraftOperatingAreaFilter((current) =>
                toggleSelection(current, value as CompanyOperatingArea),
              );
            },
          },
          {
            id: "company-languages",
            title: messages.filters.companyLanguagesTitle,
            options: COMPANY_COMMUNICATION_LANGUAGES.map((language) => ({
              value: language,
              label: messages.filters.companyLanguages[language],
            })),
            selectedValues: draftCommunicationLanguageFilter,
            onToggle: (value: string) => {
              setDraftCommunicationLanguageFilter((current) =>
                toggleSelection(current, value as CompanyCommunicationLanguage),
              );
            },
          },
          {
            id: "company-specializations",
            title: companyCreateMessages.specializationsTitle,
            activeFiltersLabel: messages.filters.activeFiltersLabel,
            options: COMPANY_SPECIALIZATIONS.map((specialization) => ({
              value: specialization,
              label: companyCreateMessages.specializationsOptions[specialization],
            })),
            groups: COMPANY_SPECIALIZATION_GROUPS.map((group) => ({
              id: group.id,
              title: messages.filters.companySpecializationGroups[group.id],
              options: group.values.map((specialization) => ({
                value: specialization,
                label: companyCreateMessages.specializationsOptions[specialization],
              })),
            })),
            selectedValues: draftCompanySpecializationFilter,
            onToggle: (value: string) => {
              setDraftCompanySpecializationFilter((current) =>
                toggleSelection(current, value as CompanySpecialization),
              );
            },
          },
        ],
      };
    }

    return {
      title: messages.filters.modalTitleLeadRequests,
      subtitle: messages.filters.modalSubtitleLeadRequests,
      sections: [
        {
          id: "lead-transport-mode",
          title: messages.filters.leadTransportModesTitle,
          options: LEAD_REQUEST_TRANSPORT_MODES.map((mode) => ({
            value: mode,
            label:
              mode === "sea"
                ? leadRequestsMessages.transportModeSea
                : mode === "rail"
                  ? leadRequestsMessages.transportModeRail
                  : mode === "road"
                    ? leadRequestsMessages.transportModeRoad
                    : mode === "air"
                      ? leadRequestsMessages.transportModeAir
                      : leadRequestsMessages.transportModeAny,
          })),
          selectedValues: draftLeadTransportModeFilter,
          onToggle: (value: string) => {
            setDraftLeadTransportModeFilter((current) =>
              toggleSelection(current, value as LeadRequestTransportMode),
            );
          },
        },
        {
          id: "lead-origin-country",
          title: messages.filters.leadOriginCountryTitle,
          options: leadCountryOptions ?? [],
          selectedValues: draftLeadOriginCountryFilter,
          onToggle: (value: string) => {
            setDraftLeadOriginCountryFilter((current) =>
              toggleSelection(current, value),
            );
          },
          emptyMessage: messages.filters.noCountriesAvailable,
        },
        {
          id: "lead-destination-country",
          title: messages.filters.leadDestinationCountryTitle,
          options: leadCountryOptions ?? [],
          selectedValues: draftLeadDestinationCountryFilter,
          onToggle: (value: string) => {
            setDraftLeadDestinationCountryFilter((current) =>
              toggleSelection(current, value),
            );
          },
          emptyMessage: messages.filters.noCountriesAvailable,
        },
      ],
    };
  }, [
    companyCreateMessages.category,
    companyCreateMessages.specializationsOptions,
    companyCreateMessages.specializationsTitle,
    draftContractTypeFilter,
    draftCompanyCategoryFilter,
    draftCompanySpecializationFilter,
    draftCommunicationLanguageFilter,
    draftLeadDestinationCountryFilter,
    draftLeadOriginCountryFilter,
    draftLeadTransportModeFilter,
    draftOperatingAreaFilter,
    draftWorkModelFilter,
    isAnnouncementsView,
    isCompaniesView,
    isOffersView,
    leadCountryOptions,
    mapMessages.categories,
    leadRequestsMessages.transportModeAir,
    leadRequestsMessages.transportModeAny,
    leadRequestsMessages.transportModeRail,
    leadRequestsMessages.transportModeRoad,
    leadRequestsMessages.transportModeSea,
    messages.filters,
  ]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-0">
      <MainMapFiltersBar
        messages={messages.filters}
        showLocationFilter={!isLeadRequestsView}
        showSort={isLeadRequestsView}
        keywordInput={keywordInput}
        locationInput={locationInput}
        distanceKm={distanceKm}
        sortLabel={leadRequestsMessages.sortLabel}
        sortValue={leadSortOrder}
        sortNewestLabel={leadRequestsMessages.sortNewest}
        sortOldestLabel={leadRequestsMessages.sortOldest}
        activeAdditionalFiltersCount={activeAdditionalFiltersCount}
        hasActiveFilters={hasActiveFilters}
        filterError={filterError}
        isApplyingFilters={isApplyingFilters}
        onKeywordInputChange={setKeywordInput}
        onLocationInputChange={setLocationInput}
        onDistanceChange={setDistanceKm}
        onSortChange={setLeadSortOrder}
        onOpenMoreFilters={() => {
          setDraftLocationInput(locationInput);
          setDraftDistanceKm(distanceKm);
          setDraftLeadSortOrder(leadSortOrder);
          if (activeView === "announcements") {
            setDraftContractTypeFilter(contractTypeFilter);
            setDraftWorkModelFilter(workModelFilter);
          } else if (activeView === "offers") {
            setDraftOperatingAreaFilter(operatingAreaFilter);
            setDraftCompanyCategoryFilter(companyCategoryFilter);
            setDraftCompanySpecializationFilter(companySpecializationFilter);
          } else if (activeView === "companies") {
            setDraftOperatingAreaFilter(operatingAreaFilter);
            setDraftCommunicationLanguageFilter(communicationLanguageFilter);
            setDraftCompanySpecializationFilter(companySpecializationFilter);
          } else {
            setDraftLeadTransportModeFilter(leadTransportModeFilter);
            setDraftLeadOriginCountryFilter(leadOriginCountryFilter);
            setDraftLeadDestinationCountryFilter(leadDestinationCountryFilter);
          }
          setIsMoreFiltersModalOpen(true);
        }}
        onApplyFilters={() => {
          void applyFilters();
        }}
        onClearFilters={clearFilters}
      />

      <MainMapViewTabs
        tabs={tabs}
        activeView={activeView}
        onTabChange={handleTabChange}
      />

      <div className="relative min-h-0 flex-1">
        {hasMountedMap ? (
          <div className={isLeadRequestsView ? "absolute inset-0 z-0 hidden" : "absolute inset-0 z-10"}>
            <UnifiedMainMap
              locale={locale}
              mapMessages={mapMessages}
              companyCreateMessages={companyCreateMessages}
              verifiedLabel={verifiedLabel}
              operatingAreaLabels={messages.filters.operatingAreas}
              announcementsMessages={messages.announcements}
              offersMessages={messages.offers}
              companiesListMessages={messages.companiesList}
              showOnMapLabel={mapMessages.showOnMapShort}
              initialMobilePane={initialMobilePane}
              activeMapView={activeMapView}
              keyword={keywordFilter}
              contractTypes={contractTypeFilter}
              workModels={workModelFilter}
              operatingAreas={operatingAreaFilter}
              communicationLanguages={communicationLanguageFilter}
              companyCategories={activeMapView === "companies" ? [] : companyCategoryFilter}
              companySpecializations={companySpecializationFilter}
              locationBbox={locationBbox}
              onLocationFilterRelease={releaseLocationFilter}
              isActive={!isLeadRequestsView}
              mapViewport={mapViewport}
              onMapViewportChange={handleMapViewportChange}
            />
          </div>
        ) : null}

        {isLeadRequestsView ? (
          <div className="map-results-scroll absolute inset-0 z-20 overflow-y-auto overflow-x-hidden p-1 sm:p-2">
            <div className="mx-auto w-full min-w-0 max-w-6xl pb-6">
              {resolvedLeadRequestsBoardData ? (
                <LeadRequestsBoard
                  messages={leadRequestsMessages}
                  locale={locale}
                  loginHref={leadRequestsLoginHref}
                  isLoggedIn={resolvedLeadRequestsBoardData.isLoggedIn}
                  currentUserEmail={resolvedLeadRequestsBoardData.currentUserEmail}
                  turnstileSiteKey={resolvedLeadRequestsBoardData.turnstileSiteKey}
                  creationLimit={resolvedLeadRequestsBoardData.creationLimit}
                  isBlocked={resolvedLeadRequestsBoardData.isBlocked}
                  isEmailVerified={resolvedLeadRequestsBoardData.isEmailVerified}
                  canManageRequests={resolvedLeadRequestsBoardData.canManageRequests}
                  initialTab={initialLeadRequestsTab}
                  sortOrder={leadSortOrder}
                  hasMyRequests={resolvedLeadRequestsBoardData.initialMyPage.totalCount > 0}
                  canSeeContact={resolvedLeadRequestsBoardData.canSeeContact}
                  keywordFilter={keywordFilter}
                  transportModeFilter={leadTransportModeFilter}
                  originCountryFilter={leadOriginCountryFilter}
                  destinationCountryFilter={leadDestinationCountryFilter}
                  initialAllPage={resolvedLeadRequestsBoardData.initialAllPage}
                  initialMyPage={resolvedLeadRequestsBoardData.initialMyPage}
                  intlLocale={resolvedLeadRequestsBoardData.intlLocale}
                />
              ) : (
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                  <p className="text-sm text-slate-300">
                    {isLoadingLeadRequestsBoardData
                      ? leadRequestsMessages.loadingList
                      : leadRequestsBoardDataError ?? leadRequestsMessages.loadingList}
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>

      <MainMapMoreFiltersModal
        isClient={isClient}
        isOpen={isMoreFiltersModalOpen}
        title={moreFiltersDialogConfig.title}
        subtitle={moreFiltersDialogConfig.subtitle}
        topContent={
          <div className="grid gap-3 lg:hidden">
            {!isLeadRequestsView ? (
              <>
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-slate-300">{messages.filters.locationLabel}</span>
                  <input
                    className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none"
                    placeholder={messages.filters.locationPlaceholder}
                    value={draftLocationInput}
                    onChange={(event) => {
                      setDraftLocationInput(event.target.value);
                    }}
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-slate-300">{messages.filters.distanceLabel}</span>
                  <select
                    className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 focus:border-slate-500 focus:outline-none [color-scheme:dark]"
                    value={String(draftDistanceKm)}
                    onChange={(event) => {
                      setDraftDistanceKm(Number(event.target.value) as DistanceOption);
                    }}
                  >
                    {DISTANCE_OPTIONS.map((option) => (
                      <option key={option} value={option} className="bg-slate-950 text-slate-100">
                        {messages.filters.distanceOption.replace("{distance}", String(option))}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : (
              <label className="grid gap-1">
                <span className="text-xs font-medium text-slate-300">{leadRequestsMessages.sortLabel}</span>
                <select
                  className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 focus:border-slate-500 focus:outline-none [color-scheme:dark]"
                  value={draftLeadSortOrder}
                  onChange={(event) => {
                    setDraftLeadSortOrder(event.target.value as LeadRequestsSortOrder);
                  }}
                >
                  <option value="newest" className="bg-slate-950 text-slate-100">
                    {leadRequestsMessages.sortNewest}
                  </option>
                  <option value="oldest" className="bg-slate-950 text-slate-100">
                    {leadRequestsMessages.sortOldest}
                  </option>
                </select>
              </label>
            )}
          </div>
        }
        clearLabel={messages.filters.clear}
        cancelLabel={messages.filters.cancel}
        saveLabel={messages.filters.save}
        sections={moreFiltersDialogConfig.sections}
        onClose={() => {
          setIsMoreFiltersModalOpen(false);
        }}
        onClear={() => {
          if (activeView === "lead-requests") {
            setDraftLeadSortOrder("newest");
          } else {
            setDraftLocationInput("");
            setDraftDistanceKm(20);
          }

          if (activeView === "announcements") {
            setDraftContractTypeFilter([]);
            setDraftWorkModelFilter([]);
          } else if (activeView === "offers") {
            setDraftOperatingAreaFilter([]);
            setDraftCompanyCategoryFilter([]);
            setDraftCompanySpecializationFilter([]);
          } else if (activeView === "companies") {
            setDraftOperatingAreaFilter([]);
            setDraftCommunicationLanguageFilter([]);
            setDraftCompanySpecializationFilter([]);
          } else {
            setDraftLeadTransportModeFilter([]);
            setDraftLeadOriginCountryFilter([]);
            setDraftLeadDestinationCountryFilter([]);
          }
        }}
        onSave={() => {
          if (activeView !== "lead-requests") {
            setLocationInput(draftLocationInput);
            setDistanceKm(draftDistanceKm);
          } else {
            setLeadSortOrder(draftLeadSortOrder);
          }

          if (activeView === "announcements") {
            setContractTypeFilter(draftContractTypeFilter);
            setWorkModelFilter(draftWorkModelFilter);
          } else if (activeView === "offers") {
            setOperatingAreaFilter(draftOperatingAreaFilter);
            setCompanyCategoryFilter(draftCompanyCategoryFilter);
            setCompanySpecializationFilter(draftCompanySpecializationFilter);
          } else if (activeView === "companies") {
            setOperatingAreaFilter(draftOperatingAreaFilter);
            setCommunicationLanguageFilter(draftCommunicationLanguageFilter);
            setCompanySpecializationFilter(draftCompanySpecializationFilter);
          } else {
            setLeadTransportModeFilter(draftLeadTransportModeFilter);
            setLeadOriginCountryFilter(draftLeadOriginCountryFilter);
            setLeadDestinationCountryFilter(draftLeadDestinationCountryFilter);
          }
          setIsMoreFiltersModalOpen(false);
        }}
      />
    </div>
  );
}





