import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { MainMapModules } from "@/components/main-map-modules";
import { getCompaniesCollection } from "@/lib/companies";
import {
  type AppLocale,
  getLocaleFromRequest,
  LOCALE_COOKIE_NAME,
  withLang,
} from "@/lib/i18n";
import { getMainMapPageData } from "@/lib/main-map-page";
import { buildPageMetadata } from "@/lib/seo";
import {
  buildCompaniesLandingFilter,
  getCityBbox,
  getSeoCityBySlug,
} from "@/lib/seo-landings";

type CompaniesBySegmentPageProps = {
  params: Promise<{ segment: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getFirstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function bboxToQuery(bbox: [number, number, number, number]): string {
  return bbox.map((value) => value.toFixed(6)).join(",");
}

function buildLandingMapParams(input: {
  params: Record<string, string | string[] | undefined>;
  cityName: string;
  cityRadiusKm: number;
  bbox: [number, number, number, number];
}): Record<string, string | string[] | undefined> {
  return {
    ...input.params,
    location: input.cityName,
    distance: String(input.cityRadiusKm),
    bbox: bboxToQuery(input.bbox),
  };
}

function getBusinessesCityCopy(locale: AppLocale, cityName: string, radiusKm: number) {
  if (locale === "en") {
    return {
      metaTitle: `Logistics, transport and freight forwarding companies - ${cityName}`,
      metaDescription: `Browse logistics, transport and freight forwarding companies in ${cityName}.`,
      heroTitle: `Logistics, transport and freight forwarding companies in ${cityName}`,
      heroIntro: `A curated view of logistics, transport and freight forwarding companies around ${cityName}. This landing focuses on businesses located within roughly ${radiusKm} km from the city center.`,
      openMapLabel: "Open full map view",
    };
  }

  if (locale === "uk") {
    return {
      metaTitle: `Lohistychni, transportni ta spedytorski kompanii - ${cityName}`,
      metaDescription: `Perehliadaite aktyvni lohistychni, transportni ta spedytorski kompanii u misti ${cityName}.`,
      heroTitle: `Lohistychni, transportni ta spedytorski kompanii v misti ${cityName}`,
      heroIntro: `Dobirka aktyvnykh lohistychnykh, transportnykh ta spedytorskykh kompanii navkolo ${cityName}. Storinka pokazue biznesy pryblizno v radiusi ${radiusKm} km vid tsentru mista.`,
      openMapLabel: "Vidkryty povnu mapu",
    };
  }

  if (locale === "de") {
    return {
      metaTitle: `Logistik-, Transport- und Speditionsunternehmen - ${cityName}`,
      metaDescription: `Sieh dir aktive Logistik-, Transport- und Speditionsunternehmen in ${cityName} an.`,
      heroTitle: `Logistik-, Transport- und Speditionsunternehmen - ${cityName}`,
      heroIntro: `Auswahl aktiver Logistik-, Transport- und Speditionsunternehmen rund um ${cityName}. Die Seite konzentriert sich auf Unternehmen in einem Umkreis von etwa ${radiusKm} km um das Stadtzentrum.`,
      openMapLabel: "Volle Kartenansicht öffnen",
    };
  }

  return {
    metaTitle: `Firmy logistyczne, transportowe i spedycyjne - ${cityName}`,
    metaDescription: `Sprawdź aktywne firmy logistyczne, transportowe i spedycyjne w mieście ${cityName}.`,
    heroTitle: `Firmy logistyczne, transportowe i spedycyjne - ${cityName}`,
    heroIntro: `Zestawienie aktywnych firm logistycznych, transportowych i spedycyjnych w okolicy ${cityName}. Strona koncentruje się na podmiotach z obszaru około ${radiusKm} km od centrum miasta.`,
    openMapLabel: "Otwórz pełny widok mapy",
  };
}

export async function generateMetadata({
  params,
  searchParams,
}: CompaniesBySegmentPageProps): Promise<Metadata> {
  const routeParams = await params;
  const query = await searchParams;
  const cookieStore = await cookies();
  const locale = getLocaleFromRequest({
    params: query,
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
  });
  const city = getSeoCityBySlug(routeParams.segment);
  const cityName = city?.name ?? routeParams.segment;
  const copy = getBusinessesCityCopy(locale, cityName, city?.radiusKm ?? 30);

  return buildPageMetadata({
    path: `/businesses/${routeParams.segment}`,
    locale,
    title: copy.metaTitle,
    description: copy.metaDescription,
  });
}

export default async function CompaniesBySegmentPage({
  params,
  searchParams,
}: CompaniesBySegmentPageProps) {
  const routeParams = await params;
  const query = await searchParams;
  const city = getSeoCityBySlug(routeParams.segment);
  if (!city) {
    notFound();
  }

  const companies = await getCompaniesCollection();
  const filter = buildCompaniesLandingFilter({ city });
  const dataPresenceRows = await companies
    .find(filter, {
      projection: {
        _id: 1,
      },
    })
    .limit(1)
    .toArray();

  if (dataPresenceRows.length === 0) {
    notFound();
  }

  const landingMapParams = buildLandingMapParams({
    params: query,
    cityName: city.name,
    cityRadiusKm: city.radiusKm,
    bbox: getCityBbox(city),
  });

  const initialMobilePane = getFirstParam(query.pane) === "map" ? "map" : "list";
  const {
    locale,
    messages,
    initialView,
    initialFilters,
    initialLeadRequestsTab,
    leadRequestsBoardData,
    leadRequestsLoginHref,
  } = await getMainMapPageData({
    params: landingMapParams,
    fallbackView: "companies",
    forcedView: "companies",
  });
  const copy = getBusinessesCityCopy(locale, city.name, city.radiusKm);
  const openMapHref = withLang(
    `/maps/companies?location=${encodeURIComponent(city.name)}&distance=${encodeURIComponent(String(city.radiusKm))}&bbox=${encodeURIComponent(bboxToQuery(getCityBbox(city)))}`,
    locale,
  );

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold text-slate-100 sm:text-3xl">{copy.heroTitle}</h1>
      <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">{copy.heroIntro}</p>
      <div className="mt-3">
        <Link href={openMapHref} className="text-sm text-sky-300 hover:text-sky-200">
          {copy.openMapLabel}
        </Link>
      </div>

      <div className="mt-6 h-[calc(100svh-11.5rem)] min-h-[620px]">
        <MainMapModules
          locale={locale}
          mapMessages={messages.map}
          companyCreateMessages={messages.companyCreate}
          verifiedLabel={messages.companyStatus.verified}
          messages={messages.mapModules}
          initialMobilePane={initialMobilePane}
          initialView={initialView}
          initialFilters={initialFilters}
          leadRequestsMessages={messages.leadRequestsPage}
          leadRequestsBoardData={leadRequestsBoardData}
          initialLeadRequestsTab={initialLeadRequestsTab}
          leadRequestsLoginHref={leadRequestsLoginHref}
        />
      </div>
    </main>
  );
}





