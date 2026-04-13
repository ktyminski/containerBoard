import { z } from "zod";
import { getDb } from "@/lib/mongodb";
import { getEnv } from "@/lib/env";
import { logError, logWarn } from "@/lib/server-logger";

const FX_COLLECTION_NAME = "fx_rates";
const FX_LATEST_DOCUMENT_ID = "latest";
const FX_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_FALLBACK_PLN_PER_EUR = 4.3;
const DEFAULT_FALLBACK_PLN_PER_USD = 3.95;
const NBP_TIMEOUT_MS = 12_000;

export type FxContext = {
  plnPerEur: number;
  plnPerUsd: number;
  fxDate: string;
  fxSource: string;
};

type FxRatesDocument = FxContext & {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
  lastError?: string;
};

type RefreshFxRatesResult = {
  context: FxContext;
  skipped: boolean;
  usedFallback: boolean;
  error?: string;
};

const nbpRateSchema = z.object({
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mid: z.number().positive(),
});

const nbpResponseSchema = z.object({
  code: z.string().min(1),
  rates: z.array(nbpRateSchema).min(1),
});

let indexesReadyPromise: Promise<void> | null = null;

function parsePositiveFxRate(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value.replace(",", ".").trim());
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function getIsoDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function getFxRatesCollection() {
  const db = await getDb();
  return db.collection<FxRatesDocument>(FX_COLLECTION_NAME);
}

export async function ensureFxRatesIndexes(): Promise<void> {
  if (!indexesReadyPromise) {
    indexesReadyPromise = (async () => {
      const collection = await getFxRatesCollection();
      await collection.createIndex({ updatedAt: -1 });
      await collection.createIndex({ fxDate: -1 });
    })();
  }

  await indexesReadyPromise;
}

export function getFallbackFxContext(now = new Date()): FxContext {
  const env = getEnv();

  const plnPerEur = parsePositiveFxRate(
    env.FX_FALLBACK_PLN_PER_EUR ?? process.env.FX_PLN_PER_EUR,
    DEFAULT_FALLBACK_PLN_PER_EUR,
  );
  const plnPerUsd = parsePositiveFxRate(
    env.FX_FALLBACK_PLN_PER_USD ?? process.env.FX_PLN_PER_USD,
    DEFAULT_FALLBACK_PLN_PER_USD,
  );

  return {
    plnPerEur,
    plnPerUsd,
    fxDate: getIsoDateString(now),
    fxSource:
      env.FX_FALLBACK_SOURCE?.trim() ??
      process.env.FX_SOURCE?.trim() ??
      "env-fallback",
  };
}

function mapDocumentToFxContext(document: FxRatesDocument): FxContext | null {
  const plnPerEur =
    typeof document.plnPerEur === "number" && Number.isFinite(document.plnPerEur)
      ? document.plnPerEur
      : null;
  const plnPerUsd =
    typeof document.plnPerUsd === "number" && Number.isFinite(document.plnPerUsd)
      ? document.plnPerUsd
      : null;
  const fxDate =
    typeof document.fxDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(document.fxDate)
      ? document.fxDate
      : null;
  const fxSource = typeof document.fxSource === "string" ? document.fxSource.trim() : "";

  if (
    plnPerEur === null ||
    plnPerUsd === null ||
    plnPerEur <= 0 ||
    plnPerUsd <= 0 ||
    !fxDate
  ) {
    return null;
  }

  return {
    plnPerEur,
    plnPerUsd,
    fxDate,
    fxSource: fxSource || "db-unknown",
  };
}

async function upsertFxContext(input: {
  context: FxContext;
  now: Date;
  lastError?: string;
}): Promise<void> {
  const collection = await getFxRatesCollection();
  await collection.updateOne(
    { _id: FX_LATEST_DOCUMENT_ID },
    {
      $set: {
        plnPerEur: input.context.plnPerEur,
        plnPerUsd: input.context.plnPerUsd,
        fxDate: input.context.fxDate,
        fxSource: input.context.fxSource,
        updatedAt: input.now,
        ...(input.lastError ? { lastError: input.lastError } : {}),
      },
      $setOnInsert: {
        _id: FX_LATEST_DOCUMENT_ID,
        createdAt: input.now,
      },
      ...(input.lastError ? {} : { $unset: { lastError: "" } }),
    },
    { upsert: true },
  );
}

