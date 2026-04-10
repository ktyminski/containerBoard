"use client";

import type { AppMessages } from "@/lib/i18n";
import { DISTANCE_OPTIONS, type DistanceOption } from "@/components/main-map-modules/shared";

type MainMapFiltersBarProps = {
  messages: AppMessages["mapModules"]["filters"];
  showLocationFilter?: boolean;
  showSort?: boolean;
  keywordInput: string;
  locationInput: string;
  distanceKm: DistanceOption;
  sortLabel?: string;
  sortValue?: "newest" | "oldest";
  sortNewestLabel?: string;
  sortOldestLabel?: string;
  activeAdditionalFiltersCount: number;
  hasActiveFilters: boolean;
  filterError: string | null;
  isApplyingFilters: boolean;
  onKeywordInputChange: (value: string) => void;
  onLocationInputChange: (value: string) => void;
  onDistanceChange: (value: DistanceOption) => void;
  onSortChange?: (value: "newest" | "oldest") => void;
  onOpenMoreFilters: () => void;
  onApplyFilters: () => void;
  onClearFilters: () => void;
};

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 text-slate-500" aria-hidden>
      <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 text-slate-500" aria-hidden>
      <path
        d="M10 18C10 18 15 13.5 15 9.5C15 6.462 12.762 4 10 4C7.238 4 5 6.462 5 9.5C5 13.5 10 18 10 18Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="10" cy="9.5" r="1.8" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function DistanceIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 text-slate-500" aria-hidden>
      <path d="M3 14L7 10L10 13L17 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14 6H17V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function FiltersIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 text-current" aria-hidden>
      <path d="M4 6H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M7 10H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M9 14H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
      <path d="M6 6L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14 6L6 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ApplyIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
      <path d="M5 10H15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M11 6L15 10L11 14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MainMapFiltersBar({
  messages,
  showLocationFilter = true,
  showSort = false,
  keywordInput,
  locationInput,
  distanceKm,
  sortLabel,
  sortValue = "newest",
  sortNewestLabel,
  sortOldestLabel,
  activeAdditionalFiltersCount,
  hasActiveFilters,
  filterError,
  isApplyingFilters,
  onKeywordInputChange,
  onLocationInputChange,
  onDistanceChange,
  onSortChange,
  onOpenMoreFilters,
  onApplyFilters,
  onClearFilters,
}: MainMapFiltersBarProps) {
  const hasActiveAdditionalFilters = activeAdditionalFiltersCount > 0;

  return (
    <div className="mx-auto mt-4 w-full max-w-[1080px] px-6">
      <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-700 bg-slate-900 px-1 py-1 shadow-[0_4px_18px_rgba(2,6,23,0.4)]">
        <label className="flex flex-1 items-center gap-2 rounded-lg px-3 md:min-w-[220px]">
          <SearchIcon />
          <span className="sr-only">{messages.keywordLabel}</span>
          <input
            className="h-10 w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
            placeholder={messages.keywordPlaceholder}
            value={keywordInput}
            onChange={(event) => {
              onKeywordInputChange(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onApplyFilters();
              }
            }}
          />
        </label>
        {showLocationFilter ? (
          <>
            <span className="hidden h-7 w-px bg-slate-700 lg:block" />
            <label className="hidden min-w-[200px] flex-1 items-center gap-2 rounded-lg px-3 lg:flex">
              <PinIcon />
              <span className="sr-only">{messages.locationLabel}</span>
              <input
                className="h-10 w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
                placeholder={messages.locationPlaceholder}
                value={locationInput}
                onChange={(event) => {
                  onLocationInputChange(event.target.value);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    onApplyFilters();
                  }
                }}
              />
            </label>
            <span className="hidden h-7 w-px bg-slate-700 lg:block" />
            <label className="hidden items-center gap-2 rounded-lg px-3 lg:flex">
              <DistanceIcon />
              <span className="sr-only">{messages.distanceLabel}</span>
              <select
                className="h-10 rounded-lg border-0 bg-transparent px-2 pr-7 text-sm text-slate-100 focus:outline-none [color-scheme:dark]"
                value={String(distanceKm)}
                onChange={(event) => {
                  onDistanceChange(Number(event.target.value) as DistanceOption);
                }}
              >
                {DISTANCE_OPTIONS.map((option) => (
                  <option key={option} value={option} className="bg-slate-950 text-slate-100">
                    {messages.distanceOption.replace("{distance}", String(option))}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : null}
        {showSort ? (
          <>
            <span className="hidden h-7 w-px bg-slate-700 lg:block" />
            <label className="hidden items-center gap-2 rounded-lg px-3 lg:flex">
              <span className="text-sm text-slate-300">{sortLabel}</span>
              <select
                className="h-10 rounded-lg border-0 bg-transparent px-2 pr-7 text-sm text-slate-100 focus:outline-none [color-scheme:dark]"
                value={sortValue}
                onChange={(event) => {
                  onSortChange?.(event.target.value as "newest" | "oldest");
                }}
              >
                <option value="newest" className="bg-slate-950 text-slate-100">{sortNewestLabel}</option>
                <option value="oldest" className="bg-slate-950 text-slate-100">{sortOldestLabel}</option>
              </select>
            </label>
          </>
        ) : null}
        <button
          type="button"
          className="hidden h-10 w-10 items-center justify-center rounded-lg border border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-40 lg:inline-flex"
          onClick={onClearFilters}
          disabled={!hasActiveFilters}
          aria-label={messages.clear}
          title={messages.clear}
        >
          <ClearIcon />
        </button>
        <button
          type="button"
          className={`relative inline-flex h-10 w-10 items-center justify-center rounded-lg border transition-colors lg:w-auto lg:gap-2 lg:px-4 ${
            hasActiveAdditionalFilters
              ? "border-sky-400/80 bg-sky-500/10 text-sky-100 shadow-[0_0_0_1px_rgba(56,189,248,0.25),0_0_20px_rgba(56,189,248,0.35)]"
              : "border-slate-700 bg-slate-950 text-slate-200 hover:border-slate-500"
          }`}
          onClick={onOpenMoreFilters}
          aria-label={messages.moreFilters}
        >
          <FiltersIcon />
          <span className="hidden lg:inline">
            {activeAdditionalFiltersCount > 0
              ? messages.moreFiltersActive.replace("{count}", String(activeAdditionalFiltersCount))
              : messages.moreFilters}
          </span>
          {activeAdditionalFiltersCount > 0 ? (
            <span className="absolute -top-1 -right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-500 px-1 text-[10px] font-semibold text-slate-950 lg:hidden">
              {activeAdditionalFiltersCount}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-r from-rose-500 to-fuchsia-500 text-sm font-medium text-white hover:brightness-110 disabled:opacity-60 sm:w-auto sm:px-4"
          disabled={isApplyingFilters}
          onClick={onApplyFilters}
          aria-label={messages.apply}
        >
          <span className="sm:hidden">
            <ApplyIcon />
          </span>
          <span className="hidden sm:inline">
            {isApplyingFilters ? messages.applying : messages.apply}
          </span>
        </button>
      </div>
      {filterError ? <p className="mt-2 text-sm text-amber-300">{filterError}</p> : null}
    </div>
  );
}
