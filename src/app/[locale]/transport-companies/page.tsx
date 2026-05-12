import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { TransportCompaniesPageClient } from "@/components/transport-companies-page-client";
import { SESSION_COOKIE_NAME } from "@/lib/auth-session";
import { getMessages, SUPPORTED_LOCALES, type AppLocale } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/seo";
import { getPublicTransportCompanies } from "@/lib/transport-companies-public";
import { getTurnstileSiteKey } from "@/lib/turnstile";

type LocalizedTransportCompaniesPageProps = {
  params: Promise<{ locale: string }>;
};

function resolveRouteLocale(input: string): AppLocale {
  const normalized = input.toLowerCase();
  return (SUPPORTED_LOCALES as readonly string[]).includes(normalized)
    ? (normalized as AppLocale)
    : notFound();
}

export async function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: LocalizedTransportCompaniesPageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = resolveRouteLocale(rawLocale);
  const messages = getMessages(locale).transportCompaniesPage;

  return buildPageMetadata({
    path: "/transport-companies",
    locale,
    title: messages.metaTitle,
    description: messages.metaDescription,
    localePrefix: true,
  });
}

export default async function LocalizedTransportCompaniesPage({
  params,
}: LocalizedTransportCompaniesPageProps) {
  const { locale: rawLocale } = await params;
  const locale = resolveRouteLocale(rawLocale);
  const messages = getMessages(locale);
  const cookieStore = await cookies();
  const isLoggedIn = Boolean(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  const turnstileSiteKey = !isLoggedIn ? getTurnstileSiteKey() : null;

  return (
    <TransportCompaniesPageClient
      locale={locale}
      messages={messages.transportCompaniesPage}
      compareMessages={messages.transportCompare}
      initialItems={await getPublicTransportCompanies()}
      isLoggedIn={isLoggedIn}
      turnstileSiteKey={turnstileSiteKey}
    />
  );
}
