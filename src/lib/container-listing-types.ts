export const LISTING_TYPES = ["available", "wanted"] as const;
export const CONTAINER_TYPES = [
  "20DV",
  "40DV",
  "40HC",
  "reefer",
  "open_top",
  "flat_rack",
  "other",
] as const;
export const DEAL_TYPES = ["sale", "rent", "one_way", "long_term"] as const;
export const LISTING_STATUSES = ["active", "expired", "closed"] as const;

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
export type ContainerType = (typeof CONTAINER_TYPES)[number];
export type DealType = (typeof DEAL_TYPES)[number];
export type ListingStatus = (typeof LISTING_STATUSES)[number];

