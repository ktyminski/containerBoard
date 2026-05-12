import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SeoContainerSalePage } from "@/components/seo-container-sale-page";
import { SUPPORTED_LOCALES } from "@/lib/i18n";
import {
  CONTAINER_SEO_CITIES,
  getContainerSeoCityBySlug,
  getContainerSeoCityMetadata,
  getContainerSeoHubCopy,
  getSeoContainerKindCityCount,
  getSeoContainerListingsByKindAndCity,
} from "@/lib/seo-containers";
import {
  CONTAINER_SEO_ROUTE_INTENTS,
  resolveContainerSeoRouteKind,
  resolveRouteLocale,
} from "../../../_shared";

type ContainerSeoCityPageProps = {
  params: Promise<{ locale: string; intent: string; city: string }>;
};

export async function generateStaticParams() {
  return SUPPORTED_LOCALES.flatMap((locale) =>
    CONTAINER_SEO_ROUTE_INTENTS.flatMap((intent) =>
      CONTAINER_SEO_CITIES.map((city) => ({ locale, intent, city: city.slug })),
    ),
  );
}

export async function generateMetadata({
  params,
}: ContainerSeoCityPageProps): Promise<Metadata> {
  const { locale: rawLocale, intent, city: citySlug } = await params;
  const city = getContainerSeoCityBySlug(citySlug);
  if (!city) {
    return {};
  }

  const locale = resolveRouteLocale(rawLocale);
  const kind = resolveContainerSeoRouteKind(intent);
  const total = await getSeoContainerKindCityCount(kind, city);
  return getContainerSeoCityMetadata({
    locale,
    kind,
    city,
    hasResults: total >= 3,
  });
}

export default async function ContainerSeoCityPage({ params }: ContainerSeoCityPageProps) {
  const { locale: rawLocale, intent, city: citySlug } = await params;
  const city = getContainerSeoCityBySlug(citySlug);
  if (!city) {
    notFound();
  }

  const locale = resolveRouteLocale(rawLocale);
  const kind = resolveContainerSeoRouteKind(intent);
  const copy = getContainerSeoHubCopy(locale, kind);
  const result = await getSeoContainerListingsByKindAndCity(kind, city);
  const browseHref = `/list?kind=${kind}&locationLat=${city.lat}&locationLng=${city.lng}&radiusKm=${city.radiusKm}`;

  return (
    <SeoContainerSalePage
      locale={locale}
      heading={copy.cityHeading(city.name)}
      lead={copy.cityLead(city.name)}
      browseHref={browseHref}
      items={result.items}
      total={result.total}
    />
  );
}
