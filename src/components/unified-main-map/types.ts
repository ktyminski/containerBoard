import type {
  MainMapView,
  SearchBBox,
  SharedMapViewport,
} from "@/components/main-map-modules/shared";
import type { CompanyOperatingArea } from "@/lib/company-operating-area";
import type { AppLocale, AppMessages } from "@/lib/i18n";
import type { OfferType } from "@/lib/offer-type";
import type { CompanyMapItem } from "@/types/company";
import type { CompanyCategory } from "@/types/company-category";
import type { CompanyCommunicationLanguage } from "@/types/company-communication-language";
import type { CompanySpecialization } from "@/types/company-specialization";

export type OfferMapItem = {
  id: string;
  companyName: string;
  companySlug: string;
  companyLogoUrl: string | null;
  companyIsPremium: boolean;
  offerType: OfferType;
  title: string;
  locationLabel: string;
  locationCity?: string;
  locationCountry?: string;
  tags: string[];
  mainPoint: [number, number];
};

export type OffersApiResponse = {
  items: OfferMapItem[];
  meta: {
    count: number;
    limit: number;
    hasMore: boolean;
  };
};

export type CompaniesApiResponse = {
  items: CompanyMapItem[];
  meta: {
    count: number;
    limit: number;
    hasMore: boolean;
  };
};

export type ActiveMapView = MainMapView;

export type UnifiedMainMapProps = {
  locale: AppLocale;
  mapMessages: AppMessages["map"];
  companyCreateMessages: AppMessages["companyCreate"];
  verifiedLabel: AppMessages["companyStatus"]["verified"];
  operatingAreaLabels: AppMessages["mapModules"]["filters"]["operatingAreas"];
  offersMessages: AppMessages["mapModules"]["offers"];
  companiesListMessages: AppMessages["mapModules"]["companiesList"];
  showOnMapLabel: string;
  initialMobilePane?: "list" | "map";
  activeMapView: ActiveMapView;
  keyword?: string;
  operatingAreas?: CompanyOperatingArea[];
  communicationLanguages?: CompanyCommunicationLanguage[];
  companyCategories?: CompanyCategory[];
  companySpecializations?: CompanySpecialization[];
  locationBbox?: SearchBBox | null;
  onLocationFilterRelease?: () => void;
  isActive?: boolean;
  mapViewport?: SharedMapViewport;
  onMapViewportChange?: (viewport: SharedMapViewport) => void;
};

export const OFFERS_SOURCE_ID = "offers";
export const COMPANIES_SOURCE_ID = "companies";

export const OFFERS_CLUSTER_LAYER_ID = "offers-clusters";
export const OFFERS_CLUSTER_COUNT_LAYER_ID = "offers-cluster-count";
export const OFFERS_POINT_LAYER_ID = "offers-point";

export const COMPANIES_CLUSTER_LAYER_ID = "companies-clusters";
export const COMPANIES_CLUSTER_COUNT_LAYER_ID = "companies-cluster-count";
export const COMPANIES_POINT_LAYER_ID = "companies-point";

export const VIEW_LAYER_IDS: Record<ActiveMapView, string[]> = {
  offers: [
    OFFERS_CLUSTER_LAYER_ID,
    OFFERS_CLUSTER_COUNT_LAYER_ID,
    OFFERS_POINT_LAYER_ID,
  ],
  companies: [
    COMPANIES_CLUSTER_LAYER_ID,
    COMPANIES_CLUSTER_COUNT_LAYER_ID,
    COMPANIES_POINT_LAYER_ID,
  ],
};

export const ALL_MAP_LAYER_IDS = [
  ...VIEW_LAYER_IDS.offers,
  ...VIEW_LAYER_IDS.companies,
];

export const FOCUS_ZOOM = 10;
export const FOCUS_FLYTO_DURATION_MS = 1800;
export const MOVE_END_DEBOUNCE_MS = 350;
export const MOVE_END_RETRY_MS = 120;
export const MAX_CLUSTER_POPUP_ITEMS = 30;

export const EMPTY_OPERATING_AREAS: CompanyOperatingArea[] = [];
export const EMPTY_COMMUNICATION_LANGUAGES: CompanyCommunicationLanguage[] = [];
export const EMPTY_COMPANY_CATEGORIES: CompanyCategory[] = [];
export const EMPTY_COMPANY_SPECIALIZATIONS: CompanySpecialization[] = [];
