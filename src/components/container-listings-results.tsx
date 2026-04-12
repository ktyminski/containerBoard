"use client";

import Link from "next/link";
import Image from "next/image";
import { memo } from "react";
import type { ContainerListingItem } from "@/lib/container-listings";
import {
  CONTAINER_CONDITION_LABEL,
  CONTAINER_FEATURE_LABEL,
  getContainerShortLabel,
  PRICE_CURRENCY_LABEL,
} from "@/lib/container-listing-types";
import {
  CONTAINER_CONDITION_COLOR_TOKENS,
} from "@/components/container-listings-shared";
import { getContainerListingLocationLabel } from "@/components/container-listings-utils";

type ContainerListingsResultsProps = {
  items: ContainerListingItem[];
  total: number;
  page: number;
  totalPages: number;
  isLoading: boolean;
  error: string | null;
  activeTab: "all" | "favorites";
  showFavoritesToggle: boolean;
  darkBlueCtaClass: string;
  pendingFavoriteId: string | null;
  onTabChange: (nextTab: "all" | "favorites") => void;
  onToggleFavorite: (listingId: string, isFavorite: boolean) => void;
  onCopyListingLink: (listingId: string) => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
};

type ListingPriceDisplay = {
  amountLabel: string;
  metaLine: string;
  isRequestPrice: boolean;
};

