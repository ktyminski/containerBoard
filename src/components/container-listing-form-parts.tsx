"use client";

import NextImage from "next/image";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { type ContainerModuleMessages } from "@/components/container-modules-i18n";
import {
  getContainerFeatureLabel,
  getContainerFeatureOptions,
  type ContainerListingsMessages,
} from "@/components/container-listings-i18n";
import {
  normalizeContainerFeatures,
  type CompanyLocationPrefillOption,
} from "@/components/container-listing-form-shared";
import { getCountryFlagEmoji, getCountryFlagSvgUrl } from "@/lib/country-flags";
import { formatTemplate } from "@/lib/i18n";
import type { ContainerFeature } from "@/lib/container-listing-types";

type LocationFlagProps = {
  country?: string;
  className?: string;
};

export function LocationFlag({ country, className }: LocationFlagProps) {
  const flagUrl = getCountryFlagSvgUrl(country);
  if (flagUrl) {
    return (
      <NextImage
        src={flagUrl}
        alt=""
        aria-hidden="true"
        width={16}
        height={12}
        unoptimized
        className={`inline-block h-3 w-4 rounded-[2px] border border-neutral-400/60 object-cover ${className ?? ""}`}
      />
    );
  }

  const emoji = getCountryFlagEmoji(country);
  if (emoji === "??") {
    return null;
  }

  return (
    <span aria-hidden="true" className={className}>
      {emoji}
    </span>
  );
}

type FormSectionProps = {
  id?: string;
  title: string;
  description?: ReactNode;
  optional?: boolean;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
};

export function FormSection({
  id,
  title,
  description,
  optional = false,
  className,
  contentClassName,
  children,
}: FormSectionProps) {
  return (
    <section
      id={id}
      className={`rounded-md border border-neutral-300 bg-neutral-50/95 p-3 ${className ?? ""}`}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-neutral-900">{title}</p>
        {optional ? (
          <span className="rounded-md border border-neutral-300 bg-white px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-neutral-600">
            opcjonalnie
          </span>
        ) : null}
      </div>
      {description ? (
        <div className="mb-3 text-xs text-neutral-500">{description}</div>
      ) : null}
      <div className={contentClassName ?? "grid gap-3"}>{children}</div>
    </section>
  );
}

type CompanyLocationPrefillDropdownProps = {
  options: CompanyLocationPrefillOption[];
  onApply: (selectedOptions: CompanyLocationPrefillOption[]) => void;
  onClear: () => void;
  variant?: "light" | "dark";
  messages: ContainerModuleMessages["shared"];
};

