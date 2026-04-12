import type { Metadata } from "next";
import { cookies } from "next/headers";
import { MainMapModules } from "@/components/main-map-modules";
import {
  parseMainMapView,
  type MainMapView,
} from "@/components/main-map-modules/shared";
import { getMainMapPageData } from "@/lib/main-map-page";
import {
  getLocaleFromRequest,
  getMessages,
  LOCALE_COOKIE_NAME,
} from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/seo";

export type MapsSearchParams = Record<string, string | string[] | undefined>;

function getFirstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function getViewLabel(messages: ReturnType<typeof getMessages>, view: MainMapView): string {
  return view === "offers"
      ? messages.mapModules.tabs.offers
      : messages.mapModules.tabs.companies;
}

function resolveMapsView(view: MainMapView | null | undefined): MainMapView {
  return view === "companies" ? view : "companies";
}

export async function buildMapsPageMetadata(input: {
  searchParams: Promise<MapsSearchParams>;
  path: string;
  forcedView?: MainMapView;
  fallbackView?: MainMapView;
}): Promise<Metadata> {
  const params = await input.searchParams;
  const cookieStore = await cookies();
  const locale = getLocaleFromRequest({
    params,
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
  });
  const messages = getMessages(locale);
  const selectedView = resolveMapsView(
    input.forcedView ??
      parseMainMapView(getFirstParam(params.view)) ??
      input.fallbackView ??
      "companies",
  );

  return buildPageMetadata({
    path: input.path,
    locale,
    title: `${messages.home.navMap}: ${getViewLabel(messages, selectedView)}`,
    description: messages.home.whatSubtitle,
  });
}

export async function renderMapsPage(input: {
  searchParams: Promise<MapsSearchParams>;
  forcedView?: MainMapView;
  fallbackView?: MainMapView;
}) {
  const params = await input.searchParams;
  const targetView = resolveMapsView(
    input.forcedView ??
      parseMainMapView(getFirstParam(params.view)) ??
      input.fallbackView ??
      "companies",
  );
  const initialMobilePane = getFirstParam(params.pane) === "map" ? "map" : "list";
  const {
    locale,
    messages,
    initialView,
    initialFilters,
  } = await getMainMapPageData({
    params,
    fallbackView: input.fallbackView ?? targetView,
    forcedView: input.forcedView,
  });

  return (
    <main className="w-full overflow-x-hidden">
      <section className="flex h-[calc(100svh-4rem)] flex-col supports-[height:100dvh]:h-[calc(100dvh-4rem)]">
        <div className="min-h-0 flex-1">
          <MainMapModules
            locale={locale}
            mapMessages={messages.map}
            companyCreateMessages={messages.companyCreate}
            verifiedLabel={messages.companyStatus.verified}
            messages={messages.mapModules}
            initialMobilePane={initialMobilePane}
            initialView={initialView}
            initialFilters={initialFilters}
          />
        </div>
      </section>
    </main>
  );
}
