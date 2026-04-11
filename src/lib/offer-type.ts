export const OFFER_TYPE = {
  TRANSPORT: "transport",
  COOPERATION: "cooperation",
} as const;

export type OfferType = (typeof OFFER_TYPE)[keyof typeof OFFER_TYPE];

export const OFFER_TYPES: OfferType[] = [OFFER_TYPE.TRANSPORT, OFFER_TYPE.COOPERATION];

export function normalizeOfferType(value: unknown): OfferType {
  return value === OFFER_TYPE.TRANSPORT ? OFFER_TYPE.TRANSPORT : OFFER_TYPE.COOPERATION;
}
