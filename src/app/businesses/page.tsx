import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import {
  formatTemplate,
  getMessages,
  getLocaleFromRequest,
  LOCALE_COOKIE_NAME,
  withLang,
} from "@/lib/i18n";
import { SEO_CITIES, SEO_SECTORS } from "@/lib/seo-landings";
import { buildPageMetadata } from "@/lib/seo";

type CompaniesIndexPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  searchParams,
}: CompaniesIndexPageProps): Promise<Metadata> {
  const params = await searchParams;
  const cookieStore = await cookies();
  const locale = getLocaleFromRequest({
    params,
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
  });
  const messages = getMessages(locale);

  return buildPageMetadata({
    path: "/businesses",
    locale,
    title: messages.seoLandingIndexes.companies.metaTitle,
    description: messages.seoLandingIndexes.companies.metaDescription,
  });
}

export default async function CompaniesIndexPage({
  searchParams,
}: CompaniesIndexPageProps) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const locale = getLocaleFromRequest({
    params,
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
  });
  const messages = getMessages(locale);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
        <h1 className="text-2xl font-semibold text-slate-100 sm:text-3xl">
          {messages.seoLandingIndexes.companies.heroTitle}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          {messages.seoLandingIndexes.companies.heroDescription}
        </p>
      </header>

      <section className="mt-6 rounded-xl border border-slate-800 bg-slate-900/50 p-5">
        <h2 className="text-lg font-semibold text-slate-100">
          {messages.seoLandingIndexes.companies.byCityTitle}
        </h2>
        <ul className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3 lg:grid-cols-4">
          {SEO_CITIES.map((city) => (
            <li key={city.slug}>
              <Link
                href={withLang(`/businesses/${city.slug}`, locale)}
                className="text-sky-300 hover:text-sky-200"
              >
                {formatTemplate(messages.seoLandingIndexes.companies.byCityLink, {
                  city: city.name,
                })}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6 rounded-xl border border-slate-800 bg-slate-900/50 p-5">
        <h2 className="text-lg font-semibold text-slate-100">
          {messages.seoLandingIndexes.companies.bySectorTitle}
        </h2>
        <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {SEO_SECTORS.map((sector) => (
            <li key={sector.slug}>
              <Link
                href={withLang(`/businesses/${sector.slug}/warszawa`, locale)}
                className="text-sky-300 hover:text-sky-200"
              >
                {formatTemplate(messages.seoLandingIndexes.companies.bySectorLink, {
                  sector: sector.name,
                  city: "Warszawa",
                })}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
