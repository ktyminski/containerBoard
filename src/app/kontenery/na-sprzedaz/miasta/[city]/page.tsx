import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { SeoContainerSalePage } from "@/components/seo-container-sale-page";
import { getLocaleFromRequest, LOCALE_COOKIE_NAME } from "@/lib/i18n";
import {
  CONTAINER_SEO_CITIES,
  getContainerSaleCityMetadata,
  getContainerSaleSeoHubCopy,
  getContainerSeoCityBySlug,
  getSeoContainerCityCount,
  getSeoContainerListingsByCity,
} from "@/lib/seo-containers";

type ContainerSaleSeoCityPageProps = {
  params: Promise<{ city: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateStaticParams() {
  return CONTAINER_SEO_CITIES.map((city) => ({ city: city.slug }));
}

export async function generateMetadata({
  params,
  searchParams,
}: ContainerSaleSeoCityPageProps): Promise<Metadata> {
  const [{ city: citySlug }, search] = await Promise.all([params, searchParams]);
  const city = getContainerSeoCityBySlug(citySlug);
  if (!city) {
    return {};
  }

  const cookieStore = await cookies();
  const locale = getLocaleFromRequest({
    params: search,
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
  });
  const total = await getSeoContainerCityCount(city);
  return getContainerSaleCityMetadata({
    locale,
    city,
    hasResults: total >= 3,
  });
}

export default async function ContainerSaleSeoCityPage({
  params,
  searchParams,
}: ContainerSaleSeoCityPageProps) {
  const [{ city: citySlug }, search] = await Promise.all([params, searchParams]);
  const city = getContainerSeoCityBySlug(citySlug);
  if (!city) {
    notFound();
  }

  const cookieStore = await cookies();
  const locale = getLocaleFromRequest({
    params: search,
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
  });
  const copy = getContainerSaleSeoHubCopy(locale);
  const result = await getSeoContainerListingsByCity(city);
  const browseHref = `/list?kind=sell&locationLat=${city.lat}&locationLng=${city.lng}&radiusKm=${city.radiusKm}`;

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
