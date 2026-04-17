"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ContainerListingsResults } from "@/components/container-listings-results";
import { useToast } from "@/components/toast-provider";
import type { ContainerListingItem } from "@/lib/container-listings";

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

export function CompanyProfileListings({
  companySlug,
  isLoggedIn,
  limit = 6,
  allListingsHref,
}: CompanyProfileListingsProps) {
  const toast = useToast();
  const normalizedSlug = companySlug.trim();
  const [items, setItems] = useState<ContainerListingItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingFavoriteId, setPendingFavoriteId] = useState<string | null>(null);

  const requestUrl = useMemo(() => {
    if (!normalizedSlug) {
      return "";
    }
    const params = new URLSearchParams({
      company: normalizedSlug,
      page: "1",
      pageSize: String(limit),
      sortBy: "createdAt",
      sortDir: "desc",
    });
    return `/api/containers?${params.toString()}`;
  }, [limit, normalizedSlug]);

  useEffect(() => {
    if (!requestUrl) {
      setItems([]);
      setTotal(0);
      setIsLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    async function loadListings() {
      setIsLoading(true);
      try {
        const response = await fetch(requestUrl, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = (await response.json()) as ContainersListApiResponse;
        if (!response.ok) {
          throw new Error(data.error ?? `Blad API (${response.status})`);
        }

        if (controller.signal.aborted) {
          return;
        }

        setItems(data.items ?? []);
        setTotal(data.meta?.total ?? 0);
        setError(null);
      } catch (loadError) {
        if (controller.signal.aborted) {
          return;
        }
        setItems([]);
        setTotal(0);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Nie udalo sie zaladowac ogloszen firmy",
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadListings();
    return () => controller.abort();
  }, [requestUrl]);

  const handleToggleFavorite = useCallback(
    async (listingId: string, isFavorite: boolean) => {
      if (pendingFavoriteId) {
        return;
      }
      if (!isLoggedIn) {
        toast.error("Zaloguj sie, aby dodawac ogloszenia do ulubionych.");
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
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        if (!response.ok) {
          throw new Error(payload?.error ?? "Nie udalo sie zaktualizowac ulubionych.");
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
            : "Nie udalo sie zaktualizowac ulubionych.",
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
        toast.success("Skopiowano link do ogloszenia.");
      } else {
        toast.error("Nie udalo sie skopiowac linku.");
      }
    },
    [toast],
  );

  const hiddenCount = Math.max(total - items.length, 0);
  const listingsHref =
    allListingsHref && allListingsHref.trim().length > 0
      ? allListingsHref
      : `/list?company=${encodeURIComponent(normalizedSlug)}`;
  const hiddenListingsFooter =
    !isLoading && !error && hiddenCount > 0 ? (
      <div className="flex justify-center">
        <Link
          href={listingsHref}
          className="inline-flex min-h-20 w-full max-w-[220px] items-center justify-center rounded-xl border border-neutral-300 bg-neutral-100 px-6 text-center text-4xl font-semibold text-neutral-400 transition-colors hover:bg-neutral-200 hover:text-neutral-500"
          aria-label={`Pokaz pozostale ogloszenia: ${hiddenCount}`}
          title="Zobacz wszystkie ogloszenia firmy"
        >
          + {hiddenCount}
        </Link>
      </div>
    ) : null;

  return (
    <div className="grid gap-1">
      <ContainerListingsResults
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
