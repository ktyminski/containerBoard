import type { Metadata } from "next";
import { getContainerFeatureLabel } from "@/components/container-listings-i18n";
import type { ContainerListingItem } from "@/lib/container-listings";
import { LISTING_STATUS, type ContainerCondition, type ContainerType, type ListingType } from "@/lib/container-listing-types";
import { getMessages, type AppLocale } from "@/lib/i18n";
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

function joinNaturalLanguage(values: string[], locale: AppLocale): string {
  if (values.length <= 1) {
    return values[0] ?? "";
  }
  if (values.length === 2) {
    const glue = locale === "pl" ? " i " : " and ";
    return `${values[0]}${glue}${values[1]}`;
  }

  const glue = locale === "pl" ? " i " : " and ";
  return `${values.slice(0, -1).join(", ")}${glue}${values[values.length - 1]}`;
}

function getFeatureSentence(item: ContainerListingItem, locale: AppLocale): string | null {
  if (!item.container.features || item.container.features.length === 0) {
    return null;
  }

  const listingMessages = getMessages(locale).containerListings;
  const labels = item.container.features
    .map((feature) => getContainerFeatureLabel(listingMessages, feature).trim())
    .filter(Boolean);
  if (labels.length === 0) {
    return null;
  }

  if (locale === "pl") {
    return `Dodatkowe cechy kontenera obejmują ${joinNaturalLanguage(labels, locale)}.`;
  }
  if (locale === "de") {
    return `Zu den zusätzlichen Merkmalen des Containers gehören ${joinNaturalLanguage(labels, locale)}.`;
  }
  if (locale === "uk") {
    return `Dodatkovi kharakterystyky konteynera vkliuchaiut ${joinNaturalLanguage(labels, locale)}.`;
  }
  return `Additional container features include ${joinNaturalLanguage(labels, locale)}.`;
}

function getColorSentence(item: ContainerListingItem, locale: AppLocale): string | null {
  if (!item.containerColors || item.containerColors.length === 0) {
    return null;
  }

  const colors = item.containerColors
    .map((color) => color.ral?.trim())
    .filter((value): value is string => Boolean(value));
  if (colors.length === 0) {
    return null;
  }

  if (locale === "pl") {
    return `Kontener jest oferowany w kolorystyce ${joinNaturalLanguage(colors, locale)}.`;
  }
  if (locale === "de") {
    return `Der Container wird in der Farbgebung ${joinNaturalLanguage(colors, locale)} angeboten.`;
  }
  if (locale === "uk") {
    return `Konteiner proponuietsia v kolorakh ${joinNaturalLanguage(colors, locale)}.`;
  }
  return `The container is offered in the following colors: ${joinNaturalLanguage(colors, locale)}.`;
}

function getNarrativeSubject(item: ContainerListingItem, locale: AppLocale): string {
  const copy = getListingCopy(locale);
  const sizeLabel = getContainerSeoSizeLabel(item);
  const typeLabel = getTypeLabel(locale, item.container.type);

  if (locale === "pl") {
    return `${copy.shippingContainer} ${sizeLabel} typu ${typeLabel}`;
  }
  if (locale === "de") {
    return `${copy.shippingContainer} ${sizeLabel} vom Typ ${typeLabel}`;
  }
  if (locale === "uk") {
    return `${copy.shippingContainer} ${sizeLabel} typu ${typeLabel}`;
  }
  return `${sizeLabel} ${typeLabel} ${copy.shippingContainer}`;
}

function getNarrativeLocationPhrase(
  locationLabel: string | null,
  locale: AppLocale,
): string {
  if (locale === "pl") {
    return locationLabel
      ? `w lokalizacji ${locationLabel}`
      : "w podanej lokalizacji";
  }
  if (locale === "de") {
    return locationLabel ? `am Standort ${locationLabel}` : "am angegebenen Standort";
  }
  if (locale === "uk") {
    return locationLabel ? `u lokatsii ${locationLabel}` : "u vkazanii lokatsii";
  }
  return locationLabel ? `in ${locationLabel}` : "in the selected location";
}

