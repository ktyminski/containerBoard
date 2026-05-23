import type { Metadata } from "next";
import {
  SUPPORTED_LOCALES,
  withLocalePrefix,
  withLang,
  type AppLocale,
} from "@/lib/i18n";
import { stripHtmlToPlainText as stripHtmlToPlainTextBase } from "@/lib/rich-text";

const DEFAULT_SITE_URL = "https://containerboard.eu";
export const DEFAULT_OPEN_GRAPH_IMAGE_PATH = "/photos/placeholder-listing.webp";
export const SITE_NAME = "ContainerBoard – Buy & Sell Shipping Containers";

const OPEN_GRAPH_LOCALE: Record<AppLocale, string> = {
  pl: "pl_PL",
  en: "en_US",
  de: "de_DE",
  uk: "uk_UA",
};

function normalizeSiteUrl(input: string): string {
  const parsed = new URL(input);
  return parsed.toString().replace(/\/$/, "");
}

export function getSiteUrl(): string {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.SITE_URL?.trim() ||
    DEFAULT_SITE_URL;

  try {
    return normalizeSiteUrl(configured);
  } catch {
    return DEFAULT_SITE_URL;
  }
}

export function getAbsoluteUrl(path: string): string {
  return new URL(path, `${getSiteUrl()}/`).toString();
}

type LocalizedUrlOptions = {
  localePrefix?: boolean;
};

function getLocalizedPath(
  path: string,
  locale: AppLocale,
  options?: LocalizedUrlOptions,
): string {
  return options?.localePrefix ? withLocalePrefix(path, locale) : withLang(path, locale);
}

export function getLanguageAlternates(
  path: string,
  options?: LocalizedUrlOptions,
): Record<AppLocale, string> {
  const alternates = {} as Record<AppLocale, string>;
  for (const locale of SUPPORTED_LOCALES) {
    alternates[locale] = getAbsoluteUrl(getLocalizedPath(path, locale, options));
  }
  return alternates;
}

export function getLocalizedCanonical(
  path: string,
  locale: AppLocale,
  options?: LocalizedUrlOptions,
): string {
  return getAbsoluteUrl(getLocalizedPath(path, locale, options));
}

export function getLocalizedAlternates(
  path: string,
  locale: AppLocale,
  options?: LocalizedUrlOptions,
): Metadata["alternates"] {
  return {
    canonical: getLocalizedCanonical(path, locale, options),
    languages: getLanguageAlternates(path, options),
  };
}

export function stripHtmlToPlainText(value: string): string {
  return stripHtmlToPlainTextBase(value);
}

export function buildPageMetadata(input: {
  path: string;
  locale: AppLocale;
  title: string;
  description?: string;
  imagePath?: string;
  type?: "website" | "article";
  noIndex?: boolean;
  localePrefix?: boolean;
}): Metadata {
  const canonical = getLocalizedCanonical(input.path, input.locale, {
    localePrefix: input.localePrefix,
  });
  const imagePath = input.imagePath ?? DEFAULT_OPEN_GRAPH_IMAGE_PATH;
  const image = getAbsoluteUrl(imagePath);
  const imageMetadata =
    imagePath === DEFAULT_OPEN_GRAPH_IMAGE_PATH
      ? {
          url: image,
          width: 1200,
          height: 900,
        }
      : { url: image };

  return {
    title: input.title,
    description: input.description,
    alternates: getLocalizedAlternates(input.path, input.locale, {
      localePrefix: input.localePrefix,
    }),
    robots: input.noIndex ? { index: false, follow: false } : undefined,
    openGraph: {
      type: input.type ?? "website",
      locale: OPEN_GRAPH_LOCALE[input.locale],
      siteName: SITE_NAME,
      url: canonical,
      title: input.title,
      description: input.description,
      images: [imageMetadata],
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      images: [image],
    },
  };
}
