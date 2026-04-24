import type {
  Container,
  ContainerCondition,
  ContainerFeature,
  ContainerHeight,
  ContainerType,
  TaxMode,
} from "@/lib/container-listing-types";
import {
  CONTAINER_CONDITION_LABEL,
  CONTAINER_FEATURE_LABEL,
  CONTAINER_HEIGHT_LABEL,
  CONTAINER_SIZE,
  CONTAINER_TYPE,
  CONTAINER_TYPE_LABEL,
} from "@/lib/container-listing-types";
import { formatTemplate, type AppMessages } from "@/lib/i18n";
import type {
  FormContainerSize,
  ListingKind,
  PriceDisplayCurrency,
  SortPreset,
} from "@/components/container-listings-shared";

export type ContainerListingsMessages = AppMessages["containerListings"];

export const CONTAINER_FILTER_LABELS_EN = {
  size: "Length",
  height: "Height",
  type: "Type",
  condition: "Condition",
  feature: "Features",
  any: "Any",
} as const;

export function getListingKindLabel(
  messages: ContainerListingsMessages,
  kind: ListingKind,
): string {
  return messages.shared.listingKinds[kind];
}

export function getListingKindOptions(messages: ContainerListingsMessages) {
  return (["sell", "rent", "buy"] as const).map((value) => ({
    value,
    label: getListingKindLabel(messages, value),
  }));
}

export function getSortOptions(messages: ContainerListingsMessages) {
  const labels = messages.shared.sortPresets;
  return ([
    "newest",
    "quantity_desc",
    "quantity_asc",
    "available_asc",
    "price_net_asc",
    "price_net_desc",
  ] as const satisfies readonly SortPreset[]).map((value) => ({
    value,
    label: labels[value],
  }));
}

export function getPriceDisplayOptions(messages: ContainerListingsMessages) {
  const originalLabel = messages.shared.priceDisplayCurrencies.original;
  return [
    { value: "original" as const, label: originalLabel },
    { value: "PLN" as const, label: "PLN" },
    { value: "EUR" as const, label: "EUR" },
    { value: "USD" as const, label: "USD" },
  ] satisfies Array<{ value: PriceDisplayCurrency; label: string }>;
}

export function getPriceTaxModeLabel(
  messages: ContainerListingsMessages,
  value: TaxMode,
): string {
  return messages.shared.taxModes[value];
}

export function getContainerConditionLabel(
  messages: ContainerListingsMessages,
  value: ContainerCondition,
): string {
  return messages.shared.containerConditions[value];
}

export function getContainerFeatureLabel(
  messages: ContainerListingsMessages,
  value: ContainerFeature,
): string {
  return messages.shared.containerFeatures[value];
}

export function getContainerHeightLabel(
  messages: ContainerListingsMessages,
  value: ContainerHeight,
): string {
  return messages.shared.containerHeights[value];
}

export function getContainerTypeLabel(
  messages: ContainerListingsMessages,
  value: ContainerType,
): string {
  const baseLabel = messages.shared.containerTypes[value];
  if (value === CONTAINER_TYPE.DRY) {
    return `${baseLabel} (DV | GP)`;
  }
  return baseLabel;
}

export function getContainerSizeOptions(messages: ContainerListingsMessages) {
  return [
    { value: "10" as const, label: "10 ft" },
    { value: "20" as const, label: "20 ft" },
    { value: "40" as const, label: "40 ft" },
    { value: "45" as const, label: "45 ft" },
    { value: "53" as const, label: "53 ft" },
    {
      value: "custom" as const,
      label: messages.shared.customContainerSize,
    },
  ] satisfies Array<{ value: FormContainerSize; label: string }>;
}

export function getContainerSizeFilterOptions() {
  return [
    { value: "10" as const, label: "10 ft" },
    { value: "20" as const, label: "20 ft" },
    { value: "40" as const, label: "40 ft" },
    { value: "45" as const, label: "45 ft" },
    { value: "53" as const, label: "53 ft" },
    {
      value: "custom" as const,
      label: "Other / custom",
    },
  ] satisfies Array<{ value: FormContainerSize; label: string }>;
}

export function getContainerHeightOptions(messages: ContainerListingsMessages) {
  return (["standard", "HC"] as const).map((value) => ({
    value,
    label: getContainerHeightLabel(messages, value),
  }));
}

export function getContainerHeightFilterOptions() {
  return (["standard", "HC"] as const).map((value) => ({
    value,
    label: CONTAINER_HEIGHT_LABEL[value],
  }));
}

export function getContainerTypeOptions(messages: ContainerListingsMessages) {
  return (
    [
      "dry",
      "reefer",
      "open_top",
      "flat_rack",
      "tank",
      "side_open",
      "hard_top",
      "platform",
      "bulk",
    ] as const
  ).map((value) => ({
    value,
    label: getContainerTypeLabel(messages, value),
  }));
}

export function getContainerTypeFilterOptions() {
  return (
    [
      "dry",
      "reefer",
      "open_top",
      "flat_rack",
      "tank",
      "side_open",
      "hard_top",
      "platform",
      "bulk",
    ] as const
  ).map((value) => ({
    value,
    label:
      value === CONTAINER_TYPE.DRY
        ? `${CONTAINER_TYPE_LABEL[value]} (DV | GP)`
        : CONTAINER_TYPE_LABEL[value],
  }));
}

export function getContainerConditionOptions(messages: ContainerListingsMessages) {
  return (
    ["new", "one_trip", "cargo_worthy", "wind_water_tight", "as_is"] as const
  ).map((value) => ({
    value,
    label: getContainerConditionLabel(messages, value),
  }));
}

export function getContainerConditionFilterOptions() {
  return (
    ["new", "one_trip", "cargo_worthy", "wind_water_tight", "as_is"] as const
  ).map((value) => ({
    value,
    label: CONTAINER_CONDITION_LABEL[value],
  }));
}

export function getContainerFeatureOptions(messages: ContainerListingsMessages) {
  return (
    [
      "double_door",
      "pallet_wide",
      "insulated",
      "ventilated",
      "dangerous_goods",
      "food_grade",
      "open_side_full",
      "crane_lugs",
      "forklift_pockets",
      "removable_roof",
      "high_security_lockbox",
      "extra_vents",
    ] as const
  ).map((value) => ({
    value,
    label: getContainerFeatureLabel(messages, value),
  }));
}

export function getContainerFeatureFilterOptions() {
  return (
    [
      "double_door",
      "pallet_wide",
      "insulated",
      "ventilated",
      "dangerous_goods",
      "food_grade",
      "open_side_full",
      "crane_lugs",
      "forklift_pockets",
      "removable_roof",
      "high_security_lockbox",
      "extra_vents",
    ] as const
  ).map((value) => ({
    value,
    label: CONTAINER_FEATURE_LABEL[value],
  }));
}

export function getContainerShortLabelLocalized(
  messages: ContainerListingsMessages,
  container: Container,
): string {
  const sizeLabel =
    container.size === CONTAINER_SIZE.CUSTOM
      ? messages.shared.customContainerShort
      : `${container.size}'${container.height === "HC" ? "HC" : ""}`;
  const typeLabel = getContainerTypeLabel(messages, container.type);
  return `${sizeLabel} ${typeLabel}`;
}

export function formatCountTemplate(
  template: string,
  count: number,
): string {
  return formatTemplate(template, { count });
}
