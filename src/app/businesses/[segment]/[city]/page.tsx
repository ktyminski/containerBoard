import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  getLocaleFromRequest,
  LOCALE_COOKIE_NAME,
  withLang,
} from "@/lib/i18n";
import {
  buildSeoMapsHref,
  getSeoCityBySlug,
  getSeoSectorBySlug,
} from "@/lib/seo-landings";

type CompaniesBySegmentCityPageProps = {
  params: Promise<{ segment: string; city: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CompaniesBySegmentCityPage({
  params,
  searchParams,
}: CompaniesBySegmentCityPageProps) {
  const routeParams = await params;
  const query = await searchParams;
  const city = getSeoCityBySlug(routeParams.city);
  const isKnownSegment = Boolean(getSeoSectorBySlug(routeParams.segment));
  if (!city || !isKnownSegment) {
    notFound();
  }

  const cookieStore = await cookies();
  const locale = getLocaleFromRequest({
    params: query,
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
  });
  redirect(withLang(buildSeoMapsHref({ view: "companies", city }), locale));
}
