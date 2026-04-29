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
import { getLocaleFromRequest, LOCALE_COOKIE_NAME } from "@/lib/i18n";

type ListContainerDetailsPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  params,
  searchParams,
}: ListContainerDetailsPageProps): Promise<Metadata> {
  const [{ id }, queryParams] = await Promise.all([params, searchParams]);
  const cookieStore = await cookies();
  const locale = getLocaleFromRequest({
    params: queryParams,
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
  });

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

  const metadata = buildContainerListingMetadata({
    item: mapContainerListingToItem(listing),
    locale,
    path: `/list/containers/${id}`,
  });

  return {
    ...metadata,
    robots: {
      index: false,
      follow: false,
    },
  };
}

function toSearchParams(
  params: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const output = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const resolved = typeof value === "string" ? value : value?.[0];
    if (resolved) {
      output.set(key, resolved);
    }
  }
  return output;
}

export default async function ListContainerDetailsPage({
  params,
  searchParams,
}: ListContainerDetailsPageProps) {
  const [{ id }, queryParams] = await Promise.all([params, searchParams]);
  if (id === "mine") {
    redirect("/containers/mine");
  }
  if (id === "new") {
    redirect("/containers/new");
  }
  const listParams = toSearchParams(queryParams);
  const listHref = listParams.toString() ? `/list?${listParams.toString()}` : "/list";

  return (
    <main className="mx-auto grid w-full max-w-5xl gap-4 px-4 py-6 sm:px-6">
      <ContainerDetailsContent listingId={id} listHref={listHref} />
    </main>
  );
}