function getNarrativeLeadSentence(
  item: ContainerListingItem,
  locale: AppLocale,
  locationLabel: string | null,
): string {
  const subject = getNarrativeSubject(item, locale);
  const locationPhrase = getNarrativeLocationPhrase(locationLabel, locale);

  if (locale === "pl") {
    if (item.type === "rent") {
      return `Do wynajęcia ${subject}, dostępny ${locationPhrase}.`;
    }
    if (item.type === "buy") {
      return `Poszukiwany ${subject}, preferowany ${locationPhrase}.`;
    }
    return `Na sprzedaż ${subject}, dostępny ${locationPhrase}.`;
  }

  if (locale === "de") {
    if (item.type === "rent") {
      return `Zur Miete angeboten wird ${subject}, verfügbar ${locationPhrase}.`;
    }
    if (item.type === "buy") {
      return `Gesucht wird ${subject}, bevorzugt ${locationPhrase}.`;
    }
    return `Zum Verkauf steht ${subject}, verfügbar ${locationPhrase}.`;
  }

  if (locale === "uk") {
    if (item.type === "rent") {
      return `Dostupnyi dlia orendy ${subject}, dostupnyi ${locationPhrase}.`;
    }
    if (item.type === "buy") {
      return `Shukaetsia ${subject}, bazhano ${locationPhrase}.`;
    }
    return `Na prodazh ${subject}, dostupnyi ${locationPhrase}.`;
  }

  if (item.type === "rent") {
    return `Available for rent: ${subject}, located ${locationPhrase}.`;
  }
  if (item.type === "buy") {
    return `Wanted: ${subject}, preferably located ${locationPhrase}.`;
  }
  return `For sale: ${subject}, located ${locationPhrase}.`;
}

function getConditionExplanation(
  condition: ContainerCondition,
  locale: AppLocale,
): string | null {
  if (locale === "pl") {
    if (condition === "cargo_worthy") {
      return "czyli nadającej się do dalszego wykorzystania w transporcie lub magazynowaniu";
    }
    if (condition === "wind_water_tight") {
      return "czyli szczelnej i odpowiedniej do bezpiecznego magazynowania";
    }
    if (condition === "one_trip") {
      return "czyli po pojedynczym użyciu w transporcie";
    }
  }

  if (locale === "de") {
    if (condition === "cargo_worthy") {
      return "also für den weiteren Einsatz im Transport oder zur Lagerung geeignet";
    }
    if (condition === "wind_water_tight") {
      return "also dicht und für eine sichere Lagerung geeignet";
    }
    if (condition === "one_trip") {
      return "also nach nur einem Transporteinsatz";
    }
  }

  if (locale === "uk") {
    if (condition === "cargo_worthy") {
      return "to bto prydatnyi dlia podalshoho vykorystannia v perevezenni abo zberihanni";
    }
    if (condition === "wind_water_tight") {
      return "to bto hermetychnyi i prydatnyi dlia bezpechnoho zberihannia";
    }
    if (condition === "one_trip") {
      return "to bto pislia odnoho reisu";
    }
  }

  if (condition === "cargo_worthy") {
    return "which means it is suitable for further transport or storage use";
  }
  if (condition === "wind_water_tight") {
    return "which means it remains wind and watertight for storage use";
  }
  if (condition === "one_trip") {
    return "which means it has seen only one transport journey";
  }

  return null;
}

function getConditionNarrativeSentence(
  item: ContainerListingItem,
  locale: AppLocale,
): string {
  const quantity = Math.max(1, Math.trunc(item.quantity || 1));
  const conditionLabel = getConditionLabel(locale, item.container.condition);
  const explanation = getConditionExplanation(item.container.condition, locale);

  if (locale === "pl") {
    const quantityPart =
      quantity === 1 ? "Oferta dotyczy jednej sztuki" : `Oferta dotyczy ${quantity} sztuk`;
    return explanation
      ? `${quantityPart} w stanie ${conditionLabel}, ${explanation}.`
      : `${quantityPart} w stanie ${conditionLabel}.`;
  }

  if (locale === "de") {
    const quantityPart =
      quantity === 1 ? "Das Angebot betrifft eine Einheit" : `Das Angebot betrifft ${quantity} Einheiten`;
    return explanation
      ? `${quantityPart} im Zustand ${conditionLabel}, ${explanation}.`
      : `${quantityPart} im Zustand ${conditionLabel}.`;
  }

  if (locale === "uk") {
    const quantityPart =
      quantity === 1 ? "Propozytsiia stosuietsia odniiei odynytsi" : `Propozytsiia stosuietsia ${quantity} odynyts`;
    return explanation
      ? `${quantityPart} u stani ${conditionLabel}, ${explanation}.`
      : `${quantityPart} u stani ${conditionLabel}.`;
  }

  const quantityPart =
    quantity === 1 ? "The offer covers one unit" : `The offer covers ${quantity} units`;
  return explanation
    ? `${quantityPart} in ${conditionLabel} condition, ${explanation}.`
    : `${quantityPart} in ${conditionLabel} condition.`;
}

