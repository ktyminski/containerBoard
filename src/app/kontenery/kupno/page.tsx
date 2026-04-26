import Link from "next/link";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { getLocaleFromRequest, LOCALE_COOKIE_NAME } from "@/lib/i18n";
import {
  CONTAINER_SEO_CITIES,
  CONTAINER_SEO_COUNTRIES,
  getContainerSeoCountryPath,
  getContainerSeoHubCopy,
  getContainerSeoHubMetadata,
  getContainerSeoCityPath,
  getSeoContainerKindTotalCount,
} from "@/lib/seo-containers";

type ContainerBuySeoHubPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  searchParams,
}: ContainerBuySeoHubPageProps): Promise<Metadata> {
  const params = await searchParams;
  const cookieStore = await cookies();
  const locale = getLocaleFromRequest({
    params,
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
  });
  const total = await getSeoContainerKindTotalCount("buy");
  return getContainerSeoHubMetadata(locale, "buy", total >= 3);
}

export default async function ContainerBuySeoHubPage({
  searchParams,
}: ContainerBuySeoHubPageProps) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const locale = getLocaleFromRequest({
    params,
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
  });
  const copy = getContainerSeoHubCopy(locale, "buy");

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6">
      <section className="rounded-md border border-neutral-300 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold text-neutral-900">{copy.hubHeading}</h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-neutral-700">{copy.hubLead}</p>
      </section>

      <section className="grid gap-4 rounded-md border border-neutral-300 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-neutral-900">{copy.citiesHeading}</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {CONTAINER_SEO_CITIES.map((city) => (
            <Link
              key={city.slug}
              href={getContainerSeoCityPath(city.slug, "buy")}
              className="rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-medium text-neutral-800 transition hover:border-neutral-300 hover:bg-neutral-100"
            >
              {city.name}
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-4 rounded-md border border-neutral-300 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-neutral-900">{copy.countriesHeading}</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {CONTAINER_SEO_COUNTRIES.map((country) => (
            <Link
              key={country.slug}
              href={getContainerSeoCountryPath(country.slug, "buy")}
              className="rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-medium text-neutral-800 transition hover:border-neutral-300 hover:bg-neutral-100"
            >
              {country.name}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