async function fetchNbpRate(currencyCode: "EUR" | "USD"): Promise<{
  effectiveDate: string;
  mid: number;
}> {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), NBP_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://api.nbp.pl/api/exchangerates/rates/A/${currencyCode}/?format=json`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: abortController.signal,
      },
    );

    if (!response.ok) {
      throw new Error(`NBP ${currencyCode} responded with ${response.status}`);
    }

    const payload = nbpResponseSchema.parse(await response.json());
    if (payload.code.toUpperCase() !== currencyCode) {
      throw new Error(
        `NBP ${currencyCode} payload mismatch (received ${payload.code})`,
      );
    }

    const latestRate = payload.rates[0];
    return {
      effectiveDate: latestRate.effectiveDate,
      mid: latestRate.mid,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchNbpFxContext(): Promise<FxContext> {
  const [eurRate, usdRate] = await Promise.all([
    fetchNbpRate("EUR"),
    fetchNbpRate("USD"),
  ]);

  if (eurRate.effectiveDate !== usdRate.effectiveDate) {
    logWarn("NBP returned rates with different effective dates", {
      eurEffectiveDate: eurRate.effectiveDate,
      usdEffectiveDate: usdRate.effectiveDate,
    });
  }

  return {
    plnPerEur: eurRate.mid,
    plnPerUsd: usdRate.mid,
    fxDate:
      eurRate.effectiveDate >= usdRate.effectiveDate
        ? eurRate.effectiveDate
        : usdRate.effectiveDate,
    fxSource: "nbp-api-table-a",
  };
}

function isFallbackSource(source: string): boolean {
  return source.toLowerCase().includes("fallback");
}

export async function getLatestFxContext(now = new Date()): Promise<FxContext> {
  await ensureFxRatesIndexes();

  const collection = await getFxRatesCollection();
  const latest = await collection.findOne({ _id: FX_LATEST_DOCUMENT_ID });
  if (!latest) {
    return getFallbackFxContext(now);
  }

  const fromDb = mapDocumentToFxContext(latest);
  if (fromDb) {
    return fromDb;
  }

  logWarn("Invalid FX latest document, using fallback context", {
    route: "lib/fx-rates:getLatestFxContext",
    documentId: latest._id,
  });
  return getFallbackFxContext(now);
}

export async function refreshFxRates(options?: {
  now?: Date;
  force?: boolean;
}): Promise<RefreshFxRatesResult> {
  const now = options?.now ?? new Date();
  const forceRefresh = options?.force === true;

  await ensureFxRatesIndexes();
  const collection = await getFxRatesCollection();
  const latest = await collection.findOne({ _id: FX_LATEST_DOCUMENT_ID });
  const latestContext = latest ? mapDocumentToFxContext(latest) : null;

  if (
    !forceRefresh &&
    latest &&
    latestContext &&
    latest.updatedAt instanceof Date &&
    now.getTime() - latest.updatedAt.getTime() < FX_REFRESH_INTERVAL_MS
  ) {
    return {
      context: latestContext,
      skipped: true,
      usedFallback: isFallbackSource(latestContext.fxSource),
    };
  }

  try {
    const context = await fetchNbpFxContext();
    await upsertFxContext({ context, now });
    return {
      context,
      skipped: false,
      usedFallback: false,
    };
  } catch (error) {
    const fallbackContext = getFallbackFxContext(now);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown FX refresh error";

    logError("FX rates refresh failed, storing fallback rates", {
      error,
      fallbackContext,
    });

    await upsertFxContext({
      context: {
        ...fallbackContext,
        fxSource: `${fallbackContext.fxSource}-refresh-error`,
      },
      now,
      lastError: errorMessage,
    });

    return {
      context: fallbackContext,
      skipped: false,
      usedFallback: true,
      error: errorMessage,
    };
  }
}
