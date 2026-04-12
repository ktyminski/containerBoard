import type { Metadata } from "next";
import Link from "next/link";
import { ObjectId } from "mongodb";
import sanitizeHtml from "sanitize-html";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ContainerInquiryForm } from "@/components/container-inquiry-form";
import { SESSION_COOKIE_NAME } from "@/lib/auth-session";
import { getCurrentUserFromToken } from "@/lib/auth-user";
import {
  ensureContainerListingsIndexes,
  expireContainerListingsIfNeeded,
  getContainerListingsCollection,
  mapContainerListingToItem,
} from "@/lib/container-listings";
import {
  CONTAINER_CONDITION_LABEL,
  CONTAINER_FEATURE_LABEL,
  CONTAINER_HEIGHT_LABEL,
  CONTAINER_TYPE_LABEL,
  getContainerShortLabel,
  LISTING_STATUS,
  PRICE_CURRENCY_LABEL,
  PRICE_TAX_MODE_LABEL,
  PRICE_TYPE_LABEL,
  PRICE_UNIT_LABEL,
} from "@/lib/container-listing-types";
import { hasRichTextContent } from "@/lib/listing-rich-text";
import { USER_ROLE } from "@/lib/user-roles";

const DESCRIPTION_ALLOWED_TAGS = ["p", "br", "strong", "em", "u", "ul", "ol", "li", "div"];

type ContainerDetailsPageProps = {
  params: Promise<{ id: string }>;
};

