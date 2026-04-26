import type { Metadata } from "next";
import type { ContainerListingItem } from "@/lib/container-listings";
import { LISTING_STATUS, type ContainerCondition, type ContainerType, type ListingType } from "@/lib/container-listing-types";
import type { AppLocale } from "@/lib/i18n";
import { buildPageMetadata, getAbsoluteUrl, stripHtmlToPlainText } from "@/lib/seo";

type ListingSeoCopy = {
  brandName: string;
  containerWord: string;
  shippingContainer: string;
  saleFallback: string;
  rentFallback: string;
  buyFallback: string;
  contactCta: string;
  locationPrefix: string;
  typeLabelShort: string;
  conditionLabel: string;
  priceLabel: string;
  noPriceLabel: string;
  availabilityLabel: string;
  availabilityNow: string;
  availabilityFrom: (date: string, approximate: boolean) => string;
  quantitySentence: (quantity: number) => string;
  typeSentence: (typeLabel: string) => string;
  kindSentence: (kind: ListingType) => string;
  transportSentence: (details: string) => string;
  sellerSentence: (seller: string) => string;
  cscSentence: string;
  descriptionIntro: (label: string, location: string) => string;
  narrativeLead: (label: string, location: string) => string;
  categoryLabel: string;
};

const LISTING_SEO_COPY: Record<AppLocale, ListingSeoCopy> = {
  pl: {
    brandName: "containerBoard",
    containerWord: "Kontener",
    shippingContainer: "kontener morski",
    saleFallback: "Kontener morski na sprzedaż | containerBoard",
    rentFallback: "Kontener morski na wynajem | containerBoard",
    buyFallback: "Kupno kontenera morskiego | containerBoard",
    contactCta: "Skontaktuj się przez containerBoard, aby poznać szczegóły oferty i przejść do rozmowy z drugą stroną ogłoszenia.",
    locationPrefix: "w lokalizacji",
    typeLabelShort: "Typ",
    conditionLabel: "Stan",
    priceLabel: "cena",
    noPriceLabel: "cena do ustalenia",
    availabilityLabel: "Dostępność",
    availabilityNow: "dostępny od ręki",
    availabilityFrom: (date, approximate) =>
      approximate ? `orientacyjnie od ${date}` : `dostępny od ${date}`,
    quantitySentence: (quantity) =>
      quantity === 1 ? "W ofercie jest 1 sztuka." : `W ofercie dostępnych jest ${quantity} sztuk.`,
    typeSentence: (typeLabel) => `Typ kontenera: ${typeLabel}.`,
    kindSentence: (kind) => {
      if (kind === "rent") {
        return "Ogłoszenie dotyczy wynajmu kontenera.";
      }
      if (kind === "buy") {
        return "Ogłoszenie dotyczy zapotrzebowania na kontener.";
      }
      return "Ogłoszenie dotyczy sprzedaży kontenera.";
    },
    transportSentence: (details) => `Logistyka: ${details}.`,
    sellerSentence: (seller) => `Ogłoszenie zostało opublikowane przez ${seller}.`,
    cscSentence: "W opisie możesz też sprawdzić informacje o CSC, gwarancji oraz dodatkowych cechach technicznych kontenera.",
    descriptionIntro: (label, location) => `Sprawdź ${label} ${location}.`,
    narrativeLead: (label, location) =>
      `To ogłoszenie prezentuje ${label} ${location} i zawiera najważniejsze dane potrzebne do szybkiej oceny oferty.`,
    categoryLabel: "Shipping container",
  },
  en: {
    brandName: "containerBoard",
    containerWord: "Container",
    shippingContainer: "shipping container",
    saleFallback: "Shipping container for sale | containerBoard",
    rentFallback: "Shipping container for rent | containerBoard",
    buyFallback: "Shipping container wanted | containerBoard",
    contactCta: "Use containerBoard to contact the advertiser and discuss the details of this listing.",
    locationPrefix: "in",
    typeLabelShort: "Type",
    conditionLabel: "Condition",
    priceLabel: "price",
    noPriceLabel: "price on request",
    availabilityLabel: "Availability",
    availabilityNow: "available now",
    availabilityFrom: (date, approximate) =>
      approximate ? `approximately from ${date}` : `available from ${date}`,
    quantitySentence: (quantity) =>
      quantity === 1 ? "The listing currently covers 1 unit." : `The listing currently covers ${quantity} units.`,
    typeSentence: (typeLabel) => `Container type: ${typeLabel}.`,
    kindSentence: (kind) => {
      if (kind === "rent") {
        return "This listing is for container rental.";
      }
      if (kind === "buy") {
        return "This listing describes container demand.";
      }
      return "This listing is for container sale.";
    },
    transportSentence: (details) => `Logistics: ${details}.`,
    sellerSentence: (seller) => `The listing was published by ${seller}.`,
    cscSentence: "You can also review CSC, warranty, and additional technical details on the page.",
    descriptionIntro: (label, location) => `Explore this ${label} ${location}.`,
    narrativeLead: (label, location) =>
      `This listing presents ${label} ${location} together with the core information needed to evaluate the offer quickly.`,
    categoryLabel: "Shipping container",
  },
  de: {
    brandName: "containerBoard",
    containerWord: "Container",
    shippingContainer: "Seecontainer",
    saleFallback: "Seecontainer zum Verkauf | containerBoard",
    rentFallback: "Seecontainer zur Miete | containerBoard",
    buyFallback: "Seecontainer gesucht | containerBoard",
    contactCta: "Nutzen Sie containerBoard, um den Anbieter zu kontaktieren und die Details dieses Angebots zu besprechen.",
    locationPrefix: "in",
    typeLabelShort: "Typ",
    conditionLabel: "Zustand",
    priceLabel: "Preis",
    noPriceLabel: "Preis auf Anfrage",
    availabilityLabel: "Verfügbarkeit",
    availabilityNow: "sofort verfügbar",
    availabilityFrom: (date, approximate) =>
      approximate ? `voraussichtlich ab ${date}` : `verfügbar ab ${date}`,
    quantitySentence: (quantity) =>
      quantity === 1 ? "Im Angebot ist 1 Einheit enthalten." : `Im Angebot sind ${quantity} Einheiten enthalten.`,
    typeSentence: (typeLabel) => `Containertyp: ${typeLabel}.`,
    kindSentence: (kind) => {
      if (kind === "rent") {
        return "Dieses Inserat betrifft die Miete eines Containers.";
      }
      if (kind === "buy") {
        return "Dieses Inserat beschreibt einen Containerbedarf.";
      }
      return "Dieses Inserat betrifft den Verkauf eines Containers.";
    },
    transportSentence: (details) => `Logistik: ${details}.`,
    sellerSentence: (seller) => `Das Inserat wurde von ${seller} veröffentlicht.`,
    cscSentence: "Auf der Seite finden Sie außerdem Angaben zu CSC, Garantie und weiteren technischen Merkmalen.",
    descriptionIntro: (label, location) => `Prüfen Sie ${label} ${location}.`,
    narrativeLead: (label, location) =>
      `Dieses Inserat zeigt ${label} ${location} zusammen mit den wichtigsten Informationen für eine schnelle Bewertung des Angebots.`,
    categoryLabel: "Shipping container",
  },
  uk: {
    brandName: "containerBoard",
    containerWord: "Konteiner",
    shippingContainer: "morskyi konteiner",
    saleFallback: "Morskyi konteiner na prodazh | containerBoard",
    rentFallback: "Morskyi konteiner v orendu | containerBoard",
    buyFallback: "Morskyi konteiner potriben | containerBoard",
    contactCta: "Skorystaites containerBoard, shchob zviazatysia z avtorom oholoshennia ta uzghodyty detali.",
    locationPrefix: "u lokatsii",
    typeLabelShort: "Typ",
    conditionLabel: "Stan",
    priceLabel: "tsina",
    noPriceLabel: "tsina za zapytom",
    availabilityLabel: "Dostupnist",
    availabilityNow: "dostupnyi zaraz",
    availabilityFrom: (date, approximate) =>
      approximate ? `oriientovno z ${date}` : `dostupnyi z ${date}`,
    quantitySentence: (quantity) =>
      quantity === 1 ? "U propozytsii 1 odynytsia." : `U propozytsii dostupno ${quantity} odynyts.`,
    typeSentence: (typeLabel) => `Typ konteynera: ${typeLabel}.`,
    kindSentence: (kind) => {
      if (kind === "rent") {
        return "Oholoshennia stosuietsia orendy konteynera.";
      }
      if (kind === "buy") {
        return "Oholoshennia opysuie potrebu v konteyneri.";
      }
      return "Oholoshennia stosuietsia prodazhu konteynera.";
    },
    transportSentence: (details) => `Lohistyka: ${details}.`,
    sellerSentence: (seller) => `Oholoshennia opublikuvav ${seller}.`,
    cscSentence: "Na storintsi takozh mozhna pereviryty dani pro CSC, harantiiu ta dodatkovi tekhnichni kharakterystyky.",
    descriptionIntro: (label, location) => `Perehliante ${label} ${location}.`,
    narrativeLead: (label, location) =>
      `Tse oholoshennia pokazue ${label} ${location} i mistyt kliuchovu informatsiiu dlia shvydkoi otsinky propozytsii.`,
    categoryLabel: "Shipping container",
  },
};

