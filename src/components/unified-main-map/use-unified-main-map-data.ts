import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { tupleBboxToQuery } from "@/components/map-shared";
import { withLang, type AppLocale, type AppMessages } from "@/lib/i18n";
import type { CompanyOperatingArea } from "@/lib/company-operating-area";
import type { JobContractType, JobWorkModel } from "@/lib/job-announcement";
import type { CompanyCategory } from "@/types/company-category";
import type { CompanyCommunicationLanguage } from "@/types/company-communication-language";
import type { CompanyMapItem } from "@/types/company";
import type { CompanySpecialization } from "@/types/company-specialization";
import type {
  AnnouncementsApiResponse,
  CompaniesApiResponse,
  JobAnnouncementMapItem,
  OfferMapItem,
  OffersApiResponse,
} from "@/components/unified-main-map/types";

type DataLayerParams = {
  locale: AppLocale;
  announcementsMessages: AppMessages["mapModules"]["announcements"];
  offersMessages: AppMessages["mapModules"]["offers"];
  mapMessages: AppMessages["map"];
  keyword: string;
  contractTypes: JobContractType[];
  workModels: JobWorkModel[];
  operatingAreas: CompanyOperatingArea[];
  communicationLanguages: CompanyCommunicationLanguage[];
  companyCategories: CompanyCategory[];
  companySpecializations: CompanySpecialization[];
  locationBbox: [number, number, number, number] | null;
  onFavoriteAddedNotice: (message: string) => void;
};

type DataLayerResult = {
  announcementsItems: JobAnnouncementMapItem[];
  announcementsError: string | null;
  announcementsLoading: boolean;
  announcementsLoaded: boolean;
  announcementsHasMore: boolean;
  canFavoriteAnnouncements: boolean;
  pendingFavoriteId: string | null;
  offersItems: OfferMapItem[];
  offersError: string | null;
  offersLoading: boolean;
  offersLoaded: boolean;
  offersHasMore: boolean;
  companiesItems: CompanyMapItem[];
  companiesError: string | null;
  companiesLoading: boolean;
  companiesLoaded: boolean;
  companiesHasMore: boolean;
  announcementsByIdRef: MutableRefObject<Map<string, JobAnnouncementMapItem>>;
  offersByIdRef: MutableRefObject<Map<string, OfferMapItem>>;
  companiesByIdRef: MutableRefObject<Map<string, CompanyMapItem>>;
  loadAnnouncements: () => Promise<void>;
  loadOffers: () => Promise<void>;
  loadCompanies: () => Promise<void>;
  toggleFavorite: (announcementId: string, isFavorite: boolean) => Promise<void>;
  reportAnnouncementsError: (message: string) => void;
  reportOffersError: (message: string) => void;
  reportCompaniesError: (message: string) => void;
  abortAll: () => void;
};

