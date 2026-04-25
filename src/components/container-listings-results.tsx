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
  getCountryDisplayName,
  resolveCountryCodeFromInput,
  resolveCountryCodeFromInputApprox,
} from "@/lib/country-flags";
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
  administrativeLocationFilter?: {
    city?: string;
    country?: string;
    countryCode?: string;
  };
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
  administrativeLocationFilter?: {
    city?: string;
    country?: string;
    countryCode?: string;
  };
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;
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
  locale: AppLocale,
  messages: ContainerListingsMessages,
  input: {
  locationAddressParts?: {
    postalCode?: string;
    city?: string;
    country?: string;
  };
  locationCity?: string;
  locationCountry?: string;
  locationCountryCode?: string;
},
): string {
  const postalCode = input.locationAddressParts?.postalCode?.trim() || "";
  const city =
    input.locationAddressParts?.city?.trim() ||
    input.locationCity?.trim() ||
    "";
  const rawCountry =
    input.locationAddressParts?.country?.trim() ||
    input.locationCountry?.trim() ||
    "";
  const country = getCountryDisplayName(
    input.locationCountryCode?.trim(),
    locale,
    rawCountry,
  );
  const combined = [postalCode, [city, country].filter(Boolean).join(", ")]
    .filter(Boolean)
    .join(" ");
  return combined || messages.utils.noLocation;
}

function getMatchingListingLocation(
  item: ContainerListingItem,
  administrativeLocationFilter?: {
    city?: string;
    country?: string;
    countryCode?: string;
  },
) {
  const normalizedCity = administrativeLocationFilter?.city?.trim().toLowerCase() ?? "";
  const normalizedCountry = administrativeLocationFilter?.country?.trim().toLowerCase() ?? "";
  const normalizedCountryCode =
    administrativeLocationFilter?.countryCode?.trim().toUpperCase() ?? "";
  const hasAdministrativeLocationFilter =
    normalizedCity.length > 0 ||
    normalizedCountry.length > 0 ||
    normalizedCountryCode.length > 0;
  const getEffectiveCountryCode = (location: {
    locationCountry?: string;
    locationCountryCode?: string;
    locationAddressParts?: {
      country?: string;
    };
  }) => {
    const countryName =
      location.locationAddressParts?.country?.trim() ||
      location.locationCountry?.trim() ||
      "";
    const resolvedFromCountry =
      resolveCountryCodeFromInput(countryName) ??
      resolveCountryCodeFromInputApprox(countryName) ??
      "";
    if (resolvedFromCountry) {
      return resolvedFromCountry.toUpperCase();
    }
    return location.locationCountryCode?.trim().toUpperCase() ?? "";
  };

  const locations =
    Array.isArray(item.locations) && item.locations.length > 0
      ? item.locations
      : [
          {
            locationAddressParts: item.locationAddressParts,
            locationCity: item.locationCity,
            locationCountry: item.locationCountry,
            locationCountryCode: item.locationCountryCode,
            isPrimary: true,
          },
        ];

  if (!hasAdministrativeLocationFilter) {
    return locations.find((location) => location.isPrimary) ?? locations[0] ?? null;
  }

  const matches = locations.find((location) => {
    const locationCity =
      location.locationAddressParts?.city?.trim().toLowerCase() ||
      location.locationCity?.trim().toLowerCase() ||
      "";
    const locationCountry =
      location.locationAddressParts?.country?.trim().toLowerCase() ||
      location.locationCountry?.trim().toLowerCase() ||
      "";
    const locationCountryCode = getEffectiveCountryCode(location);

    if (normalizedCity && locationCity !== normalizedCity) {
      return false;
    }

    if (normalizedCountryCode) {
      return locationCountryCode === normalizedCountryCode;
    }

    if (normalizedCountry) {
      return locationCountry === normalizedCountry;
    }

    return true;
  });

  return matches ?? locations.find((location) => location.isPrimary) ?? locations[0] ?? null;
}

