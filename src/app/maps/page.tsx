import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  buildMainMapPath,
  parseMainMapView,
} from "@/components/main-map-modules/shared";
import {
  buildMapsPageMetadata,
  renderMapsPage,
  type MapsSearchParams,
} from "@/app/maps/shared";

type MapsPageProps = {
  searchParams: Promise<MapsSearchParams>;
};

function toUrlSearchParams(params: MapsSearchParams): URLSearchParams {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        search.append(key, item);
      }
      continue;
    }

    search.set(key, value);
  }

  return search;
}

export async function generateMetadata({
  searchParams,
}: MapsPageProps): Promise<Metadata> {
  const params = await searchParams;
  const parsedView = parseMainMapView(Array.isArray(params.view) ? params.view[0] : params.view);
  const selectedView = parsedView === "companies" ? parsedView : null;

  return buildMapsPageMetadata({
    searchParams: Promise.resolve(params),
    path: selectedView ? buildMainMapPath(selectedView) : "/maps",
    forcedView: selectedView ?? undefined,
    fallbackView: "companies",
  });
}

export default async function MapsPage({ searchParams }: MapsPageProps) {
  const params = await searchParams;
  const parsedView = parseMainMapView(Array.isArray(params.view) ? params.view[0] : params.view);
  const selectedView = parsedView === "companies" ? parsedView : null;

  if (selectedView) {
    const nextSearch = toUrlSearchParams(params);
    nextSearch.delete("view");
    const serialized = nextSearch.toString();
    redirect(serialized ? `${buildMainMapPath(selectedView)}?${serialized}` : buildMainMapPath(selectedView));
  }

  return renderMapsPage({
    searchParams: Promise.resolve(params),
    fallbackView: "companies",
  });
}
