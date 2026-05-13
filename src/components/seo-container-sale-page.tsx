import Link from "next/link";
import { ContainerPhotoWithPlaceholder } from "@/components/container-photo-with-placeholder";
import type { ContainerListingItem } from "@/lib/container-listings";
import {
  getContainerConditionLabel,
  getContainerFeatureLabel,
  getContainerShortLabelLocalized,
} from "@/components/container-listings-i18n";
import { CONTAINER_CONDITION_COLOR_TOKENS } from "@/components/container-listings-shared";
import { getContainerListingLocationLabel } from "@/components/container-listings-utils";
import {
  PRICE_CURRENCY_LABEL,
  type Currency,
} from "@/lib/container-listing-types";
import { getMessages, type AppLocale, withLocalePrefix } from "@/lib/i18n";
import {
  getContainerSaleSeoHubCopy,
  getContainerSeoIndexable,
} from "@/lib/seo-containers";

type SeoContainerSalePageProps = {
  locale: AppLocale;
  heading: string;
  lead: string;
  browseHref: string;
  items: ContainerListingItem[];
  total: number;
};

type SeoListingPriceDisplay = {
  amountLabel: string;
  metaLine: string;
  isRequestPrice: boolean;
};

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
  const firstPhotoUrl = item.photoUrls?.find((value) => value?.trim());
  return firstPhotoUrl ?? getContainerPlaceholderSrc(item);
}

function getAdditionalPhotoCount(item: ContainerListingItem): number {
  const photoCount =
    item.photoUrls?.filter((value) => value?.trim().length > 0).length ?? 0;
  return Math.max(0, photoCount - 1);
}

function getNormalizedAmountByCurrency(
  input: {
    amountPln: number | null;
    amountEur: number | null;
    amountUsd: number | null;
  },
  currency: Currency,
): number | null {
  if (currency === "PLN") {
    return input.amountPln;
  }
  if (currency === "EUR") {
    return input.amountEur;
  }
  return input.amountUsd;
}

function formatVatRateLabel(locale: AppLocale, vatRate: number | null): string | null {
  if (typeof vatRate !== "number" || !Number.isFinite(vatRate)) {
    return null;
  }
  return `VAT ${vatRate.toLocaleString(locale)}%`;
}

