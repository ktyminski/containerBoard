import type {
  Currency,
  ListingPrice,
  TaxMode,
} from "@/lib/container-listing-types";
import { getFallbackFxContext, type FxContext } from "@/lib/fx-rates";

export type ListingPriceInput = {
  original: {
    amount: number | null;
    currency: Currency | null;
    taxMode: TaxMode | null;
    vatRate: number | null;
    negotiable: boolean;
  };
};

function roundMoney(value: number): number {
  return Math.round(value);
}

export function getFxContext(now = new Date()): FxContext {
  return getFallbackFxContext(now);
}

function convertToPln(amount: number, currency: Currency, fx: FxContext): number {
  if (currency === "PLN") {
    return amount;
  }
  if (currency === "EUR") {
    return amount * fx.plnPerEur;
  }
  return amount * fx.plnPerUsd;
}

function convertFromPln(amountPln: number, currency: Currency, fx: FxContext): number {
  if (currency === "PLN") {
    return amountPln;
  }
  if (currency === "EUR") {
    return amountPln / fx.plnPerEur;
  }
  return amountPln / fx.plnPerUsd;
}

function convertAmountSet(amount: number | null, currency: Currency | null, fx: FxContext): {
  amountPln: number | null;
  amountEur: number | null;
  amountUsd: number | null;
} {
  if (amount === null || currency === null) {
    return {
      amountPln: null,
      amountEur: null,
      amountUsd: null,
    };
  }

  const amountPln = convertToPln(amount, currency, fx);
  return {
    amountPln: roundMoney(amountPln),
    amountEur: roundMoney(convertFromPln(amountPln, "EUR", fx)),
    amountUsd: roundMoney(convertFromPln(amountPln, "USD", fx)),
  };
}

function toNullableVatRate(vatRate: number | null): number | null {
  if (typeof vatRate !== "number" || !Number.isFinite(vatRate)) {
    return null;
  }

  if (vatRate < 0 || vatRate > 100) {
    return null;
  }

  return vatRate;
}

function toNullableAmount(amount: number | null): number | null {
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) {
    return null;
  }

  return roundMoney(amount);
}

export function normalizeListingPrice(
  input: ListingPriceInput,
  now = new Date(),
  fxContext: FxContext = getFallbackFxContext(now),
): ListingPrice {
  const fx = fxContext;
  const vatRate = toNullableVatRate(input.original.vatRate);
  const amount = toNullableAmount(input.original.amount);
  const currency = input.original.currency;
  const taxMode = input.original.taxMode;

  let normalizedNetSourceAmount: number | null = null;
  let normalizedGrossSourceAmount: number | null = null;

  if (amount !== null && currency !== null && taxMode !== null) {
    if (taxMode === "net") {
      normalizedNetSourceAmount = amount;
      normalizedGrossSourceAmount =
        vatRate !== null ? roundMoney(amount * (1 + vatRate / 100)) : null;
    } else {
      normalizedGrossSourceAmount = amount;
      normalizedNetSourceAmount =
        vatRate !== null ? roundMoney(amount / (1 + vatRate / 100)) : null;
    }
  }

  return {
    original: {
      amount,
      currency: input.original.currency,
      taxMode: input.original.taxMode,
      vatRate,
      negotiable: input.original.negotiable === true,
    },
    normalized: {
      net: convertAmountSet(normalizedNetSourceAmount, currency, fx),
      gross: convertAmountSet(normalizedGrossSourceAmount, currency, fx),
      fxDate: currency ? fx.fxDate : null,
      fxSource: currency ? fx.fxSource : null,
    },
  };
}

export function buildLegacyListingPrice(input: {
  amount?: number;
  negotiable?: boolean;
  now?: Date;
  fxContext?: FxContext;
}): ListingPrice | null {
  if (typeof input.amount !== "number" || !Number.isFinite(input.amount) || input.amount < 0) {
    return null;
  }

  return normalizeListingPrice(
    {
      original: {
        amount: input.amount,
        currency: "PLN",
        taxMode: "net",
        vatRate: null,
        negotiable: input.negotiable === true,
      },
    },
    input.now ?? new Date(),
    input.fxContext,
  );
}
