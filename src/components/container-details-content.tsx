import Link from "next/link";
import Image from "next/image";
import { ObjectId } from "mongodb";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { CONTAINER_CONDITION_COLOR_TOKENS } from "@/components/container-listings-shared";
import { ContainerDetailsGallery } from "@/components/container-details-gallery";
import { ContainerDetailsRelatedListings } from "@/components/container-details-related-listings";
import { ContainerDetailsScrollTop } from "@/components/container-details-scroll-top";
import { ContainerPhotoWithPlaceholder } from "@/components/container-photo-with-placeholder";
import {
  ContainerDetailsLocationsMap,
  type ContainerDetailsLocationPoint,
} from "@/components/container-details-locations-map";
import { ContainerInquiryModalTrigger } from "@/components/container-inquiry-modal-trigger";
import { toIntlLocale } from "@/components/container-modules-i18n";
import { DetailsBackButton } from "@/components/details-back-button";
import { SESSION_COOKIE_NAME } from "@/lib/auth-session";
import { getCurrentUserFromToken } from "@/lib/auth-user";
import { getCompaniesCollection } from "@/lib/companies";
import { normalizeCompanyVerificationStatus } from "@/lib/company-verification";
import {
  getContainerConditionLabel,
  getContainerFeatureLabel,
  getContainerShortDetailTitleLocalized,
  getPriceTaxModeLabel,
  type ContainerListingsMessages,
} from "@/components/container-listings-i18n";
import type {
  ContainerListingItem,
} from "@/lib/container-listings";
import {
  ensureContainerListingsIndexes,
  expireContainerListingsIfNeeded,
  getContainerListingFavoritesCollection,
  getContainerListingsCollection,
  mapContainerListingToItem,
} from "@/lib/container-listings";
import {
  LISTING_STATUS,
  type Currency,
} from "@/lib/container-listing-types";
import {
  getCountryDisplayName,
  getCountryFlagSvgUrl,
  resolveCountryCodeFromInput,
  resolveCountryCodeFromInputApprox,
} from "@/lib/country-flags";
import {
  getMessages,
  LOCALE_COOKIE_NAME,
  resolveLocale,
  type AppLocale,
} from "@/lib/i18n";
import { normalizeOptionalListingDescriptionHtml } from "@/lib/listing-description-html";
import { getTurnstileSiteKey } from "@/lib/turnstile";
import { USER_ROLE } from "@/lib/user-roles";
type ContainerDetailsContentProps = {
  listingId: string;
  listHref?: string;
  preferHistoryBack?: boolean;
  showRelatedListings?: boolean;
};

type ListingPriceDisplay = {
  amountLabel: string;
  metaLine: string;
  isRequestPrice: boolean;
  additionalAmounts: string[];
};

function appendBackHrefToCompanyProfileHref(
  href: string,
  backHref: string | undefined,
): string {
  const normalizedHref = href.trim();
  const normalizedBackHref = backHref?.trim();

  if (!normalizedHref) {
    return normalizedHref;
  }

  if (!normalizedBackHref || !normalizedBackHref.startsWith("/")) {
    return normalizedHref;
  }

  const separator = normalizedHref.includes("?") ? "&" : "?";
  return `${normalizedHref}${separator}back=${encodeURIComponent(normalizedBackHref)}`;
}

