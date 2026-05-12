import type { Metadata } from "next";
import { ObjectId } from "mongodb";
import { redirect } from "next/navigation";
import { ContainerDetailsContent } from "@/components/container-details-content";
import {
  ensureContainerListingsIndexes,
  expireContainerListingsIfNeeded,
  getContainerListingsCollection,
  mapContainerListingToItem,
} from "@/lib/container-listings";
import { buildContainerListingMetadata } from "@/lib/container-listing-seo";
import { withLocalePrefix } from "@/lib/i18n";
import { resolveRouteLocale } from "../../shipping-containers/_shared";

type LocalizedContainerDetailsPageProps = {
  params: Promise<{ locale: string; id: string }>;
};

export async function generateMetadata({
  params,
}: LocalizedContainerDetailsPageProps): Promise<Metadata> {
  const { locale: rawLocale, id } = await params;
  const locale = resolveRouteLocale(rawLocale);

  if (!ObjectId.isValid(id)) {
    return {
      title: "Kontener",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  await ensureContainerListingsIndexes();
  await expireContainerListingsIfNeeded();

  const listings = await getContainerListingsCollection();
  const listing = await listings.findOne({ _id: new ObjectId(id) });

  if (!listing?._id) {
    return {
      title: "Kontener",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  return buildContainerListingMetadata({
    item: mapContainerListingToItem(listing),
    locale,
    path: `/containers/${id}`,
    localePrefix: true,
  });
}

export default async function LocalizedContainerDetailsPage({
  params,
}: LocalizedContainerDetailsPageProps) {
  const { locale: rawLocale, id } = await params;
  const locale = resolveRouteLocale(rawLocale);
  if (id === "mine") {
    redirect("/containers/mine");
  }
  if (id === "new") {
    redirect("/containers/new");
  }

  const canonicalPath = withLocalePrefix(`/containers/${id}`, locale);

  return (
    <main className="mx-auto grid w-full max-w-5xl gap-4 px-4 py-6 sm:px-6">
      <ContainerDetailsContent
        listingId={id}
        locale={locale}
        canonicalPath={canonicalPath}
      />
    </main>
  );
}
