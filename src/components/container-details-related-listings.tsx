"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ContainerListingsResults } from "@/components/container-listings-results";
import { useToast } from "@/components/toast-provider";
import type { ContainerListingItem } from "@/lib/container-listings";
import { formatTemplate, getMessages, resolveLocale } from "@/lib/i18n";

type ContainersListApiResponse = {
  items?: ContainerListingItem[];
  meta?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  error?: string;
};

type RelatedMode = "company" | "latest";

type ContainerDetailsRelatedListingsProps = {
  currentListingId: string;
  companySlug?: string;
  isLoggedIn: boolean;
  limit?: number;
};

const DARK_BLUE_CTA_BASE_CLASS =
  "border border-[#2f639a] bg-[linear-gradient(180deg,#082650_0%,#0c3466_100%)] text-[#e2efff] transition hover:border-[#67c7ff] hover:text-white";

async function copyTextToClipboard(value: string): Promise<boolean> {
  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function"
  ) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Fallback below.
    }
  }

  if (typeof document === "undefined") {
    return false;
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    document.body.append(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  } catch {
    return false;
  }
}

function buildCompanyRequestUrl(companySlug: string, pageSize: number): string {
  const params = new URLSearchParams({
    company: companySlug,
    page: "1",
    pageSize: String(pageSize),
    sortBy: "createdAt",
    sortDir: "desc",
  });
  return `/api/containers?${params.toString()}`;
}

function buildLatestRequestUrl(pageSize: number): string {
  const params = new URLSearchParams({
    page: "1",
    pageSize: String(pageSize),
    sortBy: "createdAt",
    sortDir: "desc",
  });
  return `/api/containers?${params.toString()}`;
}

