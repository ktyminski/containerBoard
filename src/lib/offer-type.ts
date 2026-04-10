export const OFFER_TYPE = {
  TRANSPORT: "transport",
  COOPERATION: "cooperation",
} as const;

export const OFFER_TYPES = [OFFER_TYPE.TRANSPORT, OFFER_TYPE.COOPERATION] as const;

export type OfferType = (typeof OFFER_TYPES)[number];

const OFFER_TYPE_SET = new Set<string>(OFFER_TYPES);

export function normalizeOfferType(value?: string | null): OfferType {
  if (!value) {
    return OFFER_TYPE.COOPERATION;
  }
  return OFFER_TYPE_SET.has(value) ? (value as OfferType) : OFFER_TYPE.COOPERATION;
}
