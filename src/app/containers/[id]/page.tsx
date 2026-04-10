import type { Metadata } from "next";
import Link from "next/link";
import { ObjectId } from "mongodb";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ContainerInquiryForm } from "@/components/container-inquiry-form";
import { SESSION_COOKIE_NAME } from "@/lib/auth-session";
import { getCurrentUserFromToken } from "@/lib/auth-user";
import {
  ensureContainerListingsIndexes,
  expireContainerListingsIfNeeded,
  getContainerListingsCollection,
} from "@/lib/container-listings";
import { LISTING_STATUS } from "@/lib/container-listing-types";
import { USER_ROLE } from "@/lib/user-roles";

type ContainerDetailsPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: ContainerDetailsPageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Kontener ${id} | ContainerBoard`,
  };
}

export default async function ContainerDetailsPage({ params }: ContainerDetailsPageProps) {
  await ensureContainerListingsIndexes();
  await expireContainerListingsIfNeeded();

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    notFound();
  }

  const listings = await getContainerListingsCollection();
  const listing = await listings.findOne({ _id: new ObjectId(id) });
  if (!listing?._id) {
    notFound();
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const currentUser = token ? await getCurrentUserFromToken(token) : null;
  const isOwner = currentUser?._id
    ? currentUser._id.toHexString() === listing.createdByUserId.toHexString()
    : false;
  const isAdmin = currentUser?.role === USER_ROLE.ADMIN;
  const isPublic = listing.status === LISTING_STATUS.ACTIVE;

  if (!isPublic && !isOwner && !isAdmin) {
    notFound();
  }

  return (
    <main className="mx-auto grid w-full max-w-5xl gap-4 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/list"
          className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-500"
        >
          Powrot do listy
        </Link>
        {isOwner || isAdmin ? (
          <Link
            href={`/containers/${listing._id.toHexString()}/edit`}
            className="rounded-md border border-sky-700 px-3 py-2 text-sm text-sky-200 hover:border-sky-500"
          >
            Edytuj kontener
          </Link>
        ) : null}
      </div>

      <article className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <p className="text-sm text-slate-400">{listing.companyName}</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-100">
          {listing.containerType} • {listing.type === "available" ? "Dostepny" : "Poszukiwany"}
        </h1>

        <div className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-2 lg:grid-cols-3">
          <p>Ilosc: <span className="text-slate-100">{listing.quantity}</span></p>
          <p>Lokalizacja: <span className="text-slate-100">{listing.locationCity}, {listing.locationCountry}</span></p>
          <p>Typ transakcji: <span className="text-slate-100">{listing.dealType}</span></p>
          <p>Dostepny od: <span className="text-slate-100">{listing.availableFrom.toLocaleDateString("pl-PL")}</span></p>
          <p>Wygasa: <span className="text-slate-100">{listing.expiresAt.toLocaleDateString("pl-PL")}</span></p>
          <p>Status: <span className="text-slate-100">{listing.status}</span></p>
        </div>

        {listing.price ? (
          <p className="mt-3 text-sm text-slate-200">Cena: {listing.price}</p>
        ) : null}

        {listing.description ? (
          <p className="mt-3 whitespace-pre-wrap text-sm text-slate-200">{listing.description}</p>
        ) : null}

        <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-300">
          <p>Email: <a className="text-sky-300 hover:text-sky-200" href={`mailto:${listing.contactEmail}`}>{listing.contactEmail}</a></p>
          {listing.contactPhone ? (
            <p>Telefon: <a className="text-sky-300 hover:text-sky-200" href={`tel:${listing.contactPhone.replace(/\s+/g, "")}`}>{listing.contactPhone}</a></p>
          ) : null}
        </div>
      </article>

      <ContainerInquiryForm listingId={listing._id.toHexString()} />
    </main>
  );
}


