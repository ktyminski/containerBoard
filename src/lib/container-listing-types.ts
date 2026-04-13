export const LISTING_TYPES = ["available", "wanted"] as const;
export const LISTING_STATUSES = ["active", "expired", "closed"] as const;
export const PRICE_CURRENCIES = ["PLN", "EUR", "USD"] as const;
export const PRICE_TYPES = ["fixed", "starting_from", "request"] as const;
export const PRICE_TAX_MODES = ["net", "gross"] as const;

export const CONTAINER_SIZES = [10, 20, 40, 45, 53] as const;
export const CONTAINER_HEIGHTS = ["standard", "HC"] as const;
export const CONTAINER_TYPES = [
  "dry",
  "reefer",
  "open_top",
  "flat_rack",
  "tank",
  "side_open",
  "hard_top",
  "platform",
  "bulk",
] as const;
export const CONTAINER_FEATURES = [
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
] as const;
export const CONTAINER_CONDITIONS = [
  "new",
  "one_trip",
  "cargo_worthy",
  "wind_water_tight",
  "as_is",
] as const;

export const LISTING_TYPE = {
  AVAILABLE: "available",
  WANTED: "wanted",
} as const;

export const LISTING_STATUS = {
  ACTIVE: "active",
  EXPIRED: "expired",
  CLOSED: "closed",
} as const;

export type ListingType = (typeof LISTING_TYPES)[number];
export type ListingStatus = (typeof LISTING_STATUSES)[number];
export type Currency = (typeof PRICE_CURRENCIES)[number];
export type PriceType = (typeof PRICE_TYPES)[number];
export type TaxMode = (typeof PRICE_TAX_MODES)[number];
export type ContainerSize = (typeof CONTAINER_SIZES)[number];
export type ContainerHeight = (typeof CONTAINER_HEIGHTS)[number];
export type ContainerType = (typeof CONTAINER_TYPES)[number];
export type ContainerFeature = (typeof CONTAINER_FEATURES)[number];
export type ContainerCondition = (typeof CONTAINER_CONDITIONS)[number];

export type ListingPrice = {
  type: PriceType;
  original: {
    amount: number | null;
    currency: Currency | null;
    taxMode: TaxMode | null;
    vatRate: number | null;
    negotiable: boolean;
  };
  normalized: {
    net: {
      amountPln: number | null;
      amountEur: number | null;
      amountUsd: number | null;
    };
    gross: {
      amountPln: number | null;
      amountEur: number | null;
      amountUsd: number | null;
    };
    fxDate: string | null;
    fxSource: string | null;
  };
};

export type Container = {
  size: ContainerSize;
  height: ContainerHeight;
  type: ContainerType;
  features: ContainerFeature[];
  condition: ContainerCondition;
};

export const CONTAINER_TYPE_LABEL: Record<ContainerType, string> = {
  dry: "Dry",
  reefer: "Reefer",
  open_top: "Open Top",
  flat_rack: "Flat Rack",
  tank: "Tank",
  side_open: "Side Open",
  hard_top: "Hard Top",
  platform: "Platform",
  bulk: "Bulk",
};

export const CONTAINER_HEIGHT_LABEL: Record<ContainerHeight, string> = {
  standard: "Standard",
  HC: "HC",
};

export const CONTAINER_FEATURE_LABEL: Record<ContainerFeature, string> = {
  double_door: "Double Door",
  pallet_wide: "Pallet Wide",
  insulated: "Insulated",
  ventilated: "Ventilated",
  dangerous_goods: "Dangerous Goods",
  food_grade: "Food Grade",
  open_side_full: "Open Side Full",
  crane_lugs: "Crane Lugs",
  forklift_pockets: "Forklift Pockets",
  removable_roof: "Removable Roof",
  high_security_lockbox: "High Security Lockbox",
  extra_vents: "Extra Vents",
};

export const CONTAINER_CONDITION_LABEL: Record<ContainerCondition, string> = {
  new: "New",
  one_trip: "One Trip",
  cargo_worthy: "Cargo Worthy",
  wind_water_tight: "Wind & Water Tight",
  as_is: "As Is",
};

export const PRICE_CURRENCY_LABEL: Record<Currency, string> = {
  PLN: "PLN",
  EUR: "EUR",
  USD: "USD",
};

export const PRICE_TYPE_LABEL: Record<PriceType, string> = {
  fixed: "Cena stala",
  starting_from: "Cena od",
  request: "Zapytaj o cene",
};

export const PRICE_TAX_MODE_LABEL: Record<TaxMode, string> = {
  net: "Netto",
  gross: "Brutto",
};

export function getContainerShortLabel(container: Container): string {
  const sizeLabel = `${container.size}'${container.height === "HC" ? "HC" : ""}`;
  const typeLabel = CONTAINER_TYPE_LABEL[container.type];
  return `${sizeLabel} ${typeLabel}`;
}
