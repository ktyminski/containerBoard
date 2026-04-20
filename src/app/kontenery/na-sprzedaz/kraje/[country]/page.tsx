import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { SeoContainerSalePage } from "@/components/seo-container-sale-page";
import { getLocaleFromRequest, LOCALE_COOKIE_NAME } from "@/lib/i18n";
import {
  CONTAINER_SEO_COUNTRIES,
  getContainerSaleCountryMetadata,
  getContainerSaleSeoHubCopy,
  getContainerSeoCountryBySlug,
  getSeoContainerCountryCount,
  getSeoContainerListingsByCountry,
} from "@/lib/seo-containers";

type ContainerSaleSeoCountryPageProps = {
  params: Promise<{ country: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateStaticParams() {
  return CONTAINER_SEO_COUNTRIES.map((country) => ({ country: country.slug }));
}

export async function generateMetadata({
  params,
  searchParams,
}: ContainerSaleSeoCountryPageProps): Promise<Metadata> {
  const [{ country: countrySlug }, search] = await Promise.all([params, searchParams]);
  const country = getContainerSeoCountryBySlug(countrySlug);
  if (!country) {
    return {};
  }

  const cookieStore = await cookies();
  const locale = getLocaleFromRequest({
    params: search,
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
  });
  const total = await getSeoContainerCountryCount(country);
  return getContainerSaleCountryMetadata({
    locale,
    country,
    hasResults: total >= 3,
  });
}

export default async function ContainerSaleSeoCountryPage({
  params,
  searchParams,
}: ContainerSaleSeoCountryPageProps) {
  const [{ country: countrySlug }, search] = await Promise.all([params, searchParams]);
  const country = getContainerSeoCountryBySlug(countrySlug);
  if (!country) {
    notFound();
  }

  const cookieStore = await cookies();
  const locale = getLocaleFromRequest({
    params: search,
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
  });
  const copy = getContainerSaleSeoHubCopy(locale);
  const result = await getSeoContainerListingsByCountry(country);
  const browseHref = `/list?kind=sell&country=${encodeURIComponent(
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