const TYPE_LABELS: Record<AppLocale, Record<ContainerType, string>> = {
  pl: {
    dry: "dry",
    reefer: "chłodniczy",
    open_top: "open top",
    flat_rack: "flat rack",
    tank: "tank",
    side_open: "side open",
    hard_top: "hard top",
    platform: "platform",
    bulk: "bulk",
  },
  en: {
    dry: "dry",
    reefer: "reefer",
    open_top: "open top",
    flat_rack: "flat rack",
    tank: "tank",
    side_open: "side open",
    hard_top: "hard top",
    platform: "platform",
    bulk: "bulk",
  },
  de: {
    dry: "dry",
    reefer: "reefer",
    open_top: "open top",
    flat_rack: "flat rack",
    tank: "tank",
    side_open: "side open",
    hard_top: "hard top",
    platform: "platform",
    bulk: "bulk",
  },
  uk: {
    dry: "dry",
    reefer: "reefer",
    open_top: "open top",
    flat_rack: "flat rack",
    tank: "tank",
    side_open: "side open",
    hard_top: "hard top",
    platform: "platform",
    bulk: "bulk",
  },
};

const CONDITION_LABELS: Record<AppLocale, Record<ContainerCondition, string>> = {
  pl: {
    new: "nowy",
    one_trip: "one trip",
    cargo_worthy: "używany cargo worthy",
    wind_water_tight: "szczelny wind and water tight",
    as_is: "as-is",
  },
  en: {
    new: "new",
    one_trip: "one trip",
    cargo_worthy: "used cargo worthy",
    wind_water_tight: "wind and water tight",
    as_is: "as-is",
  },
  de: {
    new: "neu",
    one_trip: "one trip",
    cargo_worthy: "gebraucht cargo worthy",
    wind_water_tight: "wind- und wasserdicht",
    as_is: "as-is",
  },
  uk: {
    new: "novyi",
    one_trip: "one trip",
    cargo_worthy: "vykorystanyi cargo worthy",
    wind_water_tight: "hermetychnyi",
    as_is: "as-is",
  },
};

