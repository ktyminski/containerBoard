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
import { useFormContext, useWatch } from "react-hook-form";
import {
  getContainerConditionOptions,
  getContainerFeatureOptions,
  getContainerHeightOptions,
  getContainerSizeOptions,
  getContainerTypeOptions,
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

type ContainerListingsFiltersProps = {
  messages: ContainerListingsMessages;
  children: ReactNode;
  locationControlsRef: RefObject<HTMLDivElement | null>;
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
  const [openMultiFilters, setOpenMultiFilters] = useState<
    Record<MultiFilterKey, boolean>
  >({
    sizes: false,
    heights: false,
    types: false,
    conditions: false,
    features: false,
  });

  const isAnyMultiFilterOpen = useMemo(
    () => Object.values(openMultiFilters).some(Boolean),
    [openMultiFilters],
  );

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
    () => getContainerSizeOptions(messages),
    [messages],
  );
  const containerHeightOptions = useMemo(
    () => getContainerHeightOptions(messages),
    [messages],
  );
  const containerTypeOptions = useMemo(
    () => getContainerTypeOptions(messages),
    [messages],
  );
  const containerConditionOptions = useMemo(
    () => getContainerConditionOptions(messages),
    [messages],
  );
  const containerFeatureOptions = useMemo(
    () => getContainerFeatureOptions(messages),
    [messages],
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

  return (
    <>
      <input type="hidden" {...register("listingKind")} />
      <section className="sticky top-[4.5rem] z-30 rounded-md border border-neutral-300 bg-neutral-50/95 p-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-neutral-50/90">
        <div className="grid gap-2 grid-cols-[minmax(100px,0.85fr)_minmax(100px,0.85fr)_minmax(100px,1fr)_minmax(100px,1fr)_minmax(360px,3fr)]">
          <MultiCheckboxFilter
            messages={filterMessages}
            label={filterMessages.size}
            values={selectedContainerSizes}
            options={containerSizeOptions}
            onOpenChange={(isOpen) => {
              setOpenMultiFilters((current) => ({ ...current, sizes: isOpen }));
            }}
            onToggle={(value) => {
              setValue(
                "containerSizes",
                toggleMultiValue(selectedContainerSizes, value),
                {
                  shouldDirty: true,
                  shouldTouch: true,
                },
              );
            }}
            onClear={() => {
              setValue("containerSizes", [], {
                shouldDirty: true,
                shouldTouch: true,
              });
            }}
          />

          <MultiCheckboxFilter
            messages={filterMessages}
            label={filterMessages.height}
            values={selectedContainerHeights}
            options={containerHeightOptions}
            onOpenChange={(isOpen) => {
              setOpenMultiFilters((current) => ({
                ...current,
                heights: isOpen,
              }));
            }}
            onToggle={(value) => {
              setValue(
                "containerHeights",
                toggleMultiValue(selectedContainerHeights, value),
                {
                  shouldDirty: true,
                  shouldTouch: true,
                },
              );
            }}
            onClear={() => {
              setValue("containerHeights", [], {
                shouldDirty: true,
                shouldTouch: true,
              });
            }}
          />

          <MultiCheckboxFilter
            messages={filterMessages}
            label={filterMessages.type}
            values={selectedContainerTypes}
            options={containerTypeOptions}
            onOpenChange={(isOpen) => {
              setOpenMultiFilters((current) => ({ ...current, types: isOpen }));
            }}
            onToggle={(value) => {
              setValue(
                "containerTypes",
                toggleMultiValue(selectedContainerTypes, value),
                {
                  shouldDirty: true,
                  shouldTouch: true,
                },
              );
            }}
            onClear={() => {
              setValue("containerTypes", [], {
                shouldDirty: true,
                shouldTouch: true,
              });
            }}
          />

          <MultiCheckboxFilter
            messages={filterMessages}
            label={filterMessages.condition}
            values={selectedContainerConditions}
            options={containerConditionOptions}
            getOptionAccentClassName={(value) =>
              CONTAINER_CONDITION_COLOR_TOKENS[value].dotClassName
            }
            onOpenChange={(isOpen) => {
              setOpenMultiFilters((current) => ({
                ...current,
                conditions: isOpen,
              }));
            }}
            onToggle={(value) => {
              setValue(
                "containerConditions",
                toggleMultiValue(selectedContainerConditions, value),
                {
                  shouldDirty: true,
                  shouldTouch: true,
                },
              );
            }}
            onClear={() => {
              setValue("containerConditions", [], {
                shouldDirty: true,
                shouldTouch: true,
              });
            }}
          />
          <div
            ref={locationControlsRef}
            className="grid h-full self-stretch gap-2 grid-cols-[minmax(220px,1fr)_minmax(100px,130px)_auto]"
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
              className={`h-full min-h-12 rounded-md border px-3 py-2 pr-10 ${
                isLocationApplied
                  ? "border-sky-400 bg-sky-100/70 text-sky-800 shadow-[0_0_0_1px_rgba(56,189,248,0.15)]"
                  : "border-neutral-300 bg-white text-neutral-900"
              }`}
              onBlur={restoreAppliedLocationOnBlur}
            >
              {LOCATION_RADIUS_OPTIONS.map((value) => (
                <option key={value} value={String(value)}>
                  +{value} km
                </option>
              ))}
            </SelectWithChevron>
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
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="h-fit min-w-0 rounded-md border border-neutral-300 bg-neutral-50/95 p-4 shadow-sm lg:sticky lg:top-[11rem] lg:z-20 lg:max-h-[calc(100dvh-12rem)] lg:overflow-y-auto">
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
              <MultiCheckboxFilter
                messages={filterMessages}
                label={filterMessages.feature}
                values={selectedContainerFeatures}
                options={containerFeatureOptions}
                onOpenChange={(isOpen) => {
                  setOpenMultiFilters((current) => ({
                    ...current,
                    features: isOpen,
                  }));
                }}
                onToggle={(value) => {
                  setValue(
                    "containerFeatures",
                    toggleMultiValue(selectedContainerFeatures, value),
                    {
                      shouldDirty: true,
                      shouldTouch: true,
                    },
                  );
                }}
                onClear={() => {
                  setValue("containerFeatures", [], {
                    shouldDirty: true,
                    shouldTouch: true,
                  });
                }}
                className="relative"
                dropdownClassName="w-full"
              />
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
    </>
  );
}

export const ContainerListingsFilters = memo(ContainerListingsFiltersComponent);
