import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { SeoContainerSalePage } from "@/components/seo-container-sale-page";
import { getLocaleFromRequest, LOCALE_COOKIE_NAME } from "@/lib/i18n";
import {
  CONTAINER_SEO_CITIES,
  getContainerSeoCityBySlug,
  getContainerSeoCityMetadata,
  getContainerSeoHubCopy,
  getNearbyContainerSeoCities,
  getSeoContainerKindCityCount,
  getSeoContainerListingsByKindAndCity,
} from "@/lib/seo-containers";

type ContainerBuySeoCityPageProps = {
  params: Promise<{ city: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateStaticParams() {
  return CONTAINER_SEO_CITIES.map((city) => ({ city: city.slug }));
}

export async function generateMetadata({
  params,
  searchParams,
}: ContainerBuySeoCityPageProps): Promise<Metadata> {
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
  const total = await getSeoContainerKindCityCount("buy", city);
  return getContainerSeoCityMetadata({
    locale,
    kind: "buy",
    city,
    hasResults: total >= 3,
  });
}

export default async function ContainerBuySeoCityPage({
  params,
  searchParams,
}: ContainerBuySeoCityPageProps) {
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
  const copy = getContainerSeoHubCopy(locale, "buy");
  const result = await getSeoContainerListingsByKindAndCity("buy", city);
  const browseHref = `/list?kind=buy&locationLat=${city.lat}&locationLng=${city.lng}&radiusKm=${city.radiusKm}`;

  return (
    <SeoContainerSalePage
      locale={locale}
      heading={copy.cityHeading(city.name)}
      lead={copy.cityLead(city.name)}
      browseHref={browseHref}
      items={result.items}
      total={result.total}
      seoContext={{
        kind: "buy",
        locationType: "city",
        name: city.name,
        nearbyLinks: getNearbyContainerSeoCities(city, "buy"),
      }}
    />
  );
}