function getListingCopy(locale: AppLocale): ListingSeoCopy {
  return LISTING_SEO_COPY[locale] ?? LISTING_SEO_COPY.en;
}

function getTypeLabel(locale: AppLocale, type: ContainerType): string {
  return TYPE_LABELS[locale]?.[type] ?? TYPE_LABELS.en[type];
}

function getConditionLabel(locale: AppLocale, condition: ContainerCondition): string {
  return CONDITION_LABELS[locale]?.[condition] ?? CONDITION_LABELS.en[condition];
}

function getListingFallbackTitle(locale: AppLocale, type: ListingType): string {
  const copy = getListingCopy(locale);
  if (type === "rent") {
    return copy.rentFallback;
  }
  if (type === "buy") {
    return copy.buyFallback;
  }
  return copy.saleFallback;
}

export function getContainerSeoSizeLabel(item: ContainerListingItem): string {
  const sizeValue = item.container.size > 0 ? `${item.container.size}ft` : "custom";
  return item.container.height === "HC" ? `${sizeValue} HC` : sizeValue;
}

function getPrimaryLocation(item: ContainerListingItem): {
  city: string | null;
  country: string | null;
  label: string | null;
} {
  const city = item.locationAddressParts?.city?.trim() || item.locationCity?.trim() || "";
  const country = item.locationAddressParts?.country?.trim() || item.locationCountry?.trim() || "";
  if (city && country) {
    return { city, country, label: `${city}, ${country}` };
  }
  if (city) {
    return { city, country: country || null, label: city };
  }
  if (country) {
    return { city: null, country, label: country };
  }
  return { city: null, country: null, label: null };
}

