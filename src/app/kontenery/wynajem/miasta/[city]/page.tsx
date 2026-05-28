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

type ContainerRentSeoCityPageProps = {
  params: Promise<{ city: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateStaticParams() {
  return CONTAINER_SEO_CITIES.map((city) => ({ city: city.slug }));
}

export async function generateMetadata({
  params,
  searchParams,
}: ContainerRentSeoCityPageProps): Promise<Metadata> {
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
  const total = await getSeoContainerKindCityCount("rent", city);
  return getContainerSeoCityMetadata({
    locale,
    kind: "rent",
    city,
    hasResults: total >= 3,
  });
}

export default async function ContainerRentSeoCityPage({
  params,
  searchParams,
}: ContainerRentSeoCityPageProps) {
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
  const copy = getContainerSeoHubCopy(locale, "rent");
  const result = await getSeoContainerListingsByKindAndCity("rent", city);
  const browseHref = `/list?kind=rent&locationLat=${city.lat}&locationLng=${city.lng}&radiusKm=${city.radiusKm}`;

  return (
    <SeoContainerSalePage
      locale={locale}
      heading={copy.cityHeading(city.name)}
      lead={copy.cityLead(city.name)}
      browseHref={browseHref}
      items={result.items}
      total={result.total}
      seoContext={{
        kind: "rent",
        locationType: "city",
        name: city.name,
        nearbyLinks: getNearbyContainerSeoCities(city, "rent"),
      }}
    />
  );
}
