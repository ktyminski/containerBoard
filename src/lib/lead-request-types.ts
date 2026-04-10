export const LEAD_REQUEST_TYPE = {
  TRANSPORT: "transport",
  OTHER: "other",
} as const;

export const LEAD_REQUEST_TYPES = [
  LEAD_REQUEST_TYPE.TRANSPORT,
  LEAD_REQUEST_TYPE.OTHER,
] as const;

export type LeadRequestType = (typeof LEAD_REQUEST_TYPES)[number];

export const LEAD_REQUEST_TRANSPORT_MODE = {
  SEA: "sea",
  RAIL: "rail",
  ROAD: "road",
  AIR: "air",
  ANY: "any",
} as const;

export const LEAD_REQUEST_TRANSPORT_MODES = [
  LEAD_REQUEST_TRANSPORT_MODE.SEA,
  LEAD_REQUEST_TRANSPORT_MODE.RAIL,
  LEAD_REQUEST_TRANSPORT_MODE.ROAD,
  LEAD_REQUEST_TRANSPORT_MODE.AIR,
  LEAD_REQUEST_TRANSPORT_MODE.ANY,
] as const;

export type LeadRequestTransportMode =
  (typeof LEAD_REQUEST_TRANSPORT_MODES)[number];

export const LEAD_REQUEST_STATUS = {
  PENDING: "pending",
  ACTIVE: "active",
  EXPIRED: "expired",
} as const;

export const LEAD_REQUEST_STATUSES = [
  LEAD_REQUEST_STATUS.PENDING,
  LEAD_REQUEST_STATUS.ACTIVE,
  LEAD_REQUEST_STATUS.EXPIRED,
] as const;

export type LeadRequestStatus = (typeof LEAD_REQUEST_STATUSES)[number];

export const LEAD_REQUEST_VALIDITY_DAYS = 14;