function getSeoDisplayLabel(item: ContainerListingItem, locale: AppLocale): string {
  const copy = getListingCopy(locale);
  const sizeLabel = getContainerSeoSizeLabel(item);
  const typeLabel = getTypeLabel(locale, item.container.type);
  if (item.container.type === "dry") {
    return `${copy.containerWord.toLowerCase()} ${sizeLabel}`;
  }
  return `${copy.containerWord.toLowerCase()} ${sizeLabel} ${typeLabel}`;
}

function getHeadingLabel(item: ContainerListingItem, locale: AppLocale): string {
  const copy = getListingCopy(locale);
  const sizeLabel = getContainerSeoSizeLabel(item);
  const typeLabel = getTypeLabel(locale, item.container.type);
  if (item.container.type === "dry") {
    return `${copy.containerWord} ${sizeLabel}`;
  }
  return `${copy.containerWord} ${sizeLabel} ${typeLabel}`;
}

type ListingSeoPrice = {
  titleLabel: string | null;
  descriptionLabel: string | null;
  numericPrice: number | null;
  currency: string | null;
};

function formatCurrencyValue(value: number, currency: string, locale: AppLocale): string {
  const rounded = Math.round(value);
  if (currency === "PLN") {
    return `${rounded.toLocaleString(locale)} zł`;
  }
  return `${rounded.toLocaleString(locale)} ${currency}`;
}

function getListingSeoPrice(item: ContainerListingItem, locale: AppLocale): ListingSeoPrice {
  if (
    typeof item.pricing?.original.amount === "number" &&
    Number.isFinite(item.pricing.original.amount) &&
    item.pricing.original.currency
  ) {
    const formatted = formatCurrencyValue(item.pricing.original.amount, item.pricing.original.currency, locale);
    const taxModeSuffix =
      item.pricing.original.taxMode === "gross"
        ? locale === "pl"
          ? " brutto"
          : " gross"
        : locale === "pl"
          ? " netto"
          : " net";
    return {
      titleLabel: formatted,
      descriptionLabel: `${formatted}${taxModeSuffix}`,
      numericPrice: item.pricing.original.amount,
      currency: item.pricing.original.currency,
    };
  }

  if (typeof item.priceAmount === "number" && Number.isFinite(item.priceAmount)) {
    const formatted = formatCurrencyValue(item.priceAmount, "PLN", locale);
    return {
      titleLabel: formatted,
      descriptionLabel: locale === "pl" ? `${formatted} netto` : `${formatted} net`,
      numericPrice: item.priceAmount,
      currency: "PLN",
    };
  }

  if (item.price?.trim()) {
    return {
      titleLabel: item.price.trim(),
      descriptionLabel: item.price.trim(),
      numericPrice: null,
      currency: null,
    };
  }

  return {
    titleLabel: null,
    descriptionLabel: null,
    numericPrice: null,
    currency: null,
  };
}

function getAvailabilitySentence(item: ContainerListingItem, locale: AppLocale): string {
  const copy = getListingCopy(locale);
  if (item.availableNow) {
    return `${copy.availabilityLabel}: ${copy.availabilityNow}.`;
  }
  const dateLabel = new Date(item.availableFrom).toLocaleDateString(locale);
  return `${copy.availabilityLabel}: ${copy.availabilityFrom(dateLabel, item.availableFromApproximate)}.`;
}

