import type { Metadata } from "next";
import { ObjectId } from "mongodb";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ContainerDetailsContent } from "@/components/container-details-content";
import {
  ensureContainerListingsIndexes,
  expireContainerListingsIfNeeded,
  getContainerListingsCollection,
  mapContainerListingToItem,
} from "@/lib/container-listings";
import { buildContainerListingMetadata } from "@/lib/container-listing-seo";
import { LOCALE_COOKIE_NAME, resolveLocale } from "@/lib/i18n";

type ContainerDetailsPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: ContainerDetailsPageProps): Promise<Metadata> {
  const { id } = await params;
  const cookieStore = await cookies();
  const locale = resolveLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);

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

  const item = mapContainerListingToItem(listing);
  return buildContainerListingMetadata({
    item,
    locale,
    path: `/containers/${id}`,
  });
}

export default async function ContainerDetailsPage({ params }: ContainerDetailsPageProps) {
  const { id } = await params;
  if (id === "mine") {
    redirect("/containers/mine");
  }
  if (id === "new") {
    redirect("/containers/new");
  }

  return (
    <main className="mx-auto grid w-full max-w-5xl gap-4 px-4 py-6 sm:px-6">
      <ContainerDetailsContent listingId={id} />
    </main>
  );
}