function sanitizeDescriptionForDisplay(value?: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || !hasRichTextContent(trimmed)) {
    return undefined;
  }

  const sanitized = sanitizeHtml(trimmed, {
    allowedTags: DESCRIPTION_ALLOWED_TAGS,
    allowedAttributes: {},
  }).trim();

  return hasRichTextContent(sanitized) ? sanitized : undefined;
}

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
  const listingItem = mapContainerListingToItem(listing);

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

  const streetLine = listing.locationAddressParts?.street
    ? [listing.locationAddressParts.street, listing.locationAddressParts.houseNumber]
      .filter(Boolean)
      .join(" ")
    : null;
  const resolvedAddress = listing.locationAddressLabel
    ?? [streetLine, listing.locationCity, listing.locationCountry].filter(Boolean).join(", ");
  const defaultTitle = `${getContainerShortLabel(listingItem.container)} - ${
    listing.type === "available" ? "Dostepny" : "Poszukiwany"
  }`;
  const resolvedTitle = listingItem.title?.trim() ? listingItem.title : defaultTitle;
  const sanitizedDescriptionHtml = sanitizeDescriptionForDisplay(listingItem.description);
  const logisticsLabels: string[] = [];
  if (listingItem.logisticsTransportAvailable) {
    const transportDistanceKm =
      typeof listingItem.logisticsTransportFreeDistanceKm === "number" &&
      Number.isFinite(listingItem.logisticsTransportFreeDistanceKm) &&
      listingItem.logisticsTransportFreeDistanceKm > 0
        ? Math.trunc(listingItem.logisticsTransportFreeDistanceKm)
        : null;
    logisticsLabels.push(
      listingItem.logisticsTransportIncluded
        ? transportDistanceKm
          ? `Transport w cenie do ${transportDistanceKm} km`
          : "Transport w cenie"
        : "Mozliwy transport",
    );
  }
  if (listingItem.logisticsUnloadingAvailable) {
    logisticsLabels.push(
      listingItem.logisticsUnloadingIncluded
        ? "Rozladunek / HDS w cenie"
        : "Mozliwy rozladunek / HDS",
    );
  }
  const logisticsComment = listingItem.logisticsComment?.trim() ?? "";
  const hasLogisticsInfo = logisticsLabels.length > 0 || logisticsComment.length > 0;
  const availableFromLabel = listingItem.availableNow
    ? "Teraz"
    : `${listingItem.availableFromApproximate ? "~" : ""}${listing.availableFrom.toLocaleDateString("pl-PL")}`;

  return (
    <main className="mx-auto grid w-full max-w-5xl gap-4 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/list"
          className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-200 hover:border-neutral-500"
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

      <article className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5">
        <p className="text-sm text-neutral-400">{listing.companyName}</p>
        <h1 className="mt-1 text-2xl font-semibold text-neutral-100">{resolvedTitle}</h1>
        {resolvedTitle !== defaultTitle ? (
          <p className="mt-1 text-sm text-neutral-400">{defaultTitle}</p>
        ) : null}

        <div className="mt-3 grid gap-2 text-sm text-neutral-300 sm:grid-cols-2 lg:grid-cols-3">
          <p>Ilosc: <span className="text-neutral-100">{listing.quantity}</span></p>
          <p>Lokalizacja: <span className="text-neutral-100">{listing.locationCity}, {listing.locationCountry}</span></p>
          {resolvedAddress ? <p>Adres: <span className="text-neutral-100">{resolvedAddress}</span></p> : null}
          <p>Rozmiar: <span className="text-neutral-100">{listingItem.container.size} ft</span></p>
          <p>Wysokosc: <span className="text-neutral-100">{CONTAINER_HEIGHT_LABEL[listingItem.container.height]}</span></p>
          <p>Rodzaj: <span className="text-neutral-100">{CONTAINER_TYPE_LABEL[listingItem.container.type]}</span></p>
          <p>Stan: <span className="text-neutral-100">{CONTAINER_CONDITION_LABEL[listingItem.container.condition]}</span></p>
          <p>Tabliczka CSC: <span className="text-neutral-100">{listingItem.hasCscPlate ? "Tak" : "Nie"}</span></p>
          <p>Certyfikacja CSC: <span className="text-neutral-100">{listingItem.hasCscCertification ? "Tak" : "Nie"}</span></p>
          {typeof listingItem.productionYear === "number" ? (
            <p>Rok produkcji: <span className="text-neutral-100">{listingItem.productionYear}</span></p>
          ) : null}
          <p>Dostepny od: <span className="text-neutral-100">{availableFromLabel}</span></p>
          <p>Wygasa: <span className="text-neutral-100">{listing.expiresAt.toLocaleDateString("pl-PL")}</span></p>
          <p>Status: <span className="text-neutral-100">{listing.status}</span></p>
        </div>

        {listingItem.container.features.length > 0 ? (
          <div className="mt-3">
            <p className="text-sm text-neutral-300">Cechy:</p>
            <p className="text-sm text-neutral-100">
              {listingItem.container.features
                .map((feature) => CONTAINER_FEATURE_LABEL[feature])
                .join(", ")}
            </p>
          </div>
        ) : null}

        {hasLogisticsInfo ? (
          <div className="mt-3">
            <p className="text-sm text-neutral-300">Logistyka:</p>
            {logisticsLabels.length > 0 ? (
              <p className="text-sm text-neutral-100">{logisticsLabels.join(", ")}</p>
            ) : null}
            {logisticsComment.length > 0 ? (
              <p className="mt-1 text-sm text-neutral-100">{logisticsComment}</p>
            ) : null}
          </div>
        ) : null}

        {listingItem.pricing ? (
          <div className="mt-3 text-sm text-neutral-200">
            <p>
              Cena:{" "}
              {listingItem.pricing.type === "request" ? (
                <span>Zapytaj o cene</span>
              ) : listingItem.pricing.original.amount !== null &&
                listingItem.pricing.original.currency &&
                listingItem.pricing.original.unit &&
                listingItem.pricing.original.taxMode ? (
                <span>
                  {listingItem.pricing.type === "starting_from" ? "od " : ""}
                  {listingItem.pricing.original.amount.toLocaleString("pl-PL")}{" "}
                  {PRICE_CURRENCY_LABEL[listingItem.pricing.original.currency]} /{" "}
                  {PRICE_UNIT_LABEL[listingItem.pricing.original.unit]} (
                  {PRICE_TAX_MODE_LABEL[listingItem.pricing.original.taxMode]})
                </span>
              ) : (
                <span>Nie podano</span>
              )}
              {listingItem.pricing.original.negotiable ? " (do negocjacji)" : ""}
            </p>
            <p className="text-xs text-neutral-400">
              Tryb ceny: {PRICE_TYPE_LABEL[listingItem.pricing.type]}
            </p>
          </div>
        ) : typeof listingItem.priceAmount === "number" ? (
          <p className="mt-3 text-sm text-neutral-200">
            Cena: {listingItem.priceAmount.toLocaleString("pl-PL")}
            {listingItem.priceNegotiable ? " (do negocjacji)" : ""}
          </p>
        ) : listing.price ? (
          <p className="mt-3 text-sm text-neutral-200">
            Cena: {listing.price}
            {listingItem.priceNegotiable ? " (do negocjacji)" : ""}
          </p>
        ) : null}

        {sanitizedDescriptionHtml ? (
          <div
            className="mt-4 space-y-2 text-sm text-neutral-200 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:leading-6 [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: sanitizedDescriptionHtml }}
          />
        ) : null}

        <div className="mt-4 rounded-lg border border-neutral-800 bg-neutral-950/60 p-3 text-sm text-neutral-300">
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