function getAllLocationLabels(
  locale: AppLocale,
  messages: ContainerListingsMessages,
  item: ContainerListingItem,
  administrativeLocationFilter?: {
    city?: string;
    country?: string;
    countryCode?: string;
  },
): string[] {
  const labels: string[] = [];
  const seen = new Set<string>();
  const preferredLocation = getMatchingListingLocation(item, administrativeLocationFilter);
  const sourceLocations =
    Array.isArray(item.locations) && item.locations.length > 0
      ? item.locations
      : [
          {
            locationAddressParts: item.locationAddressParts,
            locationCity: item.locationCity,
            locationCountry: item.locationCountry,
            locationCountryCode: item.locationCountryCode,
            isPrimary: true,
          },
        ];
  const orderedLocations = preferredLocation
    ? [
        preferredLocation,
        ...sourceLocations.filter((location) => location !== preferredLocation),
      ]
    : sourceLocations;

  const appendLabel = (label: string) => {
    const normalizedKey = label.toLowerCase();
    if (seen.has(normalizedKey)) {
      return;
    }
    seen.add(normalizedKey);
    labels.push(label);
  };

  if (orderedLocations.length > 0) {
    for (const location of orderedLocations) {
      appendLabel(
        getLocationLabel(locale, messages, {
          locationAddressParts: location.locationAddressParts,
          locationCity: location.locationCity,
          locationCountry: location.locationCountry,
          locationCountryCode: location.locationCountryCode,
        }),
      );
    }
  } else {
    appendLabel(
      getLocationLabel(locale, messages, {
        locationAddressParts: item.locationAddressParts,
        locationCity: item.locationCity,
        locationCountry: item.locationCountry,
        locationCountryCode: item.locationCountryCode,
      }),
    );
  }

  return labels.length > 0 ? labels : [messages.utils.noLocation];
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
  locale,
  item,
  messages,
  administrativeLocationFilter,
}: {
  locale: AppLocale;
  item: ContainerListingItem;
  messages: ContainerListingsMessages;
  administrativeLocationFilter?: {
    city?: string;
    country?: string;
    countryCode?: string;
  };
}) {
  const preferredLocation = getMatchingListingLocation(item, administrativeLocationFilter);
  const locationLabel = preferredLocation
    ? getLocationLabel(locale, messages, {
        locationAddressParts: preferredLocation.locationAddressParts,
        locationCity: preferredLocation.locationCity,
        locationCountry: preferredLocation.locationCountry,
        locationCountryCode: preferredLocation.locationCountryCode,
      })
    : getContainerListingLocationLabel(item, messages.utils, locale);
  const allLocationLabels = getAllLocationLabels(
    locale,
    messages,
    item,
    administrativeLocationFilter,
  );
  const extraLocationsCount = Math.max(0, allLocationLabels.length - 1);
  const showTooltip = allLocationLabels.length > 1;
  const locationSummaryLabel =
    extraLocationsCount > 0
      ? `${locationLabel} ${messages.utils.otherLocationsTemplate.replace(
          "{count}",
          String(extraLocationsCount),
        )}`
      : locationLabel;

  return (
    <div
      className={`flex w-full min-w-0 items-center gap-1.5 text-[10px] sm:text-sm sm:text-neutral-600 ${
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
        className="hidden h-4 w-4 shrink-0 text-neutral-500 sm:block"
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
        className={`min-w-0 flex-1 min-h-[2.4em] line-clamp-2 text-[13px] font-semibold leading-[1.2] text-emerald-800 sm:min-h-0 sm:truncate sm:text-sm sm:font-normal sm:leading-normal sm:text-neutral-600 ${
          showTooltip ? "cursor-help" : ""
        }`}
      >
        {locationSummaryLabel}
      </span>
      {showTooltip ? (
        <div className="pointer-events-none absolute bottom-full left-0 z-30 mb-2 hidden w-72 max-w-[85vw] translate-y-1 rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-2 text-left text-xs leading-5 text-neutral-100 opacity-0 shadow-xl transition duration-150 group-hover:delay-500 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:delay-500 group-focus-within:translate-y-0 group-focus-within:opacity-100 sm:block">
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

function getTransportSummaryLabel(
  messages: ContainerListingsMessages,
  item: ContainerListingItem,
): string {
  if (!item.logisticsTransportAvailable) {
    return messages.results.noTransportLabel;
  }

  if (item.logisticsTransportIncluded) {
    return messages.results.freeTransportLabel;
  }

  return messages.results.transportAvailableLabel;
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
  administrativeLocationFilter,
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
  const transportSummaryLabel = getTransportSummaryLabel(messages, item);
  const shouldShowTransportSummaryOnDesktop = item.logisticsTransportAvailable;
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
  const compactPriceMetaLine = priceDisplay.metaLine
    .split(" | ")
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && part !== messages.results.negotiable)
    .join(" | ");

  return (
    <li className="w-full rounded-md border border-neutral-200 bg-white p-1.5 shadow-sm transition-colors duration-150 hover:border-sky-100 hover:bg-sky-50/60 sm:p-4">
      <div className="flex h-full flex-col gap-2 sm:flex-row sm:gap-4">
        <div className="w-full shrink-0 sm:w-44">
          <div className="relative aspect-square overflow-hidden rounded-t-md border border-neutral-200 border-b-0 bg-neutral-100 sm:rounded-md sm:border-b">
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
          <span
            className={`-mt-px inline-flex w-full items-center justify-center rounded-b-md border px-2 py-1 text-[10px] font-medium sm:hidden ${CONTAINER_CONDITION_COLOR_TOKENS[item.container.condition].badgeClassName}`}
          >
            {getContainerConditionLabel(messages, item.container.condition)}
          </span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
            <div className="min-w-0 sm:w-0 sm:flex-1">
              {item.companySlug ? (
                <div className="flex min-w-0 items-center gap-1">
                  <Link
                    href={`/companies/${item.companySlug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block min-w-0 truncate text-[11px] uppercase leading-[1.15] tracking-[0.08em] text-sky-700 decoration-sky-400 underline underline-offset-2 hover:text-sky-800 sm:text-xs"
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
                </div>
              ) : (
                <p className="truncate text-[11px] uppercase leading-[1.15] tracking-[0.08em] text-neutral-500 sm:text-xs">
                  {item.companyName}
                </p>
              )}
              <h3 className="mt-1 truncate text-[17px] font-semibold leading-tight text-neutral-900 sm:text-xl">
                {fallbackTitle}
              </h3>
              <div className="mt-1 min-w-0">
                <LocationInfoBadge
                  locale={locale}
                  item={item}
                  messages={messages}
                  administrativeLocationFilter={administrativeLocationFilter}
                />
              </div>
              {containerMetaParts.length > 0 ? (
                <p
                  className="mt-1 w-full truncate text-[12px] text-neutral-500 sm:text-xs"
                  title={containerMetaParts.join(", ")}
                >
                  {containerMetaParts.join(", ")}
                </p>
              ) : null}
            </div>
            <div className="hidden w-full justify-items-start gap-1.5 text-left sm:ml-auto sm:grid sm:w-auto sm:shrink-0 sm:justify-items-end sm:gap-2 sm:text-right">
              <div>
                <p
                  className={`max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm font-bold sm:text-xl ${
                    priceDisplay.isRequestPrice ? "text-neutral-700" : "text-amber-600"
                  }`}
                >
                  {priceDisplay.amountLabel}
                </p>
                {priceDisplay.metaLine ? (
                  <p className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[10px] text-neutral-600 sm:text-xs">
                    {priceDisplay.metaLine}
                  </p>
                ) : null}
              </div>
              <div className="hidden flex-wrap items-center justify-end gap-2 sm:flex">
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
              <p className="hidden text-right text-xs text-neutral-400 sm:block">
                {messages.results.expiresLabel}: {expiresInLabel}
              </p>
            </div>
          </div>

          <div className="mt-2 flex items-center gap-2 overflow-hidden text-[12px] text-neutral-500 sm:mt-3 sm:flex-wrap sm:overflow-visible sm:text-xs">
            <p
              className={`min-w-0 truncate text-neutral-600 ${
                shouldShowTransportSummaryOnDesktop ? "sm:block" : "sm:hidden"
              }`}
            >
              {transportSummaryLabel}
            </p>
            <p className="ml-auto hidden text-right text-sm text-neutral-700 sm:block">
              {messages.results.availableFromLabel}:{" "}
              <span className="font-medium text-neutral-900">
                {availableFromLabel}
              </span>
            </p>
          </div>

          <div className="mt-auto pt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-[12px] text-neutral-700 sm:text-sm">
                {messages.results.quantityLabel}: <span className="font-medium text-neutral-900">{item.quantity}</span>
              </p>
            </div>
            <p className="min-h-[3.2rem] text-center sm:hidden">
              <span
                className={`text-[17px] font-semibold ${
                  priceDisplay.isRequestPrice ? "text-neutral-700" : "text-amber-600"
                }`}
              >
                {priceDisplay.amountLabel}
              </span>
              {compactPriceMetaLine ? (
                <span className="mt-0.5 block text-[14px] font-medium leading-tight text-neutral-700">
                  {compactPriceMetaLine}
                </span>
              ) : null}
            </p>
            <div className="ml-auto flex w-full items-center justify-end gap-2 sm:w-auto">
              <button
                type="button"
                className={`hidden rounded-md border p-2 transition-colors sm:inline-flex ${
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
                className="hidden rounded-md border border-neutral-300 bg-white p-2 text-neutral-600 transition-colors hover:border-neutral-400 hover:bg-neutral-100 hover:text-neutral-800 sm:inline-flex"
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
                className={`inline-flex w-full items-center justify-center rounded-md px-2.5 py-1.5 text-[12px] font-medium sm:w-auto sm:px-3 sm:py-2 sm:text-sm ${darkBlueCtaClass}`}
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
  administrativeLocationFilter,
}: ContainerListingsResultsProps) {
  const renderPaginationControls = (
    extraClassName?: string,
    variant: "plain" | "card" = "card",
  ) => {
    if (totalPages <= 1) {
      return null;
    }

    const className = [
      variant === "card"
        ? "flex max-w-full flex-wrap items-center justify-end gap-2 rounded-md border border-neutral-200 bg-neutral-50/95 px-2 py-2 shadow-sm sm:rounded-none sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:shadow-none"
        : "flex max-w-full flex-wrap items-center justify-end gap-2",
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
          className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-[12px] text-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 sm:px-3 sm:text-sm"
        >
          {messages.results.previous}
        </button>
        <span className="text-[12px] text-neutral-500 sm:text-xs">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={onNextPage}
          className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-[12px] text-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 sm:px-3 sm:text-sm"
        >
          {messages.results.next}
        </button>
      </div>
    );
  };

  return (
    <section className="grid content-start gap-3">
      {showSummaryBar && !isLoading ? (
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
          <div className="flex min-w-0 max-w-full flex-wrap items-center justify-end gap-4">
            {renderPaginationControls(undefined, "plain")}
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
        <div className="sm:rounded-md sm:border sm:border-neutral-300 sm:bg-neutral-100/95 sm:p-3 sm:shadow-sm">
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
              <ul className="grid w-full grid-cols-2 gap-2 sm:grid-cols-1 sm:gap-3">
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
                      administrativeLocationFilter={administrativeLocationFilter}
                    />
                  );
                })}
              </ul>

              {renderPaginationControls("mt-4 px-1.5 sm:px-0")}
              {footerContent ? <div className="mt-3 px-1.5 sm:px-0">{footerContent}</div> : null}
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export const ContainerListingsResults = memo(ContainerListingsResultsComponent);
