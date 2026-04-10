import pl from "../../translations/pl.json";

export const SUPPORTED_LOCALES = ["pl"] as const;
export const LOCALE_COOKIE_NAME = "containerboard_locale";
export const LOCALE_HEADER_NAME = "x-containerboard-locale";

// Keep legacy locale union for backward compatibility in existing code paths.
export type AppLocale = "pl" | "en" | "de" | "uk";
export type AppMessages = typeof pl;

const DICTIONARIES: Record<AppLocale, AppMessages> = {
  pl,
  en: pl,
  de: pl,
  uk: pl,
};

export function resolveLocale(input?: string | null): AppLocale {
  void input;
  return "pl";
}

export function getMessages(locale: AppLocale): AppMessages {
  return DICTIONARIES[locale] ?? DICTIONARIES.pl;
}

function getLocaleFromSearchParams(
  params?: Record<string, string | string[] | undefined>,
): AppLocale | null {
  void params;
  return null;
}

function getLocaleFromHeaderValue(value?: string | null): AppLocale | null {
  if (!value) {
    return null;
  }

  const supported = SUPPORTED_LOCALES as readonly string[];
  const parts = value.split(",");
  for (const part of parts) {
    const token = part.split(";")[0]?.trim().toLowerCase();
    if (!token) {
      continue;
    }

    if (supported.includes(token)) {
      return token as AppLocale;
    }

    const shortToken = token.split("-")[0];
    if (shortToken && supported.includes(shortToken)) {
      return shortToken as AppLocale;
    }
  }

  return null;
}

export function getLocaleFromRequest(input: {
  params?: Record<string, string | string[] | undefined>;
  cookieLocale?: string;
  headerLocale?: string | null;
  acceptLanguage?: string | null;
}): AppLocale {
  const fromParams = getLocaleFromSearchParams(input.params);
  if (fromParams) {
    return fromParams;
  }

  const fromHeader =
    getLocaleFromHeaderValue(input.headerLocale) ??
    getLocaleFromHeaderValue(input.acceptLanguage);
  if (fromHeader) {
    return fromHeader;
  }

  return resolveLocale(input.cookieLocale);
}

export function getLocaleFromApiRequest(request: Request): AppLocale {
  return getLocaleFromRequest({
    headerLocale: request.headers.get(LOCALE_HEADER_NAME),
    acceptLanguage: request.headers.get("accept-language"),
  });
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
