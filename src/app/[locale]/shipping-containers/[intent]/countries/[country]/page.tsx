import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SeoContainerSalePage } from "@/components/seo-container-sale-page";
import { SUPPORTED_LOCALES } from "@/lib/i18n";
import {
  CONTAINER_SEO_COUNTRIES,
  getContainerSeoCountryBySlug,
  getContainerSeoCountryMetadata,
  getContainerSeoHubCopy,
  getSeoContainerKindCountryCount,
  getSeoContainerListingsByKindAndCountry,
} from "@/lib/seo-containers";
import {
  CONTAINER_SEO_ROUTE_INTENTS,
  resolveContainerSeoRouteKind,
  resolveRouteLocale,
} from "../../../_shared";

type ContainerSeoCountryPageProps = {
  params: Promise<{ locale: string; intent: string; country: string }>;
};

export async function generateStaticParams() {
  return SUPPORTED_LOCALES.flatMap((locale) =>
    CONTAINER_SEO_ROUTE_INTENTS.flatMap((intent) =>
      CONTAINER_SEO_COUNTRIES.map((country) => ({
        locale,
        intent,
        country: country.slug,
      })),
    ),
  );
}

export async function generateMetadata({
  params,
}: ContainerSeoCountryPageProps): Promise<Metadata> {
  const { locale: rawLocale, intent, country: countrySlug } = await params;
  const country = getContainerSeoCountryBySlug(countrySlug);
  if (!country) {
    return {};
  }

  const locale = resolveRouteLocale(rawLocale);
  const kind = resolveContainerSeoRouteKind(intent);
  const total = await getSeoContainerKindCountryCount(kind, country);
  return getContainerSeoCountryMetadata({
    locale,
    kind,
    country,
    hasResults: total >= 3,
  });
}

export default async function ContainerSeoCountryPage({
  params,
}: ContainerSeoCountryPageProps) {
  const { locale: rawLocale, intent, country: countrySlug } = await params;
  const country = getContainerSeoCountryBySlug(countrySlug);
  if (!country) {
    notFound();
  }

  const locale = resolveRouteLocale(rawLocale);
  const kind = resolveContainerSeoRouteKind(intent);
  const copy = getContainerSeoHubCopy(locale, kind);
  const result = await getSeoContainerListingsByKindAndCountry(kind, country);
  const browseHref = `/list?kind=${kind}&country=${encodeURIComponent(
    country.name,
  )}&countryCode=${encodeURIComponent(country.countryCode)}`;

  return (
    <SeoContainerSalePage
      locale={locale}
      heading={copy.countryHeading(country.name)}
      lead={copy.countryLead(country.name)}
      browseHref={browseHref}
      items={result.items}
      total={result.total}
    />
  );
}
