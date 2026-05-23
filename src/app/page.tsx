import type { Metadata } from "next";
import { cookies } from "next/headers";
import { LandingPageContent } from "@/components/landing-page-content";
import { SESSION_COOKIE_NAME } from "@/lib/auth-session";
import { getMessages, LOCALE_COOKIE_NAME, resolveLocale } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const locale = resolveLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
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

export default async function LandingPage() {
  const cookieStore = await cookies();
  const locale = resolveLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
  const isLoggedIn = Boolean(cookieStore.get(SESSION_COOKIE_NAME)?.value);

  return <LandingPageContent locale={locale} isLoggedIn={isLoggedIn} />;
}