export function CompanyLocationPrefillDropdown({
  options,
  onApply,
  onClear,
  variant = "dark",
  messages,
}: CompanyLocationPrefillDropdownProps) {
  const detailsRef = useRef<HTMLDetailsElement | null>(null);
  const isLight = variant === "light";
  const [checkedIds, setCheckedIds] = useState<string[]>(() =>
    options.length > 0 ? [options[0].id] : [],
  );
  const resolvedCheckedIds = useMemo(() => {
    const validCheckedIds = checkedIds.filter((id) =>
      options.some((option) => option.id === id),
    );
    if (validCheckedIds.length > 0 || checkedIds.length === 0) {
      return validCheckedIds;
    }
    return options.length > 0 ? [options[0].id] : [];
  }, [checkedIds, options]);

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
      const detailsElement = detailsRef.current;
      if (!detailsElement?.open) {
        return;
      }
      detailsElement.removeAttribute("open");
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  if (options.length === 0) {
    return null;
  }

  if (options.length === 1) {
    return (
      <button
        type="button"
        onClick={() => {
          onApply([options[0]]);
        }}
        className={
          isLight
            ? "inline-flex h-9 items-center rounded-md border border-neutral-300 bg-white px-3 text-sm font-normal text-neutral-700 transition hover:bg-neutral-100"
            : "inline-flex h-9 items-center rounded-md border border-neutral-600 px-3 text-sm font-normal text-neutral-200 transition hover:border-neutral-500 hover:bg-neutral-800 hover:text-white"
        }
      >
        {messages.setFromCompany}
      </button>
    );
  }

  return (
    <details ref={detailsRef} className="relative">
      <summary
        className={`relative flex h-9 cursor-pointer list-none items-center rounded-md px-3 pr-8 text-sm font-normal transition [&::-webkit-details-marker]:hidden ${
          isLight
            ? "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100"
            : "border border-neutral-600 text-neutral-200 hover:border-neutral-500 hover:bg-neutral-800 hover:text-white"
        }`}
      >
        {messages.setFromCompany}
        <svg
          viewBox="0 0 20 20"
          aria-hidden="true"
          className={`pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 ${
            isLight ? "text-neutral-500" : "text-neutral-400"
          }`}
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
        className={`absolute right-0 top-full z-50 mt-1 min-w-[240px] rounded-md shadow-lg ${
          isLight
            ? "border border-neutral-300 bg-white"
            : "border border-neutral-700 bg-neutral-900"
        }`}
      >
        <div className="max-h-64 overflow-y-auto p-1">
          {options.map((option) => {
            const isChecked = resolvedCheckedIds.includes(option.id);
            return (
              <label
                key={option.id}
                className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs ${
                  isLight
                    ? "text-neutral-700 hover:bg-neutral-100"
                    : "text-neutral-200 hover:bg-neutral-800"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(event) => {
                    const isNextChecked = event.target.checked;
                    setCheckedIds((current) => {
                      if (isNextChecked) {
                        if (current.includes(option.id)) {
                          return current;
                        }
                        return [...current, option.id];
                      }
                      return current.filter((id) => id !== option.id);
                    });
                  }}
                  className={`h-4 w-4 rounded ${
                    isLight
                      ? "border-neutral-400 bg-white text-[#2f639a] focus:ring-[#4e86c3]"
                      : "border-neutral-500 bg-neutral-900 text-[#2f639a] focus:ring-[#4e86c3]"
                  }`}
                />
                <span className="min-w-0 truncate">{option.name}</span>
              </label>
            );
          })}
        </div>
        <div
          className={`flex items-center justify-end gap-2 border-t px-2 py-2 ${
            isLight ? "border-neutral-200" : "border-neutral-700"
          }`}
        >
          <button
            type="button"
            onClick={() => {
              setCheckedIds([]);
              onClear();
              detailsRef.current?.removeAttribute("open");
            }}
            className={`rounded-md px-2 py-1 text-[11px] ${
              isLight
                ? "text-neutral-600 hover:bg-neutral-100"
                : "text-neutral-300 hover:bg-neutral-800"
            }`}
          >
            {messages.clear}
          </button>
          <button
            type="button"
            disabled={resolvedCheckedIds.length === 0}
            onClick={() => {
              const selectedOptions = options.filter((option) =>
                resolvedCheckedIds.includes(option.id),
              );
              if (selectedOptions.length === 0) {
                return;
              }
              onApply(selectedOptions);
              detailsRef.current?.removeAttribute("open");
            }}
            className={`rounded-md px-2 py-1 text-[11px] ${
              isLight
                ? "border border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400 hover:bg-neutral-100"
                : "border border-neutral-600 text-neutral-200 hover:border-neutral-500 hover:bg-neutral-800 hover:text-white"
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {messages.apply}
          </button>
        </div>
      </div>
    </details>
  );
}

type ContainerFeaturesMultiSelectProps = {
  values: ContainerFeature[];
  onChange: (next: ContainerFeature[]) => void;
  onBlur: () => void;
  messages: ContainerModuleMessages["shared"];
  listingMessages: ContainerListingsMessages;
};

export function ContainerFeaturesMultiSelect({
  values,
  onChange,
  onBlur,
  messages,
  listingMessages,
}: ContainerFeaturesMultiSelectProps) {
  const detailsRef = useRef<HTMLDetailsElement | null>(null);
  const selectedCount = values.length;
  const selectedSummaryLabel =
    selectedCount === 0
      ? messages.any
      : selectedCount === 1
        ? values[0]
          ? getContainerFeatureLabel(listingMessages, values[0])
          : messages.oneSelected
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
      onBlur();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      const detailsElement = detailsRef.current;
      if (!detailsElement?.open) {
        return;
      }
      detailsElement.removeAttribute("open");
      onBlur();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onBlur]);

  const toggleFeature = (feature: ContainerFeature) => {
    const isSelected = values.includes(feature);
    const nextValues = isSelected
      ? values.filter((value) => value !== feature)
      : [...values, feature];
    onChange(normalizeContainerFeatures(nextValues));
  };

  return (
    <div className="grid gap-2">
      <details
        ref={detailsRef}
        className="relative"
        onToggle={(event) => {
          if (!event.currentTarget.open) {
            onBlur();
          }
        }}
      >
        <summary className="multi-checkbox-summary relative flex h-10 w-full cursor-pointer list-none items-center rounded-md border border-neutral-700 bg-neutral-950 px-3 pr-11 text-sm text-neutral-100 [&::-webkit-details-marker]:hidden">
          <span
            className={`block min-w-0 truncate ${
              selectedCount > 0 ? "text-neutral-100" : "text-neutral-500"
            }`}
            title={selectedSummaryLabel}
          >
            {selectedSummaryLabel}
          </span>
          <svg
            viewBox="0 0 20 20"
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
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
        <div className="absolute left-0 top-full z-40 mt-1 w-full rounded-md border border-neutral-700 bg-neutral-900 p-2 shadow-lg">
          <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
            {getContainerFeatureOptions(listingMessages).map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-neutral-200 hover:bg-neutral-800"
              >
                <input
                  type="checkbox"
                  checked={values.includes(option.value)}
                  onChange={() => {
                    toggleFeature(option.value);
                  }}
                  className="h-4 w-4 rounded border-neutral-500 bg-neutral-900 text-[#2f639a] focus:ring-[#4e86c3]"
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              onChange([]);
            }}
            className="mt-2 w-full rounded-md border border-neutral-600 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:border-neutral-500 hover:bg-neutral-800"
          >
            {messages.clear}
          </button>
        </div>
      </details>

      {values.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {values.map((feature) => (
            <span
              key={feature}
              className="inline-flex items-center gap-1 rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs font-medium text-neutral-200"
            >
              <span>{getContainerFeatureLabel(listingMessages, feature)}</span>
              <button
                type="button"
                onClick={() => {
                  toggleFeature(feature);
                }}
                className="rounded px-1 text-neutral-200 hover:bg-neutral-800"
                aria-label={formatTemplate(messages.removeFeature, {
                  label: getContainerFeatureLabel(listingMessages, feature),
                })}
              >
                x
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