function getAvailabilityNarrativeSentence(
  item: ContainerListingItem,
  locale: AppLocale,
): string {
  if (item.availableNow) {
    if (locale === "pl") {
      return "Kontener jest dostępny od ręki.";
    }
    if (locale === "de") {
      return "Der Container ist sofort verfügbar.";
    }
    if (locale === "uk") {
      return "Konteiner dostupnyi vidrazu.";
    }
    return "The container is available immediately.";
  }

  const dateLabel = new Date(item.availableFrom).toLocaleDateString(locale);
  if (locale === "pl") {
    return item.availableFromApproximate
      ? `Kontener powinien być dostępny orientacyjnie od ${dateLabel}.`
      : `Kontener będzie dostępny od ${dateLabel}.`;
  }
  if (locale === "de") {
    return item.availableFromApproximate
      ? `Der Container sollte voraussichtlich ab ${dateLabel} verfügbar sein.`
      : `Der Container ist ab ${dateLabel} verfügbar.`;
  }
  if (locale === "uk") {
    return item.availableFromApproximate
      ? `Konteiner maie buty dostupnyi oriientovno z ${dateLabel}.`
      : `Konteiner bude dostupnyi z ${dateLabel}.`;
  }
  return item.availableFromApproximate
    ? `The container should be available approximately from ${dateLabel}.`
    : `The container will be available from ${dateLabel}.`;
}

function getPriceNarrativeSentence(
  item: ContainerListingItem,
  locale: AppLocale,
): string {
  const price = getListingSeoPrice(item, locale);

  if (locale === "pl") {
    return price.descriptionLabel
      ? `Cena wynosi ${price.descriptionLabel}.`
      : "Cena jest ustalana indywidualnie ze sprzedającym.";
  }
  if (locale === "de") {
    return price.descriptionLabel
      ? `Der Preis beträgt ${price.descriptionLabel}.`
      : "Der Preis wird individuell mit dem Anbieter abgestimmt.";
  }
  if (locale === "uk") {
    return price.descriptionLabel
      ? `Tsina stanovit ${price.descriptionLabel}.`
      : "Tsina uzghodzhuietsia indyvidualno z prodavtsem.";
  }
  return price.descriptionLabel
    ? `The price is ${price.descriptionLabel}.`
    : "The price is agreed individually with the seller.";
}

function getTransportNarrativeSentence(
  item: ContainerListingItem,
  locale: AppLocale,
): string | null {
  const transportDetails = getTransportDetails(item, locale);
  if (!transportDetails) {
    return null;
  }

  if (locale === "pl") {
    return `W zakresie logistyki dostępne są następujące opcje: ${transportDetails}.`;
  }
  if (locale === "de") {
    return `Im Bereich Logistik sind folgende Optionen verfügbar: ${transportDetails}.`;
  }
  if (locale === "uk") {
    return `Shchodo lohistyky dostupni taki optsii: ${transportDetails}.`;
  }
  return `The following logistics options are available: ${transportDetails}.`;
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
  const location = getPrimaryLocation(item);
  const locationLabel = location.label;

  const firstParagraph = [
    getNarrativeLeadSentence(item, locale, locationLabel),
    getConditionNarrativeSentence(item, locale),
  ].join(" ");

  const secondParagraph = [
    getAvailabilityNarrativeSentence(item, locale),
    getPriceNarrativeSentence(item, locale),
    getFeatureSentence(item, locale),
    getColorSentence(item, locale),
    getTransportNarrativeSentence(item, locale),
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ");

  const thirdParts = [
    copy.cscSentence,
    copy.contactCta,
  ].filter((value): value is string => Boolean(value));

  return [firstParagraph, secondParagraph, thirdParts.join(" ")].filter(
    (value): value is string => Boolean(value.trim()),
  );
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
    : getContainerListingSeoNarrative(input.item, input.locale).join(" ").trim();

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
