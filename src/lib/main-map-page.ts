import { cookies } from "next/headers";
import { parseBbox } from "@/lib/geo";
import {
  getLocaleFromRequest,
  getMessages,
  LOCALE_COOKIE_NAME,
  type AppLocale,
  type AppMessages,
} from "@/lib/i18n";
import type {
  DistanceOption,
  MainMapInitialFilters,
  MainMapView,
} from "@/components/main-map-modules/shared";
import { parseMainMapView } from "@/components/main-map-modules/shared";

type MainMapSearchParams = Record<string, string | string[] | undefined>;
const DISTANCE_OPTIONS = [10, 20, 25, 30, 35, 50, 100] as const;

export type MainMapPageData = {
  locale: AppLocale;
  messages: AppMessages;
  initialView: MainMapView;
  initialFilters: MainMapInitialFilters;
};

type GetMainMapPageDataInput = {
  params: MainMapSearchParams;
  fallbackView?: MainMapView;
  forcedView?: MainMapView;
};

function getFirstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function resolveMainMapView(
  value: string | undefined,
  fallbackView: MainMapView,
): MainMapView {
  const parsed = parseMainMapView(value);
  if (!parsed) {
    return fallbackView;
  }
  if (parsed === "announcements" || parsed === "offers") {
    return fallbackView;
  }
  return parsed;
}

function normalizeFilterText(value: string | undefined, maxLength: number): string {
  if (!value) {
    return "";
  }
  return value.trim().slice(0, maxLength);
}

function resolveDistance(value: string | undefined): DistanceOption {
  const parsed = value ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) {
    return 20;
  }

  let nearest: DistanceOption = DISTANCE_OPTIONS[0];
  for (const option of DISTANCE_OPTIONS) {
    if (Math.abs(parsed - option) < Math.abs(parsed - nearest)) {
      nearest = option;
    }
  }

  return nearest;
}

function resolveInitialFilters(params: MainMapSearchParams): MainMapInitialFilters {
  return {
    keyword: normalizeFilterText(getFirstParam(params.q), 100),
    location: normalizeFilterText(getFirstParam(params.location), 120),
    distanceKm: resolveDistance(getFirstParam(params.distance)),
    locationBbox: parseBbox(getFirstParam(params.bbox)) ?? null,
  };
}

export async function getMainMapPageData({
  params,
  fallbackView = "companies",
  forcedView,
}: GetMainMapPageDataInput): Promise<MainMapPageData> {
  const cookieStore = await cookies();
  const locale = getLocaleFromRequest({
    params,
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
  });
  const messages = getMessages(locale);
  const viewParam = getFirstParam(params.view);
  const initialView = forcedView ?? resolveMainMapView(viewParam, fallbackView);
  const initialFilters = resolveInitialFilters(params);

  return {
    locale,
    messages,
    initialView,
    initialFilters,
  };
}
