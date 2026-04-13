import Link from "next/link";
import Image from "next/image";
import { ObjectId } from "mongodb";
import sanitizeHtml from "sanitize-html";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { CONTAINER_CONDITION_COLOR_TOKENS } from "@/components/container-listings-shared";
import { ContainerDetailsGallery } from "@/components/container-details-gallery";
import {
  ContainerDetailsLocationsMap,
  type ContainerDetailsLocationPoint,
} from "@/components/container-details-locations-map";
import { ContainerInquiryModalTrigger } from "@/components/container-inquiry-modal-trigger";
import { DetailsBackButton } from "@/components/details-back-button";
import { SESSION_COOKIE_NAME } from "@/lib/auth-session";
import { getCurrentUserFromToken } from "@/lib/auth-user";
import type {
  ContainerListingItem,
  ContainerListingDocument,
} from "@/lib/container-listings";
import {
  ensureContainerListingsIndexes,
  expireContainerListingsIfNeeded,
  getContainerListingFavoritesCollection,
  getContainerListingsCollection,
  mapContainerListingToItem,
} from "@/lib/container-listings";
import {
  CONTAINER_CONDITION_LABEL,
  CONTAINER_FEATURE_LABEL,
  LISTING_STATUS,
  PRICE_CURRENCY_LABEL,
  PRICE_TAX_MODE_LABEL,
  getContainerShortLabel,
  type Currency,
} from "@/lib/container-listing-types";
import { getCountryFlagSvgUrl } from "@/lib/country-flags";
import { hasRichTextContent } from "@/lib/listing-rich-text";
import { getTurnstileSiteKey } from "@/lib/turnstile";
import { USER_ROLE } from "@/lib/user-roles";

const DESCRIPTION_ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "u",
  "ul",
  "ol",
  "li",
  "div",
];
type ContainerDetailsContentProps = {
  listingId: string;
  listHref?: string;
  preferHistoryBack?: boolean;
};

