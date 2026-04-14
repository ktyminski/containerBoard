"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { UnifiedMainMap } from "@/components/unified-main-map";
import { MainMapFiltersBar } from "@/components/main-map-modules/main-map-filters-bar";
import { MainMapMoreFiltersModal } from "@/components/main-map-modules/main-map-more-filters-modal";
import {
  DEFAULT_MAP_VIEWPORT,
  DISTANCE_OPTIONS,
  toBboxFromRadius,
  toggleSelection,
  type DistanceOption,
  type MainMapInitialFilters,
  type MainMapView,
  type SearchBBox,
  type SharedMapViewport,
} from "@/components/main-map-modules/shared";
import { type AppLocale, type AppMessages } from "@/lib/i18n";
import { COMPANY_OPERATING_AREAS, type CompanyOperatingArea } from "@/lib/company-operating-area";
import {
  COMPANY_COMMUNICATION_LANGUAGES,
  type CompanyCommunicationLanguage,
} from "@/types/company-communication-language";
import {
  COMPANY_SPECIALIZATIONS,
  type CompanySpecialization,
} from "@/types/company-specialization";

export type { MainMapView } from "@/components/main-map-modules/shared";

const DESKTOP_MAP_BREAKPOINT = 1024;
const DESKTOP_DEFAULT_MAP_ZOOM = 5.5;

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
};

