import deRaw from "../../translations/de.json";
import enRaw from "../../translations/en.json";
import pl from "../../translations/pl.json";
import ukRaw from "../../translations/uk.json";

export const SUPPORTED_LOCALES = ["pl", "en", "de", "uk"] as const;
export const LOCALE_COOKIE_NAME = "containerboard_locale";
export const LOCALE_HEADER_NAME = "x-containerboard-locale";
const DEFAULT_LOCALE = "en";

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];
export type AppMessages = typeof pl;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeMessages<T>(base: T, override: unknown): T {
  if (override === undefined) {
    return base;
  }

  if (Array.isArray(base)) {
    return (Array.isArray(override) ? override : base) as T;
  }

  if (isRecord(base) && isRecord(override)) {
    const output: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(override)) {
      const baseValue = output[key];
      if (baseValue === undefined) {
        output[key] = value;
        continue;
      }
      output[key] = mergeMessages(baseValue, value);
    }
    return output as T;
  }

  return override as T;
}

const DICTIONARIES: Record<AppLocale, AppMessages> = {
  pl,
  en: mergeMessages(pl, enRaw),
  de: mergeMessages(pl, deRaw),
  uk: mergeMessages(pl, ukRaw),
};

function normalizeLocaleToken(value?: string | null): AppLocale | null {
  if (!value) {
    return null;
  }

  const supported = SUPPORTED_LOCALES as readonly string[];
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (supported.includes(normalized)) {
    return normalized as AppLocale;
  }

  const shortToken = normalized.split("-")[0];
  if (shortToken && supported.includes(shortToken)) {
    return shortToken as AppLocale;
  }

  return null;
}

function normalizeCountryCode(value?: string | null): string | null {
  const normalized = value?.trim().toUpperCase();
  if (!normalized || !/^[A-Z]{2}$/.test(normalized)) {
    return null;
  }
  return normalized;
}

export function getLocaleFromCountryCode(countryCode?: string | null): AppLocale | null {
  const normalizedCountryCode = normalizeCountryCode(countryCode);
  if (normalizedCountryCode === "PL") {
    return "pl";
  }

  return null;
}

export function resolveLocale(
  input?: string | null,
  fallback: AppLocale = DEFAULT_LOCALE,
): AppLocale {
  return normalizeLocaleToken(input) ?? fallback;
}

export function getMessages(locale: AppLocale): AppMessages {
  return DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
}

function getLocaleFromSearchParams(params?: Record<string, string | string[] | undefined>): AppLocale | null {
  const rawLocale = params?.lang ?? params?.locale;
  const value = typeof rawLocale === "string" ? rawLocale : rawLocale?.[0];
  return normalizeLocaleToken(value);
}

function getLocaleFromHeaderValue(value?: string | null): AppLocale | null {
  if (!value) {
    return null;
  }

  const parts = value.split(",");
  for (const part of parts) {
    const token = part.split(";")[0]?.trim().toLowerCase();
    const locale = normalizeLocaleToken(token);
    if (locale) {
      return locale;
    }
  }

  return null;
}

export function getLocaleFromRequest(input: {
  params?: Record<string, string | string[] | undefined>;
  cookieLocale?: string;
  headerLocale?: string | null;
  acceptLanguage?: string | null;
  countryCode?: string | null;
}): AppLocale {
  const fromParams = getLocaleFromSearchParams(input.params);
  if (fromParams) {
    return fromParams;
  }

  const fromCookie = normalizeLocaleToken(input.cookieLocale);
  if (fromCookie) {
    return fromCookie;
  }

  const fromHeaderLocale = getLocaleFromHeaderValue(input.headerLocale);
  if (fromHeaderLocale) {
    return fromHeaderLocale;
  }

  const fromCountry = getLocaleFromCountryCode(input.countryCode);
  if (fromCountry) {
    return fromCountry;
  }

  const fromAcceptLanguage = getLocaleFromHeaderValue(input.acceptLanguage);
  if (fromAcceptLanguage) {
    return fromAcceptLanguage;
  }

  return DEFAULT_LOCALE;
}

export function getLocaleFromApiRequest(request: Request): AppLocale {
  return getLocaleFromRequest({
    headerLocale: request.headers.get(LOCALE_HEADER_NAME),
    acceptLanguage: request.headers.get("accept-language"),
  });
}

export function getLocaleFromPathname(pathname?: string | null): AppLocale | null {
  const firstSegment = pathname?.split("/").filter(Boolean)[0]?.toLowerCase();
  if (!firstSegment) {
    return null;
  }

  const supported = SUPPORTED_LOCALES as readonly string[];
  return supported.includes(firstSegment) ? (firstSegment as AppLocale) : null;
}

export function stripLocalePrefix(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const [pathnameWithLocale, suffix = ""] = normalizedPath.split(/(?=[?#])/, 2);
  const segments = pathnameWithLocale.split("/").filter(Boolean);
  if (segments.length === 0) {
    return suffix ? `/${suffix}` : "/";
  }

  const supported = SUPPORTED_LOCALES as readonly string[];
  if (!supported.includes(segments[0].toLowerCase())) {
    return normalizedPath;
  }

  const withoutLocale = `/${segments.slice(1).join("/")}`;
  return `${withoutLocale === "/" ? "/" : withoutLocale}${suffix}`;
}

export function withLocalePrefix(path: string, locale: AppLocale): string {
  const strippedPath = stripLocalePrefix(path);
  const [pathname, suffix = ""] = strippedPath.split(/(?=[?#])/, 2);
  const normalizedPathname = pathname === "/" ? "" : pathname;
  return `/${locale}${normalizedPathname}${suffix}`;
}

export function withLang(path: string, locale: AppLocale): string {
  void locale;
  return path;
}

export function formatTemplate(
  template: string,
  values: Record<string, string | number>,
): string {
  return Object.entries(values).reduce((result, [key, value]) => {
    return result.replaceAll(`{${key}}`, String(value));
  }, template);
}