function getListingPriceDisplay(
  item: ContainerListingItem,
  locale: AppLocale,
  messages: ReturnType<typeof getMessages>["containerListings"],
): SeoListingPriceDisplay {
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
    const grossAmount = getNormalizedAmountByCurrency(
      pricing.normalized.gross,
      pricing.original.currency,
    );
    const amount =
      typeof grossAmount === "number" && Number.isFinite(grossAmount)
        ? grossAmount
        : pricing.original.amount;
    const metaParts = [messages.results.gross];
    const netAmount = getNormalizedAmountByCurrency(
      pricing.normalized.net,
      pricing.original.currency,
    );
    if (typeof netAmount === "number" && Number.isFinite(netAmount)) {
      metaParts.push(
        `${Math.round(netAmount).toLocaleString(locale)} ${
          PRICE_CURRENCY_LABEL[pricing.original.currency]
        } ${messages.results.net.toLowerCase()}`,
      );
    }
    const vatRateLabel = formatVatRateLabel(locale, pricing.original.vatRate);
    if (vatRateLabel) {
      metaParts.push(vatRateLabel);
    }
    if (pricing.original.negotiable === true || item.priceNegotiable === true) {
      metaParts.push(messages.results.negotiable);
    }
    return {
      amountLabel: `${Math.round(amount).toLocaleString(locale)} ${
        PRICE_CURRENCY_LABEL[pricing.original.currency]
      }`,
      metaLine: metaParts.join(" | "),
      isRequestPrice: false,
    };
  }

  if (typeof item.priceAmount === "number" && Number.isFinite(item.priceAmount)) {
    const metaParts = [
      `${Math.round(item.priceAmount).toLocaleString(locale)} PLN ${messages.results.net.toLowerCase()}`,
      "VAT 23%",
    ];
    if (item.priceNegotiable === true) {
      metaParts.push(messages.results.negotiable);
    }
    return {
      amountLabel: `${Math.round(item.priceAmount * 1.23).toLocaleString(locale)} PLN`,
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

function getAvailableFromLabel(
  item: ContainerListingItem,
  locale: AppLocale,
  messages: ReturnType<typeof getMessages>["containerListings"],
): string {
  if (item.availableNow) {
    return messages.results.availableNow;
  }
  const date = item.availableFrom ? new Date(item.availableFrom) : null;
  if (!date || !Number.isFinite(date.getTime())) {
    return messages.results.unknown;
  }
  return date.toLocaleDateString(locale);
}

function getLogisticsSummaryLabels(
  item: ContainerListingItem,
  messages: ReturnType<typeof getMessages>["containerListings"],
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

export function SeoContainerSalePage({
  locale,
  heading,
  lead,
  browseHref,
  items,
  total,
}: SeoContainerSalePageProps) {
  const copy = getContainerSaleSeoHubCopy(locale);
  const listingMessages = getMessages(locale).containerListings;
  const isIndexable = getContainerSeoIndexable(total);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6">
      <section className="rounded-md border border-neutral-300 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-semibold text-neutral-900">{heading}</h1>
            <p className="mt-3 text-base leading-7 text-neutral-700">{lead}</p>
            <p className="mt-3 text-sm font-medium text-neutral-500">{copy.totalLabel(total)}</p>
            {!isIndexable ? (
              <p className="mt-2 text-sm text-neutral-500">{copy.noIndexReason}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={browseHref}
              className="inline-flex h-11 items-center justify-center rounded-md border border-[#1d5ea8] bg-[#103b74] px-4 text-sm font-semibold text-white transition hover:border-[#2f76c7] hover:bg-[#16498d]"
            >
              {copy.browseList}
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">{copy.latestHeading}</h2>
        </div>
        {items.length > 0 ? (
          <ul className="grid gap-3">
            {items.map((item) => {
              const title = getContainerShortLabelLocalized(
                listingMessages,
                item.container,
              );
              const priceDisplay = getListingPriceDisplay(item, locale, listingMessages);
              const additionalPhotoCount = getAdditionalPhotoCount(item);
              const containerFeatureLabels = item.container.features
                .map((feature) => getContainerFeatureLabel(listingMessages, feature))
                .filter((label) => label.trim().length > 0);
              const containerMetaParts = [
                ...(typeof item.productionYear === "number"
                  ? [String(item.productionYear)]
                  : []),
                ...containerFeatureLabels,
              ];
              const logisticsSummaryLabels = getLogisticsSummaryLabels(
                item,
                listingMessages,
              );
              const detailsHref = withLocalePrefix(`/containers/${item.id}`, locale);

              return (
                <li
                  key={item.id}
                  className="w-full rounded-md border border-neutral-200 bg-white p-1.5 shadow-sm transition-colors duration-150 hover:border-sky-100 hover:bg-sky-50/60 sm:p-4"
                >
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
                        />
                        {additionalPhotoCount > 0 ? (
                          <span
                            className="absolute bottom-1.5 right-1.5 inline-flex h-6 min-w-8 items-center justify-center gap-1 rounded-md border border-neutral-300 bg-white/95 px-1.5 text-[11px] font-semibold text-neutral-900 shadow-sm backdrop-blur"
                            aria-label={`+${additionalPhotoCount}`}
                            title={`+${additionalPhotoCount}`}
                          >
                            +{additionalPhotoCount}
                          </span>
                        ) : null}
                      </div>
                      <span
                        className={`-mt-px inline-flex w-full items-center justify-center rounded-b-md border px-2 py-1 text-[10px] font-medium sm:hidden ${CONTAINER_CONDITION_COLOR_TOKENS[item.container.condition].badgeClassName}`}
                      >
                        {getContainerConditionLabel(
                          listingMessages,
                          item.container.condition,
                        )}
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
                              >
                                {item.companyName}
                              </Link>
                              {item.companyIsVerified ? (
                                <span
                                  className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-emerald-300/80 bg-emerald-100/80 text-emerald-700"
                                  aria-label={listingMessages.results.verifiedCompany}
                                  title={listingMessages.results.verifiedCompany}
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
                            {title}
                          </h3>
                          <p className="mt-1 truncate text-sm text-neutral-600">
                            {getContainerListingLocationLabel(
                              item,
                              listingMessages.utils,
                              locale,
                            )}
                          </p>
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
                                priceDisplay.isRequestPrice
                                  ? "text-neutral-700"
                                  : "text-amber-600"
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
                            <span
                              className={`rounded-md border px-2 py-1 text-xs font-medium ${CONTAINER_CONDITION_COLOR_TOKENS[item.container.condition].badgeClassName}`}
                            >
                              {getContainerConditionLabel(
                                listingMessages,
                                item.container.condition,
                              )}
                            </span>
                          </div>
                          <p className="hidden text-right text-xs text-neutral-400 sm:block">
                            {copy.addedLabel}:{" "}
                            {new Date(item.createdAt).toLocaleDateString(locale)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-2 flex items-center gap-2 overflow-hidden text-[12px] text-neutral-500 sm:mt-3 sm:flex-wrap sm:overflow-visible sm:text-xs">
                        {logisticsSummaryLabels.length > 0 ? (
                          <p className="min-w-0 truncate text-neutral-600">
                            {logisticsSummaryLabels.join(", ")}
                          </p>
                        ) : null}
                        <p className="ml-auto hidden text-right text-sm text-neutral-700 sm:block">
                          {listingMessages.results.availableFromLabel}:{" "}
                          <span className="font-medium text-neutral-900">
                            {getAvailableFromLabel(item, locale, listingMessages)}
                          </span>
                        </p>
                      </div>

                      <div className="mt-auto flex flex-col gap-2 pt-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                        <p className="text-[12px] text-neutral-700 sm:text-sm">
                          {copy.quantityLabel}:{" "}
                          <span className="font-medium text-neutral-900">
                            {item.quantity}
                          </span>
                        </p>
                        <p className="min-h-[3.2rem] text-center sm:hidden">
                          <span
                            className={`text-[17px] font-semibold ${
                              priceDisplay.isRequestPrice
                                ? "text-neutral-700"
                                : "text-amber-600"
                            }`}
                          >
                            {priceDisplay.amountLabel}
                          </span>
                          {priceDisplay.metaLine ? (
                            <span className="mt-0.5 block text-[14px] font-medium leading-tight text-neutral-700">
                              {priceDisplay.metaLine}
                            </span>
                          ) : null}
                        </p>
                        <div className="ml-auto flex w-full items-center justify-end gap-2 sm:w-auto">
                          <Link
                            href={detailsHref}
                            className="inline-flex w-full items-center justify-center rounded-md border border-[#1d5ea8] bg-[#103b74] px-2.5 py-1.5 text-[12px] font-medium text-white transition hover:border-[#2f76c7] hover:bg-[#16498d] sm:w-auto sm:px-3 sm:py-2 sm:text-sm"
                          >
                            {listingMessages.results.detailsCta}
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="rounded-md border border-dashed border-neutral-300 bg-white p-8 text-center">
            <p className="text-lg font-semibold text-neutral-900">{copy.emptyTitle}</p>
            <p className="mt-2 text-sm leading-6 text-neutral-600">{copy.emptyText}</p>
            <div className="mt-4">
              <Link
                href={browseHref}
                className="inline-flex h-11 items-center justify-center rounded-md border border-neutral-300 bg-neutral-100 px-4 text-sm font-medium text-neutral-800 transition hover:bg-neutral-200"
              >
                {copy.browseList}
              </Link>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