type LogisticsChipDisplay = {
  key: "transport" | "unloading";
  label: string;
  tooltip: string;
  isFree: boolean;
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function getDaysLabel(days: number): string {
  return days === 1 ? "dzien" : "dni";
}

function getExpiresInLabel(expiresAtIso: string, now = new Date()): string {
  const expiresAt = new Date(expiresAtIso);
  if (!Number.isFinite(expiresAt.getTime())) {
    return "nieznane";
  }

  const diffMs = expiresAt.getTime() - now.getTime();
  if (diffMs <= 0) {
    return "Dzisiaj";
  }

  if (diffMs < DAY_IN_MS) {
    return "Dzisiaj";
  }

  const fullDaysLeft = Math.floor(diffMs / DAY_IN_MS);
  return `za ${fullDaysLeft} ${getDaysLabel(fullDaysLeft)}`;
}

function getAvailableFromLabel(item: ContainerListingItem): string {
  if (item.availableNow) {
    return "Teraz";
  }

  const availableFrom = new Date(item.availableFrom);
  if (!Number.isFinite(availableFrom.getTime())) {
    return "nieznane";
  }

  const dateLabel = availableFrom.toLocaleDateString("pl-PL");
  return item.availableFromApproximate ? `~${dateLabel}` : dateLabel;
}

function formatVatRateLabel(vatRate: number | null): string {
  if (typeof vatRate !== "number" || !Number.isFinite(vatRate)) {
    return "VAT n/d";
  }

  return `VAT${vatRate.toLocaleString("pl-PL")}%`;
}

function getListingPriceDisplay(item: ContainerListingItem): ListingPriceDisplay {
  const pricing = item.pricing;

  if (pricing?.type === "request") {
    const metaParts = ["Zapytanie", "VAT do ustalenia"];
    if (pricing.original.negotiable === true || item.priceNegotiable === true) {
      metaParts.push("Do negocjacji");
    }

    return {
      amountLabel: "Zapytaj o cene",
      metaLine: metaParts.join(" | "),
      isRequestPrice: true,
    };
  }

  if (
    pricing?.original.amount !== null &&
    typeof pricing?.original.amount === "number" &&
    pricing.original.currency &&
    pricing.original.unit &&
    pricing.original.taxMode
  ) {
    const amountPrefix = pricing.type === "starting_from" ? "od " : "";
    const metaParts = [
      pricing.original.taxMode === "net" ? "Netto" : "Brutto",
      formatVatRateLabel(pricing.original.vatRate),
    ];
    if (pricing.original.negotiable === true || item.priceNegotiable === true) {
      metaParts.push("Do negocjacji");
    }

    return {
      amountLabel: `${amountPrefix}${pricing.original.amount.toLocaleString("pl-PL")} ${PRICE_CURRENCY_LABEL[pricing.original.currency]}`,
      metaLine: metaParts.join(" | "),
      isRequestPrice: false,
    };
  }

  if (typeof item.priceAmount === "number" && Number.isFinite(item.priceAmount)) {
    const metaParts = ["Netto", "VAT n/d"];
    if (item.priceNegotiable === true) {
      metaParts.push("Do negocjacji");
    }

    return {
      amountLabel: `${item.priceAmount.toLocaleString("pl-PL")} PLN`,
      metaLine: metaParts.join(" | "),
      isRequestPrice: false,
    };
  }

  if (item.price?.trim()) {
    const metaParts = ["VAT n/d"];
    if (item.priceNegotiable === true) {
      metaParts.push("Do negocjacji");
    }

    return {
      amountLabel: item.price.trim(),
      metaLine: metaParts.join(" | "),
      isRequestPrice: false,
    };
  }

  return {
    amountLabel: "Nie podano",
    metaLine: "VAT n/d",
    isRequestPrice: false,
  };
}

function getContainerPlaceholderSrc(item: ContainerListingItem): string {
  if (item.container.size === 20) {
    return "/placeholders/containers/container-20.svg";
  }
  if (item.container.size === 40) {
    return "/placeholders/containers/container-40.svg";
  }
  if (item.container.size === 45) {
    return "/placeholders/containers/container-45.svg";
  }
  return "/placeholders/containers/container-unknown.svg";
}

function buildLogisticsChips(item: ContainerListingItem): LogisticsChipDisplay[] {
  const chips: LogisticsChipDisplay[] = [];
  const comment = item.logisticsComment?.trim();

  if (item.logisticsTransportAvailable) {
    const distanceKm =
      typeof item.logisticsTransportFreeDistanceKm === "number" &&
      Number.isFinite(item.logisticsTransportFreeDistanceKm) &&
      item.logisticsTransportFreeDistanceKm > 0
        ? Math.trunc(item.logisticsTransportFreeDistanceKm)
        : null;
    const baseTooltip = item.logisticsTransportIncluded
      ? distanceKm
        ? `Darmowy transport do ${distanceKm} km.`
        : "Darmowy transport."
      : "Mozliwy transport na dodatkowych warunkach.";
    chips.push({
      key: "transport",
      label: item.logisticsTransportIncluded ? "🚛 FREE" : "🚛",
      tooltip: comment ? `${baseTooltip} ${comment}` : baseTooltip,
      isFree: item.logisticsTransportIncluded,
    });
  }

  if (item.logisticsUnloadingAvailable) {
    const baseTooltip = item.logisticsUnloadingIncluded
      ? "Rozladunek / HDS w cenie."
      : "Mozliwy rozladunek / HDS na dodatkowych warunkach.";
    chips.push({
      key: "unloading",
      label: item.logisticsUnloadingIncluded ? "🏗️ FREE" : "🏗️",
      tooltip: comment ? `${baseTooltip} ${comment}` : baseTooltip,
      isFree: item.logisticsUnloadingIncluded,
    });
  }

  return chips;
}

function ContainerListingsResultsComponent({
  items,
  total,
  page,
  totalPages,
  isLoading,
  error,
  activeTab,
  showFavoritesToggle,
  darkBlueCtaClass,
  pendingFavoriteId,
  onTabChange,
  onToggleFavorite,
  onCopyListingLink,
  onPreviousPage,
  onNextPage,
}: ContainerListingsResultsProps) {
  const renderPaginationControls = (extraClassName?: string) => {
    if (totalPages <= 1) {
      return null;
    }

    const className = [
      "flex items-center justify-end gap-2",
      extraClassName ?? "",
    ]
      .join(" ")
      .trim();

    return (
      <div className={className}>
        <button
          type="button"
          disabled={page <= 1}
          onClick={onPreviousPage}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Poprzednia
        </button>
        <span className="text-xs text-neutral-500">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={onNextPage}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Nastepna
        </button>
      </div>
    );
  };

  return (
    <section className="grid content-start gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-neutral-300 bg-neutral-50/95 p-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-neutral-50/90">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-neutral-700">
            Wyniki wyszukiwania: <span className="font-semibold">{total}</span>
          </p>
          {showFavoritesToggle ? (
            <div className="ml-0 flex items-center gap-2 sm:ml-2">
              <button
                type="button"
                onClick={() => {
                  onTabChange("all");
                }}
                className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                  activeTab === "all"
                    ? "border-sky-400 bg-sky-100 text-sky-900 shadow-[0_0_0_1px_rgba(56,189,248,0.15)]"
                    : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100"
                }`}
              >
                Wszystkie
              </button>
              <button
                type="button"
                onClick={() => {
                  onTabChange("favorites");
                }}
                className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                  activeTab === "favorites"
                    ? "border-sky-400 bg-sky-100 text-sky-900 shadow-[0_0_0_1px_rgba(56,189,248,0.15)]"
                    : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100"
                }`}
              >
                Ulubione
              </button>
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-4">
          <p className="text-xs text-neutral-500">
            Strona {page} z {totalPages}
          </p>
          {renderPaginationControls()}
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-md border border-neutral-300 bg-neutral-50/95 p-5 shadow-sm">
          <div className="flex items-center justify-center gap-3 text-neutral-700">
            <span
              className="h-7 w-7 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-500"
              aria-label="Ladowanie kontenerow"
            />
            <span className="text-sm font-medium">Ladowanie kontenerow...</span>
          </div>
        </div>
      ) : null}

      {!isLoading ? (
        <div className="rounded-md border border-neutral-300 bg-neutral-100/95 p-3 shadow-sm">
          {error ? <p className="text-sm text-neutral-700">{error}</p> : null}

          {items.length === 0 ? (
            <div className="flex min-h-[220px] items-center justify-center px-4 text-center">
              <p className="text-xl font-medium text-neutral-400 sm:text-2xl">
                Brak kontenerow dla aktualnych filtrow.
              </p>
            </div>
          ) : null}

          <ul className="space-y-3">
            {items.map((item) => {
              const priceDisplay = getListingPriceDisplay(item);
              const expiresInLabel = getExpiresInLabel(item.expiresAt);
              const availableFromLabel = getAvailableFromLabel(item);
              const normalizedTitle = item.title?.trim();
              const fallbackTitle = getContainerShortLabel(item.container);
              const resolvedTitle = normalizedTitle && normalizedTitle.length > 0
                ? normalizedTitle
                : fallbackTitle;
              const logisticsChips = buildLogisticsChips(item);
              const containerFeatureLabels = item.container.features
                .map((feature) => CONTAINER_FEATURE_LABEL[feature])
                .filter((label) => typeof label === "string" && label.trim().length > 0);
              const containerMetaParts = [
                ...(typeof item.productionYear === "number"
                  ? [String(item.productionYear)]
                  : []),
                ...containerFeatureLabels,
              ];

              return (
                <li
                  key={item.id}
                  className="rounded-md border border-neutral-200 bg-white p-4 shadow-sm transition-colors duration-150 hover:border-sky-100 hover:bg-sky-50/60"
                >
                  <div className="flex flex-col gap-4 sm:flex-row">
                    <div className="relative aspect-square w-full shrink-0 overflow-hidden rounded-md border border-neutral-200 bg-neutral-100 sm:w-44">
                      <Image
                        src={getContainerPlaceholderSrc(item)}
                        alt=""
                        fill
                        className="object-contain p-1"
                        sizes="(max-width: 640px) 100vw, 176px"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs uppercase tracking-wide text-neutral-500">
                            {item.companyName}
                          </p>
                          <h3 className="mt-1 text-xl font-semibold text-neutral-900">
                            {resolvedTitle}
                          </h3>
                          {resolvedTitle !== fallbackTitle ? (
                            <p className="mt-1 text-xs text-neutral-500">
                              {fallbackTitle}
                            </p>
                          ) : null}
                          <div className="mt-1 inline-flex items-center gap-1.5 text-sm text-neutral-600">
                            <svg
                              className="h-4 w-4 shrink-0 text-neutral-500"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              aria-hidden="true"
                            >
                              <path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z" />
                              <circle cx="12" cy="10" r="2.5" />
                            </svg>
                            <span>{getContainerListingLocationLabel(item)}</span>
                          </div>
                          {containerMetaParts.length > 0 ? (
                            <p className="mt-1 text-xs text-neutral-500">
                              {containerMetaParts.join(", ")}
                            </p>
                          ) : null}
                        </div>
                        <div className="grid gap-2">
                          <div className="text-right">
                            <p
                              className={`text-lg font-bold sm:text-xl ${
                                priceDisplay.isRequestPrice ? "text-neutral-700" : "text-amber-600"
                              }`}
                            >
                              {priceDisplay.amountLabel}
                            </p>
                            <p className="text-xs text-neutral-600">{priceDisplay.metaLine}</p>
                          </div>
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            {logisticsChips.map((chip) => (
                              <span
                                key={chip.key}
                                title={chip.tooltip}
                                className={`rounded-md border px-2 py-1 text-xs font-semibold ${
                                  chip.isFree
                                    ? "border-emerald-300 bg-emerald-100 text-emerald-800"
                                    : "border-neutral-300 bg-white text-neutral-700"
                                }`}
                              >
                                {chip.label}
                              </span>
                            ))}
                            {item.hasCscPlate || item.hasCscCertification ? (
                              <span className="inline-flex items-center gap-1 rounded-md border border-green-300 bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                                <span>CSC</span>
                                <svg
                                  className="h-3.5 w-3.5"
                                  viewBox="0 0 20 20"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  aria-hidden="true"
                                >
                                  <path d="m5 10 3 3 7-7" />
                                </svg>
                              </span>
                            ) : null}
                            <span
                              className={`rounded-md border px-2 py-1 text-xs font-medium ${CONTAINER_CONDITION_COLOR_TOKENS[item.container.condition].badgeClassName}`}
                            >
                              {CONTAINER_CONDITION_LABEL[item.container.condition]}
                            </span>
                          </div>
                          <p className="text-right text-xs text-neutral-400">
                            Wygasa: {expiresInLabel}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-neutral-700">
                        {item.quantity > 1 ? (
                          <p>
                            Ilosc:{" "}
                            <span className="font-medium text-neutral-900">
                              {item.quantity}
                            </span>
                          </p>
                        ) : null}
                        <p className="ml-auto text-right">
                          Dostepny od:{" "}
                          <span className="font-medium text-neutral-900">
                            {availableFromLabel}
                          </span>
                        </p>
                      </div>

                      <div className="mt-3 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          className={`rounded-md border p-2 transition-colors ${
                            item.isFavorite
                              ? "border-rose-300 bg-rose-100 text-rose-700 hover:bg-rose-200"
                              : "border-neutral-300 bg-white text-neutral-600 hover:border-neutral-400 hover:bg-neutral-100 hover:text-neutral-800"
                          } disabled:cursor-not-allowed disabled:opacity-60`}
                          onClick={() => {
                            onToggleFavorite(item.id, item.isFavorite === true);
                          }}
                          aria-label={
                            item.isFavorite ? "Usun z ulubionych" : "Dodaj do ulubionych"
                          }
                          title={
                            item.isFavorite ? "Usun z ulubionych" : "Dodaj do ulubionych"
                          }
                          disabled={pendingFavoriteId === item.id}
                        >
                          <svg
                            className="h-4 w-4"
                            viewBox="0 0 24 24"
                            fill={item.isFavorite ? "currentColor" : "none"}
                            stroke="currentColor"
                            strokeWidth="2"
                            aria-hidden="true"
                          >
                            <path d="M12 21s-6.7-4.35-9.25-8.09C.83 10.09 1.64 6.1 4.68 4.3a5.46 5.46 0 0 1 6.24.46L12 5.66l1.08-.9a5.46 5.46 0 0 1 6.24-.46c3.04 1.8 3.85 5.8 1.93 8.61C18.7 16.65 12 21 12 21Z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-neutral-300 bg-white p-2 text-neutral-600 transition-colors hover:border-neutral-400 hover:bg-neutral-100 hover:text-neutral-800"
                          onClick={() => {
                            onCopyListingLink(item.id);
                          }}
                          aria-label="Kopiuj link do ogloszenia"
                          title="Kopiuj link do ogloszenia"
                        >
                          <svg
                            className="h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            aria-hidden="true"
                          >
                            <rect x="9" y="9" width="11" height="11" rx="2" />
                            <rect x="4" y="4" width="11" height="11" rx="2" />
                          </svg>
                        </button>
                        <Link
                          href={`/containers/${item.id}`}
                          className={`rounded-md px-3 py-2 text-sm font-medium ${darkBlueCtaClass}`}
                        >
                          Szczegoly i zapytanie
                        </Link>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {renderPaginationControls("mt-4")}
        </div>
      ) : null}
    </section>
  );
}

export const ContainerListingsResults = memo(ContainerListingsResultsComponent);
