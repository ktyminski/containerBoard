"use client";

import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { useFormContext, useWatch } from "react-hook-form";
import {
  getContainerConditionFilterOptions,
  getContainerFeatureFilterOptions,
  getContainerHeightFilterOptions,
  getContainerSizeFilterOptions,
  getContainerTypeFilterOptions,
  getListingKindOptions,
  getPriceDisplayOptions,
  getPriceTaxModeLabel,
  getSortOptions,
  type ContainerListingsMessages,
} from "@/components/container-listings-i18n";
import { SelectWithChevron } from "@/components/ui/select-with-chevron";
import { parseContainerRalColors } from "@/lib/container-ral-colors";
import {
  PRICE_CURRENCIES,
  PRICE_CURRENCY_LABEL,
  PRICE_TAX_MODES,
  type Currency,
} from "@/lib/container-listing-types";
import {
  AUTO_APPLY_FILTERS_DEBOUNCE_MS,
  AUTO_APPLY_TYPED_FILTERS_DEBOUNCE_MS,
  CONTAINER_CONDITION_COLOR_TOKENS,
  FILTER_FORM_DEFAULTS,
  LOCATION_RADIUS_OPTIONS,
  areNonLocationFiltersEqual,
  pickNonLocationFilters,
  shouldUseTypedDebounce,
  toggleMultiValue,
  toNormalizedArray,
  type AppliedFilters,
  type FiltersFormValues,
  type MultiFilterKey,
  type NonLocationFilters,
} from "@/components/container-listings-shared";
import { usePageScrollLock } from "@/components/use-page-scroll-lock";
import { formatTemplate } from "@/lib/i18n";

const PRICE_FILTER_CURRENCIES = [...PRICE_CURRENCIES] as Currency[];

function handleCheckboxEnterToggle(
  event: ReactKeyboardEvent<HTMLInputElement>,
) {
  if (event.key !== "Enter") {
    return;
  }
  event.preventDefault();
  event.currentTarget.click();
}

type MultiCheckboxFilterProps<T extends string> = {
  messages: ContainerListingsMessages["filters"];
  label: string;
  emptyLabel?: string;
  values: T[];
  options: Array<{ value: T; label: string }>;
  getOptionAccentClassName?: (value: T) => string | undefined;
  onToggle: (value: T) => void;
  onClear: () => void;
  onOpenChange?: (isOpen: boolean) => void;
  className?: string;
  dropdownClassName?: string;
};

function MultiCheckboxFilter<T extends string>({
  messages,
  label,
  emptyLabel = messages.any,
  values,
  options,
  getOptionAccentClassName,
  onToggle,
  onClear,
  onOpenChange,
  className,
  dropdownClassName,
}: MultiCheckboxFilterProps<T>) {
  const detailsRef = useRef<HTMLDetailsElement | null>(null);
  const selectedCount = values.length;
  const singleSelectedOption =
    selectedCount === 1
      ? (options.find((option) => option.value === values[0])?.label ??
        values[0])
      : null;
  const selectedSummaryLabel =
    selectedCount === 0
      ? emptyLabel
      : selectedCount === 1
        ? (singleSelectedOption ?? messages.oneSelected)
        : formatTemplate(messages.selectedCount, { count: selectedCount });

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const detailsElement = detailsRef.current;
      if (!detailsElement || !detailsElement.open) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (detailsElement.contains(target)) {
        return;
      }

      detailsElement.removeAttribute("open");
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      detailsRef.current?.removeAttribute("open");
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <details
      ref={detailsRef}
      className={className ?? "relative"}
      onToggle={(event) => {
        onOpenChange?.(event.currentTarget.open);
      }}
    >
      <summary
        className={`multi-checkbox-summary flex h-full min-h-12 w-full cursor-pointer list-none items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm [&::-webkit-details-marker]:hidden ${
          selectedCount > 0
            ? "border-sky-400 bg-sky-100 text-neutral-900 shadow-[0_0_0_1px_rgba(56,189,248,0.15)]"
            : "border-neutral-300 bg-white text-neutral-900"
        }`}
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span
            className={`truncate text-xs ${
              selectedCount > 0
                ? "font-semibold text-neutral-900"
                : "text-neutral-600"
            }`}
            title={label}
          >
            {label}
          </span>
          <span
            className={`truncate text-left ${
              selectedCount > 0
                ? "text-sm font-medium text-neutral-800"
                : "text-sm text-neutral-500"
            }`}
            title={selectedSummaryLabel}
          >
            {selectedSummaryLabel}
          </span>
        </span>
        <svg
          viewBox="0 0 20 20"
          aria-hidden="true"
          className="h-4 w-4 shrink-0 text-neutral-500"
          fill="none"
        >
          <path
            d="M5 7.5L10 12.5L15 7.5"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </summary>
      <div
        className={`absolute left-0 top-full z-40 mt-1 w-72 rounded-md border border-neutral-300 bg-white p-2 shadow-lg ${dropdownClassName ?? ""}`}
      >
        <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
          {options.map((option) => {
            const accentClassName = getOptionAccentClassName?.(option.value);
            return (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100"
              >
                <input
                  type="checkbox"
                  checked={values.includes(option.value)}
                  onChange={() => {
                    onToggle(option.value);
                  }}
                  onKeyDown={handleCheckboxEnterToggle}
                  className="h-4 w-4 rounded border-neutral-400 text-neutral-700 focus:ring-neutral-400"
                />
                {accentClassName ? (
                  <span
                    aria-hidden="true"
                    className={`h-2.5 w-2.5 shrink-0 rounded-full border ${accentClassName}`}
                  />
                ) : null}
                <span>{option.label}</span>
              </label>
            );
          })}
        </div>
        <button
          type="button"
          onClick={onClear}
          className="mt-2 w-full rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:border-neutral-400 hover:bg-neutral-100"
        >
          {messages.clear}
        </button>
      </div>
    </details>
  );
}

function FiltersIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 text-current" aria-hidden="true">
      <path d="M4 6H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M7 10H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M9 14H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M6 6L14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M14 6L6 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function countMobileAdditionalFilters(filters: NonLocationFilters): number {
  let count = 0;

  if (filters.listingKind !== FILTER_FORM_DEFAULTS.listingKind) {
    count += 1;
  }
  if (filters.containerFeatures.length > 0) {
    count += 1;
  }
  if (filters.containerRalColors.length > 0) {
    count += 1;
  }
  if (filters.priceNegotiableOnly) {
    count += 1;
  }
  if (filters.logisticsTransportOnly) {
    count += 1;
  }
  if (filters.logisticsUnloadingOnly) {
    count += 1;
  }
  if (filters.hasCscPlateOnly) {
    count += 1;
  }
  if (filters.hasCscCertificationOnly) {
    count += 1;
  }
  if (filters.priceDisplayCurrency !== FILTER_FORM_DEFAULTS.priceDisplayCurrency) {
    count += 1;
  }
  if (filters.priceMinInput.length > 0 || filters.priceMaxInput.length > 0) {
    count += 1;
  }
  if (filters.productionYearInput.trim().length > 0) {
    count += 1;
  }

  return count;
}

type ContainerListingsFiltersProps = {
  messages: ContainerListingsMessages;
  children: ReactNode;
  locationControlsRef: RefObject<HTMLDivElement | null>;
  sectionRef?: RefObject<HTMLElement | null>;
  sectionId?: string;
  sectionClassName?: string;
  appliedFilters: AppliedFilters;
  restoreAppliedLocationOnBlur: (
    event: FocusEvent<HTMLInputElement | HTMLSelectElement>,
  ) => void;
  isResolvingLocation: boolean;
  locationFilterError: string | null;
  onApplyNonLocationFilters: (nextFilters: NonLocationFilters) => void;
  clearLocationFilter: () => void;
  clearAllFilters: () => void;
};

