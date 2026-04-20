"use client";

import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";
import { memo } from "react";
import {
  getContainerConditionLabel,
  getContainerFeatureLabel,
  getContainerShortLabelLocalized,
  type ContainerListingsMessages,
} from "@/components/container-listings-i18n";
import type { ContainerListingItem } from "@/lib/container-listings";
import { ContainerPhotoWithPlaceholder } from "@/components/container-photo-with-placeholder";
import { CopyLinkIcon } from "@/components/icons/copy-link-icon";
import {
  PRICE_CURRENCY_LABEL,
} from "@/lib/container-listing-types";
import {
  CONTAINER_CONDITION_COLOR_TOKENS,
  type PriceDisplayCurrency,
} from "@/components/container-listings-shared";
import { getContainerListingLocationLabel } from "@/components/container-listings-utils";
import type { AppLocale } from "@/lib/i18n";

type ContainerListingsResultsProps = {
  locale: AppLocale;
  messages: ContainerListingsMessages;
  items: ContainerListingItem[];
  total: number;
  page: number;
  totalPages: number;
  showSummaryBar?: boolean;
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
  onOpenDetails?: (href: string) => void;
  detailsHrefPrefix?: string;
  detailsQueryString?: string;
  priceDisplayCurrency: PriceDisplayCurrency;
  footerContent?: ReactNode;
};

type ListingPriceDisplay = {
  amountLabel: string;
  metaLine: string;
  isRequestPrice: boolean;
};