type ListingPriceDisplay = {
  amountLabel: string;
  metaLine: string;
  isRequestPrice: boolean;
  additionalAmounts: string[];
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

function formatVatRateLabel(vatRate: number | null): string {
  if (typeof vatRate !== "number" || !Number.isFinite(vatRate)) {
    return "VAT n/d";
  }
  return `VAT${vatRate.toLocaleString("pl-PL")}%`;
}

function getNormalizedAmountByCurrency(
  input: {
    amountPln: number | null;
    amountEur: number | null;
    amountUsd: number | null;
  },
  currency: Currency,
): number | null {
  if (currency === "PLN") {
    return input.amountPln;
  }
  if (currency === "EUR") {
    return input.amountEur;
  }
  return input.amountUsd;
}

function getListingPriceDisplay(
  item: ContainerListingItem,
): ListingPriceDisplay {
  const pricing = item.pricing;

  if (pricing?.type === "request") {
    const metaParts = ["Zapytanie", "VAT do ustalenia"];
    if (pricing.original.negotiable === true || item.priceNegotiable === true) {
      metaParts.push("Do negocjacji");
    }
    return {
      amountLabel: "Zapytaj o cene",
      metaLine: metaParts.join(" | "),
      isRequestPrice: true,
      additionalAmounts: [],
    };
  }

  if (
    pricing?.original.amount !== null &&
    typeof pricing?.original.amount === "number" &&
    pricing.original.currency &&
    pricing.original.taxMode
  ) {
    const amountPrefix = pricing.type === "starting_from" ? "od " : "";
    const normalizedAmountSet =
      pricing.original.taxMode === "net"
        ? pricing.normalized.net
        : pricing.normalized.gross;
    const alternativeCurrencies = (["PLN", "EUR", "USD"] as const).filter(
      (currency) => currency !== pricing.original.currency,
    );
    const additionalAmounts = alternativeCurrencies
      .map((currency) => {
        const normalizedAmount = getNormalizedAmountByCurrency(
          normalizedAmountSet,
          currency,
        );
        if (
          typeof normalizedAmount !== "number" ||
          !Number.isFinite(normalizedAmount)
        ) {
          return null;
        }
        return `${amountPrefix}~${Math.round(normalizedAmount).toLocaleString("pl-PL")} ${PRICE_CURRENCY_LABEL[currency]}`;
      })
      .filter((value): value is string => Boolean(value));

    const metaParts = [
      `${PRICE_TAX_MODE_LABEL[pricing.original.taxMode]}`,
      formatVatRateLabel(pricing.original.vatRate),
    ];
    if (pricing.original.negotiable === true || item.priceNegotiable === true) {
      metaParts.push("Do negocjacji");
    }

    return {
      amountLabel: `${amountPrefix}${Math.round(pricing.original.amount).toLocaleString("pl-PL")} ${PRICE_CURRENCY_LABEL[pricing.original.currency]}`,
      metaLine: metaParts.join(" | "),
      isRequestPrice: false,
      additionalAmounts,
    };
  }

  if (
    typeof item.priceAmount === "number" &&
    Number.isFinite(item.priceAmount)
  ) {
    const metaParts = ["Netto", "VAT n/d"];
    if (item.priceNegotiable === true) {
      metaParts.push("Do negocjacji");
    }
    return {
      amountLabel: `${Math.round(item.priceAmount).toLocaleString("pl-PL")} PLN`,
      metaLine: metaParts.join(" | "),
      isRequestPrice: false,
      additionalAmounts: [],
    };
  }

  if (item.price?.trim()) {
    const metaParts = ["VAT n/d"];
    if (item.priceNegotiable === true) {
      metaParts.push("Do negocjacji");
    }
    return {
      amountLabel: item.price.trim(),
      metaLine: metaParts.join(" | "),
      isRequestPrice: false,
      additionalAmounts: [],
    };
  }

  return {
    amountLabel: "Nie podano",
    metaLine: "VAT n/d",
    isRequestPrice: false,
    additionalAmounts: [],
  };
}

function getContainerPlaceholderSrc(item: ContainerListingItem): string {
  if (item.container.size === 20) {
    return "/placeholders/containers/container-20.svg";
  }
  if (item.container.size === 40) {
    return "/placeholders/containers/container-40.svg";
  }
  if (item.container.size === 45) {
    return "/placeholders/containers/container-45.svg";
  }
  return "/placeholders/containers/container-unknown.svg";
}

function normalizeImageCandidate(value: unknown): string[] {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  if (!Array.isArray(value)) {
    return [];
  }

  const output: string[] = [];
  for (const entry of value) {
    if (typeof entry === "string") {
      const trimmed = entry.trim();
      if (trimmed) {
        output.push(trimmed);
      }
      continue;
    }
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const record = entry as Record<string, unknown>;
    for (const key of ["url", "src", "path"]) {
      const candidate = record[key];
      if (typeof candidate === "string" && candidate.trim()) {
        output.push(candidate.trim());
        break;
      }
    }
  }

  return output;
}

function isSupportedImageSource(src: string): boolean {
  return (
    src.startsWith("/") ||
    src.startsWith("data:image/") ||
    /^https?:\/\//i.test(src)
  );
}

function extractImageUrls(source: unknown): string[] {
  if (!source || typeof source !== "object") {
    return [];
  }

  const record = source as Record<string, unknown>;
  const output: string[] = [];
  for (const key of ["images", "imageUrls", "photoUrls", "photos", "gallery"]) {
    output.push(...normalizeImageCandidate(record[key]));
  }
  return output;
}

function isPlaceholderImageSource(src: string): boolean {
  return src.startsWith("/placeholders/");
}

function resolveListingRealImages(
  listing: ContainerListingDocument,
  listingItem: ContainerListingItem,
): string[] {
  const dynamicCandidates = [
    ...extractImageUrls(listing),
    ...extractImageUrls(listingItem as unknown),
  ].filter(
    (source) => isSupportedImageSource(source) && !isPlaceholderImageSource(source),
  );

  return Array.from(new Set(dynamicCandidates));
}

type LocationDisplayItem = {
  id: string;
  streetLine?: string;
  city: string;
  country: string;
  flagUrl: string | null;
};

function getLocationDisplayItems(item: ContainerListingItem): LocationDisplayItem[] {
  const items: LocationDisplayItem[] = [];
  const seen = new Set<string>();

  const appendLocation = (input: {
    street?: string;
    houseNumber?: string;
    city?: string;
    country?: string;
  }) => {
    const street = input.street?.trim() ?? "";
    const houseNumber = input.houseNumber?.trim() ?? "";
    const city = input.city?.trim() ?? "";
    const country = input.country?.trim() ?? "";
    const streetLine = street ? [street, houseNumber].filter(Boolean).join(" ") : undefined;
    const key = [streetLine ?? "", city, country].join("|").toLowerCase();

    if (!city && !country && !streetLine) {
      return;
    }
    if (seen.has(key)) {
      return;
    }
    seen.add(key);

    items.push({
      id: `${items.length + 1}-${key}`,
      streetLine,
      city: city || "Nieznane miasto",
      country: country || "Nieznany kraj",
      flagUrl: getCountryFlagSvgUrl(country),
    });
  };

  for (const location of item.locations ?? []) {
    appendLocation({
      street: location.locationAddressParts?.street,
      houseNumber: location.locationAddressParts?.houseNumber,
      city: location.locationAddressParts?.city ?? location.locationCity,
      country: location.locationAddressParts?.country ?? location.locationCountry,
    });
  }

  if (items.length === 0) {
    appendLocation({
      street: item.locationAddressParts?.street,
      houseNumber: item.locationAddressParts?.houseNumber,
      city: item.locationAddressParts?.city ?? item.locationCity,
      country: item.locationAddressParts?.country ?? item.locationCountry,
    });
  }

  if (items.length === 0) {
    return [
      {
        id: "fallback-empty-location",
        city: "Nie podano lokalizacji",
        country: "Nieznany kraj",
        flagUrl: null,
      },
    ];
  }

  return items;
}

function getLocationMapPoints(item: ContainerListingItem): ContainerDetailsLocationPoint[] {
  const output: ContainerDetailsLocationPoint[] = [];
  const seen = new Set<string>();

  const appendPoint = (input: {
    idHint: string;
    lat: unknown;
    lng: unknown;
    city?: string;
    country?: string;
  }) => {
    const lat = typeof input.lat === "number" && Number.isFinite(input.lat) ? input.lat : null;
    const lng = typeof input.lng === "number" && Number.isFinite(input.lng) ? input.lng : null;
    if (lat === null || lng === null) {
      return;
    }

    const key = `${lat.toFixed(6)}|${lng.toFixed(6)}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);

    const city = input.city?.trim() || "Nieznane miasto";
    const country = input.country?.trim() || "Nieznany kraj";
    output.push({
      id: `${input.idHint}-${key}`,
      lat,
      lng,
      label: `${city}, ${country}`,
    });
  };

  for (const [index, location] of (item.locations ?? []).entries()) {
    appendPoint({
      idHint: `location-${index + 1}`,
      lat: location.locationLat,
      lng: location.locationLng,
      city: location.locationAddressParts?.city ?? location.locationCity,
      country: location.locationAddressParts?.country ?? location.locationCountry,
    });
  }

  if (output.length === 0) {
    appendPoint({
      idHint: "fallback",
      lat: item.locationLat,
      lng: item.locationLng,
      city: item.locationAddressParts?.city ?? item.locationCity,
      country: item.locationAddressParts?.country ?? item.locationCountry,
    });
  }

  return output;
}

function getCscValidityLabel(item: ContainerListingItem): string | null {
  if (
    typeof item.cscValidToMonth !== "number" ||
    !Number.isInteger(item.cscValidToMonth) ||
    item.cscValidToMonth < 1 ||
    item.cscValidToMonth > 12 ||
    typeof item.cscValidToYear !== "number" ||
    !Number.isInteger(item.cscValidToYear)
  ) {
    return null;
  }
  return `${String(item.cscValidToMonth).padStart(2, "0")}.${item.cscValidToYear}`;
}

function getQuantityDisplay(value: number): string {
  if (!Number.isFinite(value) || value <= 1) {
    return "1";
  }
  if (value > 999) {
    return "999+";
  }
  return String(Math.trunc(value));
}

export async function ContainerDetailsContent({
  listingId,
  listHref = "/list",
  preferHistoryBack = false,
}: ContainerDetailsContentProps) {
  await ensureContainerListingsIndexes();
  await expireContainerListingsIfNeeded();

  if (!ObjectId.isValid(listingId)) {
    notFound();
  }

  const listings = await getContainerListingsCollection();
  const listing = await listings.findOne({ _id: new ObjectId(listingId) });
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
  const isLoggedIn = Boolean(currentUser?._id);
  const turnstileSiteKey = !isLoggedIn ? getTurnstileSiteKey() : null;
  const inquiryInitialValues = isLoggedIn
    ? {
        buyerName: currentUser?.name ?? "",
        buyerEmail: currentUser?.email ?? "",
        buyerPhone: currentUser?.phone ?? "",
      }
    : undefined;
  const initialIsFavorite = isLoggedIn
    ? Boolean(
        await (await getContainerListingFavoritesCollection()).findOne({
          userId: currentUser!._id,
          listingId: listing._id,
        }),
      )
    : false;
  const isPublic = listing.status === LISTING_STATUS.ACTIVE;

  if (!isPublic && !isOwner && !isAdmin) {
    notFound();
  }

  const defaultTitle = getContainerShortLabel(listingItem.container);
  const resolvedTitle = listingItem.title?.trim()
    ? listingItem.title
    : defaultTitle;
  const sanitizedDescriptionHtml = sanitizeDescriptionForDisplay(
    listingItem.description,
  );
  const availableFromLabel = listingItem.availableNow
    ? "Teraz"
    : `${listingItem.availableFromApproximate ? "~" : ""}${listing.availableFrom.toLocaleDateString("pl-PL")}`;
  const cscValidityLabel = getCscValidityLabel(listingItem);
  const priceDisplay = getListingPriceDisplay(listingItem);
  const realImages = resolveListingRealImages(listing, listingItem);
  const mainImage = realImages[0] ?? getContainerPlaceholderSrc(listingItem);
  const additionalRealImages = realImages.length > 1 ? realImages.slice(1) : [];
  const hasAnyCsc = listingItem.hasCscPlate || listingItem.hasCscCertification;
  const quantityDisplay = getQuantityDisplay(listingItem.quantity);
  const locationItems = getLocationDisplayItems(listingItem);
  const locationMapPoints = getLocationMapPoints(listingItem);
  const freeTransportDistanceKmForMap =
    listingItem.logisticsTransportIncluded &&
    typeof listingItem.logisticsTransportFreeDistanceKm === "number" &&
    Number.isFinite(listingItem.logisticsTransportFreeDistanceKm) &&
    listingItem.logisticsTransportFreeDistanceKm > 0
      ? Math.trunc(listingItem.logisticsTransportFreeDistanceKm)
      : null;
  const featureLabels = listingItem.container.features
    .map((feature) => CONTAINER_FEATURE_LABEL[feature])
    .filter((label) => label.trim().length > 0);
  const logisticsComment = listingItem.logisticsComment?.trim() || undefined;
  const isPriceNegotiable =
    listingItem.priceNegotiable === true ||
    listingItem.pricing?.original.negotiable === true;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <DetailsBackButton
          href={listHref}
          preferHistoryBack={preferHistoryBack}
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100"
        />
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <ContainerInquiryModalTrigger
            listingId={listing._id.toHexString()}
            isPriceNegotiable={isPriceNegotiable}
            isLoggedIn={isLoggedIn}
            initialIsFavorite={initialIsFavorite}
            turnstileSiteKey={turnstileSiteKey}
            initialInquiryValues={inquiryInitialValues}
          />
          {isOwner || isAdmin ? (
            <Link
              href={`/containers/${listing._id.toHexString()}/edit`}
              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100"
            >
              Edytuj kontener
            </Link>
          ) : null}
        </div>
      </div>

      <article className="rounded-md border border-neutral-300 bg-neutral-50/95 p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-stretch">
          <section className="h-full rounded-md border border-neutral-300 bg-white p-4">
            <div className="grid gap-4 sm:grid-cols-[176px_minmax(0,1fr)] sm:items-start">
              <div className="grid h-fit justify-items-start">
                <ContainerDetailsGallery
                  images={[mainImage]}
                  title={resolvedTitle}
                  showMainImage
                  showThumbnails={false}
                  className="mt-0"
                />
              </div>

              <div className="min-w-0">
                <p className="text-sm text-neutral-600">
                  {listing.companyName}
                </p>
                <h1 className="mt-2 text-3xl font-semibold text-neutral-900">
                  {getContainerShortLabel(listingItem.container)}
                </h1>
                <div className="mt-2 grid gap-2 text-sm text-neutral-700">
                  <div className="flex items-center">
                    <span
                      className={`rounded-md border px-2 py-1 text-xs font-medium ${CONTAINER_CONDITION_COLOR_TOKENS[listingItem.container.condition].badgeClassName}`}
                    >
                      {
                        CONTAINER_CONDITION_LABEL[
                          listingItem.container.condition
                        ]
                      }
                    </span>
                  </div>
                  {typeof listingItem.productionYear === "number" ? (
                    <p>
                      Rok:{" "}
                      <span className="text-neutral-900">
                        {listingItem.productionYear}
                      </span>
                    </p>
                  ) : null}
                  <p>
                    Dostepny od:{" "}
                    <span className="text-neutral-900">
                      {availableFromLabel}
                    </span>
                  </p>
                  <p>
                    Ilosc:{" "}
                    <span className="text-neutral-900">{quantityDisplay}</span>
                  </p>
                </div>
              </div>
            </div>
          </section>

          <div className="grid gap-4 lg:h-full lg:grid-rows-2">
            <section className="h-full rounded-md border border-neutral-300 bg-white p-4 text-right">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                Cena
              </p>
              <p
                className={`mt-1 text-2xl font-bold ${
                  priceDisplay.isRequestPrice
                    ? "text-neutral-700"
                    : "text-amber-600"
                }`}
              >
                {priceDisplay.amountLabel}
              </p>
              {priceDisplay.additionalAmounts.length > 0 ? (
                <div className="text-right text-[13px] text-neutral-600">
                  {priceDisplay.additionalAmounts.map((amountLine, index) => (
                    <p key={`${amountLine}-${index}`}>{amountLine}</p>
                  ))}
                </div>
              ) : null}
              <p className="mt-1 text-xs text-neutral-600">
                {priceDisplay.metaLine}
              </p>
            </section>

            <section
              className={`rounded-md border p-4 ${
                hasAnyCsc
                  ? "border-green-300 bg-green-50"
                  : "border-neutral-300 bg-white"
              } h-full`}
            >
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                CSC
              </p>
              <div className="mt-2 grid gap-1 text-sm text-neutral-700">
                <p>
                  Tabliczka CSC:{" "}
                  <span className="text-neutral-900">
                    {listingItem.hasCscPlate ? "Tak" : "Nie"}
                  </span>
                </p>
                <p>
                  Certyfikacja CSC:{" "}
                  <span className="text-neutral-900">
                    {listingItem.hasCscCertification ? "Tak" : "Nie"}
                  </span>
                </p>
                <p>
                  Waznosc CSC:{" "}
                  <span className="text-neutral-900">
                    {cscValidityLabel ?? "brak danych"}
                  </span>
                </p>
              </div>
            </section>
          </div>
        </div>

        {featureLabels.length > 0 ? (
          <section className="mt-4 rounded-md border border-neutral-300 bg-white p-4">
            <h2 className="text-sm font-semibold text-neutral-800">
              Cechy kontenera
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {featureLabels.map((label) => (
                <span
                  key={`${listingItem.id}-feature-${label}`}
                  className="rounded-md border border-neutral-300 bg-neutral-50 px-2 py-1 text-xs text-neutral-700"
                >
                  {label}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        {sanitizedDescriptionHtml || resolvedTitle !== defaultTitle ? (
          <section className="mt-4 rounded-md border border-neutral-300 bg-white p-4">
            <h2 className="text-sm font-semibold text-neutral-800">Opis</h2>
            {resolvedTitle !== defaultTitle ? (
              <p className="mt-3 text-lg font-semibold text-neutral-900">
                {resolvedTitle}
              </p>
            ) : null}
            {sanitizedDescriptionHtml ? (
              <div
                className="mt-3 space-y-2 text-sm text-neutral-700 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:leading-6 [&_ul]:list-disc [&_ul]:pl-5"
                dangerouslySetInnerHTML={{ __html: sanitizedDescriptionHtml }}
              />
            ) : null}
          </section>
        ) : null}

        <section className="mt-4 rounded-md border border-neutral-300 bg-white p-4">
          <h2 className="text-sm font-semibold text-neutral-800">Lokalizacja</h2>
          <ul className="mt-3 grid gap-2 text-sm text-neutral-700">
            {locationItems.map((location) => (
              <li key={location.id} className="flex items-start gap-2">
                {location.flagUrl ? (
                  <Image
                    src={location.flagUrl}
                    alt={`Flaga: ${location.country}`}
                    width={20}
                    height={15}
                    unoptimized
                    className="mt-[1px] h-[15px] w-5 rounded-[2px] border border-neutral-300 object-cover"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="mt-[1px] h-[15px] w-5 rounded-[2px] border border-neutral-300 bg-neutral-200"
                  />
                )}
                <p className="min-w-0">
                  {location.streetLine ? <span>{location.streetLine}, </span> : null}
                  <strong className="font-semibold text-neutral-900">{location.city}</strong>
                  <span>, </span>
                  <strong className="font-semibold text-neutral-900">{location.country}</strong>
                </p>
              </li>
            ))}
          </ul>

          {listingItem.logisticsTransportAvailable ||
          listingItem.logisticsUnloadingAvailable ||
          logisticsComment ? (
            <div className="mt-4 border-t border-neutral-200 pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Logistyka
              </p>
              <div className="mt-2 grid gap-1 text-sm">
                {listingItem.logisticsTransportAvailable ? (
                  <p
                    className={
                      listingItem.logisticsTransportIncluded
                        ? "text-green-700"
                        : "text-neutral-700"
                    }
                  >
                    {listingItem.logisticsTransportIncluded ? (
                      <>
                        Darmowy transport
                        {freeTransportDistanceKmForMap ? (
                          <>
                            {" "}
                            do <strong>{freeTransportDistanceKmForMap} km</strong>
                          </>
                        ) : null}
                      </>
                    ) : (
                      "Mozliwy transport"
                    )}
                  </p>
                ) : null}
                {listingItem.logisticsUnloadingAvailable ? (
                  <p
                    className={
                      listingItem.logisticsUnloadingIncluded
                        ? "text-green-700"
                        : "text-neutral-700"
                    }
                  >
                    {listingItem.logisticsUnloadingIncluded
                      ? "Darmowy rozladunek / HDS"
                      : "Mozliwy rozladunek / HDS"}
                  </p>
                ) : null}
              </div>
              {logisticsComment ? (
                <p className="mt-2 text-xs text-neutral-600">{logisticsComment}</p>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="mt-4 h-[280px] overflow-hidden rounded-md border border-neutral-300 bg-white">
          <ContainerDetailsLocationsMap
            points={locationMapPoints}
            freeTransportDistanceKm={freeTransportDistanceKmForMap}
          />
        </section>

        <section className="mt-4 rounded-md border border-neutral-300 bg-white p-4 text-sm text-neutral-700">
          <h2 className="text-sm font-semibold text-neutral-800">Kontakt</h2>
          <p className="mt-3">
            Email:{" "}
            <a
              className="text-sky-700 hover:text-sky-600"
              href={`mailto:${listing.contactEmail}`}
            >
              {listing.contactEmail}
            </a>
          </p>
          {listing.contactPhone ? (
            <p>
              Telefon:{" "}
              <a
                className="text-sky-700 hover:text-sky-600"
                href={`tel:${listing.contactPhone.replace(/\s+/g, "")}`}
              >
                {listing.contactPhone}
              </a>
            </p>
          ) : null}
        </section>

        {additionalRealImages.length > 0 ? (
          <section className="mt-4 rounded-md border border-neutral-300 bg-white p-4">
            <h2 className="text-sm font-semibold text-neutral-800">Galeria</h2>
            <ContainerDetailsGallery
              images={additionalRealImages}
              title={resolvedTitle}
              showMainImage={false}
              showThumbnails
              className="mt-3"
            />
          </section>
        ) : null}

        <div className="mt-4 flex justify-end">
          <p className="text-right text-xs text-neutral-400">
            Wygasa: {listing.expiresAt.toLocaleDateString("pl-PL")}
          </p>
        </div>
      </article>
      <div className="flex justify-end">
        <ContainerInquiryModalTrigger
          listingId={listing._id.toHexString()}
          isPriceNegotiable={isPriceNegotiable}
          isLoggedIn={isLoggedIn}
          initialIsFavorite={initialIsFavorite}
          turnstileSiteKey={turnstileSiteKey}
          initialInquiryValues={inquiryInitialValues}
        />
      </div>
    </div>
  );
}
