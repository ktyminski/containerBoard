import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { TransportCompaniesPageClient } from "@/components/transport-companies-page-client";
import { SESSION_COOKIE_NAME } from "@/lib/auth-session";
import { getMessages, SUPPORTED_LOCALES, type AppLocale } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/seo";
import { SEO_CITIES, getSeoCityBySlug } from "@/lib/seo-landings";
import { getPublicTransportCompanies } from "@/lib/transport-companies-public";
import { getTurnstileSiteKey } from "@/lib/turnstile";

type LocalizedTransportCompaniesCityPageProps = {
  params: Promise<{ locale: string; city: string }>;
};

function resolveRouteLocale(input: string): AppLocale {
  const normalized = input.toLowerCase();
  return (SUPPORTED_LOCALES as readonly string[]).includes(normalized)
    ? (normalized as AppLocale)
    : notFound();
}

function formatTemplate(template: string, cityName: string): string {
  return template.replaceAll("{city}", cityName);
}

export async function generateStaticParams() {
  return SUPPORTED_LOCALES.flatMap((locale) =>
    SEO_CITIES.slice(0, 30).map((city) => ({
      locale,
      city: city.slug,
    })),
  );
}

export async function generateMetadata({
  params,
}: LocalizedTransportCompaniesCityPageProps): Promise<Metadata> {
  const { locale: rawLocale, city: citySlug } = await params;
  const locale = resolveRouteLocale(rawLocale);
  const city = getSeoCityBySlug(citySlug);
  if (!city) {
    return {};
  }
  const messages = getMessages(locale).transportCompaniesPage;

  return buildPageMetadata({
    path: `/transport-companies/${city.slug}`,
    locale,
    title: formatTemplate(messages.cityMetaTitleTemplate, city.name),
    description: formatTemplate(messages.cityMetaDescriptionTemplate, city.name),
    localePrefix: true,
  });
}

export default async function LocalizedTransportCompaniesCityPage({
  params,
}: LocalizedTransportCompaniesCityPageProps) {
  const { locale: rawLocale, city: citySlug } = await params;
  const locale = resolveRouteLocale(rawLocale);
  const city = getSeoCityBySlug(citySlug);
  if (!city) {
    notFound();
  }
  const messages = getMessages(locale);
  const cookieStore = await cookies();
  const isLoggedIn = Boolean(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  const turnstileSiteKey = !isLoggedIn ? getTurnstileSiteKey() : null;

  return (
    <TransportCompaniesPageClient
      locale={locale}
      messages={messages.transportCompaniesPage}
      compareMessages={messages.transportCompare}
      initialItems={await getPublicTransportCompanies({
        location: { lat: city.lat, lng: city.lng },
      })}
      initialLocationLabel={city.name}
      title={formatTemplate(messages.transportCompaniesPage.cityTitleTemplate, city.name)}
      subtitle={formatTemplate(
        messages.transportCompaniesPage.citySubtitleTemplate,
        city.name,
      )}
      isLoggedIn={isLoggedIn}
      turnstileSiteKey={turnstileSiteKey}
    />
  );
}