export function useUnifiedMainMapData(params: DataLayerParams): DataLayerResult {
  const {
    locale,
    announcementsMessages,
    offersMessages,
    mapMessages,
    keyword,
    contractTypes,
    workModels,
    operatingAreas,
    communicationLanguages,
    companyCategories,
    companySpecializations,
    locationBbox,
    onFavoriteAddedNotice,
  } = params;

  const [announcementsItems, setAnnouncementsItems] = useState<JobAnnouncementMapItem[]>([]);
  const [announcementsError, setAnnouncementsError] = useState<string | null>(null);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const [announcementsLoaded, setAnnouncementsLoaded] = useState(false);
  const [announcementsHasMore, setAnnouncementsHasMore] = useState(false);
  const [canFavoriteAnnouncements, setCanFavoriteAnnouncements] = useState(false);
  const [pendingFavoriteId, setPendingFavoriteId] = useState<string | null>(null);

  const [offersItems, setOffersItems] = useState<OfferMapItem[]>([]);
  const [offersError, setOffersError] = useState<string | null>(null);
  const [offersLoading, setOffersLoading] = useState(false);
  const [offersLoaded, setOffersLoaded] = useState(false);
  const [offersHasMore, setOffersHasMore] = useState(false);

  const [companiesItems, setCompaniesItems] = useState<CompanyMapItem[]>([]);
  const [companiesError, setCompaniesError] = useState<string | null>(null);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [companiesLoaded, setCompaniesLoaded] = useState(false);
  const [companiesHasMore, setCompaniesHasMore] = useState(false);

  const announcementsByIdRef = useRef<Map<string, JobAnnouncementMapItem>>(new Map());
  const offersByIdRef = useRef<Map<string, OfferMapItem>>(new Map());
  const companiesByIdRef = useRef<Map<string, CompanyMapItem>>(new Map());

  const announcementsAbortRef = useRef<AbortController | null>(null);
  const offersAbortRef = useRef<AbortController | null>(null);
  const companiesAbortRef = useRef<AbortController | null>(null);

  const announcementsReqSeqRef = useRef(0);
  const offersReqSeqRef = useRef(0);
  const companiesReqSeqRef = useRef(0);

  const loginRedirectHref = useMemo(
    () => withLang(`/login?next=${encodeURIComponent("/maps/announcements")}`, locale),
    [locale],
  );

  useEffect(() => {
    announcementsByIdRef.current = new Map(announcementsItems.map((item) => [item.id, item]));
  }, [announcementsItems]);

  useEffect(() => {
    offersByIdRef.current = new Map(offersItems.map((item) => [item.id, item]));
  }, [offersItems]);

  useEffect(() => {
    companiesByIdRef.current = new Map(companiesItems.map((item) => [item.id, item]));
  }, [companiesItems]);

  const loadAnnouncements = useCallback(async () => {
    announcementsAbortRef.current?.abort();
    const requestId = announcementsReqSeqRef.current + 1;
    announcementsReqSeqRef.current = requestId;

    const controller = new AbortController();
    announcementsAbortRef.current = controller;

    setAnnouncementsLoading(true);
    setAnnouncementsError(null);

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
      if (contractTypes.length > 0) {
        searchParams.set("contractTypes", contractTypes.join(","));
      }
      if (workModels.length > 0) {
        searchParams.set("workModels", workModels.join(","));
      }

      const response = await fetch(`/api/announcements?${searchParams.toString()}`, {
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = (await response.json()) as AnnouncementsApiResponse;
      if (controller.signal.aborted || requestId !== announcementsReqSeqRef.current) {
        return;
      }

      setAnnouncementsItems(data.items);
      setAnnouncementsHasMore(data.meta.hasMore);
      setCanFavoriteAnnouncements(data.meta.canFavorite === true);
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }

      setAnnouncementsError(
        error instanceof Error ? error.message : announcementsMessages.unknownError,
      );
    } finally {
      if (!controller.signal.aborted && requestId === announcementsReqSeqRef.current) {
        setAnnouncementsLoading(false);
        setAnnouncementsLoaded(true);
      }
    }
  }, [
    announcementsMessages.unknownError,
    contractTypes,
    keyword,
    locationBbox,
    workModels,
  ]);

  const loadOffers = useCallback(async () => {
    offersAbortRef.current?.abort();
    const requestId = offersReqSeqRef.current + 1;
    offersReqSeqRef.current = requestId;

    const controller = new AbortController();
    offersAbortRef.current = controller;

    setOffersLoading(true);
    setOffersError(null);

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
      if (operatingAreas.length > 0) {
        searchParams.set("operatingAreas", operatingAreas.join(","));
      }
      if (companyCategories.length > 0) {
        searchParams.set("categories", companyCategories.join(","));
      }
      if (companySpecializations.length > 0) {
        searchParams.set("specializations", companySpecializations.join(","));
      }

      const response = await fetch(`/api/offers?${searchParams.toString()}`, {
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = (await response.json()) as OffersApiResponse;
      if (controller.signal.aborted || requestId !== offersReqSeqRef.current) {
        return;
      }

      setOffersItems(data.items);
      setOffersHasMore(data.meta.hasMore);
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }

      setOffersError(
        error instanceof Error ? error.message : offersMessages.unknownError,
      );
    } finally {
      if (!controller.signal.aborted && requestId === offersReqSeqRef.current) {
        setOffersLoading(false);
        setOffersLoaded(true);
      }
    }
  }, [
    companyCategories,
    companySpecializations,
    keyword,
    locationBbox,
    offersMessages.unknownError,
    operatingAreas,
  ]);

  const loadCompanies = useCallback(async () => {
    companiesAbortRef.current?.abort();
    const requestId = companiesReqSeqRef.current + 1;
    companiesReqSeqRef.current = requestId;

    const controller = new AbortController();
    companiesAbortRef.current = controller;

    setCompaniesLoading(true);
    setCompaniesError(null);

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
      if (operatingAreas.length > 0) {
        searchParams.set("operatingAreas", operatingAreas.join(","));
      }
      if (communicationLanguages.length > 0) {
        searchParams.set("communicationLanguages", communicationLanguages.join(","));
      }
      if (companyCategories.length > 0) {
        searchParams.set("categories", companyCategories.join(","));
      }
      if (companySpecializations.length > 0) {
        searchParams.set("specializations", companySpecializations.join(","));
      }

      const response = await fetch(`/api/companies?${searchParams.toString()}`, {
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = (await response.json()) as CompaniesApiResponse;
      if (controller.signal.aborted || requestId !== companiesReqSeqRef.current) {
        return;
      }

      setCompaniesItems(data.items);
      setCompaniesHasMore(data.meta.hasMore);
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }

      setCompaniesError(error instanceof Error ? error.message : mapMessages.unknownError);
    } finally {
      if (!controller.signal.aborted && requestId === companiesReqSeqRef.current) {
        setCompaniesLoading(false);
        setCompaniesLoaded(true);
      }
    }
  }, [
    communicationLanguages,
    companyCategories,
    companySpecializations,
    keyword,
    locationBbox,
    mapMessages.unknownError,
    operatingAreas,
  ]);

  const toggleFavorite = useCallback(
    async (announcementId: string, isFavorite: boolean) => {
      if (pendingFavoriteId) {
        return;
      }

      if (!canFavoriteAnnouncements) {
        window.location.href = loginRedirectHref;
        return;
      }

      setPendingFavoriteId(announcementId);
      setAnnouncementsItems((current) =>
        current.map((item) =>
          item.id === announcementId ? { ...item, isFavorite: !isFavorite } : item,
        ),
      );

      try {
        const response = await fetch(`/api/announcements/${announcementId}/favorite`, {
          method: isFavorite ? "DELETE" : "POST",
        });

        if (response.status === 401) {
          window.location.href = loginRedirectHref;
          return;
        }

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(payload?.error || announcementsMessages.unknownError);
        }

        const payload = (await response.json().catch(() => null)) as {
          isFavorite?: boolean;
        } | null;

        let resolvedFavorite = !isFavorite;
        if (typeof payload?.isFavorite === "boolean") {
          resolvedFavorite = payload.isFavorite;
          setAnnouncementsItems((current) =>
            current.map((item) =>
              item.id === announcementId ? { ...item, isFavorite: payload.isFavorite } : item,
            ),
          );
        }

        if (!isFavorite && resolvedFavorite) {
          onFavoriteAddedNotice(announcementsMessages.favoriteAddedNotice);
        }
      } catch {
        setAnnouncementsItems((current) =>
          current.map((item) =>
            item.id === announcementId ? { ...item, isFavorite } : item,
          ),
        );
        setAnnouncementsError(announcementsMessages.unknownError);
      } finally {
        setPendingFavoriteId(null);
      }
    },
    [
      announcementsMessages.favoriteAddedNotice,
      announcementsMessages.unknownError,
      canFavoriteAnnouncements,
      loginRedirectHref,
      onFavoriteAddedNotice,
      pendingFavoriteId,
    ],
  );

  const abortAll = useCallback(() => {
    announcementsAbortRef.current?.abort();
    offersAbortRef.current?.abort();
    companiesAbortRef.current?.abort();
  }, []);

  const reportAnnouncementsError = useCallback((message: string) => {
    setAnnouncementsError(message);
  }, []);

  const reportOffersError = useCallback((message: string) => {
    setOffersError(message);
  }, []);

  const reportCompaniesError = useCallback((message: string) => {
    setCompaniesError(message);
  }, []);

  return {
    announcementsItems,
    announcementsError,
    announcementsLoading,
    announcementsLoaded,
    announcementsHasMore,
    canFavoriteAnnouncements,
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
  };
}
