import Link from "next/link";
import type { Metadata } from "next";
import { SUPPORTED_LOCALES, withLocalePrefix } from "@/lib/i18n";
import {
  CONTAINER_SEO_CITIES,
  CONTAINER_SEO_COUNTRIES,
  getContainerSeoCityPath,
  getContainerSeoCountryPath,
  getContainerSeoHubCopy,
  getContainerSeoHubMetadata,
  getSeoContainerKindTotalCount,
} from "@/lib/seo-containers";
import {
  CONTAINER_SEO_ROUTE_INTENTS,
  resolveContainerSeoRouteKind,
  resolveRouteLocale,
} from "../_shared";

type ContainerSeoHubPageProps = {
  params: Promise<{ locale: string; intent: string }>;
};

export async function generateStaticParams() {
  return SUPPORTED_LOCALES.flatMap((locale) =>
    CONTAINER_SEO_ROUTE_INTENTS.map((intent) => ({ locale, intent })),
  );
}

export async function generateMetadata({
  params,
}: ContainerSeoHubPageProps): Promise<Metadata> {
  const { locale: rawLocale, intent } = await params;
  const locale = resolveRouteLocale(rawLocale);
  const kind = resolveContainerSeoRouteKind(intent);
  const total = await getSeoContainerKindTotalCount(kind);
  return getContainerSeoHubMetadata(locale, kind, total >= 3);
}

export default async function ContainerSeoHubPage({ params }: ContainerSeoHubPageProps) {
  const { locale: rawLocale, intent } = await params;
  const locale = resolveRouteLocale(rawLocale);
  const kind = resolveContainerSeoRouteKind(intent);
  const copy = getContainerSeoHubCopy(locale, kind);

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
              href={withLocalePrefix(getContainerSeoCityPath(city.slug, kind), locale)}
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
              href={withLocalePrefix(getContainerSeoCountryPath(country.slug, kind), locale)}
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