function ContainerListingsFiltersComponent({
  messages,
  children,
  locationControlsRef,
  sectionRef,
  sectionId,
  sectionClassName,
  appliedFilters,
  restoreAppliedLocationOnBlur,
  isResolvingLocation,
  locationFilterError,
  onApplyNonLocationFilters,
  clearLocationFilter,
  clearAllFilters,
}: ContainerListingsFiltersProps) {
  const { register, setValue, control } = useFormContext<FiltersFormValues>();
  const filterMessages = messages.filters;
  const [isMobileAdditionalFiltersOpen, setIsMobileAdditionalFiltersOpen] = useState(false);
  const [openMultiFilters, setOpenMultiFilters] = useState<
    Record<MultiFilterKey, boolean>
  >({
    sizes: false,
    heights: false,
    types: false,
    conditions: false,
    features: false,
  });

  usePageScrollLock(isMobileAdditionalFiltersOpen);

  const isAnyMultiFilterOpen = useMemo(
    () => Object.values(openMultiFilters).some(Boolean),
    [openMultiFilters],
  );

  useEffect(() => {
    if (!isMobileAdditionalFiltersOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMobileAdditionalFiltersOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobileAdditionalFiltersOpen]);

  const listingKind = useWatch({ control, name: "listingKind" }) ?? "sell";
  const selectedContainerSizesValue = useWatch({
    control,
    name: "containerSizes",
  });
  const selectedContainerHeightsValue = useWatch({
    control,
    name: "containerHeights",
  });
  const selectedContainerTypesValue = useWatch({
    control,
    name: "containerTypes",
  });
  const selectedContainerConditionsValue = useWatch({
    control,
    name: "containerConditions",
  });
  const selectedContainerFeaturesValue = useWatch({
    control,
    name: "containerFeatures",
  });
  const selectedContainerSizes = useMemo(
    () => selectedContainerSizesValue ?? [],
    [selectedContainerSizesValue],
  );
  const selectedContainerHeights = useMemo(
    () => selectedContainerHeightsValue ?? [],
    [selectedContainerHeightsValue],
  );
  const selectedContainerTypes = useMemo(
    () => selectedContainerTypesValue ?? [],
    [selectedContainerTypesValue],
  );
  const selectedContainerConditions = useMemo(
    () => selectedContainerConditionsValue ?? [],
    [selectedContainerConditionsValue],
  );
  const selectedContainerFeatures = useMemo(
    () => selectedContainerFeaturesValue ?? [],
    [selectedContainerFeaturesValue],
  );
  const containerRalInputValue =
    useWatch({ control, name: "containerRalInput" }) ?? "";
  const priceNegotiableOnlyValue =
    useWatch({ control, name: "priceNegotiableOnly" }) ?? false;
  const logisticsTransportOnlyValue =
    useWatch({ control, name: "logisticsTransportOnly" }) ?? false;
  const logisticsUnloadingOnlyValue =
    useWatch({ control, name: "logisticsUnloadingOnly" }) ?? false;
  const hasCscPlateOnlyValue =
    useWatch({ control, name: "hasCscPlateOnly" }) ?? false;
  const hasCscCertificationOnlyValue =
    useWatch({ control, name: "hasCscCertificationOnly" }) ?? false;
  const priceCurrencyValue =
    useWatch({ control, name: "priceCurrency" }) ?? "EUR";
  const priceDisplayCurrencyValue =
    useWatch({ control, name: "priceDisplayCurrency" }) ?? "original";
  const priceTaxModeValue =
    useWatch({ control, name: "priceTaxMode" }) ?? "net";
  const priceMinInputValue = useWatch({ control, name: "priceMinInput" }) ?? "";
  const priceMaxInputValue = useWatch({ control, name: "priceMaxInput" }) ?? "";
  const productionYearInputValue =
    useWatch({ control, name: "productionYearInput" }) ?? "";
  const cityValue = useWatch({ control, name: "city" }) ?? "";
  const countryValue = useWatch({ control, name: "country" }) ?? "";
  const countryCodeValue = useWatch({ control, name: "countryCode" }) ?? "";
  const sortPresetValue = useWatch({ control, name: "sortPreset" }) ?? "newest";
  const parsedRalColors = useMemo(
    () =>
      parseContainerRalColors(containerRalInputValue, {
        ignoreIncompleteTrailingToken: true,
      }),
    [containerRalInputValue],
  );
  const priceDisplayOptions = useMemo(
    () => getPriceDisplayOptions(messages),
    [messages],
  );
  const sortOptions = useMemo(() => getSortOptions(messages), [messages]);
  const listingKindOptions = useMemo(
    () => getListingKindOptions(messages),
    [messages],
  );
  const containerSizeOptions = useMemo(
    () => getContainerSizeFilterOptions(),
    [],
  );
  const containerHeightOptions = useMemo(
    () => getContainerHeightFilterOptions(),
    [],
  );
  const containerTypeOptions = useMemo(
    () => getContainerTypeFilterOptions(),
    [],
  );
  const containerConditionOptions = useMemo(
    () => getContainerConditionFilterOptions(),
    [],
  );
  const containerFeatureOptions = useMemo(
    () => getContainerFeatureFilterOptions(),
    [],
  );

  const draftNonLocationFilters = useMemo<NonLocationFilters>(() => {
    const normalizedPriceMinInput = priceMinInputValue.trim();
    const normalizedPriceMaxInput = priceMaxInputValue.trim();
    const hasPriceRange =
      normalizedPriceMinInput.length > 0 || normalizedPriceMaxInput.length > 0;

    return {
      listingKind,
      containerSizes: toNormalizedArray(selectedContainerSizes),
      containerHeights: toNormalizedArray(selectedContainerHeights),
      containerTypes: toNormalizedArray(selectedContainerTypes),
      containerConditions: toNormalizedArray(selectedContainerConditions),
      containerFeatures: toNormalizedArray(selectedContainerFeatures),
      containerRalColors: toNormalizedArray(
        parsedRalColors.colors.map((color) => color.ral),
      ),
      priceNegotiableOnly: priceNegotiableOnlyValue,
      logisticsTransportOnly: logisticsTransportOnlyValue,
      logisticsUnloadingOnly: logisticsUnloadingOnlyValue,
      hasCscPlateOnly: hasCscPlateOnlyValue,
      hasCscCertificationOnly: hasCscCertificationOnlyValue,
      priceCurrency: priceCurrencyValue === "all" ? "EUR" : priceCurrencyValue,
      priceDisplayCurrency: priceDisplayCurrencyValue,
      priceTaxMode: hasPriceRange ? priceTaxModeValue : "net",
      priceMinInput: normalizedPriceMinInput,
      priceMaxInput: normalizedPriceMaxInput,
      productionYearInput: productionYearInputValue,
      city: cityValue,
      country: countryValue,
      countryCode: countryCodeValue.trim().toUpperCase(),
      sortPreset: sortPresetValue,
    };
  }, [
    cityValue,
    countryValue,
    countryCodeValue,
    listingKind,
    logisticsTransportOnlyValue,
    logisticsUnloadingOnlyValue,
    parsedRalColors.colors,
    priceCurrencyValue,
    priceDisplayCurrencyValue,
    priceMaxInputValue,
    priceMinInputValue,
    priceNegotiableOnlyValue,
    priceTaxModeValue,
    productionYearInputValue,
    selectedContainerConditions,
    selectedContainerFeatures,
    selectedContainerHeights,
    selectedContainerSizes,
    selectedContainerTypes,
    hasCscCertificationOnlyValue,
    hasCscPlateOnlyValue,
    sortPresetValue,
  ]);

  useEffect(() => {
    if (isAnyMultiFilterOpen) {
      return;
    }

    const appliedNonLocationFilters = pickNonLocationFilters(appliedFilters);
    if (
      areNonLocationFiltersEqual(
        draftNonLocationFilters,
        appliedNonLocationFilters,
      )
    ) {
      return;
    }

    const debounceMs = shouldUseTypedDebounce(
      draftNonLocationFilters,
      appliedNonLocationFilters,
    )
      ? AUTO_APPLY_TYPED_FILTERS_DEBOUNCE_MS
      : AUTO_APPLY_FILTERS_DEBOUNCE_MS;

    const timeoutId = window.setTimeout(() => {
      onApplyNonLocationFilters(draftNonLocationFilters);
    }, debounceMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    appliedFilters,
    draftNonLocationFilters,
    isAnyMultiFilterOpen,
    onApplyNonLocationFilters,
  ]);

  const isLocationApplied = appliedFilters.locationQuery.trim().length > 0;
  const hasPriceRangeFilter =
    priceMinInputValue.trim().length > 0 ||
    priceMaxInputValue.trim().length > 0;
  const isPriceFilterApplied = hasPriceRangeFilter;
  const mobileAdditionalFiltersCount = useMemo(
    () => countMobileAdditionalFilters(draftNonLocationFilters),
    [draftNonLocationFilters],
  );
  const mobileMoreFiltersAriaLabel =
    mobileAdditionalFiltersCount > 0
      ? formatTemplate(filterMessages.moreFiltersActive, {
          count: mobileAdditionalFiltersCount,
        })
      : filterMessages.moreFilters;

  const renderSizesFilter = (className?: string, dropdownClassName?: string) => (
    <MultiCheckboxFilter
      messages={filterMessages}
      label={filterMessages.size}
      values={selectedContainerSizes}
      options={containerSizeOptions}
      className={className}
      dropdownClassName={dropdownClassName}
      onOpenChange={(isOpen) => {
        setOpenMultiFilters((current) => ({ ...current, sizes: isOpen }));
      }}
      onToggle={(value) => {
        setValue("containerSizes", toggleMultiValue(selectedContainerSizes, value), {
          shouldDirty: true,
          shouldTouch: true,
        });
      }}
      onClear={() => {
        setValue("containerSizes", [], {
          shouldDirty: true,
          shouldTouch: true,
        });
      }}
    />
  );

  const renderHeightsFilter = (className?: string, dropdownClassName?: string) => (
    <MultiCheckboxFilter
      messages={filterMessages}
      label={filterMessages.height}
      values={selectedContainerHeights}
      options={containerHeightOptions}
      className={className}
      dropdownClassName={dropdownClassName}
      onOpenChange={(isOpen) => {
        setOpenMultiFilters((current) => ({ ...current, heights: isOpen }));
      }}
      onToggle={(value) => {
        setValue("containerHeights", toggleMultiValue(selectedContainerHeights, value), {
          shouldDirty: true,
          shouldTouch: true,
        });
      }}
      onClear={() => {
        setValue("containerHeights", [], {
          shouldDirty: true,
          shouldTouch: true,
        });
      }}
    />
  );

  const renderTypesFilter = (className?: string, dropdownClassName?: string) => (
    <MultiCheckboxFilter
      messages={filterMessages}
      label={filterMessages.type}
      values={selectedContainerTypes}
      options={containerTypeOptions}
      className={className}
      dropdownClassName={dropdownClassName}
      onOpenChange={(isOpen) => {
        setOpenMultiFilters((current) => ({ ...current, types: isOpen }));
      }}
      onToggle={(value) => {
        setValue("containerTypes", toggleMultiValue(selectedContainerTypes, value), {
          shouldDirty: true,
          shouldTouch: true,
        });
      }}
      onClear={() => {
        setValue("containerTypes", [], {
          shouldDirty: true,
          shouldTouch: true,
        });
      }}
    />
  );

  const renderConditionsFilter = (className?: string, dropdownClassName?: string) => (
    <MultiCheckboxFilter
      messages={filterMessages}
      label={filterMessages.condition}
      values={selectedContainerConditions}
      options={containerConditionOptions}
      getOptionAccentClassName={(value) =>
        CONTAINER_CONDITION_COLOR_TOKENS[value].dotClassName
      }
      className={className}
      dropdownClassName={dropdownClassName}
      onOpenChange={(isOpen) => {
        setOpenMultiFilters((current) => ({ ...current, conditions: isOpen }));
      }}
      onToggle={(value) => {
        setValue("containerConditions", toggleMultiValue(selectedContainerConditions, value), {
          shouldDirty: true,
          shouldTouch: true,
        });
      }}
      onClear={() => {
        setValue("containerConditions", [], {
          shouldDirty: true,
          shouldTouch: true,
        });
      }}
    />
  );

  const renderFeaturesFilter = (className?: string, dropdownClassName?: string) => (
    <MultiCheckboxFilter
      messages={filterMessages}
      label={filterMessages.feature}
      values={selectedContainerFeatures}
      options={containerFeatureOptions}
      className={className}
      dropdownClassName={dropdownClassName}
      onOpenChange={(isOpen) => {
        setOpenMultiFilters((current) => ({ ...current, features: isOpen }));
      }}
      onToggle={(value) => {
        setValue("containerFeatures", toggleMultiValue(selectedContainerFeatures, value), {
          shouldDirty: true,
          shouldTouch: true,
        });
      }}
      onClear={() => {
        setValue("containerFeatures", [], {
          shouldDirty: true,
          shouldTouch: true,
        });
      }}
    />
  );

  return (
    <>
      <input type="hidden" {...register("listingKind")} />
      <section
        ref={sectionRef}
        id={sectionId}
        className={`z-30 rounded-md border border-neutral-300 bg-neutral-50/95 p-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-neutral-50/90 sm:sticky sm:top-[4.5rem] ${
          sectionClassName ?? ""
        }`}
      >
        <div id="container-listings-primary-filters">
          <div className="grid gap-2 lg:grid-cols-[minmax(100px,0.85fr)_minmax(100px,0.85fr)_minmax(100px,1fr)_minmax(100px,1fr)_minmax(280px,1fr)_minmax(180px,220px)_auto]">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:contents">
              {renderSizesFilter(undefined, "w-[min(20rem,calc(100vw-2rem))]")}
              {renderHeightsFilter(undefined, "w-[min(20rem,calc(100vw-2rem))]")}
              {renderTypesFilter(undefined, "w-[min(20rem,calc(100vw-2rem))]")}
              {renderConditionsFilter(undefined, "w-[min(20rem,calc(100vw-2rem))]")}
            </div>

            <div
              ref={locationControlsRef}
              className="grid gap-2 grid-cols-[minmax(0,1fr)_auto_auto] lg:contents"
            >
              <div className="relative">
                <input
                  {...register("locationInput")}
                  placeholder={filterMessages.anyLocation}
                  className={`h-full min-h-12 w-full rounded-md border px-3 py-2 text-sm text-neutral-900 ${
                    isLocationApplied
                      ? "border-sky-400 bg-sky-100/70 pr-11 shadow-[0_0_0_1px_rgba(56,189,248,0.15)]"
                      : "border-neutral-300 bg-white"
                  }`}
                  onBlur={restoreAppliedLocationOnBlur}
                />
                {isLocationApplied ? (
                  <button
                    type="button"
                    onClick={clearLocationFilter}
                    className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md border border-sky-300 bg-white/85 text-sm font-semibold text-sky-800 transition hover:border-sky-400 hover:bg-white"
                    aria-label={filterMessages.clearLocation}
                    title={filterMessages.clearLocation}
                  >
                    x
                  </button>
                ) : null}
              </div>
              <SelectWithChevron
                {...register("locationRadiusKmInput")}
                wrapperClassName="hidden lg:block"
                className={`h-full min-h-12 rounded-md border px-3 py-2 pr-10 ${
                  isLocationApplied
                    ? "border-sky-400 bg-sky-100/70 text-sky-800 shadow-[0_0_0_1px_rgba(56,189,248,0.15)]"
                    : "border-neutral-300 bg-white text-neutral-900"
                }`}
                onBlur={restoreAppliedLocationOnBlur}
                title={filterMessages.anyLocation}
              >
                {LOCATION_RADIUS_OPTIONS.map((value) => (
                  <option key={value} value={String(value)}>
                    +{value} km
                  </option>
                ))}
              </SelectWithChevron>
              <button
                type="button"
                onClick={() => {
                  setIsMobileAdditionalFiltersOpen(true);
                }}
                className={`relative inline-flex min-h-12 w-12 items-center justify-center rounded-md border text-sm transition-colors lg:hidden ${
                  mobileAdditionalFiltersCount > 0
                    ? "border-sky-400 bg-sky-100 text-sky-900 shadow-[0_0_0_1px_rgba(56,189,248,0.15)]"
                    : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100"
                }`}
                aria-label={mobileMoreFiltersAriaLabel}
                title={mobileMoreFiltersAriaLabel}
              >
                <FiltersIcon />
                {mobileAdditionalFiltersCount > 0 ? (
                  <span className="absolute -right-1.5 -top-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-sky-500 px-1 text-[10px] font-semibold text-white">
                    {mobileAdditionalFiltersCount}
                  </span>
                ) : null}
              </button>
              <button
                type="submit"
                disabled={isResolvingLocation}
                className="h-full min-h-12 shrink-0 whitespace-nowrap rounded-md border border-rose-500 bg-gradient-to-r from-rose-500 to-fuchsia-500 px-3.5 text-sm font-semibold text-white transition-colors duration-200 hover:from-rose-600 hover:to-fuchsia-600 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isResolvingLocation
                  ? filterMessages.searching
                  : filterMessages.search}
              </button>
            </div>
          </div>
          {locationFilterError ? (
            <p className="mt-2 text-xs text-neutral-600">{locationFilterError}</p>
          ) : null}
        </div>
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden h-fit min-w-0 rounded-md border border-neutral-300 bg-neutral-50/95 p-4 shadow-sm lg:sticky lg:top-[11rem] lg:z-20 lg:block lg:max-h-[calc(100dvh-12rem)] lg:overflow-y-auto">
          <div className="grid gap-3">
            <label className="grid gap-1 text-sm">
              <span className="text-neutral-600">{filterMessages.sort}</span>
              <SelectWithChevron
                {...register("sortPreset")}
                className={`rounded-md border px-3 py-2 text-neutral-900 ${
                  sortPresetValue !== "newest"
                    ? "border-sky-400 bg-sky-100/70 shadow-[0_0_0_1px_rgba(56,189,248,0.15)]"
                    : "border-neutral-300 bg-white"
                }`}
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectWithChevron>
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-neutral-600">
                {filterMessages.convertPricesTo}
              </span>
              <SelectWithChevron
                {...register("priceDisplayCurrency")}
                className={`rounded-md border px-3 py-2 text-neutral-900 ${
                  priceDisplayCurrencyValue !== "original"
                    ? "border-sky-400 bg-sky-100/70 shadow-[0_0_0_1px_rgba(56,189,248,0.15)]"
                    : "border-neutral-300 bg-white"
                }`}
              >
                {priceDisplayOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectWithChevron>
            </label>

            <div className="border-t border-neutral-300" aria-hidden="true" />

            <div className="grid gap-1 text-sm">
              <span className="text-neutral-600">
                {filterMessages.listingKind}
              </span>
              <div className="grid w-full grid-cols-1 overflow-hidden rounded-md border border-neutral-300 text-sm">
                {listingKindOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setValue("listingKind", option.value, {
                        shouldDirty: true,
                        shouldTouch: true,
                      });
                    }}
                    className={`listing-kind-option ${
                      listingKind === option.value
                        ? option.value === "buy"
                          ? "w-full border-b border-neutral-300 bg-amber-500 px-3 py-2 text-left font-semibold text-white shadow-[0_8px_20px_-12px_rgba(245,158,11,0.9)] last:border-b-0"
                          : "w-full border-b border-neutral-300 bg-[#0c3466] px-3 py-2 text-left font-semibold text-white shadow-[0_8px_20px_-12px_rgba(12,52,102,0.95)] last:border-b-0"
                        : option.value === "buy"
                          ? "w-full border-b border-neutral-300 bg-amber-50 px-3 py-2 text-left text-amber-900 transition-colors hover:bg-amber-100 last:border-b-0"
                          : "w-full border-b border-neutral-300 bg-white px-3 py-2 text-left text-neutral-700 transition-colors hover:bg-neutral-100 last:border-b-0"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-1 text-sm">
              <span className="text-neutral-600">{filterMessages.feature}</span>
              {renderFeaturesFilter("relative", "w-full")}
            </div>

            <div className="grid gap-1 text-sm">
              <label
                className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                  priceNegotiableOnlyValue
                    ? "border-sky-400 bg-sky-100/70 text-sky-900 shadow-[0_0_0_1px_rgba(56,189,248,0.15)]"
                    : "border-neutral-300 bg-white text-neutral-700"
                }`}
              >
                <input
                  type="checkbox"
                  {...register("priceNegotiableOnly")}
                  onKeyDown={handleCheckboxEnterToggle}
                  className="h-4 w-4 rounded border-neutral-400 text-neutral-700 focus:ring-neutral-400"
                />
                <span>{filterMessages.negotiablePrice}</span>
              </label>
            </div>

            <div className="grid gap-1 text-sm">
              <span className="text-neutral-600">{filterMessages.logistics}</span>
              <div className="grid gap-2">
                <label
                  className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                    logisticsTransportOnlyValue
                      ? "border-sky-400 bg-sky-100/70 text-sky-900 shadow-[0_0_0_1px_rgba(56,189,248,0.15)]"
                      : "border-neutral-300 bg-white text-neutral-700"
                  }`}
                >
                  <input
                    type="checkbox"
                    {...register("logisticsTransportOnly")}
                    onKeyDown={handleCheckboxEnterToggle}
                    className="h-4 w-4 rounded border-neutral-400 text-neutral-700 focus:ring-neutral-400"
                  />
                  <span>{filterMessages.transport}</span>
                </label>
                <label
                  className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                    logisticsUnloadingOnlyValue
                      ? "border-sky-400 bg-sky-100/70 text-sky-900 shadow-[0_0_0_1px_rgba(56,189,248,0.15)]"
                      : "border-neutral-300 bg-white text-neutral-700"
                  }`}
                >
                  <input
                    type="checkbox"
                    {...register("logisticsUnloadingOnly")}
                    onKeyDown={handleCheckboxEnterToggle}
                    className="h-4 w-4 rounded border-neutral-400 text-neutral-700 focus:ring-neutral-400"
                  />
                  <span>{filterMessages.unloading}</span>
                </label>
              </div>
            </div>

            <div className="grid gap-1 text-sm">
              <span className="text-neutral-600">{filterMessages.price}</span>
              <div
                className={`grid gap-2 rounded-md border p-3 transition-colors ${
                  isPriceFilterApplied
                    ? "border-sky-400 bg-sky-100/70 shadow-[0_0_0_1px_rgba(56,189,248,0.15)]"
                    : "border-neutral-300 bg-white"
                }`}
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="grid gap-1">
                    <span className="text-xs text-neutral-500">
                      {filterMessages.currency}
                    </span>
                    <SelectWithChevron
                      {...register("priceCurrency")}
                      className="h-10 rounded-md border border-neutral-300 bg-white px-3 py-2 pr-10 text-neutral-900"
                    >
                      {PRICE_FILTER_CURRENCIES.map((currency) => (
                        <option key={currency} value={currency}>
                          {PRICE_CURRENCY_LABEL[currency]}
                        </option>
                      ))}
                    </SelectWithChevron>
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs text-neutral-500">
                      {filterMessages.variant}
                    </span>
                    <SelectWithChevron
                      {...register("priceTaxMode")}
                      className="h-10 rounded-md border border-neutral-300 bg-white px-3 py-2 pr-10 text-neutral-900"
                    >
                      {PRICE_TAX_MODES.map((priceTaxMode) => (
                        <option key={priceTaxMode} value={priceTaxMode}>
                          {getPriceTaxModeLabel(messages, priceTaxMode)}
                        </option>
                      ))}
                    </SelectWithChevron>
                  </label>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="grid gap-1">
                    <span className="text-xs text-neutral-500">
                      {filterMessages.min}
                    </span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      {...register("priceMinInput")}
                      className={`w-full min-w-0 rounded-md border px-3 py-2 text-neutral-900 ${
                        hasPriceRangeFilter
                          ? "border-sky-400 bg-sky-100/70 shadow-[0_0_0_1px_rgba(56,189,248,0.15)]"
                          : "border-neutral-300 bg-white"
                      }`}
                      placeholder={filterMessages.fromPlaceholder}
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs text-neutral-500">
                      {filterMessages.max}
                    </span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      {...register("priceMaxInput")}
                      className={`w-full min-w-0 rounded-md border px-3 py-2 text-neutral-900 ${
                        hasPriceRangeFilter
                          ? "border-sky-400 bg-sky-100/70 shadow-[0_0_0_1px_rgba(56,189,248,0.15)]"
                          : "border-neutral-300 bg-white"
                      }`}
                      placeholder={filterMessages.toPlaceholder}
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="grid gap-1 text-sm">
              <label className="grid min-w-0 gap-1">
                <span className="text-neutral-600">
                  {filterMessages.productionYearFrom}
                </span>
                <input
                  type="number"
                  min={1900}
                  max={2100}
                  step={1}
                  inputMode="numeric"
                  {...register("productionYearInput")}
                  className={`w-full min-w-0 rounded-md border px-3 py-2 text-neutral-900 ${
                    productionYearInputValue.trim().length > 0
                      ? "border-sky-400 bg-sky-100/70 shadow-[0_0_0_1px_rgba(56,189,248,0.15)]"
                      : "border-neutral-300 bg-white"
                  }`}
                  placeholder={filterMessages.productionYearPlaceholder}
                />
              </label>
            </div>

            <div className="grid gap-1 text-sm">
              <span className="text-neutral-600">
                {filterMessages.certification}
              </span>
              <div className="grid gap-2">
                <label
                  className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                    hasCscPlateOnlyValue
                      ? "border-sky-400 bg-sky-100/70 text-sky-900 shadow-[0_0_0_1px_rgba(56,189,248,0.15)]"
                      : "border-neutral-300 bg-white text-neutral-700"
                  }`}
                >
                  <input
                    type="checkbox"
                    {...register("hasCscPlateOnly")}
                    onKeyDown={handleCheckboxEnterToggle}
                    className="h-4 w-4 rounded border-neutral-400 text-neutral-700 focus:ring-neutral-400"
                  />
                  <span>{filterMessages.cscPlate}</span>
                </label>
                <label
                  className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                    hasCscCertificationOnlyValue
                      ? "border-sky-400 bg-sky-100/70 text-sky-900 shadow-[0_0_0_1px_rgba(56,189,248,0.15)]"
                      : "border-neutral-300 bg-white text-neutral-700"
                  }`}
                >
                  <input
                    type="checkbox"
                    {...register("hasCscCertificationOnly")}
                    onKeyDown={handleCheckboxEnterToggle}
                    className="h-4 w-4 rounded border-neutral-400 text-neutral-700 focus:ring-neutral-400"
                  />
                  <span>{filterMessages.cscCertification}</span>
                </label>
              </div>
            </div>

            <div className="grid gap-1 text-sm">
              <span className="text-neutral-600">{filterMessages.ralColors}</span>
              <input
                {...register("containerRalInput")}
                placeholder={filterMessages.ralPlaceholder}
                className={`w-full min-w-0 rounded-md border px-3 py-2 text-neutral-900 ${
                  containerRalInputValue.trim().length > 0
                    ? "border-sky-400 bg-sky-100/70 shadow-[0_0_0_1px_rgba(56,189,248,0.15)]"
                    : "border-neutral-300 bg-white"
                }`}
              />
            </div>

            <button
              type="button"
              onClick={() => {
                clearAllFilters();
                setOpenMultiFilters({
                  sizes: false,
                  heights: false,
                  types: false,
                  conditions: false,
                  features: false,
                });
              }}
              className="rounded-md border border-neutral-500 bg-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-900 shadow-[0_6px_14px_-10px_rgba(15,23,42,0.65)] transition-colors hover:bg-neutral-400"
            >
              {filterMessages.clearAll}
            </button>
          </div>
        </aside>

        {children}
      </div>

      {typeof document !== "undefined" && isMobileAdditionalFiltersOpen
        ? createPortal(
            <div className="fixed inset-x-0 bottom-0 top-16 z-[70] flex items-end justify-center bg-neutral-950/70 p-0 backdrop-blur-sm lg:hidden">
              <button
                type="button"
                className="absolute inset-0"
                aria-label={filterMessages.closeFiltersModal}
                onClick={() => {
                  setIsMobileAdditionalFiltersOpen(false);
                }}
              />
              <section
                aria-modal="true"
                role="dialog"
                className="relative flex max-h-[calc(100dvh-4rem)] w-full flex-col overflow-hidden border border-neutral-200 bg-white shadow-2xl"
              >
                <div className="flex items-start justify-between gap-3 border-b border-neutral-200 px-4 py-4">
                  <div>
                    <h2 className="text-base font-semibold text-neutral-950">
                      {filterMessages.additionalFiltersTitle}
                    </h2>
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-neutral-300 bg-white text-neutral-600"
                    aria-label={filterMessages.closeFiltersModal}
                    onClick={() => {
                      setIsMobileAdditionalFiltersOpen(false);
                    }}
                  >
                    <CloseIcon />
                  </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                  <div className="grid gap-4">
                    <div className="grid gap-2 text-sm">
                      <span className="text-neutral-600">{filterMessages.listingKind}</span>
                      <div className="grid grid-cols-1 overflow-hidden rounded-md border border-neutral-300 text-sm">
                        {listingKindOptions.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                              setValue("listingKind", option.value, {
                                shouldDirty: true,
                                shouldTouch: true,
                              });
                            }}
                            className={`border-b border-neutral-300 px-3 py-2 text-left last:border-b-0 ${
                              listingKind === option.value
                                ? option.value === "buy"
                                  ? "bg-amber-500 font-semibold text-white"
                                  : "bg-[#0c3466] font-semibold text-white"
                                : option.value === "buy"
                                  ? "bg-amber-50 text-amber-900"
                                  : "bg-white text-neutral-700"
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-2 text-sm">
                      <span className="text-neutral-600">{filterMessages.sort}</span>
                      <SelectWithChevron
                        value={sortPresetValue}
                        onChange={(event) => {
                          setValue(
                            "sortPreset",
                            event.target.value as FiltersFormValues["sortPreset"],
                            {
                              shouldDirty: true,
                              shouldTouch: true,
                            },
                          );
                        }}
                        className={`rounded-md border px-3 py-2 text-neutral-900 ${
                          sortPresetValue !== "newest"
                            ? "border-sky-400 bg-sky-100/70 shadow-[0_0_0_1px_rgba(56,189,248,0.15)]"
                            : "border-neutral-300 bg-white"
                        }`}
                      >
                        {sortOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </SelectWithChevron>
                    </div>

                    <div className="grid gap-2 text-sm">
                      <span className="text-neutral-600">{filterMessages.feature}</span>
                      {renderFeaturesFilter("relative", "w-full")}
                    </div>

                    <label className="grid gap-1 text-sm">
                      <span className="text-neutral-600">{filterMessages.convertPricesTo}</span>
                      <SelectWithChevron
                        value={priceDisplayCurrencyValue}
                        onChange={(event) => {
                          setValue(
                            "priceDisplayCurrency",
                            event.target.value as FiltersFormValues["priceDisplayCurrency"],
                            {
                              shouldDirty: true,
                              shouldTouch: true,
                            },
                          );
                        }}
                        className={`rounded-md border px-3 py-2 text-neutral-900 ${
                          priceDisplayCurrencyValue !== "original"
                            ? "border-sky-400 bg-sky-100/70 shadow-[0_0_0_1px_rgba(56,189,248,0.15)]"
                            : "border-neutral-300 bg-white"
                        }`}
                      >
                        {priceDisplayOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </SelectWithChevron>
                    </label>

                    <label
                      className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                        priceNegotiableOnlyValue
                          ? "border-sky-400 bg-sky-100/70 text-sky-900 shadow-[0_0_0_1px_rgba(56,189,248,0.15)]"
                          : "border-neutral-300 bg-white text-neutral-700"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={priceNegotiableOnlyValue}
                        onChange={(event) => {
                          setValue("priceNegotiableOnly", event.target.checked, {
                            shouldDirty: true,
                            shouldTouch: true,
                          });
                        }}
                        onKeyDown={handleCheckboxEnterToggle}
                        className="h-4 w-4 rounded border-neutral-400 text-neutral-700 focus:ring-neutral-400"
                      />
                      <span>{filterMessages.negotiablePrice}</span>
                    </label>

                    <div className="grid gap-2 text-sm">
                      <span className="text-neutral-600">{filterMessages.logistics}</span>
                      <div className="grid gap-2">
                        <label
                          className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                            logisticsTransportOnlyValue
                              ? "border-sky-400 bg-sky-100/70 text-sky-900 shadow-[0_0_0_1px_rgba(56,189,248,0.15)]"
                              : "border-neutral-300 bg-white text-neutral-700"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={logisticsTransportOnlyValue}
                            onChange={(event) => {
                              setValue("logisticsTransportOnly", event.target.checked, {
                                shouldDirty: true,
                                shouldTouch: true,
                              });
                            }}
                            onKeyDown={handleCheckboxEnterToggle}
                            className="h-4 w-4 rounded border-neutral-400 text-neutral-700 focus:ring-neutral-400"
                          />
                          <span>{filterMessages.transport}</span>
                        </label>
                        <label
                          className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                            logisticsUnloadingOnlyValue
                              ? "border-sky-400 bg-sky-100/70 text-sky-900 shadow-[0_0_0_1px_rgba(56,189,248,0.15)]"
                              : "border-neutral-300 bg-white text-neutral-700"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={logisticsUnloadingOnlyValue}
                            onChange={(event) => {
                              setValue("logisticsUnloadingOnly", event.target.checked, {
                                shouldDirty: true,
                                shouldTouch: true,
                              });
                            }}
                            onKeyDown={handleCheckboxEnterToggle}
                            className="h-4 w-4 rounded border-neutral-400 text-neutral-700 focus:ring-neutral-400"
                          />
                          <span>{filterMessages.unloading}</span>
                        </label>
                      </div>
                    </div>

                    <div className="grid gap-2 text-sm">
                      <span className="text-neutral-600">{filterMessages.price}</span>
                      <div
                        className={`grid gap-2 rounded-md border p-3 ${
                          isPriceFilterApplied
                            ? "border-sky-400 bg-sky-100/70 shadow-[0_0_0_1px_rgba(56,189,248,0.15)]"
                            : "border-neutral-300 bg-white"
                        }`}
                      >
                        <div className="grid gap-2 sm:grid-cols-2">
                          <label className="grid gap-1">
                            <span className="text-xs text-neutral-500">{filterMessages.currency}</span>
                            <SelectWithChevron
                              value={priceCurrencyValue}
                              onChange={(event) => {
                                setValue(
                                  "priceCurrency",
                                  event.target.value as FiltersFormValues["priceCurrency"],
                                  {
                                    shouldDirty: true,
                                    shouldTouch: true,
                                  },
                                );
                              }}
                              className="h-10 rounded-md border border-neutral-300 bg-white px-3 py-2 pr-10 text-neutral-900"
                            >
                              {PRICE_FILTER_CURRENCIES.map((currency) => (
                                <option key={currency} value={currency}>
                                  {PRICE_CURRENCY_LABEL[currency]}
                                </option>
                              ))}
                            </SelectWithChevron>
                          </label>
                          <label className="grid gap-1">
                            <span className="text-xs text-neutral-500">{filterMessages.variant}</span>
                            <SelectWithChevron
                              value={priceTaxModeValue}
                              onChange={(event) => {
                                setValue(
                                  "priceTaxMode",
                                  event.target.value as FiltersFormValues["priceTaxMode"],
                                  {
                                    shouldDirty: true,
                                    shouldTouch: true,
                                  },
                                );
                              }}
                              className="h-10 rounded-md border border-neutral-300 bg-white px-3 py-2 pr-10 text-neutral-900"
                            >
                              {PRICE_TAX_MODES.map((priceTaxMode) => (
                                <option key={priceTaxMode} value={priceTaxMode}>
                                  {getPriceTaxModeLabel(messages, priceTaxMode)}
                                </option>
                              ))}
                            </SelectWithChevron>
                          </label>
                        </div>

                        <div className="grid gap-2 sm:grid-cols-2">
                          <label className="grid gap-1">
                            <span className="text-xs text-neutral-500">{filterMessages.min}</span>
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              inputMode="decimal"
                              value={priceMinInputValue}
                              onChange={(event) => {
                                setValue("priceMinInput", event.target.value, {
                                  shouldDirty: true,
                                  shouldTouch: true,
                                });
                              }}
                              className={`w-full min-w-0 rounded-md border px-3 py-2 text-neutral-900 ${
                                hasPriceRangeFilter
                                  ? "border-sky-400 bg-sky-100/70 shadow-[0_0_0_1px_rgba(56,189,248,0.15)]"
                                  : "border-neutral-300 bg-white"
                              }`}
                              placeholder={filterMessages.fromPlaceholder}
                            />
                          </label>
                          <label className="grid gap-1">
                            <span className="text-xs text-neutral-500">{filterMessages.max}</span>
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              inputMode="decimal"
                              value={priceMaxInputValue}
                              onChange={(event) => {
                                setValue("priceMaxInput", event.target.value, {
                                  shouldDirty: true,
                                  shouldTouch: true,
                                });
                              }}
                              className={`w-full min-w-0 rounded-md border px-3 py-2 text-neutral-900 ${
                                hasPriceRangeFilter
                                  ? "border-sky-400 bg-sky-100/70 shadow-[0_0_0_1px_rgba(56,189,248,0.15)]"
                                  : "border-neutral-300 bg-white"
                              }`}
                              placeholder={filterMessages.toPlaceholder}
                            />
                          </label>
                        </div>
                      </div>
                    </div>

                    <label className="grid gap-1 text-sm">
                      <span className="text-neutral-600">{filterMessages.productionYearFrom}</span>
                      <input
                        type="number"
                        min={1900}
                        max={2100}
                        step={1}
                        inputMode="numeric"
                        value={productionYearInputValue}
                        onChange={(event) => {
                          setValue("productionYearInput", event.target.value, {
                            shouldDirty: true,
                            shouldTouch: true,
                          });
                        }}
                        className={`w-full min-w-0 rounded-md border px-3 py-2 text-neutral-900 ${
                          productionYearInputValue.trim().length > 0
                            ? "border-sky-400 bg-sky-100/70 shadow-[0_0_0_1px_rgba(56,189,248,0.15)]"
                            : "border-neutral-300 bg-white"
                        }`}
                        placeholder={filterMessages.productionYearPlaceholder}
                      />
                    </label>

                    <div className="grid gap-2 text-sm">
                      <span className="text-neutral-600">{filterMessages.certification}</span>
                      <div className="grid gap-2">
                        <label
                          className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                            hasCscPlateOnlyValue
                              ? "border-sky-400 bg-sky-100/70 text-sky-900 shadow-[0_0_0_1px_rgba(56,189,248,0.15)]"
                              : "border-neutral-300 bg-white text-neutral-700"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={hasCscPlateOnlyValue}
                            onChange={(event) => {
                              setValue("hasCscPlateOnly", event.target.checked, {
                                shouldDirty: true,
                                shouldTouch: true,
                              });
                            }}
                            onKeyDown={handleCheckboxEnterToggle}
                            className="h-4 w-4 rounded border-neutral-400 text-neutral-700 focus:ring-neutral-400"
                          />
                          <span>{filterMessages.cscPlate}</span>
                        </label>
                        <label
                          className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                            hasCscCertificationOnlyValue
                              ? "border-sky-400 bg-sky-100/70 text-sky-900 shadow-[0_0_0_1px_rgba(56,189,248,0.15)]"
                              : "border-neutral-300 bg-white text-neutral-700"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={hasCscCertificationOnlyValue}
                            onChange={(event) => {
                              setValue("hasCscCertificationOnly", event.target.checked, {
                                shouldDirty: true,
                                shouldTouch: true,
                              });
                            }}
                            onKeyDown={handleCheckboxEnterToggle}
                            className="h-4 w-4 rounded border-neutral-400 text-neutral-700 focus:ring-neutral-400"
                          />
                          <span>{filterMessages.cscCertification}</span>
                        </label>
                      </div>
                    </div>

                    <label className="grid gap-1 text-sm">
                      <span className="text-neutral-600">{filterMessages.ralColors}</span>
                      <input
                        value={containerRalInputValue}
                        onChange={(event) => {
                          setValue("containerRalInput", event.target.value, {
                            shouldDirty: true,
                            shouldTouch: true,
                          });
                        }}
                        placeholder={filterMessages.ralPlaceholder}
                        className={`w-full min-w-0 rounded-md border px-3 py-2 text-neutral-900 ${
                          containerRalInputValue.trim().length > 0
                            ? "border-sky-400 bg-sky-100/70 shadow-[0_0_0_1px_rgba(56,189,248,0.15)]"
                            : "border-neutral-300 bg-white"
                        }`}
                      />
                    </label>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-neutral-200 px-4 py-4">
                  <button
                    type="button"
                    onClick={() => {
                      clearAllFilters();
                      setOpenMultiFilters({
                        sizes: false,
                        heights: false,
                        types: false,
                        conditions: false,
                        features: false,
                      });
                    }}
                    className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700"
                  >
                    {filterMessages.clearAll}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileAdditionalFiltersOpen(false);
                    }}
                    className="rounded-md bg-[#0c3466] px-4 py-2 text-sm font-semibold text-white"
                  >
                    {filterMessages.closeFiltersModal}
                  </button>
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export const ContainerListingsFilters = memo(ContainerListingsFiltersComponent);
