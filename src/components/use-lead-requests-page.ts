"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LEAD_REQUESTS_PAGE_SIZE,
  type LeadRequestsPageData,
} from "@/components/lead-requests-board.shared";
import type { LeadRequestTransportMode } from "@/lib/lead-request-types";
import type { AppMessages } from "@/lib/i18n";

type UseLeadRequestsPageInput = {
  activeTab: "all" | "mine";
  currentPage: number;
  sortOrder: "newest" | "oldest";
  keywordFilter: string;
  transportModeFilter: LeadRequestTransportMode[];
  originCountryFilter: string[];
  destinationCountryFilter: string[];
  initialAllPage: LeadRequestsPageData;
  initialMyPage: LeadRequestsPageData;
  reloadKey: number;
  messages: AppMessages["leadRequestsPage"];
};

type UseLeadRequestsPageResult = {
  pageData: LeadRequestsPageData;
  isLoading: boolean;
  error: string | null;
};

type RemotePageResult = {
  key: string;
  pageData: LeadRequestsPageData;
  error: string | null;
};

function getEmptyPageData(page: number): LeadRequestsPageData {
  return {
    items: [],
    totalCount: 0,
    page,
    pageSize: LEAD_REQUESTS_PAGE_SIZE,
    totalPages: 1,
  };
}

export function useLeadRequestsPage({
  activeTab,
  currentPage,
  sortOrder,
  keywordFilter,
  transportModeFilter,
  originCountryFilter,
  destinationCountryFilter,
  initialAllPage,
  initialMyPage,
  reloadKey,
  messages,
}: UseLeadRequestsPageInput): UseLeadRequestsPageResult {
  const [remoteResult, setRemoteResult] = useState<RemotePageResult | null>(null);

  const hasServerFilters =
    keywordFilter.trim().length > 0 ||
    transportModeFilter.length > 0 ||
    originCountryFilter.length > 0 ||
    destinationCountryFilter.length > 0;
  const initialPage = activeTab === "mine" ? initialMyPage : initialAllPage;
  const canUseInitialPage =
    reloadKey === 0 &&
    !hasServerFilters &&
    sortOrder === "newest" &&
    currentPage === 1;
  const requestQueryString = useMemo(() => {
    if (canUseInitialPage) {
      return null;
    }

    const searchParams = new URLSearchParams({
      tab: activeTab,
      page: String(currentPage),
      pageSize: String(LEAD_REQUESTS_PAGE_SIZE),
      sort: sortOrder,
    });
    if (keywordFilter.trim()) {
      searchParams.set("q", keywordFilter.trim());
    }
    for (const value of transportModeFilter) {
      searchParams.append("transportMode", value);
    }
    for (const value of originCountryFilter) {
      searchParams.append("originCountry", value);
    }
    for (const value of destinationCountryFilter) {
      searchParams.append("destinationCountry", value);
    }

    return searchParams.toString();
  }, [
    activeTab,
    canUseInitialPage,
    currentPage,
    destinationCountryFilter,
    keywordFilter,
    originCountryFilter,
    sortOrder,
    transportModeFilter,
  ]);
  const requestKey = requestQueryString ? `${requestQueryString}::${reloadKey}` : null;

  useEffect(() => {
    if (!requestQueryString || !requestKey) {
      return;
    }

    const controller = new AbortController();
    void fetch(`/api/lead-requests?${requestQueryString}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as LeadRequestsPageData | null;
        if (!response.ok || !payload) {
          throw new Error(messages.listLoadError);
        }
        setRemoteResult({
          key: requestKey,
          pageData: payload,
          error: null,
        });
      })
      .catch((fetchError) => {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
          return;
        }
        setRemoteResult({
          key: requestKey,
          pageData: getEmptyPageData(currentPage),
          error: messages.listLoadError,
        });
      });

    return () => {
      controller.abort();
    };
  }, [
    currentPage,
    messages.listLoadError,
    requestKey,
    requestQueryString,
  ]);

  const hasResolvedRemoteRequest =
    Boolean(requestKey) && remoteResult?.key === requestKey;
  const pageData = useMemo(
    () =>
      canUseInitialPage
        ? initialPage
        : hasResolvedRemoteRequest
          ? (remoteResult?.pageData ?? getEmptyPageData(currentPage))
          : getEmptyPageData(currentPage),
    [canUseInitialPage, currentPage, hasResolvedRemoteRequest, initialPage, remoteResult?.pageData],
  );
  const resolvedIsLoading = !canUseInitialPage && !hasResolvedRemoteRequest;
  const resolvedError =
    !canUseInitialPage && hasResolvedRemoteRequest ? (remoteResult?.error ?? null) : null;

  return {
    pageData,
    isLoading: resolvedIsLoading,
    error: resolvedError,
  };
}
