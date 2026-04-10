import { type ReactNode, type RefObject } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import NextImage from "next/image";
import Link from "next/link";
import { withLang, formatTemplate, type AppLocale, type AppMessages } from "@/lib/i18n";
import { type CompanyMapItem } from "@/types/company";
import { COMPANY_VERIFICATION_STATUS } from "@/lib/company-verification";
import type {
  JobAnnouncementMapItem,
  OfferMapItem,
} from "@/components/unified-main-map/types";
import {
  categoryToLabel,
  formatCompanySummary,
  formatSalaryRange,
  getCompanyFallbackColor,
  getCompanyInitial,
  getOfferTypeLabel,
  hasSalaryRange,
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

type AnnouncementsListProps = {
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  locale: AppLocale;
  messages: AppMessages["mapModules"]["announcements"];
  showOnMapLabel: string;
  items: JobAnnouncementMapItem[];
  isLoading: boolean;
  hasLoaded: boolean;
  error: string | null;
  pendingFavoriteId: string | null;
  onToggleFavorite: (announcementId: string, isFavorite: boolean) => void;
  onFocusMap: (item: JobAnnouncementMapItem) => void;
};

export function AnnouncementsList({
  scrollContainerRef,
  locale,
  messages,
  showOnMapLabel,
  items,
  isLoading,
  hasLoaded,
  error,
  pendingFavoriteId,
  onToggleFavorite,
  onFocusMap,
}: AnnouncementsListProps) {
  return (
    <>
      {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
      {items.length === 0 && hasLoaded && !isLoading ? (
        <p className="mt-3 text-sm text-slate-400">{messages.empty}</p>
      ) : null}
      <VirtualizedList
        items={items}
        getItemKey={(item) => item.id}
        estimateSize={122}
        scrollContainerRef={scrollContainerRef}
        className="pr-2 text-sm"
        renderItem={(item) => {
          const showSalary = hasSalaryRange({
            salaryFrom: item.salaryFrom,
            salaryTo: item.salaryTo,
          });
          const salaryText = showSalary
            ? formatSalaryRange({
                salaryFrom: item.salaryFrom,
                salaryTo: item.salaryTo,
                salaryRatePeriod: item.salaryRatePeriod,
                locale,
                messages,
                formatTemplate,
              })
            : "";

          return (
            <div
              role="button"
              tabIndex={0}
              className={`w-full cursor-pointer rounded-md border px-3 py-2 text-left transition ${
                item.companyIsPremium
                  ? "border-slate-800 bg-slate-950 bg-gradient-to-r from-emerald-900/35 via-emerald-900/12 to-transparent hover:border-emerald-300/75"
                  : "border-slate-800 bg-slate-950 hover:border-sky-300/60"
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
                  className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-md border bg-slate-900 ${
                    item.companyIsPremium
                      ? "border-slate-800 shadow-[0_0_10px_rgba(52,211,153,0.30)]"
                      : "border-slate-800"
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
                        item.companyIsPremium ? "text-emerald-100" : "text-slate-100"
                      }`}
                    >
                      {item.title}
                    </p>
                    <div className="order-2 flex shrink-0 items-center gap-2 sm:order-3">
                      <button
                        type="button"
                        className={`rounded-full border p-1.5 ${
                          item.isFavorite
                            ? "border-rose-600 text-rose-300"
                            : "border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"
                        } disabled:cursor-not-allowed disabled:opacity-60`}
                        onClick={(event) => {
                          event.stopPropagation();
                          onToggleFavorite(item.id, item.isFavorite === true);
                        }}
                        aria-label={
                          item.isFavorite
                            ? messages.favoriteRemove
                            : messages.favoriteAdd
                        }
                        title={
                          item.isFavorite
                            ? messages.favoriteRemove
                            : messages.favoriteAdd
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
                    </div>
                    {showSalary ? (
                      <span className="order-3 basis-full sm:order-2 sm:basis-auto">
                        <span className="inline-flex items-center rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-300">
                          {salaryText}
                        </span>
                      </span>
                    ) : null}
                  </div>
                  <p
                    className={`truncate text-xs ${
                      item.companyIsPremium ? "text-emerald-200/80" : "text-slate-400"
                    }`}
                  >
                    {item.companyName}
                  </p>
                  <p className="truncate text-xs text-slate-300">
                    {toShortLocationLabel({
                      locationLabel: item.locationLabel,
                      locationCity: item.locationCity,
                      locationCountry: item.locationCountry,
                    })}
                  </p>
                  <div className="mt-1 flex items-center gap-3 text-xs font-medium">
                    <Link
                      href={withLang(`/announcements/${item.id}`, locale)}
                      className={`transition ${
                        item.companyIsPremium
                          ? "text-emerald-200/90 hover:text-emerald-100"
                          : "text-slate-400 hover:text-sky-300"
                      }`}
                      onClick={(event) => {
                        event.stopPropagation();
                      }}
                      onKeyDown={(event) => {
                        event.stopPropagation();
                      }}
                    >
                      {messages.openAnnouncement}
                    </Link>
                    <Link
                      href={withLang(`/companies/${item.companySlug}`, locale)}
                      className={`transition ${
                        item.companyIsPremium
                          ? "text-emerald-200/90 hover:text-emerald-100"
                          : "text-slate-400 hover:text-sky-300"
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
                          : "text-slate-400 hover:text-sky-300"
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
          );
        }}
      />
    </>
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
        <p className="mt-3 text-sm text-slate-400">{messages.empty}</p>
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
                ? "border-slate-800 bg-slate-950 bg-gradient-to-r from-emerald-900/35 via-emerald-900/12 to-transparent hover:border-emerald-300/75"
                : "border-slate-800 bg-slate-950 hover:border-sky-300/60"
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
                className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-md border bg-slate-900 ${
                  item.companyIsPremium
                    ? "border-slate-800 shadow-[0_0_10px_rgba(52,211,153,0.30)]"
                    : "border-slate-800"
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
                      item.companyIsPremium ? "text-emerald-100" : "text-slate-100"
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
                    item.companyIsPremium ? "text-emerald-200/80" : "text-slate-400"
                  }`}
                >
                  {item.companyName}
                </p>
                <p className="truncate text-xs text-slate-300">
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
                        : "text-slate-400 hover:text-sky-300"
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
                        : "text-slate-400 hover:text-sky-300"
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
                        : "text-slate-400 hover:text-sky-300"
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
        <p className="mt-3 text-sm text-slate-400">{messages.empty}</p>
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
            className={`w-full cursor-pointer rounded-md border px-3 py-2 text-left transition ${
              company.isPremium
                ? "border-slate-800 bg-slate-950 bg-gradient-to-r from-emerald-900/35 via-emerald-900/12 to-transparent hover:border-emerald-300/75"
                : "border-slate-800 bg-slate-950 hover:border-sky-400/60"
            }`}
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
                className={`relative h-16 w-16 shrink-0 rounded-md border bg-slate-900 ${
                  company.isPremium
                    ? "overflow-visible border-slate-800 shadow-[0_0_14px_rgba(52,211,153,0.30)]"
                    : "overflow-hidden border-slate-800"
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
                  <span className="absolute left-0 top-0 z-10 inline-flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-amber-400/80 bg-slate-950/90 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.35)]">
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
                    <span
                      className={`truncate font-medium ${
                        company.isPremium ? "text-emerald-100" : "text-slate-100"
                      }`}
                    >
                      {company.name}
                    </span>
                    {company.verificationStatus === COMPANY_VERIFICATION_STATUS.VERIFIED ? (
                      <span
                        className="inline-flex h-5 w-5 shrink-0 items-center justify-center text-emerald-300"
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
                <p className={`truncate text-xs ${company.isPremium ? "text-emerald-200/80" : "text-slate-400"}`}>
                  {categoryToLabel(mapMessages, company.category)}
                  {company.locationCity ? (
                    <>
                      {", "}
                      <strong className={`font-semibold ${company.isPremium ? "text-emerald-100" : "text-slate-200"}`}>
                        {company.locationCity}
                      </strong>
                    </>
                  ) : null}
                </p>
                <p className={`mt-1 truncate text-xs ${company.isPremium ? "text-emerald-300/75" : "text-slate-500"}`}>
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
                    className={`transition ${company.isPremium ? "text-emerald-200/90 hover:text-emerald-100" : "text-slate-400 hover:text-sky-300"}`}
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
                    className={`transition ${company.isPremium ? "text-emerald-200/90 hover:text-emerald-100" : "text-slate-400 hover:text-sky-300"}`}
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
