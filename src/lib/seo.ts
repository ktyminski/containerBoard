import type { Metadata } from "next";
import {
  SUPPORTED_LOCALES,
  withLang,
  type AppLocale,
} from "@/lib/i18n";
import { stripHtmlToPlainText as stripHtmlToPlainTextBase } from "@/lib/rich-text";

const DEFAULT_SITE_URL = "https://containerboard.eu";
export const DEFAULT_OPEN_GRAPH_IMAGE_PATH = "/photos/placeholder-listing.png";
export const SITE_NAME = "ContainerBoard – Buy & Sell Shipping Containers";

const OPEN_GRAPH_LOCALE: Record<AppLocale, string> = {
  pl: "pl_PL",
  en: "pl_PL",
  de: "pl_PL",
  uk: "pl_PL",
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

export function getLanguageAlternates(path: string): Record<AppLocale, string> {
  const alternates = {} as Record<AppLocale, string>;
  for (const locale of SUPPORTED_LOCALES) {
    alternates[locale] = getAbsoluteUrl(withLang(path, locale));
  }
  return alternates;
}

export function getLocalizedCanonical(path: string, locale: AppLocale): string {
  return getAbsoluteUrl(withLang(path, locale));
}

export function getLocalizedAlternates(path: string, locale: AppLocale): Metadata["alternates"] {
  return {
    canonical: getLocalizedCanonical(path, locale),
    languages: getLanguageAlternates(path),
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
}): Metadata {
  const canonical = getLocalizedCanonical(input.path, input.locale);
  const imagePath = input.imagePath ?? DEFAULT_OPEN_GRAPH_IMAGE_PATH;
  const image = getAbsoluteUrl(imagePath);
  const imageMetadata =
    imagePath === DEFAULT_OPEN_GRAPH_IMAGE_PATH
      ? {
          url: image,
          width: 1448,
          height: 1086,
        }
      : { url: image };

  return {
    title: input.title,
    description: input.description,
    alternates: getLocalizedAlternates(input.path, input.locale),
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
