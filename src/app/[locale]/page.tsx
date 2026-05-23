import type { Metadata } from "next";
import { cookies } from "next/headers";
import { LandingPageContent } from "@/components/landing-page-content";
import { SESSION_COOKIE_NAME } from "@/lib/auth-session";
import { SUPPORTED_LOCALES } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/seo";
import { getMessages } from "@/lib/i18n";
import { resolveRouteLocale } from "./shipping-containers/_shared";

type LocalizedLandingPageProps = {
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: LocalizedLandingPageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = resolveRouteLocale(rawLocale);
  const landing = getMessages(locale).landingPage;

  return buildPageMetadata({
    path: "/",
    locale,
    title: landing.metaTitle,
    description: landing.metaDescription,
    imagePath: "/photos/background.webp",
    localePrefix: true,
  });
}

export default async function LocalizedLandingPage({
  params,
}: LocalizedLandingPageProps) {
  const { locale: rawLocale } = await params;
  const locale = resolveRouteLocale(rawLocale);
  const cookieStore = await cookies();
  const isLoggedIn = Boolean(cookieStore.get(SESSION_COOKIE_NAME)?.value);

  return <LandingPageContent locale={locale} isLoggedIn={isLoggedIn} />;
}
