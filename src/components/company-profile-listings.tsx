"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ContainerListingsResults } from "@/components/container-listings-results";
import { useToast } from "@/components/toast-provider";
import type { ContainerListingItem } from "@/lib/container-listings";
import type { ListingType } from "@/lib/container-listing-types";
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

type CompanyProfileListingsProps = {
  companySlug: string;
  isLoggedIn: boolean;
  limit?: number;
  allListingsHref?: string;
};

const DARK_BLUE_CTA_BASE_CLASS =
  "border border-[#2f639a] bg-[linear-gradient(180deg,#082650_0%,#0c3466_100%)] text-[#e2efff] transition hover:border-[#67c7ff] hover:text-white";
const LISTING_TYPE_TABS: ListingType[] = ["sell", "rent", "buy"];

type ListingsByType = Record<ListingType, ContainerListingItem[]>;
type TotalsByType = Record<ListingType, number>;

const EMPTY_LISTINGS_BY_TYPE: ListingsByType = {
  sell: [],
  rent: [],
  buy: [],
};
const EMPTY_TOTALS_BY_TYPE: TotalsByType = {
  sell: 0,
  rent: 0,
  buy: 0,
};

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

function buildCompanyRequestUrl(
  companySlug: string,
  pageSize: number,
  type: ListingType,
): string {
  const params = new URLSearchParams({
    company: companySlug,
    page: "1",
    pageSize: String(pageSize),
    sortBy: "createdAt",
    sortDir: "desc",
    type,
  });
  return `/api/containers?${params.toString()}`;
}

function getMostPopulatedListingType(totals: TotalsByType): ListingType {
  return LISTING_TYPE_TABS.reduce((bestType, type) =>
    totals[type] > totals[bestType] ? type : bestType,
  );
}

function buildCompanyListingsHref(
  fallbackCompanySlug: string,
  type: ListingType,
  baseHref?: string,
): string {
  const fallbackHref = `/list?company=${encodeURIComponent(fallbackCompanySlug)}`;
  const href = baseHref?.trim() || fallbackHref;

  try {
    const url = new URL(href, "https://containerboard.local");
    url.searchParams.set("kind", type);
    return `${url.pathname}${url.search}`;
  } catch {
    const separator = href.includes("?") ? "&" : "?";
    return `${href}${separator}kind=${encodeURIComponent(type)}`;
  }
}