function getTransportDetails(item: ContainerListingItem, locale: AppLocale): string | null {
  const parts: string[] = [];
  if (locale === "pl") {
    if (item.logisticsTransportAvailable) {
      parts.push(
        item.logisticsTransportIncluded
          ? item.logisticsTransportFreeDistanceKm
            ? `transport w cenie do ${item.logisticsTransportFreeDistanceKm} km`
            : "transport w cenie"
          : "transport możliwy po uzgodnieniu",
      );
    }
    if (item.logisticsUnloadingAvailable) {
      parts.push(
        item.logisticsUnloadingIncluded
          ? "rozładunek/HDS w cenie"
          : "rozładunek/HDS możliwy po uzgodnieniu",
      );
    }
  } else {
    if (item.logisticsTransportAvailable) {
      parts.push(
        item.logisticsTransportIncluded
          ? item.logisticsTransportFreeDistanceKm
            ? `transport included up to ${item.logisticsTransportFreeDistanceKm} km`
            : "transport included"
          : "transport available on request",
      );
    }
    if (item.logisticsUnloadingAvailable) {
      parts.push(
        item.logisticsUnloadingIncluded
          ? "unloading included"
          : "unloading available on request",
      );
    }
  }

  const comment = item.logisticsComment?.trim();
  if (comment) {
    parts.push(comment);
  }

  return parts.length > 0 ? parts.join(", ") : null;
}

export function getContainerListingSeoHeading(
  item: ContainerListingItem,
  locale: AppLocale,
): string {
  const headingLabel = getHeadingLabel(item, locale);
  const location = getPrimaryLocation(item);
  return location.city ? `${headingLabel} – ${location.city}` : headingLabel;
}

export function getContainerListingSeoTitle(
  item: ContainerListingItem,
  locale: AppLocale,
): string {
  const copy = getListingCopy(locale);
  const location = getPrimaryLocation(item);
  const price = getListingSeoPrice(item, locale);
  const segments = [getContainerListingSeoHeading(item, locale)];
  if (!location.city && location.label && !segments[0].includes(location.label)) {
    segments.push(location.label);
  }
  if (price.titleLabel) {
    segments.push(price.titleLabel);
  }
  return `${segments.join(" – ")} | ${copy.brandName}`;
}

export function getContainerListingSeoDescription(
  item: ContainerListingItem,
  locale: AppLocale,
): string {
  const copy = getListingCopy(locale);
  const displayLabel = getSeoDisplayLabel(item, locale);
  const location = getPrimaryLocation(item);
  const conditionLabel = getConditionLabel(locale, item.container.condition);
  const price = getListingSeoPrice(item, locale);
  const locationPart = location.label
    ? `${copy.locationPrefix} ${location.city ?? location.label}`
    : locale === "pl"
      ? "w wybranej lokalizacji"
      : "in the selected location";
  const pricePart = price.descriptionLabel
    ? `${copy.priceLabel}: ${price.descriptionLabel}.`
    : `${copy.priceLabel}: ${copy.noPriceLabel}.`;

  return [
    copy.descriptionIntro(displayLabel, locationPart),
    `${copy.typeLabelShort}: ${getTypeLabel(locale, item.container.type)}.`,
    `${copy.conditionLabel}: ${conditionLabel}.`,
    pricePart,
    copy.contactCta,
  ].join(" ");
}

export function getContainerListingSeoNarrative(
  item: ContainerListingItem,
  locale: AppLocale,
): string[] {
  const copy = getListingCopy(locale);
  const displayLabel = getSeoDisplayLabel(item, locale);
  const location = getPrimaryLocation(item);
  const conditionLabel = getConditionLabel(locale, item.container.condition);
  const price = getListingSeoPrice(item, locale);
  const locationLabel = location.label ?? (locale === "pl" ? "w podanej lokalizacji" : "in the specified location");
  const transportDetails = getTransportDetails(item, locale);

  const firstParagraph = [
    copy.narrativeLead(displayLabel, locationLabel),
    copy.kindSentence(item.type),
    copy.typeSentence(getTypeLabel(locale, item.container.type)),
    `${copy.conditionLabel}: ${conditionLabel}.`,
    copy.quantitySentence(Math.max(1, Math.trunc(item.quantity || 1))),
    getAvailabilitySentence(item, locale),
  ].join(" ");

  const secondParts = [
    price.descriptionLabel
      ? `${copy.priceLabel.charAt(0).toUpperCase()}${copy.priceLabel.slice(1)}: ${price.descriptionLabel}.`
      : `${copy.priceLabel.charAt(0).toUpperCase()}${copy.priceLabel.slice(1)}: ${copy.noPriceLabel}.`,
    transportDetails ? copy.transportSentence(transportDetails) : null,
    item.companyName?.trim() ? copy.sellerSentence(item.companyName.trim()) : null,
    copy.cscSentence,
    copy.contactCta,
  ].filter((value): value is string => Boolean(value));

  return [firstParagraph, secondParts.join(" ")];
}

