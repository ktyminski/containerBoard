import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { tupleBboxToQuery } from "@/components/map-shared";
import type { CompanyOperatingArea } from "@/lib/company-operating-area";
import type { AppMessages } from "@/lib/i18n";
import type { CompanyMapItem } from "@/types/company";
import type { CompanyCommunicationLanguage } from "@/types/company-communication-language";
import type { CompanySpecialization } from "@/types/company-specialization";
import type {
  CompaniesApiResponse,
  OfferMapItem,
  OffersApiResponse,
} from "@/components/unified-main-map/types";

type DataLayerParams = {
  offersMessages: AppMessages["mapModules"]["offers"];
  mapMessages: AppMessages["map"];
  keyword: string;
  operatingAreas: CompanyOperatingArea[];
  communicationLanguages: CompanyCommunicationLanguage[];
  companySpecializations: CompanySpecialization[];
  locationBbox: [number, number, number, number] | null;
};

type DataLayerResult = {
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
  offersByIdRef: MutableRefObject<Map<string, OfferMapItem>>;
  companiesByIdRef: MutableRefObject<Map<string, CompanyMapItem>>;
  loadOffers: () => Promise<void>;
  loadCompanies: () => Promise<void>;
  reportOffersError: (message: string) => void;
  reportCompaniesError: (message: string) => void;
  abortAll: () => void;
};

export function useUnifiedMainMapData(params: DataLayerParams): DataLayerResult {
  const {
    offersMessages,
    mapMessages,
    keyword,
    operatingAreas,
    communicationLanguages,
    companySpecializations,
    locationBbox,
  } = params;

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

  const offersByIdRef = useRef<Map<string, OfferMapItem>>(new Map());
  const companiesByIdRef = useRef<Map<string, CompanyMapItem>>(new Map());

  const offersAbortRef = useRef<AbortController | null>(null);
  const companiesAbortRef = useRef<AbortController | null>(null);

  const offersReqSeqRef = useRef(0);
  const companiesReqSeqRef = useRef(0);

  useEffect(() => {
    offersByIdRef.current = new Map(offersItems.map((item) => [item.id, item]));
  }, [offersItems]);

  useEffect(() => {
    companiesByIdRef.current = new Map(companiesItems.map((item) => [item.id, item]));
  }, [companiesItems]);

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

      setOffersError(error instanceof Error ? error.message : offersMessages.unknownError);
    } finally {
      if (!controller.signal.aborted && requestId === offersReqSeqRef.current) {
        setOffersLoading(false);
        setOffersLoaded(true);
      }
    }
  }, [
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
    companySpecializations,
    keyword,
    locationBbox,
    mapMessages.unknownError,
    operatingAreas,
  ]);

  const abortAll = useCallback(() => {
    offersAbortRef.current?.abort();
    companiesAbortRef.current?.abort();
  }, []);

  const reportOffersError = useCallback((message: string) => {
    setOffersError(message);
  }, []);

  const reportCompaniesError = useCallback((message: string) => {
    setCompaniesError(message);
  }, []);

  return {
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
    offersByIdRef,
    companiesByIdRef,
    loadOffers,
    loadCompanies,
    reportOffersError,
    reportCompaniesError,
    abortAll,
  };
}