export function ContainerDetailsRelatedListings({
  currentListingId,
  companySlug,
  isLoggedIn,
  limit = 3,
}: ContainerDetailsRelatedListingsProps) {
  const locale = useMemo(
    () =>
      resolveLocale(
        typeof document === "undefined" ? "pl" : document.documentElement.lang,
      ),
    [],
  );
  const listingMessages = useMemo(
    () => getMessages(locale).containerListings,
    [locale],
  );
  const relatedMessages = listingMessages.related;
  const toast = useToast();
  const normalizedCurrentId = currentListingId.trim();
  const normalizedCompanySlug = companySlug?.trim() || "";
  const [items, setItems] = useState<ContainerListingItem[]>([]);
  const [total, setTotal] = useState(0);
  const [mode, setMode] = useState<RelatedMode>("latest");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingFavoriteId, setPendingFavoriteId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchList(url: string): Promise<ContainersListApiResponse> {
      const response = await fetch(url, {
        cache: "no-store",
        signal: controller.signal,
      });
      const data = (await response.json()) as ContainersListApiResponse;
      if (!response.ok) {
        throw new Error(
          data.error ?? `${listingMessages.board.apiErrorPrefix} (${response.status})`,
        );
      }
      return data;
    }

    async function loadRelatedListings() {
      setIsLoading(true);
      setError(null);
      const requestPageSize = Math.max(limit + 1, 4);

      try {
        if (normalizedCompanySlug) {
          const companyData = await fetchList(
            buildCompanyRequestUrl(normalizedCompanySlug, requestPageSize),
          );
          if (controller.signal.aborted) {
            return;
          }

          const companyItems = companyData.items ?? [];
          const companyFiltered = companyItems.filter(
            (item) => item.id !== normalizedCurrentId,
          );
          const companyIncludesCurrent = companyItems.some(
            (item) => item.id === normalizedCurrentId,
          );
          const companyTotalRaw = companyData.meta?.total ?? companyFiltered.length;
          const companyTotal = Math.max(
            0,
            companyTotalRaw - (companyIncludesCurrent ? 1 : 0),
          );

          if (companyFiltered.length > 0) {
            setMode("company");
            setItems(companyFiltered.slice(0, limit));
            setTotal(companyTotal);
            return;
          }
        }

        const latestData = await fetchList(buildLatestRequestUrl(requestPageSize));
        if (controller.signal.aborted) {
          return;
        }

        const latestItems = (latestData.items ?? []).filter(
          (item) => item.id !== normalizedCurrentId,
        );
        const latestTotalRaw = latestData.meta?.total ?? latestItems.length;
        const latestIncludesCurrent = (latestData.items ?? []).some(
          (item) => item.id === normalizedCurrentId,
        );
        const latestTotal = Math.max(
          0,
          latestTotalRaw - (latestIncludesCurrent ? 1 : 0),
        );

        setMode("latest");
        setItems(latestItems.slice(0, limit));
        setTotal(latestTotal);
      } catch (loadError) {
        if (controller.signal.aborted) {
          return;
        }
        setItems([]);
        setTotal(0);
        setError(
          loadError instanceof Error
            ? loadError.message
            : relatedMessages.loadRelatedError,
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadRelatedListings();
    return () => controller.abort();
  }, [limit, normalizedCompanySlug, normalizedCurrentId]);

  const handleToggleFavorite = useCallback(
    async (listingId: string, isFavorite: boolean) => {
      if (pendingFavoriteId) {
        return;
      }
      if (!isLoggedIn) {
        toast.error(relatedMessages.loginRequiredForFavorites);
        return;
      }

      const nextIsFavorite = !isFavorite;
      setPendingFavoriteId(listingId);
      setItems((current) =>
        current.map((item) =>
          item.id === listingId ? { ...item, isFavorite: nextIsFavorite } : item,
        ),
      );

      try {
        const response = await fetch(`/api/containers/${listingId}/favorite`, {
          method: isFavorite ? "DELETE" : "POST",
          credentials: "include",
        });
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        if (!response.ok) {
          throw new Error(payload?.error ?? listingMessages.map.favoriteUpdateError);
        }
      } catch (favoriteError) {
        setItems((current) =>
          current.map((item) =>
            item.id === listingId ? { ...item, isFavorite } : item,
          ),
        );
        toast.error(
          favoriteError instanceof Error
            ? favoriteError.message
            : listingMessages.map.favoriteUpdateError,
        );
      } finally {
        setPendingFavoriteId(null);
      }
    },
    [isLoggedIn, pendingFavoriteId, toast],
  );

  const handleCopyListingLink = useCallback(
    async (listingId: string) => {
      const origin = window.location.origin;
      const url = `${origin}/containers/${listingId}`;
      const copied = await copyTextToClipboard(url);
      if (copied) {
        toast.success(listingMessages.map.linkCopied);
      } else {
        toast.error(listingMessages.map.copyError);
      }
    },
    [listingMessages.map.copyError, listingMessages.map.linkCopied, toast],
  );

  const sectionTitle =
    mode === "company" ? relatedMessages.companyTitle : relatedMessages.latestTitle;
  const listingsHref =
    mode === "company" && normalizedCompanySlug
      ? `/list?company=${encodeURIComponent(normalizedCompanySlug)}`
      : "/list";
  const hiddenCount = Math.max(total - items.length, 0);
  const hiddenListingsFooter =
    !isLoading && !error && hiddenCount > 0 ? (
      <div className="flex justify-center">
        <Link
          href={listingsHref}
          className="inline-flex min-h-20 w-full max-w-[220px] items-center justify-center rounded-xl border border-neutral-300 bg-neutral-100 px-6 text-center text-4xl font-semibold text-neutral-400 transition-colors hover:bg-neutral-200 hover:text-neutral-500"
          aria-label={formatTemplate(relatedMessages.hiddenAriaTemplate, {
            count: hiddenCount,
          })}
          title={relatedMessages.showAllTitle}
        >
          + {hiddenCount}
        </Link>
      </div>
    ) : null;

  if (!isLoading && !error && items.length === 0) {
    return null;
  }

  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <h2 className="text-lg font-semibold text-neutral-900">{sectionTitle}</h2>
        <Link
          href={listingsHref}
          className="inline-flex items-center gap-1 text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-700"
        >
          <span>{relatedMessages.showAll}</span>
          <svg
            viewBox="0 0 20 20"
            fill="none"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path
              d="M7 5l5 5-5 5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
      </div>
      <ContainerListingsResults
        locale={locale}
        messages={listingMessages}
        items={items}
        total={total}
        page={1}
        totalPages={1}
        showSummaryBar={false}
        isLoading={isLoading}
        error={error}
        activeTab="all"
        showFavoritesToggle={false}
        darkBlueCtaClass={DARK_BLUE_CTA_BASE_CLASS}
        pendingFavoriteId={pendingFavoriteId}
        onTabChange={() => {}}
        onToggleFavorite={handleToggleFavorite}
        onCopyListingLink={handleCopyListingLink}
        onPreviousPage={() => {}}
        onNextPage={() => {}}
        detailsHrefPrefix="/containers"
        priceDisplayCurrency="original"
        footerContent={hiddenListingsFooter}
      />
    </section>
  );
}
