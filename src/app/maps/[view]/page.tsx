import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  buildMainMapPath,
  parseMainMapView,
} from "@/components/main-map-modules/shared";
import {
  buildMapsPageMetadata,
  renderMapsPage,
  type MapsSearchParams,
} from "@/app/maps/shared";

type MapsViewPageProps = {
  params: Promise<{ view: string }>;
  searchParams: Promise<MapsSearchParams>;
};

async function resolveView(paramsPromise: Promise<{ view: string }>) {
  const params = await paramsPromise;
  const view = parseMainMapView(params.view);

  if (!view || view !== "companies") {
    notFound();
  }

  return view;
}

export async function generateMetadata({
  params,
  searchParams,
}: MapsViewPageProps): Promise<Metadata> {
  const view = await resolveView(params);

  return buildMapsPageMetadata({
    searchParams,
    path: buildMainMapPath(view),
    forcedView: view,
    fallbackView: view,
  });
}

export default async function MapsViewPage({
  params,
  searchParams,
}: MapsViewPageProps) {
  const view = await resolveView(params);

  return renderMapsPage({
    searchParams,
    forcedView: view,
    fallbackView: view,
  });
}