function getPrimaryImageUrl(item: ContainerListingItem): string | null {
  const src = item.photoUrls?.find((value) => value?.trim());
  if (!src) {
    return null;
  }
  if (/^https?:\/\//i.test(src)) {
    return src;
  }
  if (src.startsWith("/")) {
    return getAbsoluteUrl(src);
  }
  return null;
}

function getStructuredDataAvailability(item: ContainerListingItem): string {
  if (item.status !== LISTING_STATUS.ACTIVE) {
    return "https://schema.org/Discontinued";
  }
  return item.availableNow
    ? "https://schema.org/InStock"
    : "https://schema.org/PreOrder";
}

function getStructuredDataCondition(item: ContainerListingItem): string {
  if (item.container.condition === "new" || item.container.condition === "one_trip") {
    return "https://schema.org/NewCondition";
  }
  return "https://schema.org/UsedCondition";
}

export function buildContainerListingMetadata(input: {
  item: ContainerListingItem;
  locale: AppLocale;
  path: string;
}): Metadata {
  const title = getContainerListingSeoTitle(input.item, input.locale);
  const description = getContainerListingSeoDescription(input.item, input.locale);
  const imageUrl = getPrimaryImageUrl(input.item);
  const base = buildPageMetadata({
    path: input.path,
    locale: input.locale,
    title,
    description,
  });

  return {
    ...base,
    title: {
      absolute: title,
    },
    description,
    robots:
      input.item.status === LISTING_STATUS.ACTIVE
        ? undefined
        : { index: false, follow: true },
    openGraph: {
      ...base.openGraph,
      title,
      description,
      images: imageUrl ? [{ url: imageUrl }] : undefined,
    },
    twitter: {
      ...base.twitter,
      card: imageUrl ? "summary_large_image" : "summary",
      title,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
  };
}

export function buildContainerListingStructuredData(input: {
  item: ContainerListingItem;
  locale: AppLocale;
  path: string;
}): Record<string, unknown> {
  const imageUrl = getPrimaryImageUrl(input.item);
  const price = getListingSeoPrice(input.item, input.locale);
  const name = getContainerListingSeoHeading(input.item, input.locale);
  const description = input.item.description?.trim()
    ? stripHtmlToPlainText(input.item.description).trim()
    : "";

  const product: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    category: getListingCopy(input.locale).categoryLabel,
    sku: input.item.id,
    url: getAbsoluteUrl(input.path),
    itemCondition: getStructuredDataCondition(input.item),
    ...(description ? { description } : {}),
    ...(imageUrl ? { image: [imageUrl] } : {}),
  };

  if (price.numericPrice !== null && price.currency && input.item.type !== "buy") {
    product.offers = {
      "@type": "Offer",
      url: getAbsoluteUrl(input.path),
      price: String(Math.round(price.numericPrice)),
      priceCurrency: price.currency,
      availability: getStructuredDataAvailability(input.item),
      itemCondition: getStructuredDataCondition(input.item),
      ...(input.item.companyName?.trim()
        ? {
            seller: {
              "@type": "Organization",
              name: input.item.companyName.trim(),
            },
          }
        : {}),
    };
  }

  return product;
}

export function getContainerListingSeoFallbackTitle(
  locale: AppLocale,
  type: ListingType = "sell",
): string {
  return getListingFallbackTitle(locale, type);
}
