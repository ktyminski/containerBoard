import { type ReactNode, type RefObject } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import NextImage from "next/image";
import Link from "next/link";
import { withLang, type AppLocale, type AppMessages } from "@/lib/i18n";
import { type CompanyMapItem } from "@/types/company";
import { COMPANY_VERIFICATION_STATUS } from "@/lib/company-verification";
import type { OfferMapItem } from "@/components/unified-main-map/types";
import {
  formatCompanySummary,
  getCompanyFallbackColor,
  getCompanyInitial,
  getOfferTypeLabel,
  toShortLocationLabel,
} from "@/components/unified-main-map/utils";

const LIST_OVERSCAN = 10;
const LIST_ITEM_GAP_PX = 8;

type VirtualizedListProps<T> = {
  items: T[];
  getItemKey: (item: T) => string;
  estimateSize: number;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  className: string;
  renderItem: (item: T) => ReactNode;
};

function VirtualizedList<T>({
  items,
  getItemKey,
  estimateSize,
  scrollContainerRef,
  className,
  renderItem,
}: VirtualizedListProps<T>) {
  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => estimateSize,
    overscan: LIST_OVERSCAN,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  return (
    <ul className={className} style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
      {virtualItems.map((virtualItem) => {
        const item = items[virtualItem.index];
        return (
          <li
            key={getItemKey(item)}
            className="absolute left-0 top-0 w-full"
            style={{ transform: `translateY(${virtualItem.start}px)` }}
          >
            <div
              data-index={virtualItem.index}
              ref={rowVirtualizer.measureElement}
              style={{ paddingBottom: LIST_ITEM_GAP_PX }}
            >
              {renderItem(item)}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

type OffersListProps = {
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  locale: AppLocale;
  messages: AppMessages["mapModules"]["offers"];
  showOnMapLabel: string;
  items: OfferMapItem[];
  isLoading: boolean;
  hasLoaded: boolean;
  error: string | null;
  onFocusMap: (item: OfferMapItem) => void;
};

export function OffersList({
  scrollContainerRef,
  locale,
  messages,
  showOnMapLabel,
  items,
  isLoading,
  hasLoaded,
  error,
  onFocusMap,
}: OffersListProps) {
  return (
    <>
      {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
      {items.length === 0 && hasLoaded && !isLoading ? (
        <p className="mt-3 text-sm text-neutral-400">{messages.empty}</p>
      ) : null}
      <VirtualizedList
        items={items}
        getItemKey={(item) => item.id}
        estimateSize={116}
        scrollContainerRef={scrollContainerRef}
        className="pr-2 text-sm"
        renderItem={(item) => (
          <div
            role="button"
            tabIndex={0}
            className={`w-full cursor-pointer rounded-md border px-3 py-2 text-left transition ${
              item.companyIsPremium
                ? "border-neutral-800 bg-neutral-950 bg-gradient-to-r from-emerald-900/35 via-emerald-900/12 to-transparent hover:border-emerald-300/75"
                : "border-neutral-800 bg-neutral-950 hover:border-sky-300/60"
            }`}
            onClick={() => {
              onFocusMap(item);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onFocusMap(item);
              }
            }}
          >
            <div className="flex min-h-[5.25rem] items-center gap-3">
              <div
                className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-md border bg-neutral-900 ${
                  item.companyIsPremium
                    ? "border-neutral-800 shadow-[0_0_10px_rgba(52,211,153,0.30)]"
                    : "border-neutral-800"
                }`}
              >
                {item.companyLogoUrl ? (
                  <NextImage
                    src={item.companyLogoUrl}
                    alt={item.companyName}
                    fill
                    sizes="64px"
                    className="object-contain"
                  />
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center text-sm font-semibold text-white"
                    style={{
                      backgroundColor: getCompanyFallbackColor(
                        item.companySlug || item.companyName,
                      ),
                    }}
                  >
                    {getCompanyInitial(item.companyName)}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <p
                    className={`min-w-0 flex-1 truncate font-medium ${
                      item.companyIsPremium ? "text-emerald-100" : "text-neutral-100"
                    }`}
                  >
                    {item.title}
                  </p>
                  <span className="order-2 basis-full sm:basis-auto">
                    <span className="inline-flex shrink-0 items-center rounded-md border border-sky-500/60 bg-cyan-500/15 px-2 py-0.5 text-[11px] font-semibold text-cyan-200">
                      {getOfferTypeLabel(item.offerType, messages)}
                    </span>
                  </span>
                </div>
                <p
                  className={`truncate text-xs ${
                    item.companyIsPremium ? "text-emerald-200/80" : "text-neutral-400"
                  }`}
                >
                  {item.companyName}
                </p>
                <p className="truncate text-xs text-neutral-300">
                  {toShortLocationLabel({
                    locationLabel: item.locationLabel,
                    locationCity: item.locationCity,
                    locationCountry: item.locationCountry,
                  })}
                </p>
                <div className="mt-1 flex items-center gap-3 text-xs font-medium">
                  <Link
                    href={withLang(`/offers/${item.id}`, locale)}
                    className={`transition ${
                      item.companyIsPremium
                        ? "text-emerald-200/90 hover:text-emerald-100"
                        : "text-neutral-400 hover:text-sky-300"
                    }`}
                    onClick={(event) => {
                      event.stopPropagation();
                    }}
                    onKeyDown={(event) => {
                      event.stopPropagation();
                    }}
                  >
                    {messages.openOffer}
                  </Link>
                  <Link
                    href={withLang(`/companies/${item.companySlug}`, locale)}
                    className={`transition ${
                      item.companyIsPremium
                        ? "text-emerald-200/90 hover:text-emerald-100"
                        : "text-neutral-400 hover:text-sky-300"
                    }`}
                    onClick={(event) => {
                      event.stopPropagation();
                    }}
                    onKeyDown={(event) => {
                      event.stopPropagation();
                    }}
                  >
                    {messages.openCompany}
                  </Link>
                  <button
                    type="button"
                    className={`transition ${
                      item.companyIsPremium
                        ? "text-emerald-200/90 hover:text-emerald-100"
                        : "text-neutral-400 hover:text-sky-300"
                    }`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onFocusMap(item);
                    }}
                  >
                    {showOnMapLabel}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      />
    </>
  );
}

type CompaniesListProps = {
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  locale: AppLocale;
  messages: AppMessages["mapModules"]["companiesList"];
  mapMessages: AppMessages["map"];
  companyCreateMessages: AppMessages["companyCreate"];
  operatingAreaLabels: AppMessages["mapModules"]["filters"]["operatingAreas"];
  verifiedLabel: AppMessages["companyStatus"]["verified"];
  showOnMapLabel: string;
  items: CompanyMapItem[];
  isLoading: boolean;
  hasLoaded: boolean;
  error: string | null;
  onFocusMap: (item: CompanyMapItem) => void;
};

export function CompaniesList({
  scrollContainerRef,
  locale,
  messages,
  mapMessages,
  companyCreateMessages,
  operatingAreaLabels,
  verifiedLabel,
  showOnMapLabel,
  items,
  isLoading,
  hasLoaded,
  error,
  onFocusMap,
}: CompaniesListProps) {
  return (
    <>
      {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
      {items.length === 0 && hasLoaded && !isLoading ? (
        <p className="mt-3 text-sm text-neutral-400">{messages.empty}</p>
      ) : null}
      <VirtualizedList
        items={items}
        getItemKey={(company) => company.id}
        estimateSize={112}
        scrollContainerRef={scrollContainerRef}
        className="mt-1 pr-2 text-sm"
        renderItem={(company) => (
          <div
            role="button"
            tabIndex={0}
            className="w-full cursor-pointer rounded-md border border-sky-200 bg-gradient-to-r from-sky-50 via-blue-50 to-sky-100/75 px-3 py-2 text-left transition hover:border-sky-300 hover:from-sky-100 hover:via-blue-50 hover:to-sky-100"
            onClick={() => {
              onFocusMap(company);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onFocusMap(company);
              }
            }}
          >
            <div className="flex min-h-[5.25rem] items-center gap-3">
              <div
                className={`relative h-16 w-16 shrink-0 rounded-md border bg-white ${
                  company.isPremium
                    ? "overflow-visible border-sky-200 shadow-[0_0_14px_rgba(244,114,182,0.22)]"
                    : "overflow-hidden border-sky-200"
                }`}
              >
                <div className="relative h-full w-full overflow-hidden rounded-[inherit]">
                  {company.logoUrl ? (
                    <NextImage
                      src={company.logoUrl}
                      alt={company.name}
                      fill
                      sizes="64px"
                      className="object-contain"
                    />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center text-sm font-semibold text-white"
                      style={{ backgroundColor: getCompanyFallbackColor(company.id) }}
                    >
                      {getCompanyInitial(company.name)}
                    </div>
                  )}
                </div>
                {company.isPremium ? (
                  <span className="absolute left-0 top-0 z-10 inline-flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-amber-300/80 bg-white/95 text-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.30)]">
                    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" aria-hidden="true">
                      <path
                        d="M10 2.9l2.15 4.35 4.8.7-3.47 3.38.82 4.78L10 13.95 5.7 16.1l.82-4.78L3.05 7.95l4.8-.7L10 2.9Z"
                        fill="currentColor"
                      />
                    </svg>
                  </span>
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="min-w-0">
                  <span className="inline-flex max-w-full items-center gap-1.5">
                    <span className="truncate font-medium text-neutral-900">
                      {company.name}
                    </span>
                    {company.verificationStatus === COMPANY_VERIFICATION_STATUS.VERIFIED ? (
                      <span
                        className="inline-flex h-5 w-5 shrink-0 items-center justify-center text-sky-600"
                        aria-label={verifiedLabel}
                        title={verifiedLabel}
                      >
                        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
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
                </div>
                {company.locationCity ? (
                  <p className="truncate text-xs text-neutral-600">
                    <strong className="font-semibold text-neutral-700">{company.locationCity}</strong>
                  </p>
                ) : null}
                <p className="mt-1 truncate text-xs text-neutral-500">
                  {formatCompanySummary(
                    company,
                    mapMessages,
                    operatingAreaLabels,
                    companyCreateMessages.specializationsOptions,
                  )}
                </p>
                <div className="mt-1 flex items-center gap-3 text-xs font-medium">
                  <Link
                    href={withLang(`/companies/${company.slug}`, locale)}
                    className="text-neutral-500 transition hover:text-sky-600"
                    onClick={(event) => {
                      event.stopPropagation();
                    }}
                    onKeyDown={(event) => {
                      event.stopPropagation();
                    }}
                  >
                    {mapMessages.openCompanyShort}
                  </Link>
                  <button
                    type="button"
                    className="text-neutral-500 transition hover:text-sky-600"
                    onClick={(event) => {
                      event.stopPropagation();
                      onFocusMap(company);
                    }}
                  >
                    {showOnMapLabel}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      />
    </>
  );
}