export function CompanyProfileListings({
  companySlug,
  isLoggedIn,
  limit = 6,
  allListingsHref,
}: CompanyProfileListingsProps) {
  const locale = useMemo(
    () =>
      resolveLocale(
        typeof document === "undefined" ? undefined : document.documentElement.lang,
      ),
    [],
  );
  const listingMessages = useMemo(
    () => getMessages(locale).containerListings,
    [locale],
  );
  const relatedMessages = listingMessages.related;
  const toast = useToast();
  const normalizedSlug = companySlug.trim();
  const [itemsByType, setItemsByType] = useState<ListingsByType>(
    EMPTY_LISTINGS_BY_TYPE,
  );
  const [totalsByType, setTotalsByType] =
    useState<TotalsByType>(EMPTY_TOTALS_BY_TYPE);
  const [activeType, setActiveType] = useState<ListingType>("sell");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingFavoriteId, setPendingFavoriteId] = useState<string | null>(null);

  useEffect(() => {
    if (!normalizedSlug) {
      setItemsByType(EMPTY_LISTINGS_BY_TYPE);
      setTotalsByType(EMPTY_TOTALS_BY_TYPE);
      setActiveType("sell");
      setIsLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();

    async function fetchList(type: ListingType): Promise<{
      type: ListingType;
      items: ContainerListingItem[];
      total: number;
    }> {
      const response = await fetch(buildCompanyRequestUrl(normalizedSlug, limit, type), {
        cache: "no-store",
        signal: controller.signal,
      });
      const data = (await response.json()) as ContainersListApiResponse;
      if (!response.ok) {
        throw new Error(
          data.error ?? `${listingMessages.board.apiErrorPrefix} (${response.status})`,
        );
      }

      return {
        type,
        items: data.items ?? [],
        total: data.meta?.total ?? 0,
      };
    }

    async function loadListingsByType() {
      setIsLoading(true);
      try {
        const results = await Promise.all(
          LISTING_TYPE_TABS.map((type) => fetchList(type)),
        );

        if (controller.signal.aborted) {
          return;
        }

        const nextItemsByType = { ...EMPTY_LISTINGS_BY_TYPE };
        const nextTotalsByType = { ...EMPTY_TOTALS_BY_TYPE };
        for (const result of results) {
          nextItemsByType[result.type] = result.items;
          nextTotalsByType[result.type] = result.total;
        }

        setItemsByType(nextItemsByType);
        setTotalsByType(nextTotalsByType);
        setActiveType(getMostPopulatedListingType(nextTotalsByType));
        setError(null);
      } catch (loadError) {
        if (controller.signal.aborted) {
          return;
        }
        setItemsByType(EMPTY_LISTINGS_BY_TYPE);
        setTotalsByType(EMPTY_TOTALS_BY_TYPE);
        setActiveType("sell");
        setError(
          loadError instanceof Error
            ? loadError.message
            : relatedMessages.loadCompanyError,
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadListingsByType();
    return () => controller.abort();
  }, [
    limit,
    listingMessages.board.apiErrorPrefix,
    normalizedSlug,
    relatedMessages.loadCompanyError,
  ]);

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
      setItemsByType((current) => ({
        ...current,
        [activeType]: current[activeType].map((item) =>
          item.id === listingId ? { ...item, isFavorite: nextIsFavorite } : item,
        ),
      }));

      try {
        const response = await fetch(`/api/containers/${listingId}/favorite`, {
          method: isFavorite ? "DELETE" : "POST",
          credentials: "include",
        });
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        if (!response.ok) {
          throw new Error(payload?.error ?? listingMessages.map.favoriteUpdateError);
        }
      } catch (favoriteError) {
        setItemsByType((current) => ({
          ...current,
          [activeType]: current[activeType].map((item) =>
            item.id === listingId ? { ...item, isFavorite } : item,
          ),
        }));
        toast.error(
          favoriteError instanceof Error
            ? favoriteError.message
            : listingMessages.map.favoriteUpdateError,
        );
      } finally {
        setPendingFavoriteId(null);
      }
    },
    [
      activeType,
      isLoggedIn,
      listingMessages.map.favoriteUpdateError,
      pendingFavoriteId,
      relatedMessages.loginRequiredForFavorites,
      toast,
    ],
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

  const items = itemsByType[activeType];
  const total = totalsByType[activeType];
  const visibleTypes = LISTING_TYPE_TABS.filter((type) => totalsByType[type] > 0);
  const hasAnyListings = visibleTypes.length > 0;
  const hiddenCount = Math.max(total - items.length, 0);
  const listingsHref = buildCompanyListingsHref(
    normalizedSlug,
    activeType,
    allListingsHref,
  );
  const hiddenListingsFooter =
    !isLoading && !error && hiddenCount > 0 ? (
      <div className="flex justify-center">
        <Link
          href={listingsHref}
          className="inline-flex min-h-20 w-full max-w-[220px] items-center justify-center rounded-xl border border-neutral-300 bg-neutral-100 px-6 text-center text-4xl font-semibold text-neutral-400 transition-colors hover:bg-neutral-200 hover:text-neutral-500"
          aria-label={formatTemplate(relatedMessages.hiddenAriaTemplate, {
            count: hiddenCount,
          })}
          title={relatedMessages.showAllCompanyTitle}
        >
          + {hiddenCount}
        </Link>
      </div>
    ) : null;

  if (!isLoading && !error && !hasAnyListings) {
    return null;
  }

  return (
    <div className="grid gap-3">
      <h2 className="px-1 text-lg font-semibold text-neutral-900">
        {relatedMessages.companyLatestTitle}
      </h2>
      {hasAnyListings ? (
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex flex-wrap gap-2">
            {visibleTypes.map((type) => {
              const isActive = type === activeType;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setActiveType(type)}
                  className={`rounded-md border px-3 py-1.5 text-sm font-medium transition ${
                    isActive
                      ? "border-[#1f2937] bg-[#1f2937] text-white shadow-sm"
                      : "border-neutral-300 bg-white text-neutral-600 hover:border-neutral-400 hover:text-neutral-900"
                  }`}
                >
                  {listingMessages.shared.listingKinds[type]} ({totalsByType[type]})
                </button>
              );
            })}
          </div>
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
      ) : null}
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
    </div>
  );
}