function formatVatRateLabel(vatRate: number | null, locale: AppLocale): string | null {
  if (typeof vatRate !== "number" || !Number.isFinite(vatRate)) {
    return null;
  }
  return `VAT ${vatRate.toLocaleString(toIntlLocale(locale))}%`;
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
  locale: AppLocale,
  messages: ContainerListingsMessages,
  moduleMessages: ReturnType<typeof getMessages>["containerModules"],
): ListingPriceDisplay {
  const pricing = item.pricing;

  if (
    pricing &&
    (pricing.original.amount === null || typeof pricing.original.amount !== "number")
  ) {
    const metaParts: string[] = [];
    if (pricing.original.negotiable === true || item.priceNegotiable === true) {
      metaParts.push(moduleMessages.details.negotiable);
    }
    return {
      amountLabel: moduleMessages.details.askPrice,
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
        return `~${Math.round(normalizedAmount).toLocaleString(toIntlLocale(locale))} ${currency}`;
      })
      .filter((value): value is string => Boolean(value));

    const metaParts = [getPriceTaxModeLabel(messages, pricing.original.taxMode)];
    const vatRateLabel = formatVatRateLabel(pricing.original.vatRate, locale);
    if (vatRateLabel) {
      metaParts.push(vatRateLabel);
    }
    if (pricing.original.negotiable === true || item.priceNegotiable === true) {
      metaParts.push(moduleMessages.details.negotiable);
    }

    return {
      amountLabel: `${Math.round(pricing.original.amount).toLocaleString(toIntlLocale(locale))} ${pricing.original.currency}`,
      metaLine: metaParts.join(" | "),
      isRequestPrice: false,
      additionalAmounts,
    };
  }

  if (
    typeof item.priceAmount === "number" &&
    Number.isFinite(item.priceAmount)
  ) {
    const metaParts = [moduleMessages.details.net];
    if (item.priceNegotiable === true) {
      metaParts.push(moduleMessages.details.negotiable);
    }
    return {
      amountLabel: `${Math.round(item.priceAmount).toLocaleString(toIntlLocale(locale))} PLN`,
      metaLine: metaParts.join(" | "),
      isRequestPrice: false,
      additionalAmounts: [],
    };
  }

  if (item.price?.trim()) {
    const metaParts: string[] = [];
    if (item.priceNegotiable === true) {
      metaParts.push(moduleMessages.details.negotiable);
    }
    return {
      amountLabel: item.price.trim(),
      metaLine: metaParts.join(" | "),
      isRequestPrice: false,
      additionalAmounts: [],
    };
  }

  return {
    amountLabel: moduleMessages.details.askPrice,
    metaLine: "",
    isRequestPrice: true,
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

function isSupportedImageSource(src: string): boolean {
  return (
    src.startsWith("/") ||
    src.startsWith("data:image/") ||
    /^https?:\/\//i.test(src)
  );
}

function isPlaceholderImageSource(src: string): boolean {
  return src.startsWith("/placeholders/");
}

type LocationDisplayItem = {
  id: string;
  postalCode?: string;
  streetLine?: string;
  city: string;
  country: string;
  countryCode?: string;
  flagUrl: string | null;
};

function getResolvedCountryCode(input: {
  country?: string;
  countryCode?: string;
}): string | undefined {
  const directCode = input.countryCode?.trim().toUpperCase();
  if (directCode) {
    return directCode;
  }

  const countryName = input.country?.trim() ?? "";
  if (!countryName) {
    return undefined;
  }

  return (
    resolveCountryCodeFromInput(countryName) ??
    resolveCountryCodeFromInputApprox(countryName) ??
    undefined
  );
}

function getLocationDisplayItems(
  item: ContainerListingItem,
  locale: AppLocale,
  moduleMessages: ReturnType<typeof getMessages>["containerModules"],
): LocationDisplayItem[] {
  const items: LocationDisplayItem[] = [];
  const seen = new Set<string>();

  const appendLocation = (input: {
    postalCode?: string;
    street?: string;
    houseNumber?: string;
    city?: string;
    country?: string;
    countryCode?: string;
  }) => {
    const postalCode = input.postalCode?.trim() ?? "";
    const street = input.street?.trim() ?? "";
    const houseNumber = input.houseNumber?.trim() ?? "";
    const city = input.city?.trim() ?? "";
    const rawCountry = input.country?.trim() ?? "";
    const countryCode = getResolvedCountryCode({
      country: rawCountry,
      countryCode: input.countryCode,
    });
    const country = getCountryDisplayName(countryCode, locale, rawCountry);
    const streetLine = street ? [street, houseNumber].filter(Boolean).join(" ") : undefined;
    const key = [postalCode, streetLine ?? "", city, country].join("|").toLowerCase();

    if (!city && !country && !streetLine) {
      return;
    }
    if (seen.has(key)) {
      return;
    }
    seen.add(key);

    items.push({
      id: `${items.length + 1}-${key}`,
      ...(postalCode ? { postalCode } : {}),
      streetLine,
      city: city || moduleMessages.details.noData,
      country: country || moduleMessages.details.noData,
      ...(countryCode ? { countryCode } : {}),
      flagUrl: getCountryFlagSvgUrl(countryCode ?? rawCountry),
    });
  };

  for (const location of item.locations ?? []) {
    appendLocation({
      postalCode: location.locationAddressParts?.postalCode,
      street: location.locationAddressParts?.street,
      houseNumber: location.locationAddressParts?.houseNumber,
      city: location.locationAddressParts?.city ?? location.locationCity,
      country: location.locationAddressParts?.country ?? location.locationCountry,
      countryCode: location.locationCountryCode,
    });
  }

  if (items.length === 0) {
    appendLocation({
      postalCode: item.locationAddressParts?.postalCode,
      street: item.locationAddressParts?.street,
      houseNumber: item.locationAddressParts?.houseNumber,
      city: item.locationAddressParts?.city ?? item.locationCity,
      country: item.locationAddressParts?.country ?? item.locationCountry,
      countryCode: item.locationCountryCode,
    });
  }

  if (items.length === 0) {
    return [
      {
        id: "fallback-empty-location",
        city: moduleMessages.details.noData,
        country: moduleMessages.details.noData,
        flagUrl: null,
      },
    ];
  }

  return items;
}

function getLocationMapPoints(
  item: ContainerListingItem,
  locale: AppLocale,
  moduleMessages: ReturnType<typeof getMessages>["containerModules"],
): ContainerDetailsLocationPoint[] {
  const output: ContainerDetailsLocationPoint[] = [];
  const seen = new Set<string>();

  const appendPoint = (input: {
    idHint: string;
    lat: unknown;
    lng: unknown;
    city?: string;
    country?: string;
    countryCode?: string;
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

    const city = input.city?.trim() || moduleMessages.details.noData;
    const rawCountry = input.country?.trim() || "";
    const countryCode = getResolvedCountryCode({
      country: rawCountry,
      countryCode: input.countryCode,
    });
    const country =
      getCountryDisplayName(countryCode, locale, rawCountry) ||
      moduleMessages.details.noData;
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
      countryCode: location.locationCountryCode,
    });
  }

  if (output.length === 0) {
    appendPoint({
      idHint: "fallback",
      lat: item.locationLat,
      lng: item.locationLng,
      city: item.locationAddressParts?.city ?? item.locationCity,
      country: item.locationAddressParts?.country ?? item.locationCountry,
      countryCode: item.locationCountryCode,
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

function getRalColorCode(value: string): string {
  const normalized = value.trim().replace(/^RAL[\s-]*/i, "").trim();
  return normalized.length > 0 ? normalized : value.trim();
}

function getRalTileTextClass(color: { r: number; g: number; b: number }): string {
  const luminance = (color.r * 299 + color.g * 587 + color.b * 114) / 1000;
  return luminance > 160 ? "text-neutral-900" : "text-white";
}

function isSameCompanyName(left: string, right: string): boolean {
  return left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase();
}

export async function ContainerDetailsContent({
  listingId,
  listHref = "/list",
  preferHistoryBack = false,
  showRelatedListings = true,
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
  let isCompanyVerified = listingItem.companyIsVerified === true;
  let companyProfileHref: string | null = listingItem.companySlug
    ? `/companies/${listingItem.companySlug}`
    : null;
  const companies = await getCompaniesCollection();
  const ownerCompany = await companies.findOne(
    {
      createdByUserId: listing.createdByUserId,
      isBlocked: { $ne: true },
    },
    {
      projection: {
        slug: 1,
        name: 1,
        verificationStatus: 1,
      },
      sort: { updatedAt: -1 },
    },
  );
  const ownerCompanyMatchesListing =
    Boolean(ownerCompany?.name) &&
    isSameCompanyName(ownerCompany!.name, listing.companyName);
  const ownerCompanySlug = ownerCompany?.slug?.trim();
  if (!companyProfileHref && ownerCompanySlug && ownerCompanyMatchesListing) {
    companyProfileHref = `/companies/${ownerCompanySlug}`;
  }
  if (
    ownerCompanyMatchesListing &&
    normalizeCompanyVerificationStatus(ownerCompany?.verificationStatus) === "verified"
  ) {
    isCompanyVerified = true;
  }
  if (companyProfileHref) {
    companyProfileHref = appendBackHrefToCompanyProfileHref(companyProfileHref, listHref);
  }
  const relatedCompanySlug =
    listingItem.publishedAsCompany === true
      ? listingItem.companySlug?.trim() ||
        (ownerCompanyMatchesListing ? ownerCompanySlug : undefined)
      : undefined;

  const cookieStore = await cookies();
  const locale = resolveLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
  const messages = getMessages(locale);
  const moduleMessages = messages.containerModules;
  const listingMessages = messages.containerListings;
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

  const galleryTitle = getContainerShortDetailTitleLocalized(
    listingMessages,
    listingItem.container,
  );
  const sanitizedDescriptionHtml = normalizeOptionalListingDescriptionHtml(
    listingItem.description,
  );
  const availableFromLabel = listingItem.availableNow
    ? moduleMessages.details.availableNow
    : `${listingItem.availableFromApproximate ? "~" : ""}${listing.availableFrom.toLocaleDateString(toIntlLocale(locale))}`;
  const cscValidityLabel = getCscValidityLabel(listingItem);
  const priceDisplay = getListingPriceDisplay(
    listingItem,
    locale,
    listingMessages,
    moduleMessages,
  );
  const detailPhotoUrls = (listingItem.photoUrls ?? []).filter(
    (source) => isSupportedImageSource(source) && !isPlaceholderImageSource(source),
  );
  const mainImage = detailPhotoUrls[0] ?? getContainerPlaceholderSrc(listingItem);
  const additionalRealImages = detailPhotoUrls.slice(1);
  const hasRealMainImage = detailPhotoUrls.length > 0;
  const hasAnyCertification =
    listingItem.hasCscPlate || listingItem.hasCscCertification || listingItem.hasWarranty;
  const quantityDisplay = getQuantityDisplay(listingItem.quantity);
  const locationItems = getLocationDisplayItems(listingItem, locale, moduleMessages);
  const locationMapPoints = getLocationMapPoints(listingItem, locale, moduleMessages);
  const freeTransportDistanceKmForMap =
    listingItem.logisticsTransportIncluded &&
    typeof listingItem.logisticsTransportFreeDistanceKm === "number" &&
    Number.isFinite(listingItem.logisticsTransportFreeDistanceKm) &&
    listingItem.logisticsTransportFreeDistanceKm > 0
      ? Math.trunc(listingItem.logisticsTransportFreeDistanceKm)
      : null;
  const featureLabels = listingItem.container.features
    .map((feature) => getContainerFeatureLabel(listingMessages, feature))
    .filter((label) => label.trim().length > 0);
  const logisticsComment = listingItem.logisticsComment?.trim() || undefined;
  const isPriceNegotiable =
    listingItem.priceNegotiable === true ||
    listingItem.pricing?.original.negotiable === true;
  const containerColors = listingItem.containerColors ?? [];

  return (
    <div className="grid gap-4">
      <ContainerDetailsScrollTop listingId={listing._id.toHexString()} />
      <div className="sticky top-0 z-20 -mx-4 -mt-6 px-4 pb-1 pt-6 sm:hidden">
        <div className="flex min-w-0 items-center gap-2 rounded-md border border-neutral-200 bg-white/95 p-2 shadow-sm backdrop-blur">
          <DetailsBackButton
            href={listHref}
            preferHistoryBack={preferHistoryBack}
            label={moduleMessages.shared.backToList}
            className="inline-flex h-10 min-w-0 flex-1 items-center justify-center overflow-hidden whitespace-nowrap rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-100/80"
          />
          <ContainerInquiryModalTrigger
            listingId={listing._id.toHexString()}
            isPriceNegotiable={isPriceNegotiable}
            isLoggedIn={isLoggedIn}
            initialIsFavorite={initialIsFavorite}
            turnstileSiteKey={turnstileSiteKey}
            initialInquiryValues={inquiryInitialValues}
            className="min-w-0 flex-1 flex-nowrap [&>button:nth-child(1)]:hidden [&>button:nth-child(2)]:hidden [&>button:nth-child(4)]:hidden [&>button:nth-child(3)]:h-10 [&>button:nth-child(3)]:w-full [&>button:nth-child(3)]:min-w-0 [&>button:nth-child(3)]:justify-center [&>button:nth-child(3)]:overflow-hidden [&>button:nth-child(3)]:whitespace-nowrap"
          />
        </div>
      </div>

      <div className="hidden flex-wrap items-center justify-between gap-2 sm:flex">
        <DetailsBackButton
          href={listHref}
          preferHistoryBack={preferHistoryBack}
          label={moduleMessages.shared.backToList}
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
            className="[&>button:nth-child(1)]:hidden [&>button:nth-child(2)]:hidden"
          />
        </div>
      </div>

      <article className="rounded-md border border-neutral-300 bg-neutral-50/95 p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-stretch">
          <section className="h-full rounded-md border border-neutral-300 bg-white p-4">
            <div className="grid gap-4 sm:grid-cols-[176px_minmax(0,1fr)] sm:items-start">
              {hasRealMainImage ? (
                <div className="sm:hidden">
                  <div className="relative mx-auto aspect-square w-full max-w-[375px] overflow-hidden rounded-md border border-neutral-200 bg-neutral-100">
                    <ContainerPhotoWithPlaceholder
                      src={mainImage}
                      alt={galleryTitle}
                      fill
                      unoptimized
                      className="object-contain p-1"
                      sizes="(max-width: 640px) 100vw, 375px"
                      priority
                    />
                  </div>
                </div>
              ) : null}

              <div className="hidden h-fit justify-items-start sm:grid">
                <ContainerDetailsGallery
                  images={[mainImage]}
                  title={galleryTitle}
                  showMainImage
                  mainImagePriority
                  showThumbnails={false}
                  className="mt-0"
                  messages={moduleMessages.gallery}
                />
              </div>

              <div className="min-w-0">
                {companyProfileHref ? (
                  <span className="inline-flex min-w-0 items-center gap-1">
                    <Link
                      href={companyProfileHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 truncate text-sm text-sky-700 decoration-sky-400 underline underline-offset-2 hover:text-sky-800"
                    >
                      {listing.companyName}
                    </Link>
                    {isCompanyVerified ? (
                      <span
                        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-emerald-300/80 bg-emerald-100/80 text-emerald-700"
                        aria-label={moduleMessages.details.verifiedCompany}
                        title={moduleMessages.details.verifiedCompany}
                      >
                        <svg
                          viewBox="0 0 20 20"
                          fill="none"
                          className="h-3.5 w-3.5"
                          aria-hidden="true"
                        >
                          <path
                            d="M5 10.5l3.2 3.2L15 7"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    ) : null}
                  </span>
                ) : (
                  <p className="text-sm text-neutral-600">{listing.companyName}</p>
                )}
                <h1 className="mt-2 text-3xl font-semibold text-neutral-900">
                  {getContainerShortDetailTitleLocalized(listingMessages, listingItem.container)}
                </h1>
                <div className="mt-2 grid gap-2 text-sm text-neutral-700">
                  <div className="flex items-center">
                    <span
                      className={`rounded-md border px-2 py-1 text-xs font-medium ${CONTAINER_CONDITION_COLOR_TOKENS[listingItem.container.condition].badgeClassName}`}
                    >
                      {
                        getContainerConditionLabel(
                          listingMessages,
                          listingItem.container.condition,
                        )
                      }
                    </span>
                  </div>
                  {typeof listingItem.productionYear === "number" ? (
                    <p>
                      {moduleMessages.details.productionYearLabel}:{" "}
                      <span className="text-neutral-900">
                        {listingItem.productionYear}
                      </span>
                    </p>
                  ) : null}
                  <p>
                    {moduleMessages.details.availableFromLabel}:{" "}
                    <span className="text-neutral-900">
                      {availableFromLabel}
                    </span>
                  </p>
                  <p>
                    {moduleMessages.details.quantityLabel}:{" "}
                    <span className="text-neutral-900">{quantityDisplay}</span>
                  </p>
                </div>
              </div>
            </div>
            {containerColors.length > 0 ? (
              <div className="mt-4 border-t border-neutral-200 pt-3">
                <div className="flex flex-wrap gap-2.5">
                  {containerColors.map((color, index) => {
                    const textClass = getRalTileTextClass(color.rgb);
                    return (
                      <span
                        key={`${listingItem.id}-details-color-${color.ral}-${index}`}
                        className={`relative inline-flex h-16 w-16 rounded-md border border-neutral-800/50 shadow-sm ${textClass}`}
                        style={{
                          backgroundColor: `rgb(${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b})`,
                        }}
                        aria-label={`${color.ral} (RGB ${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b})`}
                        title={`${color.ral} (RGB ${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b})`}
                      >
                        <span className="absolute bottom-1 right-1 inline-flex flex-col items-end leading-none">
                          <span className="text-[9px] font-semibold uppercase tracking-[0.01em]">
                            RAL
                          </span>
                          <span className="max-w-[56px] truncate text-right text-[13px] font-bold">
                            {getRalColorCode(color.ral)}
                          </span>
                        </span>
                      </span>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </section>

          <div className="grid gap-4 lg:h-full lg:grid-rows-2">
            <section className="h-full rounded-md border border-neutral-300 bg-white p-4 text-right">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                {moduleMessages.details.priceTitle}
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
              {priceDisplay.metaLine ? (
                <p className="mt-1 text-xs text-neutral-600">
                  {priceDisplay.metaLine}
                </p>
              ) : null}
              {isPriceNegotiable ? (
                <div className="mt-3 sm:hidden">
                  <ContainerInquiryModalTrigger
                    listingId={listing._id.toHexString()}
                    isPriceNegotiable={isPriceNegotiable}
                    isLoggedIn={isLoggedIn}
                    initialIsFavorite={initialIsFavorite}
                    turnstileSiteKey={turnstileSiteKey}
                    initialInquiryValues={inquiryInitialValues}
                    className="justify-stretch [&>button:nth-child(1)]:hidden [&>button:nth-child(2)]:hidden [&>button:nth-child(3)]:hidden [&>button:nth-child(4)]:w-full [&>button:nth-child(4)]:justify-center"
                  />
                </div>
              ) : null}
            </section>

            <section
              className={`rounded-md border p-4 ${
                hasAnyCertification
                  ? "border-green-300 bg-green-50"
                  : "border-neutral-300 bg-white"
              } h-full`}
            >
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                CSC
              </p>
              <div className="mt-2 grid gap-1 text-sm text-neutral-700">
                <p>
                  {moduleMessages.details.cscPlateLabel}:{" "}
                  <span className="text-neutral-900">
                    {listingItem.hasCscPlate
                      ? moduleMessages.details.yes
                      : moduleMessages.details.no}
                  </span>
                </p>
                <p>
                  {moduleMessages.details.cscCertificationLabel}:{" "}
                  <span className="text-neutral-900">
                    {listingItem.hasCscCertification
                      ? moduleMessages.details.yes
                      : moduleMessages.details.no}
                  </span>
                </p>
                <p>
                  {moduleMessages.details.warrantyLabel}:{" "}
                  <span className="text-neutral-900">
                    {listingItem.hasWarranty
                      ? moduleMessages.details.yes
                      : moduleMessages.details.no}
                  </span>
                </p>
                <p>
                  {moduleMessages.details.cscValidityLabel}:{" "}
                  <span className="text-neutral-900">
                    {cscValidityLabel ?? moduleMessages.details.noData}
                  </span>
                </p>
              </div>
            </section>
          </div>
        </div>

        {featureLabels.length > 0 ? (
          <section className="mt-4 rounded-md border border-neutral-300 bg-white p-4">
            <h2 className="text-sm font-semibold text-neutral-800">
              {moduleMessages.details.featuresTitle}
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

        {sanitizedDescriptionHtml ? (
          <section className="mt-4 rounded-md border border-neutral-300 bg-white p-4">
            <h2 className="text-sm font-semibold text-neutral-800">
              {moduleMessages.details.descriptionTitle}
            </h2>
            {sanitizedDescriptionHtml ? (
              <div
                className="mt-3 space-y-2 text-sm text-neutral-700 [&_p]:leading-6 [&_ul]:list-disc [&_ul]:pl-5"
                dangerouslySetInnerHTML={{ __html: sanitizedDescriptionHtml }}
              />
            ) : null}
          </section>
        ) : null}

        <section className="mt-4 rounded-md border border-neutral-300 bg-white p-4">
          <h2 className="text-sm font-semibold text-neutral-800">
            {moduleMessages.details.locationTitle}
          </h2>
          <ul className="mt-3 grid gap-2 text-sm text-neutral-700">
            {locationItems.map((location) => (
              <li key={location.id} className="flex items-start gap-2">
                {location.flagUrl ? (
                  <Image
                    src={location.flagUrl}
                    alt={`${moduleMessages.details.flagLabel}: ${location.country}`}
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
                  {location.postalCode ? (
                    <strong className="font-semibold text-neutral-900">
                      {location.postalCode}
                    </strong>
                  ) : null}
                  {location.postalCode ? <span> </span> : null}
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
                {moduleMessages.details.logisticsTitle}
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
                            {moduleMessages.details.toDistancePrefix}{" "}
                            <strong>{freeTransportDistanceKmForMap} km</strong>
                          </>
                        ) : null}
                      </>
                    ) : (
                      moduleMessages.details.transportAvailable
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
                      ? moduleMessages.details.unloadingIncluded
                      : moduleMessages.details.unloadingAvailable}
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
            messages={moduleMessages.shared}
          />
        </section>

        <section className="mt-4 rounded-md border border-neutral-300 bg-white p-4 text-sm text-neutral-700">
          <h2 className="text-sm font-semibold text-neutral-800">
            {moduleMessages.details.contactTitle}
          </h2>
          <p className="mt-3">
            {moduleMessages.details.emailLabel}:{" "}
            <a
              className="text-sky-700 hover:text-sky-600"
              href={`mailto:${listing.contactEmail}`}
            >
              {listing.contactEmail}
            </a>
          </p>
          {listing.contactPhone ? (
            <p>
              {moduleMessages.details.phoneLabel}:{" "}
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
            <h2 className="text-sm font-semibold text-neutral-800">
              {moduleMessages.details.galleryTitle}
            </h2>
            <ContainerDetailsGallery
              images={additionalRealImages}
              title={galleryTitle}
              showMainImage={false}
              showThumbnails
              className="mt-3"
              thumbnailsGridClassName="grid gap-3 sm:grid-cols-2"
              thumbnailButtonClassName="relative aspect-[4/3] overflow-hidden rounded-md border border-neutral-200 bg-neutral-100 transition hover:border-sky-300 hover:ring-1 hover:ring-sky-200"
              messages={moduleMessages.gallery}
            />
          </section>
        ) : null}

        <div className="mt-4 flex justify-end">
          <p className="text-right text-xs text-neutral-400">
            {moduleMessages.details.expiresLabel}:{" "}
            {listing.expiresAt.toLocaleDateString(toIntlLocale(locale))}
          </p>
        </div>
      </article>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <ContainerInquiryModalTrigger
          listingId={listing._id.toHexString()}
          isPriceNegotiable={isPriceNegotiable}
          isLoggedIn={isLoggedIn}
          initialIsFavorite={initialIsFavorite}
          turnstileSiteKey={turnstileSiteKey}
          initialInquiryValues={inquiryInitialValues}
          className="[&>button:nth-child(3)]:hidden [&>button:nth-child(4)]:hidden"
        />
        {isOwner || isAdmin ? (
          <Link
            href={`/containers/${listing._id.toHexString()}/edit`}
            className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100"
          >
            {moduleMessages.details.editContainer}
          </Link>
        ) : null}
      </div>
      {showRelatedListings ? (
        <ContainerDetailsRelatedListings
          currentListingId={listing._id.toHexString()}
          companySlug={relatedCompanySlug}
          isLoggedIn={isLoggedIn}
          limit={4}
        />
      ) : null}
    </div>
  );
}