type ContainerListingResultCardProps = {
  locale: AppLocale;
  messages: ContainerListingsMessages;
  item: ContainerListingItem;
  darkBlueCtaClass: string;
  detailsHrefPrefix: string;
  detailsQueryString?: string;
  isFavoritePending: boolean;
  onCopyListingLink: (listingId: string) => void;
  onOpenDetails?: (href: string) => void;
  onToggleFavorite: (listingId: string, isFavorite: boolean) => void;
  priceDisplayCurrency: PriceDisplayCurrency;
  shouldPrefetchDetails: boolean;
  shouldPrioritizeImage: boolean;
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const MAX_LOGISTICS_TOOLTIP_LENGTH = 120;

function getDaysLabel(
  messages: ContainerListingsMessages,
  locale: AppLocale,
  days: number,
): string {
  const category = new Intl.PluralRules(locale).select(days);
  const dayLabels = messages.results.dayLabels;
  if (category === "one") {
    return dayLabels.one;
  }
  if (category === "few") {
    return dayLabels.few;
  }
  if (category === "many") {
    return dayLabels.many;
  }
  return dayLabels.other;
}

function getExpiresInLabel(
  messages: ContainerListingsMessages,
  locale: AppLocale,
  expiresAtIso: string,
  now = new Date(),
): string {
  const expiresAt = new Date(expiresAtIso);
  if (!Number.isFinite(expiresAt.getTime())) {
    return messages.results.unknown;
  }

  const diffMs = expiresAt.getTime() - now.getTime();
  if (diffMs <= 0) {
    return messages.results.today;
  }

  if (diffMs < DAY_IN_MS) {
    return messages.results.today;
  }

  const fullDaysLeft = Math.floor(diffMs / DAY_IN_MS);
  return `${messages.results.inPrefix} ${fullDaysLeft} ${getDaysLabel(messages, locale, fullDaysLeft)}`;
}

function getAvailableFromLabel(
  messages: ContainerListingsMessages,
  locale: AppLocale,
  item: ContainerListingItem,
): string {
  if (item.availableNow) {
    return messages.results.availableNow;
  }

  const availableFrom = new Date(item.availableFrom);
  if (!Number.isFinite(availableFrom.getTime())) {
    return messages.results.unknown;
  }

  const dateLabel = availableFrom.toLocaleDateString(locale);
  return item.availableFromApproximate ? `~${dateLabel}` : dateLabel;
}

function truncateTooltipText(
  value: string,
  maxLength = MAX_LOGISTICS_TOOLTIP_LENGTH,
): string {
  const normalizedValue = value.trim();
  if (normalizedValue.length <= maxLength) {
    return normalizedValue;
  }

  return `${normalizedValue.slice(0, maxLength).trimEnd()}...`;
}

function formatVatRateLabel(locale: AppLocale, vatRate: number | null): string | null {
  if (typeof vatRate !== "number" || !Number.isFinite(vatRate)) {
    return null;
  }

  return `VAT${vatRate.toLocaleString(locale)}%`;
}

function getNormalizedAmountByCurrency(
  input: {
    amountPln: number | null;
    amountEur: number | null;
    amountUsd: number | null;
  },
  currency: Exclude<PriceDisplayCurrency, "original">,
): number | null {
  if (currency === "PLN") {
    return input.amountPln;
  }
  if (currency === "EUR") {
    return input.amountEur;
  }
  return input.amountUsd;
}

function getListingPriceDisplay(
  messages: ContainerListingsMessages,
  locale: AppLocale,
  item: ContainerListingItem,
  priceDisplayCurrency: PriceDisplayCurrency,
): ListingPriceDisplay {
  const pricing = item.pricing;

  if (
    pricing &&
    (pricing.original.amount === null ||
      typeof pricing.original.amount !== "number")
  ) {
    const metaParts: string[] = [];
    if (pricing.original.negotiable === true || item.priceNegotiable === true) {
      metaParts.push(messages.results.negotiable);
    }

    return {
      amountLabel: messages.results.askPrice,
      metaLine: metaParts.join(" | "),
      isRequestPrice: true,
    };
  }

  if (
    pricing?.original.amount !== null &&
    typeof pricing?.original.amount === "number" &&
    pricing.original.currency &&
    pricing.original.taxMode
  ) {
    const normalizedAmountSet =
      pricing.original.taxMode === "net"
        ? pricing.normalized.net
        : pricing.normalized.gross;
    const shouldConvertAmount =
      priceDisplayCurrency !== "original" &&
      priceDisplayCurrency !== pricing.original.currency;
    const normalizedAmount = shouldConvertAmount
      ? getNormalizedAmountByCurrency(normalizedAmountSet, priceDisplayCurrency)
      : null;
    const hasConvertedAmount =
      shouldConvertAmount &&
      typeof normalizedAmount === "number" &&
      Number.isFinite(normalizedAmount);
    const resolvedAmountRaw = hasConvertedAmount
      ? normalizedAmount
      : pricing.original.amount;
    const resolvedAmount = Math.round(resolvedAmountRaw);
    const resolvedCurrency = hasConvertedAmount
      ? priceDisplayCurrency
      : pricing.original.currency;
    const convertedPrefix = hasConvertedAmount ? "~" : "";

    const metaParts = [
      pricing.original.taxMode === "net"
        ? messages.results.net
        : messages.results.gross,
    ];
    const vatRateLabel = formatVatRateLabel(locale, pricing.original.vatRate);
    if (vatRateLabel) {
      metaParts.push(vatRateLabel);
    }
    if (pricing.original.negotiable === true || item.priceNegotiable === true) {
      metaParts.push(messages.results.negotiable);
    }

    return {
      amountLabel: `${convertedPrefix}${resolvedAmount.toLocaleString(locale)} ${PRICE_CURRENCY_LABEL[resolvedCurrency]}`,
      metaLine: metaParts.join(" | "),
      isRequestPrice: false,
    };
  }

  if (
    typeof item.priceAmount === "number" &&
    Number.isFinite(item.priceAmount)
  ) {
    const metaParts = [messages.results.net];
    if (item.priceNegotiable === true) {
      metaParts.push(messages.results.negotiable);
    }

    return {
      amountLabel: `${Math.round(item.priceAmount).toLocaleString(locale)} PLN`,
      metaLine: metaParts.join(" | "),
      isRequestPrice: false,
    };
  }

  if (item.price?.trim()) {
    const metaParts: string[] = [];
    if (item.priceNegotiable === true) {
      metaParts.push(messages.results.negotiable);
    }

    return {
      amountLabel: item.price.trim(),
      metaLine: metaParts.join(" | "),
      isRequestPrice: false,
    };
  }

  return {
    amountLabel: messages.results.askPrice,
    metaLine: "",
    isRequestPrice: true,
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

function getContainerPreviewSrc(item: ContainerListingItem): string {
  const firstPhotoUrl = item.photoUrls?.find((value) => {
    const trimmed = value?.trim();
    return Boolean(trimmed);
  });
  return firstPhotoUrl ?? getContainerPlaceholderSrc(item);
}

function getCscValidityLabel(
  messages: ContainerListingsMessages,
  item: ContainerListingItem,
): string {
  if (
    typeof item.cscValidToMonth === "number" &&
    Number.isInteger(item.cscValidToMonth) &&
    item.cscValidToMonth >= 1 &&
    item.cscValidToMonth <= 12 &&
    typeof item.cscValidToYear === "number" &&
    Number.isInteger(item.cscValidToYear) &&
    item.cscValidToYear >= 1900 &&
    item.cscValidToYear <= 2100
  ) {
    return `${String(item.cscValidToMonth).padStart(2, "0")}.${item.cscValidToYear}`;
  }

  return messages.results.noData;
}

function getLocationLabel(
  messages: ContainerListingsMessages,
  input: {
  locationAddressParts?: {
    postalCode?: string;
    city?: string;
    country?: string;
  };
  locationCity?: string;
  locationCountry?: string;
},
): string {
  const postalCode = input.locationAddressParts?.postalCode?.trim() || "";
  const city =
    input.locationAddressParts?.city?.trim() ||
    input.locationCity?.trim() ||
    "";
  const country =
    input.locationAddressParts?.country?.trim() ||
    input.locationCountry?.trim() ||
    "";
  const combined = [postalCode, [city, country].filter(Boolean).join(", ")]
    .filter(Boolean)
    .join(" ");
  return combined || messages.utils.noLocation;
}

function getAllLocationLabels(
  messages: ContainerListingsMessages,
  item: ContainerListingItem,
): string[] {
  const labels: string[] = [];
  const seen = new Set<string>();

  const appendLabel = (label: string) => {
    const normalizedKey = label.toLowerCase();
    if (seen.has(normalizedKey)) {
      return;
    }
    seen.add(normalizedKey);
    labels.push(label);
  };

  if (Array.isArray(item.locations) && item.locations.length > 0) {
    for (const location of item.locations) {
      appendLabel(
        getLocationLabel(messages, {
          locationAddressParts: location.locationAddressParts,
          locationCity: location.locationCity,
          locationCountry: location.locationCountry,
        }),
      );
    }
  } else {
    appendLabel(
      getLocationLabel(messages, {
        locationAddressParts: item.locationAddressParts,
        locationCity: item.locationCity,
        locationCountry: item.locationCountry,
      }),
    );
  }

  return labels.length > 0 ? labels : [messages.utils.noLocation];
}

function getContainerColorBadgeLabel(color: {
  ral: string;
  rgb: { r: number; g: number; b: number };
}): string {
  return `${color.ral} (RGB ${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b})`;
}

function getRalColorCode(value: string): string {
  const normalized = value
    .trim()
    .replace(/^RAL[\s-]*/i, "")
    .trim();
  return normalized.length > 0 ? normalized : value.trim();
}

function getRalTileTextClass(color: {
  r: number;
  g: number;
  b: number;
}): string {
  const luminance = (color.r * 299 + color.g * 587 + color.b * 114) / 1000;
  return luminance > 160 ? "text-neutral-900" : "text-white";
}

function ContainerColorsInlineSummary({
  messages,
  colors,
  itemId,
}: {
  messages: ContainerListingsMessages;
  colors: Array<{
    ral: string;
    rgb: { r: number; g: number; b: number };
  }>;
  itemId: string;
}) {
  if (colors.length === 0) {
    return null;
  }

  const previewColors = colors.slice(0, 3);
  const additionalCount = Math.max(colors.length - previewColors.length, 0);
  const tooltipColumns = Math.min(colors.length, 5);
  const tooltipContentWidthRem =
    tooltipColumns * 4 + (tooltipColumns - 1) * 0.625;

  return (
    <div
      className="group relative inline-flex items-center gap-2"
      tabIndex={0}
      aria-label={`${messages.results.ralColorsAria}: ${colors.map((color) => color.ral).join(", ")}`}
    >
      <span className="text-sm text-neutral-700">{messages.results.colorLabel}</span>
      <div className="inline-flex items-center gap-1">
        {previewColors.map((color, index) => (
          <span
            key={`${itemId}-preview-${color.ral}-${index}`}
            className="h-3.5 w-3.5 rounded-[3px] border border-neutral-300"
            style={{
              backgroundColor: `rgb(${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b})`,
            }}
            aria-label={getContainerColorBadgeLabel(color)}
            title={color.ral}
          />
        ))}
        {additionalCount > 0 ? (
          <span className="text-xs font-medium text-neutral-600">
            + {additionalCount}
          </span>
        ) : null}
      </div>
      <div className="pointer-events-none absolute bottom-full right-0 z-30 mb-2 w-fit translate-y-1 rounded-md border border-neutral-700 bg-neutral-900 p-2.5 opacity-0 shadow-xl transition duration-150 group-hover:delay-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:delay-300 group-focus-within:translate-y-0 group-focus-within:opacity-100">
        <div
          className="flex flex-wrap gap-2.5"
          style={{
            width: `${tooltipContentWidthRem}rem`,
          }}
        >
          {colors.map((color, index) => {
            const textClass = getRalTileTextClass(color.rgb);
            return (
              <span
                key={`${itemId}-tooltip-${color.ral}-${index}`}
                className={`relative inline-flex h-16 w-16 rounded-md border border-neutral-800/50 shadow-sm ${textClass}`}
                style={{
                  backgroundColor: `rgb(${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b})`,
                }}
                aria-label={getContainerColorBadgeLabel(color)}
                title={getContainerColorBadgeLabel(color)}
              >
                <span className="absolute bottom-1 right-1 inline-flex flex-col items-end leading-none">
                  <span className="text-[9px] font-semibold uppercase tracking-[0.01em]">
                    RAL
                  </span>
                  <span className="max-w-[56px] truncate text-right text-[13px] font-bold">
                    {getRalColorCode(color.ral)}
                  </span>
                </span>
              </span>
            );
          })}
        </div>
        <span
          aria-hidden="true"
          className="absolute -bottom-1 left-3 h-2 w-2 rotate-45 border-b border-r border-neutral-700 bg-neutral-900"
        />
      </div>
    </div>
  );
}

function CscInfoBadge({
  item,
  messages,
}: {
  item: ContainerListingItem;
  messages: ContainerListingsMessages;
}) {
  const validityLabel = getCscValidityLabel(messages, item);

  return (
    <div className="group relative">
      <span className="inline-flex cursor-help items-center gap-1 rounded-md border border-green-300 bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
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
      <div className="pointer-events-none absolute bottom-full right-0 z-30 mb-2 w-64 translate-y-1 rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-2 text-left text-xs leading-5 text-neutral-100 opacity-0 shadow-xl transition duration-150 group-hover:delay-500 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:delay-500 group-focus-within:translate-y-0 group-focus-within:opacity-100">
        <p>{messages.results.cscPlateLabel}: {item.hasCscPlate ? messages.results.yes : messages.results.no}</p>
        <p>{messages.results.cscCertificationLabel}: {item.hasCscCertification ? messages.results.yes : messages.results.no}</p>
        <p>{messages.results.warrantyLabel}: {item.hasWarranty ? messages.results.yes : messages.results.no}</p>
        <p>{messages.results.cscValidityLabel}: {validityLabel}</p>
        <span
          aria-hidden="true"
          className="absolute -bottom-1 right-3 h-2 w-2 rotate-45 border-b border-r border-neutral-700 bg-neutral-900"
        />
      </div>
    </div>
  );
}

function LocationInfoBadge({
  item,
  messages,
}: {
  item: ContainerListingItem;
  messages: ContainerListingsMessages;
}) {
  const locationLabel = getContainerListingLocationLabel(item, messages.utils);
  const allLocationLabels = getAllLocationLabels(messages, item);
  const showTooltip = allLocationLabels.length > 1;

  return (
    <div
      className={`flex w-full min-w-0 items-center gap-1.5 text-sm text-neutral-600 ${
        showTooltip ? "group relative" : ""
      }`}
      {...(showTooltip
        ? {
            tabIndex: 0,
            "aria-label": messages.results.allLocationsAria,
          }
        : {})}
    >
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
      <span
        className={`min-w-0 flex-1 truncate ${showTooltip ? "cursor-help" : ""}`}
      >
        {locationLabel}
      </span>
      {showTooltip ? (
        <div className="pointer-events-none absolute bottom-full left-0 z-30 mb-2 w-72 max-w-[85vw] translate-y-1 rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-2 text-left text-xs leading-5 text-neutral-100 opacity-0 shadow-xl transition duration-150 group-hover:delay-500 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:delay-500 group-focus-within:translate-y-0 group-focus-within:opacity-100">
          <ul className="space-y-0.5">
            {allLocationLabels.map((label) => (
              <li key={`${item.id}-location-${label}`}>{label}</li>
            ))}
          </ul>
          <span
            aria-hidden="true"
            className="absolute -bottom-1 left-3 h-2 w-2 rotate-45 border-b border-r border-neutral-700 bg-neutral-900"
          />
        </div>
      ) : null}
    </div>
  );
}

function getLogisticsSummaryLabels(
  messages: ContainerListingsMessages,
  item: ContainerListingItem,
): string[] {
  const labels: string[] = [];

  if (item.logisticsTransportAvailable) {
    if (item.logisticsTransportIncluded) {
      const distanceKm =
        typeof item.logisticsTransportFreeDistanceKm === "number" &&
        Number.isFinite(item.logisticsTransportFreeDistanceKm) &&
        item.logisticsTransportFreeDistanceKm > 0
          ? Math.trunc(item.logisticsTransportFreeDistanceKm)
          : null;
      labels.push(
        distanceKm
          ? `${messages.results.freeTransportLabel} ${distanceKm} km`
          : messages.results.freeTransportLabel,
      );
    } else {
      labels.push(messages.results.transportAvailableLabel);
    }
  }

  if (item.logisticsUnloadingAvailable) {
    labels.push(
      item.logisticsUnloadingIncluded
        ? messages.results.freeUnloadingLabel
        : messages.results.unloadingAvailableLabel,
    );
  }

  return labels;
}

const ContainerListingResultCard = memo(function ContainerListingResultCard({
  locale,
  messages,
  item,
  darkBlueCtaClass,
  detailsHrefPrefix,
  detailsQueryString,
  isFavoritePending,
  onCopyListingLink,
  onOpenDetails,
  onToggleFavorite,
  priceDisplayCurrency,
  shouldPrefetchDetails,
  shouldPrioritizeImage,
}: ContainerListingResultCardProps) {
  const priceDisplay = getListingPriceDisplay(
    messages,
    locale,
    item,
    priceDisplayCurrency,
  );
  const expiresInLabel = getExpiresInLabel(
    messages,
    locale,
    item.expiresAt,
  );
  const availableFromLabel = getAvailableFromLabel(messages, locale, item);
  const fallbackTitle = getContainerShortLabelLocalized(messages, item.container);
  const logisticsSummaryLabels = getLogisticsSummaryLabels(messages, item);
  const logisticsComment = item.logisticsComment?.trim();
  const logisticsTooltipText =
    logisticsComment && logisticsComment.length > 0
      ? truncateTooltipText(logisticsComment)
      : messages.results.contactForDetails;
  const showLogisticsTooltip = logisticsSummaryLabels.length > 0;
  const detailsHref =
    detailsQueryString && detailsQueryString.length > 0
      ? `${detailsHrefPrefix}/${item.id}?${detailsQueryString}`
      : `${detailsHrefPrefix}/${item.id}`;
  const containerFeatureLabels = item.container.features
    .map((feature) => getContainerFeatureLabel(messages, feature))
    .filter((label) => typeof label === "string" && label.trim().length > 0);
  const containerMetaParts = [
    ...(typeof item.productionYear === "number" ? [String(item.productionYear)] : []),
    ...containerFeatureLabels,
  ];
  const containerColors = item.containerColors ?? [];

  return (
    <li className="w-full rounded-md border border-neutral-200 bg-white p-4 shadow-sm transition-colors duration-150 hover:border-sky-100 hover:bg-sky-50/60">
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative aspect-square w-full shrink-0 sm:w-44">
          <div className="absolute inset-0 overflow-hidden rounded-md border border-neutral-200 bg-neutral-100">
            <ContainerPhotoWithPlaceholder
              src={getContainerPreviewSrc(item)}
              alt=""
              fill
              className={
                item.photoUrls && item.photoUrls.length > 0
                  ? "object-cover"
                  : "object-contain p-1"
              }
              sizes="(max-width: 640px) 100vw, 176px"
              priority={shouldPrioritizeImage}
            />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start gap-3">
            <div className="w-0 flex-1">
              {item.companySlug ? (
                <span className="inline-flex min-w-0 items-center gap-1">
                  <Link
                    href={`/companies/${item.companySlug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block min-w-0 truncate text-xs uppercase tracking-wide text-sky-700 decoration-sky-400 underline underline-offset-2 hover:text-sky-800"
                    onClick={(event) => {
                      event.stopPropagation();
                    }}
                  >
                    {item.companyName}
                  </Link>
                  {item.companyIsVerified ? (
                    <span
                      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-emerald-300/80 bg-emerald-100/80 text-emerald-700"
                      aria-label={messages.results.verifiedCompany}
                      title={messages.results.verifiedCompany}
                    >
                      <svg
                        viewBox="0 0 20 20"
                        fill="none"
                        className="h-3 w-3"
                        aria-hidden="true"
                      >
                        <path
                          d="M5 10.5l3.2 3.2L15 7"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  ) : null}
                </span>
              ) : (
                <p className="truncate text-xs uppercase tracking-wide text-neutral-500">
                  {item.companyName}
                </p>
              )}
              <h3 className="mt-1 truncate text-xl font-semibold text-neutral-900">
                {fallbackTitle}
              </h3>
              <div className="mt-1 min-w-0">
                <LocationInfoBadge item={item} messages={messages} />
              </div>
              {containerMetaParts.length > 0 ? (
                <p
                  className="mt-1 w-full truncate text-xs text-neutral-500"
                  title={containerMetaParts.join(", ")}
                >
                  {containerMetaParts.join(", ")}
                </p>
              ) : null}
            </div>
            <div className="ml-auto grid shrink-0 justify-items-end gap-2 text-right">
              <div>
                <p
                  className={`max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-lg font-bold sm:text-xl ${
                    priceDisplay.isRequestPrice ? "text-neutral-700" : "text-amber-600"
                  }`}
                >
                  {priceDisplay.amountLabel}
                </p>
                {priceDisplay.metaLine ? (
                  <p className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-xs text-neutral-600">
                    {priceDisplay.metaLine}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {item.hasCscPlate ||
                item.hasCscCertification ||
                item.hasWarranty ||
                (typeof item.cscValidToMonth === "number" &&
                  typeof item.cscValidToYear === "number") ? (
                  <CscInfoBadge item={item} messages={messages} />
                ) : null}
                <span
                  className={`rounded-md border px-2 py-1 text-xs font-medium ${CONTAINER_CONDITION_COLOR_TOKENS[item.container.condition].badgeClassName}`}
                >
                  {getContainerConditionLabel(messages, item.container.condition)}
                </span>
              </div>
              <p className="text-right text-xs text-neutral-400">
                {messages.results.expiresLabel}: {expiresInLabel}
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
            <div
              className={`group relative flex flex-wrap items-center gap-x-1 gap-y-1 ${
                showLogisticsTooltip ? "cursor-help" : ""
              }`}
              {...(showLogisticsTooltip
                ? {
                    tabIndex: 0,
                    "aria-label": messages.results.logisticsCommentAria,
                  }
                : {})}
            >
              {logisticsSummaryLabels.map((label, index) => {
                const isFreeLabel =
                  label === messages.results.freeUnloadingLabel ||
                  label === messages.results.freeTransportLabel ||
                  label.startsWith(`${messages.results.freeTransportLabel} `);
                return (
                  <span
                    key={`${item.id}-${label}`}
                    className={isFreeLabel ? "font-medium text-neutral-700" : undefined}
                  >
                    {label}
                    {index < logisticsSummaryLabels.length - 1 ? "," : ""}
                  </span>
                );
              })}
              {showLogisticsTooltip ? (
                <div className="pointer-events-none absolute bottom-full left-0 z-30 mb-2 w-72 max-w-[85vw] translate-y-1 rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-2 text-left text-xs leading-5 text-neutral-100 opacity-0 shadow-xl transition duration-150 group-hover:delay-500 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:delay-500 group-focus-within:translate-y-0 group-focus-within:opacity-100">
                  <p className="mb-1 font-medium text-neutral-200">
                    {messages.results.sellerCommentLabel}
                  </p>
                  <p>{logisticsTooltipText}</p>
                  <span
                    aria-hidden="true"
                    className="absolute -bottom-1 left-3 h-2 w-2 rotate-45 border-b border-r border-neutral-700 bg-neutral-900"
                  />
                </div>
              ) : null}
            </div>
            <p className="ml-auto text-right text-sm text-neutral-700">
              {messages.results.availableFromLabel}:{" "}
              <span className="font-medium text-neutral-900">
                {availableFromLabel}
              </span>
            </p>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            {item.quantity > 1 || containerColors.length > 0 ? (
              <div className="flex flex-wrap items-center gap-3">
                {item.quantity > 1 ? (
                  <p className="text-sm text-neutral-700">
                    {messages.results.quantityLabel}: <span className="font-medium text-neutral-900">{item.quantity}</span>
                  </p>
                ) : null}
                <ContainerColorsInlineSummary
                  messages={messages}
                  colors={containerColors}
                  itemId={item.id}
                />
              </div>
            ) : (
              <span />
            )}
            <div className="ml-auto flex items-center justify-end gap-2">
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
                aria-label={item.isFavorite ? messages.results.removeFavorite : messages.results.addFavorite}
                title={item.isFavorite ? messages.results.removeFavorite : messages.results.addFavorite}
                disabled={isFavoritePending}
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
                aria-label={messages.results.copyLink}
                title={messages.results.copyLink}
              >
                <CopyLinkIcon className="h-4 w-4" />
              </button>
              <Link
                href={detailsHref}
                prefetch={shouldPrefetchDetails}
                scroll={false}
                onClick={(event: MouseEvent<HTMLAnchorElement>) => {
                  if (!onOpenDetails) {
                    return;
                  }
                  event.preventDefault();
                  onOpenDetails(detailsHref);
                }}
                className={`rounded-md px-3 py-2 text-sm font-medium ${darkBlueCtaClass}`}
              >
                {messages.results.detailsCta}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
});

function ContainerListingsResultsComponent({
  locale,
  messages,
  items,
  total,
  page,
  totalPages,
  showSummaryBar = true,
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
  onOpenDetails,
  detailsHrefPrefix = "/containers",
  detailsQueryString,
  priceDisplayCurrency,
  footerContent,
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
          {messages.results.previous}
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
          {messages.results.next}
        </button>
      </div>
    );
  };

  return (
    <section className="grid content-start gap-3">
      {showSummaryBar ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-neutral-300 bg-neutral-50/95 p-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-neutral-50/90">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-neutral-700">
              {messages.results.searchResultsLabel}: <span className="font-semibold">{total}</span>
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
                  {messages.results.allTab}
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
                  {messages.results.favoritesTab}
                </button>
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-4">
            {renderPaginationControls()}
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-md border border-neutral-300 bg-neutral-50/95 p-5 shadow-sm">
          <div className="flex items-center justify-center gap-3 text-neutral-700">
            <span
              className="h-7 w-7 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-500"
              aria-label={messages.results.loadingAria}
            />
            <span className="text-sm font-medium">{messages.results.loading}</span>
          </div>
        </div>
      ) : null}

      {!isLoading ? (
        <div className="rounded-md border border-neutral-300 bg-neutral-100/95 p-3 shadow-sm">
          {error ? <p className="text-sm text-neutral-700">{error}</p> : null}

          {items.length === 0 ? (
            <div className="flex min-h-[220px] items-center justify-center px-4 text-center">
              <div className="flex max-w-2xl flex-col items-center gap-4">
                <p className="text-xl font-medium text-neutral-500 sm:text-2xl">
                  <span className="block">
                    {messages.results.emptyTitle}
                  </span>
                  <span className="mt-1 block">
                    {messages.results.emptyText}
                  </span>
                </p>
                <Link
                  href="/containers/new?intent=buy"
                  className={`inline-flex h-10 items-center gap-2 rounded-md px-4 text-sm font-semibold ${darkBlueCtaClass}`}
                >
                  {messages.results.emptyCta}
                </Link>
              </div>
            </div>
          ) : null}

          {items.length > 0 ? (
            <>
              <ul className="w-full space-y-3">
                {items.map((item, index) => {
                  return (
                    <ContainerListingResultCard
                      key={item.id}
                      locale={locale}
                      messages={messages}
                      item={item}
                      darkBlueCtaClass={darkBlueCtaClass}
                      detailsHrefPrefix={detailsHrefPrefix}
                      detailsQueryString={detailsQueryString}
                      isFavoritePending={pendingFavoriteId === item.id}
                      onCopyListingLink={onCopyListingLink}
                      onOpenDetails={onOpenDetails}
                      onToggleFavorite={onToggleFavorite}
                      priceDisplayCurrency={priceDisplayCurrency}
                      shouldPrefetchDetails={page === 1 && index === 0}
                      shouldPrioritizeImage={page === 1 && index === 0}
                    />
                  );
                })}
              </ul>

              {renderPaginationControls("mt-4")}
              {footerContent ? <div className="mt-3">{footerContent}</div> : null}
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export const ContainerListingsResults = memo(ContainerListingsResultsComponent);