export function MainMapModules({
  locale,
  mapMessages,
  companyCreateMessages,
  verifiedLabel,
  messages,
  initialMobilePane,
  initialFilters,
}: MainMapModulesProps) {
  const [isClient, setIsClient] = useState(false);
  const [mapViewport, setMapViewport] = useState<SharedMapViewport>(() => resolveInitialMapViewport());
  const [keywordInput, setKeywordInput] = useState(initialFilters.keyword);
  const [locationInput, setLocationInput] = useState(initialFilters.location);
  const [distanceKm, setDistanceKm] = useState<DistanceOption>(initialFilters.distanceKm);
  const [keywordFilter, setKeywordFilter] = useState(initialFilters.keyword);
  const [operatingAreaFilter, setOperatingAreaFilter] = useState<CompanyOperatingArea[]>([]);
  const [communicationLanguageFilter, setCommunicationLanguageFilter] = useState<
    CompanyCommunicationLanguage[]
  >([]);
  const [companySpecializationFilter, setCompanySpecializationFilter] = useState<
    CompanySpecialization[]
  >([]);
  const [draftLocationInput, setDraftLocationInput] = useState(initialFilters.location);
  const [draftDistanceKm, setDraftDistanceKm] = useState<DistanceOption>(initialFilters.distanceKm);
  const [draftOperatingAreaFilter, setDraftOperatingAreaFilter] = useState<CompanyOperatingArea[]>([]);
  const [draftCommunicationLanguageFilter, setDraftCommunicationLanguageFilter] = useState<
    CompanyCommunicationLanguage[]
  >([]);
  const [draftCompanySpecializationFilter, setDraftCompanySpecializationFilter] = useState<
    CompanySpecialization[]
  >([]);
  const [locationBbox, setLocationBbox] = useState<SearchBBox | null>(initialFilters.locationBbox);
  const [isMoreFiltersModalOpen, setIsMoreFiltersModalOpen] = useState(false);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [isApplyingFilters, setIsApplyingFilters] = useState(false);

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

  const applyFilters = async () => {
    const trimmedKeyword = keywordInput.trim();
    const trimmedLocation = locationInput.trim();
    setKeywordFilter(trimmedKeyword);
    setFilterError(null);

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
    setKeywordFilter("");
    setOperatingAreaFilter([]);
    setCommunicationLanguageFilter([]);
    setCompanySpecializationFilter([]);
    setDraftLocationInput("");
    setDraftDistanceKm(20);
    setDraftOperatingAreaFilter([]);
    setDraftCommunicationLanguageFilter([]);
    setDraftCompanySpecializationFilter([]);
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
    setKeywordInput(initialFilters.keyword);
    setLocationInput(initialFilters.location);
    setDistanceKm(initialFilters.distanceKm);
    setKeywordFilter(initialFilters.keyword);
    setOperatingAreaFilter([]);
    setCommunicationLanguageFilter([]);
    setCompanySpecializationFilter([]);
    setDraftLocationInput(initialFilters.location);
    setDraftDistanceKm(initialFilters.distanceKm);
    setDraftOperatingAreaFilter([]);
    setDraftCommunicationLanguageFilter([]);
    setDraftCompanySpecializationFilter([]);
    setLocationBbox(initialFilters.locationBbox);
    setFilterError(null);
    setIsMoreFiltersModalOpen(false);
  }, [initialFilters]);

  const activeAdditionalFiltersCount =
    operatingAreaFilter.length +
    communicationLanguageFilter.length +
    companySpecializationFilter.length;
  const hasActiveFilters =
    keywordInput.trim().length > 0 ||
    locationInput.trim().length > 0 ||
    keywordFilter.trim().length > 0 ||
    locationBbox !== null ||
    distanceKm !== 20 ||
    activeAdditionalFiltersCount > 0;

  const moreFiltersDialogConfig = useMemo(
    () => ({
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
    }),
    [
      companyCreateMessages.specializationsOptions,
      companyCreateMessages.specializationsTitle,
      draftCommunicationLanguageFilter,
      draftCompanySpecializationFilter,
      draftOperatingAreaFilter,
      messages.filters,
    ],
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-0">
      <MainMapFiltersBar
        messages={messages.filters}
        keywordInput={keywordInput}
        locationInput={locationInput}
        distanceKm={distanceKm}
        activeAdditionalFiltersCount={activeAdditionalFiltersCount}
        hasActiveFilters={hasActiveFilters}
        filterError={filterError}
        isApplyingFilters={isApplyingFilters}
        onKeywordInputChange={setKeywordInput}
        onLocationInputChange={setLocationInput}
        onDistanceChange={setDistanceKm}
        onOpenMoreFilters={() => {
          setDraftLocationInput(locationInput);
          setDraftDistanceKm(distanceKm);
          setDraftOperatingAreaFilter(operatingAreaFilter);
          setDraftCommunicationLanguageFilter(communicationLanguageFilter);
          setDraftCompanySpecializationFilter(companySpecializationFilter);
          setIsMoreFiltersModalOpen(true);
        }}
        onApplyFilters={() => {
          void applyFilters();
        }}
        onClearFilters={clearFilters}
      />

      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0 z-10">
          <UnifiedMainMap
            locale={locale}
            mapMessages={mapMessages}
            companyCreateMessages={companyCreateMessages}
            verifiedLabel={verifiedLabel}
            operatingAreaLabels={messages.filters.operatingAreas}
            offersMessages={messages.offers}
            companiesListMessages={messages.companiesList}
            showOnMapLabel={mapMessages.showOnMapShort}
            initialMobilePane={initialMobilePane}
            activeMapView="companies"
            keyword={keywordFilter}
            operatingAreas={operatingAreaFilter}
            communicationLanguages={communicationLanguageFilter}
            companySpecializations={companySpecializationFilter}
            locationBbox={locationBbox}
            onLocationFilterRelease={releaseLocationFilter}
            mapViewport={mapViewport}
            onMapViewportChange={handleMapViewportChange}
          />
        </div>
      </div>

      <MainMapMoreFiltersModal
        isClient={isClient}
        isOpen={isMoreFiltersModalOpen}
        title={moreFiltersDialogConfig.title}
        subtitle={moreFiltersDialogConfig.subtitle}
        topContent={
          <div className="grid gap-3 lg:hidden">
            <label className="grid gap-1">
              <span className="text-xs font-medium text-neutral-300">{messages.filters.locationLabel}</span>
              <input
                className="h-10 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-neutral-500 focus:outline-none"
                placeholder={messages.filters.locationPlaceholder}
                value={draftLocationInput}
                onChange={(event) => {
                  setDraftLocationInput(event.target.value);
                }}
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-medium text-neutral-300">{messages.filters.distanceLabel}</span>
              <select
                className="h-10 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none [color-scheme:dark]"
                value={String(draftDistanceKm)}
                onChange={(event) => {
                  setDraftDistanceKm(Number(event.target.value) as DistanceOption);
                }}
              >
                {DISTANCE_OPTIONS.map((option) => (
                  <option key={option} value={option} className="bg-neutral-950 text-neutral-100">
                    {messages.filters.distanceOption.replace("{distance}", String(option))}
                  </option>
                ))}
              </select>
            </label>
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
          setDraftLocationInput("");
          setDraftDistanceKm(20);
          setDraftOperatingAreaFilter([]);
          setDraftCommunicationLanguageFilter([]);
          setDraftCompanySpecializationFilter([]);
        }}
        onSave={() => {
          setLocationInput(draftLocationInput);
          setDistanceKm(draftDistanceKm);
          setOperatingAreaFilter(draftOperatingAreaFilter);
          setCommunicationLanguageFilter(draftCommunicationLanguageFilter);
          setCompanySpecializationFilter(draftCompanySpecializationFilter);
          setIsMoreFiltersModalOpen(false);
        }}
      />
    </div>
  );
}

