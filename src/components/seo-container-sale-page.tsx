import Link from "next/link";
import { ContainerPhotoWithPlaceholder } from "@/components/container-photo-with-placeholder";
import { ContainerSerialNumberOverlay } from "@/components/container-serial-number-overlay";
import type { ContainerListingItem } from "@/lib/container-listings";
import {
  getContainerConditionLabel,
  getContainerFeatureLabel,
  getContainerShortLabelLocalized,
} from "@/components/container-listings-i18n";
import { CONTAINER_CONDITION_COLOR_TOKENS } from "@/components/container-listings-shared";
import { getContainerListingLocationLabel } from "@/components/container-listings-utils";
import {
  PRICE_CURRENCY_LABEL,
  type Currency,
} from "@/lib/container-listing-types";
import { getMessages, type AppLocale, withLocalePrefix } from "@/lib/i18n";
import {
  getContainerSeoHubCopy,
  getContainerSeoIndexable,
  type ContainerSeoKind,
} from "@/lib/seo-containers";

type SeoNearbyLink = {
  name: string;
  href: string;
  distanceKm?: number;
};

type SeoLocalContext = {
  kind: ContainerSeoKind;
  locationType: "city" | "country";
  name: string;
  nearbyLinks?: SeoNearbyLink[];
};

type SeoContainerSalePageProps = {
  locale: AppLocale;
  heading: string;
  lead: string;
  browseHref: string;
  items: ContainerListingItem[];
  total: number;
  seoContext?: SeoLocalContext;
};

type SeoListingPriceDisplay = {
  amountLabel: string;
  metaLine: string;
  isRequestPrice: boolean;
};

type LocalSeoText = {
  expandSummary: string;
  locationPrefix: (isCity: boolean) => string;
  defaultContainerLabels: string;
  defaultConditionLabels: string;
  transportSentence: (hasTransport: boolean, hasUnloading: boolean) => string;
  priceSentence: (hasPrices: boolean) => string;
  introParagraph: (offerNoun: string, locationLabel: string) => string;
  containerParagraph: (containerLabels: string) => string;
  checkHeading: string;
  checkItems: string[];
  checkAnswerPrefix?: string;
  scopeHeading: string;
  scopeParagraph: (total: string) => string;
  fullListCta: string;
  faqHeading: string;
  nearbyHeading: string;
  faq: (input: {
    locationLabel: string;
    locationName: string;
    containerLabels: string;
    conditionLabels: string;
    transportSentence: string;
    checkAnswer: string;
    intentPhrase: string;
    browsePhrase: string;
  }) => Array<{ question: string; answer: string }>;
};

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

function getContainerPreviewSrc(item: ContainerListingItem): string {
  const firstPhotoUrl = item.photoUrls?.find((value) => value?.trim());
  return firstPhotoUrl ?? getContainerPlaceholderSrc(item);
}

function getAdditionalPhotoCount(item: ContainerListingItem): number {
  const photoCount =
    item.photoUrls?.filter((value) => value?.trim().length > 0).length ?? 0;
  return Math.max(0, photoCount - 1);
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

function formatVatRateLabel(locale: AppLocale, vatRate: number | null): string | null {
  if (typeof vatRate !== "number" || !Number.isFinite(vatRate)) {
    return null;
  }
  return `VAT ${vatRate.toLocaleString(locale)}%`;
}

function getListingPriceDisplay(
  item: ContainerListingItem,
  locale: AppLocale,
  messages: ReturnType<typeof getMessages>["containerListings"],
): SeoListingPriceDisplay {
  const pricing = item.pricing;

  if (
    pricing &&
    (pricing.original.amount === null ||
      typeof pricing.original.amount !== "number")
  ) {
    const metaParts: string[] = [];
    if (pricing.original.negotiable === true || item.priceNegotiable === true) {
      metaParts.push(messages.results.negotiable);
    }
    return {
      amountLabel: messages.results.askPrice,
      metaLine: metaParts.join(" | "),
      isRequestPrice: true,
    };
  }

  if (
    pricing?.original.amount !== null &&
    typeof pricing?.original.amount === "number" &&
    pricing.original.currency &&
    pricing.original.taxMode
  ) {
    const grossAmount = getNormalizedAmountByCurrency(
      pricing.normalized.gross,
      pricing.original.currency,
    );
    const amount =
      typeof grossAmount === "number" && Number.isFinite(grossAmount)
        ? grossAmount
        : pricing.original.amount;
    const metaParts = [messages.results.gross];
    const netAmount = getNormalizedAmountByCurrency(
      pricing.normalized.net,
      pricing.original.currency,
    );
    if (typeof netAmount === "number" && Number.isFinite(netAmount)) {
      metaParts.push(
        `${Math.round(netAmount).toLocaleString(locale)} ${
          PRICE_CURRENCY_LABEL[pricing.original.currency]
        } ${messages.results.net.toLowerCase()}`,
      );
    }
    const vatRateLabel = formatVatRateLabel(locale, pricing.original.vatRate);
    if (vatRateLabel) {
      metaParts.push(vatRateLabel);
    }
    if (pricing.original.negotiable === true || item.priceNegotiable === true) {
      metaParts.push(messages.results.negotiable);
    }
    return {
      amountLabel: `${Math.round(amount).toLocaleString(locale)} ${
        PRICE_CURRENCY_LABEL[pricing.original.currency]
      }`,
      metaLine: metaParts.join(" | "),
      isRequestPrice: false,
    };
  }

  if (typeof item.priceAmount === "number" && Number.isFinite(item.priceAmount)) {
    const metaParts = [
      `${Math.round(item.priceAmount).toLocaleString(locale)} PLN ${messages.results.net.toLowerCase()}`,
      "VAT 23%",
    ];
    if (item.priceNegotiable === true) {
      metaParts.push(messages.results.negotiable);
    }
    return {
      amountLabel: `${Math.round(item.priceAmount * 1.23).toLocaleString(locale)} PLN`,
      metaLine: metaParts.join(" | "),
      isRequestPrice: false,
    };
  }

  if (item.price?.trim()) {
    const metaParts: string[] = [];
    if (item.priceNegotiable === true) {
      metaParts.push(messages.results.negotiable);
    }
    return {
      amountLabel: item.price.trim(),
      metaLine: metaParts.join(" | "),
      isRequestPrice: false,
    };
  }

  return {
    amountLabel: messages.results.askPrice,
    metaLine: "",
    isRequestPrice: true,
  };
}

function getAvailableFromLabel(
  item: ContainerListingItem,
  locale: AppLocale,
  messages: ReturnType<typeof getMessages>["containerListings"],
): string {
  if (item.availableNow) {
    return messages.results.availableNow;
  }
  const date = item.availableFrom ? new Date(item.availableFrom) : null;
  if (!date || !Number.isFinite(date.getTime())) {
    return messages.results.unknown;
  }
  return date.toLocaleDateString(locale);
}

function getLogisticsSummaryLabels(
  item: ContainerListingItem,
  messages: ReturnType<typeof getMessages>["containerListings"],
): string[] {
  const labels: string[] = [];
  if (item.logisticsTransportAvailable) {
    if (item.logisticsTransportIncluded) {
      const distanceKm =
        typeof item.logisticsTransportFreeDistanceKm === "number" &&
        Number.isFinite(item.logisticsTransportFreeDistanceKm) &&
        item.logisticsTransportFreeDistanceKm > 0
          ? Math.trunc(item.logisticsTransportFreeDistanceKm)
          : null;
      labels.push(
        distanceKm
          ? `${messages.results.freeTransportLabel} ${distanceKm} km`
          : messages.results.freeTransportLabel,
      );
    } else {
      labels.push(messages.results.transportAvailableLabel);
    }
  }
  if (item.logisticsUnloadingAvailable) {
    labels.push(
      item.logisticsUnloadingIncluded
        ? messages.results.freeUnloadingLabel
        : messages.results.unloadingAvailableLabel,
    );
  }
  return labels;
}

function getIntentCopy(locale: AppLocale, kind: ContainerSeoKind) {
  if (locale === "pl") {
    if (kind === "rent") {
      return {
        headingPrefix: "Wynajem kontenerów",
        offerNoun: "oferty wynajmu kontenerów",
        actionPhrase: "wynająć kontener",
        intentPhrase: "wynajmu",
        browsePhrase: "ofert wynajmu",
      };
    }
    if (kind === "buy") {
      return {
        headingPrefix: "Kupno kontenerów",
        offerNoun: "ogłoszenia kupna kontenerów",
        actionPhrase: "znaleźć zapotrzebowanie na kontener",
        intentPhrase: "kupna",
        browsePhrase: "ogłoszeń kupna",
      };
    }
    return {
      headingPrefix: "Kontenery na sprzedaż",
      offerNoun: "oferty sprzedaży kontenerów",
      actionPhrase: "kupić kontener",
      intentPhrase: "sprzedaży",
      browsePhrase: "ofert sprzedaży",
    };
  }

  if (locale === "de") {
    if (kind === "rent") {
      return {
        headingPrefix: "Container zur Miete",
        offerNoun: "Mietangebote für Container",
        actionPhrase: "einen Container mieten",
        intentPhrase: "Miete",
        browsePhrase: "Mietangebote",
      };
    }
    if (kind === "buy") {
      return {
        headingPrefix: "Container gesucht",
        offerNoun: "Suchanzeigen für Container",
        actionPhrase: "Containerbedarf finden",
        intentPhrase: "Suche",
        browsePhrase: "Suchanzeigen",
      };
    }
    return {
      headingPrefix: "Container zum Verkauf",
      offerNoun: "Verkaufsangebote für Container",
      actionPhrase: "einen Container kaufen",
      intentPhrase: "Verkauf",
      browsePhrase: "Verkaufsangebote",
    };
  }

  if (locale === "uk") {
    if (kind === "rent") {
      return {
        headingPrefix: "Оренда контейнерів",
        offerNoun: "пропозиції оренди контейнерів",
        actionPhrase: "орендувати контейнер",
        intentPhrase: "оренди",
        browsePhrase: "пропозицій оренди",
      };
    }
    if (kind === "buy") {
      return {
        headingPrefix: "Купівля контейнерів",
        offerNoun: "оголошення про купівлю контейнерів",
        actionPhrase: "знайти попит на контейнер",
        intentPhrase: "купівлі",
        browsePhrase: "оголошень про купівлю",
      };
    }
    return {
      headingPrefix: "Контейнери на продаж",
      offerNoun: "пропозиції продажу контейнерів",
      actionPhrase: "купити контейнер",
      intentPhrase: "продажу",
      browsePhrase: "пропозицій продажу",
    };
  }

  if (kind === "rent") {
    return {
      headingPrefix: "Container rental",
      offerNoun: "container rental listings",
      actionPhrase: "rent a container",
      intentPhrase: "rental",
      browsePhrase: "rental listings",
    };
  }
  if (kind === "buy") {
    return {
      headingPrefix: "Container wanted listings",
      offerNoun: "container wanted listings",
      actionPhrase: "find container demand",
      intentPhrase: "wanted",
      browsePhrase: "wanted listings",
    };
  }
  return {
    headingPrefix: "Containers for sale",
    offerNoun: "container sale listings",
    actionPhrase: "buy a container",
    intentPhrase: "sale",
    browsePhrase: "sale listings",
  };
}

function getLocalSeoText(locale: AppLocale): LocalSeoText {
  if (locale === "pl") {
    return {
      expandSummary: "Rozwiń opis lokalizacji i najczęstsze pytania",
      locationPrefix: (isCity) => (isCity ? "w okolicy" : "w kraju"),
      defaultContainerLabels: "kontenery dry van (DV) 20 ft, 40 ft oraz 40 HC",
      defaultConditionLabels: "nowe i używane",
      transportSentence: (hasTransport, hasUnloading) =>
        hasTransport || hasUnloading
          ? `W części ogłoszeń pojawiają się opcje logistyczne, takie jak transport kontenera${hasUnloading ? " lub rozładunek HDS" : ""}.`
          : "Jeżeli transport nie jest opisany w ogłoszeniu, warto ustalić go bezpośrednio ze sprzedającym lub wynajmującym.",
      priceSentence: (hasPrices) =>
        hasPrices
          ? "Część ofert ma podaną cenę, a przy pozostałych można dopytać o wycenę bezpośrednio z poziomu ogłoszenia."
          : "Ceny są ustalane indywidualnie, dlatego najlepiej otworzyć ogłoszenie i skontaktować się z wystawcą.",
      introParagraph: (offerNoun, locationLabel) =>
        `Ta strona zbiera aktywne ${offerNoun} ${locationLabel}. Dzięki temu możesz szybko porównać aktualną dostępność, lokalizację, stan techniczny i podstawowe warunki ogłoszenia bez ręcznego przeszukiwania całej tablicy.`,
      containerParagraph: (containerLabels) =>
        `W aktualnych ogłoszeniach mogą pojawiać się między innymi ${containerLabels}. Dla zastosowań magazynowych, budowlanych i transportowych szczególnie ważne są zdjęcia, stan kontenera, dostępność od ręki oraz możliwość odbioru lub dostawy.`,
      checkHeading: "Co sprawdzić przed kontaktem",
      checkItems: [
        "typ i rozmiar kontenera",
        "czy opis dotyczy kontenera dry van / DV, HC, reefer lub innego typu",
        "stan: nowy, one trip, cargo worthy lub WWT",
        "lokalizację i możliwość transportu",
        "cenę netto/brutto albo sposób wyceny",
      ],
      checkAnswerPrefix: "Przed kontaktem warto sprawdzić",
      scopeHeading: "Aktualny zakres strony",
      scopeParagraph: (total) =>
        `W tej lokalizacji system pokazuje ${total} aktywnych ogłoszeń. Wyniki zmieniają się wraz z dodawaniem, odświeżaniem i wygasaniem ofert.`,
      fullListCta: "Zobacz pełną listę",
      faqHeading: "Najczęstsze pytania",
      nearbyHeading: "Podobne lokalizacje",
      faq: (input) => [
        {
          question: `Jakie kontenery są dostępne ${input.locationLabel}?`,
          answer: `Aktualna lista zależy od aktywnych ogłoszeń. Najczęściej warto sprawdzać ${input.containerLabels}, a także stan kontenera: ${input.conditionLabels}.`,
        },
        {
          question: `Czy można zorganizować transport kontenera ${input.locationName}?`,
          answer: input.transportSentence,
        },
        {
          question: `Czy strona pokazuje tylko kontenery z miasta ${input.locationName}?`,
          answer:
            "Lista obejmuje ogłoszenia z promienia przypisanego do tej lokalizacji, żeby pokazać również oferty z najbliższej okolicy.",
        },
        {
          question: `Jak szybko sprawdzić szczegóły ${input.intentPhrase}?`,
          answer: `Otwórz wybraną ofertę, sprawdź zdjęcia, lokalizację, cenę i dane kontaktowe wystawcy. Możesz też przejść do pełnej listy ${input.browsePhrase}.`,
        },
      ],
    };
  }

  if (locale === "de") {
    return {
      expandSummary: "Beschreibung und häufige Fragen aufklappen",
      locationPrefix: (isCity) => (isCity ? "im Raum" : "in"),
      defaultContainerLabels: "Dry-Van-Container (DV), 20 ft, 40 ft und 40 HC",
      defaultConditionLabels: "neue und gebrauchte",
      transportSentence: (hasTransport, hasUnloading) =>
        hasTransport || hasUnloading
          ? `In einigen Anzeigen gibt es Logistikoptionen wie Containertransport${hasUnloading ? " oder Entladung per HDS/Kran" : ""}.`
          : "Wenn der Transport in der Anzeige nicht beschrieben ist, sollte er direkt mit dem Anbieter abgestimmt werden.",
      priceSentence: (hasPrices) =>
        hasPrices
          ? "Ein Teil der Angebote enthält einen Preis, bei den übrigen kann die Bewertung direkt über die Anzeige angefragt werden."
          : "Preise werden individuell abgestimmt; öffnen Sie daher am besten die Anzeige und kontaktieren Sie den Anbieter.",
      introParagraph: (offerNoun, locationLabel) =>
        `Diese Seite bündelt aktive ${offerNoun} ${locationLabel}. So können Sie Verfügbarkeit, Standort, Zustand und die wichtigsten Angebotsdaten vergleichen, ohne die gesamte Liste manuell zu durchsuchen.`,
      containerParagraph: (containerLabels) =>
        `In aktuellen Anzeigen können unter anderem ${containerLabels} erscheinen. Für Lagerung, Baustellen und Transport sind Fotos, Zustand, kurzfristige Verfügbarkeit sowie Abholung oder Lieferung besonders wichtig.`,
      checkHeading: "Was vor der Kontaktaufnahme prüfen",
      checkItems: [
        "Typ und Größe des Containers",
        "ob es sich um Dry Van / DV, HC, Reefer oder einen anderen Typ handelt",
        "Zustand: neu, one trip, cargo worthy oder WWT",
        "Standort und Transportmöglichkeit",
        "Netto-/Bruttopreis oder Art der Preisfindung",
      ],
      checkAnswerPrefix: "Vor der Kontaktaufnahme sollten Sie prüfen",
      scopeHeading: "Aktueller Seitenumfang",
      scopeParagraph: (total) =>
        `Für diese Lokalisierung zeigt das System ${total} aktive Anzeigen. Die Ergebnisse ändern sich, wenn Angebote hinzugefügt, erneuert oder beendet werden.`,
      fullListCta: "Vollständige Liste öffnen",
      faqHeading: "Häufige Fragen",
      nearbyHeading: "Ähnliche Standorte",
      faq: (input) => [
        {
          question: `Welche Container sind ${input.locationLabel} verfügbar?`,
          answer: `Die aktuelle Liste hängt von aktiven Anzeigen ab. Besonders sinnvoll ist der Blick auf ${input.containerLabels} sowie auf den Zustand: ${input.conditionLabels}.`,
        },
        {
          question: `Kann der Transport eines Containers ${input.locationName} organisiert werden?`,
          answer: input.transportSentence,
        },
        {
          question: `Zeigt die Seite nur Container aus ${input.locationName}?`,
          answer:
            "Die Liste umfasst Anzeigen aus dem Radius dieser Lokalisierung, damit auch Angebote aus der näheren Umgebung sichtbar sind.",
        },
        {
          question: `Wie prüfe ich schnell Details zur ${input.intentPhrase}?`,
          answer: `Öffnen Sie ein Angebot und prüfen Sie Fotos, Standort, Preis und Kontaktdaten des Anbieters. Sie können auch zur vollständigen Liste der ${input.browsePhrase} wechseln.`,
        },
      ],
    };
  }

  if (locale === "uk") {
    return {
      expandSummary: "Розгорнути опис локації та FAQ",
      locationPrefix: (isCity) => (isCity ? "у районі" : "у країні"),
      defaultContainerLabels: "контейнери dry van (DV) 20 ft, 40 ft та 40 HC",
      defaultConditionLabels: "нові та вживані",
      transportSentence: (hasTransport, hasUnloading) =>
        hasTransport || hasUnloading
          ? `У частині оголошень доступні логістичні опції, такі як доставка контейнера${hasUnloading ? " або розвантаження HDS/краном" : ""}.`
          : "Якщо транспорт не описаний в оголошенні, його варто узгодити безпосередньо з автором оголошення.",
      priceSentence: (hasPrices) =>
        hasPrices
          ? "Частина пропозицій має вказану ціну, а в інших випадках вартість можна уточнити безпосередньо через оголошення."
          : "Ціни узгоджуються індивідуально, тому найкраще відкрити оголошення і зв'язатися з автором.",
      introParagraph: (offerNoun, locationLabel) =>
        `Ця сторінка збирає активні ${offerNoun} ${locationLabel}. Це допомагає швидко порівняти доступність, локацію, стан і основні умови оголошення без ручного перегляду всієї дошки.`,
      containerParagraph: (containerLabels) =>
        `В актуальних оголошеннях можуть з'являтися, зокрема, ${containerLabels}. Для складування, будівництва і транспорту особливо важливі фото, стан контейнера, доступність та можливість самовивозу або доставки.`,
      checkHeading: "Що перевірити перед контактом",
      checkItems: [
        "тип і розмір контейнера",
        "чи це dry van / DV, HC, reefer або інший тип",
        "стан: новий, one trip, cargo worthy або WWT",
        "локацію і можливість доставки",
        "ціну нетто/брутто або спосіб оцінки",
      ],
      checkAnswerPrefix: "Перед контактом варто перевірити",
      scopeHeading: "Поточний обсяг сторінки",
      scopeParagraph: (total) =>
        `У цій локації система показує ${total} активних оголошень. Результати змінюються, коли пропозиції додаються, оновлюються або завершуються.`,
      fullListCta: "Відкрити повний список",
      faqHeading: "Поширені питання",
      nearbyHeading: "Схожі локації",
      faq: (input) => [
        {
          question: `Які контейнери доступні ${input.locationLabel}?`,
          answer: `Актуальний список залежить від активних оголошень. Варто перевіряти ${input.containerLabels}, а також стан контейнера: ${input.conditionLabels}.`,
        },
        {
          question: `Чи можна організувати доставку контейнера ${input.locationName}?`,
          answer: input.transportSentence,
        },
        {
          question: `Чи сторінка показує лише контейнери з міста ${input.locationName}?`,
          answer:
            "Список охоплює оголошення в радіусі цієї локації, щоб показувати також пропозиції з найближчої околиці.",
        },
        {
          question: `Як швидко перевірити деталі ${input.intentPhrase}?`,
          answer: `Відкрийте вибране оголошення, перевірте фото, локацію, ціну та контактні дані автора. Також можна перейти до повного списку ${input.browsePhrase}.`,
        },
      ],
    };
  }

  return {
    expandSummary: "Expand location description and FAQ",
    locationPrefix: (isCity) => (isCity ? "around" : "in"),
    defaultContainerLabels: "dry van (DV), 20 ft, 40 ft, and 40 HC containers",
    defaultConditionLabels: "new and used",
    transportSentence: (hasTransport, hasUnloading) =>
      hasTransport || hasUnloading
        ? `Some listings include logistics options such as container transport${hasUnloading ? " or unloading" : ""}.`
        : "If transport is not described in the listing, it is worth confirming it directly with the advertiser.",
    priceSentence: (hasPrices) =>
      hasPrices
        ? "Some offers include a listed price, while others can be priced directly with the advertiser."
        : "Prices are agreed individually, so it is best to open a listing and contact the advertiser.",
    introParagraph: (offerNoun, locationLabel) =>
      `This page collects active ${offerNoun} ${locationLabel}. It helps you compare availability, location, condition, and core listing details without searching the full board manually.`,
    containerParagraph: (containerLabels) =>
      `Current listings may include ${containerLabels}. For storage, construction, and transport use, photos, condition, availability, and pickup or delivery options are especially important.`,
    checkHeading: "What to check before contact",
    checkItems: [
      "container type and size",
      "whether it is dry van / DV, HC, reefer, or another type",
      "condition: new, one trip, cargo worthy, or WWT",
      "location and transport availability",
      "net/gross price or pricing method",
    ],
    checkAnswerPrefix: "Before contact, check",
    scopeHeading: "Current page scope",
    scopeParagraph: (total) =>
      `This location currently shows ${total} active listings. Results change as offers are added, refreshed, and expired.`,
    fullListCta: "Open full list",
    faqHeading: "Frequently asked questions",
    nearbyHeading: "Nearby locations",
    faq: (input) => [
      {
        question: `What containers are available ${input.locationLabel}?`,
        answer: `Availability depends on active listings. It is worth checking ${input.containerLabels} and the listed condition: ${input.conditionLabels}.`,
      },
      {
        question: `Can container transport be arranged ${input.locationName}?`,
        answer: input.transportSentence,
      },
      {
        question: `Does this page only show containers in ${input.locationName}?`,
        answer:
          "The list covers listings within the location radius, so nearby offers may also appear.",
      },
      {
        question: `How do I check the ${input.intentPhrase} details?`,
        answer: `Open a listing to review photos, location, price, and advertiser contact details. You can also open the full ${input.browsePhrase}.`,
      },
    ],
  };
}

function getTopValues(values: string[], limit = 4): string[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized) {
      continue;
    }
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([value]) => value);
}

function joinReadable(values: string[], locale: AppLocale): string {
  if (values.length === 0) {
    return "";
  }
  if (values.length === 1) {
    return values[0];
  }
  const glue =
    locale === "pl"
      ? " oraz "
      : locale === "de"
        ? " und "
        : locale === "uk"
          ? " та "
          : " and ";
  return `${values.slice(0, -1).join(", ")}${glue}${values[values.length - 1]}`;
}

function withDryVanAliases(
  label: string,
  items: ContainerListingItem[],
): string {
  const hasDryContainer = items.some((item) => item.container.type === "dry");
  if (!hasDryContainer || /dry van|dv/i.test(label)) {
    return label;
  }
  return `${label} (dry van / DV)`;
}

function getCheckAnswer(text: LocalSeoText, locale: AppLocale): string {
  const prefix = text.checkAnswerPrefix ?? text.checkHeading;
  const normalizedItems = text.checkItems.map((item) => item.trim()).filter(Boolean);
  const list = joinReadable(normalizedItems, locale);
  return `${prefix}: ${list}.`;
}

function getLocalContentStats(
  items: ContainerListingItem[],
  locale: AppLocale,
  listingMessages: ReturnType<typeof getMessages>["containerListings"],
) {
  const text = getLocalSeoText(locale);
  const containerLabels = getTopValues(
    items.map((item) => getContainerShortLabelLocalized(listingMessages, item.container)),
  );
  const conditionLabels = getTopValues(
    items.map((item) =>
      getContainerConditionLabel(listingMessages, item.container.condition),
    ),
  );
  const hasTransport = items.some((item) => item.logisticsTransportAvailable);
  const hasUnloading = items.some((item) => item.logisticsUnloadingAvailable);
  const hasPrices = items.some(
    (item) =>
      typeof item.pricing?.original.amount === "number" ||
      typeof item.priceAmount === "number" ||
      Boolean(item.price?.trim()),
  );

  return {
    containerLabels:
      containerLabels.length > 0
        ? withDryVanAliases(joinReadable(containerLabels, locale), items)
        : text.defaultContainerLabels,
    conditionLabels:
      conditionLabels.length > 0
        ? joinReadable(conditionLabels, locale)
        : text.defaultConditionLabels,
    hasTransport,
    hasUnloading,
    hasPrices,
  };
}

function SeoLocalContent({
  context,
  items,
  total,
  locale,
  browseHref,
  listingMessages,
}: {
  context: SeoLocalContext;
  items: ContainerListingItem[];
  total: number;
  locale: AppLocale;
  browseHref: string;
  listingMessages: ReturnType<typeof getMessages>["containerListings"];
}) {
  const intent = getIntentCopy(locale, context.kind);
  const text = getLocalSeoText(locale);
  const stats = getLocalContentStats(items, locale, listingMessages);
  const isCity = context.locationType === "city";
  const locationLabel = `${text.locationPrefix(isCity)} ${context.name}`;
  const transportSentence = text.transportSentence(
    stats.hasTransport,
    stats.hasUnloading,
  );
  const priceSentence = text.priceSentence(stats.hasPrices);
  const checkAnswer = getCheckAnswer(text, locale);
  const faqItems = [
    ...text.faq({
      locationLabel,
      locationName: context.name,
      containerLabels: stats.containerLabels,
      conditionLabels: stats.conditionLabels,
      transportSentence,
      checkAnswer,
      intentPhrase: intent.intentPhrase,
      browsePhrase: intent.browsePhrase,
    }),
    {
      question: text.checkHeading,
      answer: checkAnswer,
    },
  ];

  return (
    <section className="rounded-md border border-neutral-300 bg-white shadow-sm">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-semibold text-neutral-900 marker:hidden sm:px-6">
          <span>{text.expandSummary}</span>
          <span className="shrink-0 text-lg leading-none text-neutral-500 transition group-open:rotate-45">
            +
          </span>
        </summary>
        <div className="grid gap-6 border-t border-neutral-200 px-5 py-5 sm:px-6">
          <div className="max-w-4xl">
            <h2 className="text-2xl font-semibold text-neutral-900">
              {intent.headingPrefix} {locationLabel}
            </h2>
            <div className="mt-3 grid gap-3 text-sm leading-7 text-neutral-700 sm:text-base">
              <p>
                {text.introParagraph(intent.offerNoun, locationLabel)}
              </p>
              <p>
                {text.containerParagraph(stats.containerLabels)}
              </p>
              <p>
                {transportSentence} {priceSentence}
              </p>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4">
              <h3 className="text-base font-semibold text-neutral-900">
                {text.scopeHeading}
              </h3>
              <p className="mt-3 text-sm leading-6 text-neutral-700">
                {text.scopeParagraph(total.toLocaleString(locale))}
              </p>
              <Link
                href={browseHref}
                className="mt-4 inline-flex h-10 items-center justify-center rounded-md border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-800 transition hover:bg-neutral-100"
              >
                {text.fullListCta}
              </Link>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-neutral-900">
              {text.faqHeading}
            </h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {faqItems.map((item) => (
                <div key={item.question} className="rounded-md border border-neutral-200 p-4">
                  <h4 className="text-sm font-semibold text-neutral-900">{item.question}</h4>
                  <p className="mt-2 text-sm leading-6 text-neutral-700">{item.answer}</p>
                </div>
              ))}
            </div>
          </div>

          {context.nearbyLinks && context.nearbyLinks.length > 0 ? (
            <div>
              <h3 className="text-lg font-semibold text-neutral-900">
                {text.nearbyHeading}
              </h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {context.nearbyLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="inline-flex min-h-10 items-center rounded-md border border-neutral-300 bg-neutral-50 px-3 text-sm font-medium text-neutral-800 transition hover:bg-neutral-100"
                  >
                    {link.name}
                    {typeof link.distanceKm === "number" ? (
                      <span className="ml-2 text-xs font-normal text-neutral-500">
                        {link.distanceKm} km
                      </span>
                    ) : null}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </details>
    </section>
  );
}

export function SeoContainerSalePage({
  locale,
  heading,
  lead,
  browseHref,
  items,
  total,
  seoContext,
}: SeoContainerSalePageProps) {
  const copy = getContainerSeoHubCopy(locale, seoContext?.kind ?? "sell");
  const listingMessages = getMessages(locale).containerListings;
  const isIndexable = getContainerSeoIndexable(total);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6">
      <section className="rounded-md border border-neutral-300 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-semibold text-neutral-900">{heading}</h1>
            <p className="mt-3 text-base leading-7 text-neutral-700">{lead}</p>
            <p className="mt-3 text-sm font-medium text-neutral-500">{copy.totalLabel(total)}</p>
            {!isIndexable ? (
              <p className="mt-2 text-sm text-neutral-500">{copy.noIndexReason}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={browseHref}
              className="inline-flex h-11 items-center justify-center rounded-md border border-[#1d5ea8] bg-[#103b74] px-4 text-sm font-semibold text-white transition hover:border-[#2f76c7] hover:bg-[#16498d]"
            >
              {copy.browseList}
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">{copy.latestHeading}</h2>
        </div>
        {items.length > 0 ? (
          <ul className="grid gap-3">
            {items.map((item) => {
              const title = getContainerShortLabelLocalized(
                listingMessages,
                item.container,
              );
              const priceDisplay = getListingPriceDisplay(item, locale, listingMessages);
              const additionalPhotoCount = getAdditionalPhotoCount(item);
              const containerFeatureLabels = item.container.features
                .map((feature) => getContainerFeatureLabel(listingMessages, feature))
                .filter((label) => label.trim().length > 0);
              const containerMetaParts = [
                ...(typeof item.productionYear === "number"
                  ? [String(item.productionYear)]
                  : []),
                ...containerFeatureLabels,
              ];
              const logisticsSummaryLabels = getLogisticsSummaryLabels(
                item,
                listingMessages,
              );
              const detailsHref = withLocalePrefix(`/containers/${item.id}`, locale);

              return (
                <li
                  key={item.id}
                  className="w-full rounded-md border border-neutral-200 bg-white p-1.5 shadow-sm transition-colors duration-150 hover:border-sky-100 hover:bg-sky-50/60 sm:p-4"
                >
                  <div className="flex h-full flex-col gap-2 sm:flex-row sm:gap-4">
                    <div className="w-full shrink-0 sm:w-44">
                      <div className="relative aspect-square overflow-hidden rounded-t-md border border-neutral-200 border-b-0 bg-neutral-100 sm:rounded-md sm:border-b">
                        <ContainerPhotoWithPlaceholder
                          src={getContainerPreviewSrc(item)}
                          alt=""
                          fill
                          className={
                            item.photoUrls && item.photoUrls.length > 0
                              ? "object-cover"
                              : "object-contain p-1"
                          }
                          sizes="(max-width: 640px) 100vw, 176px"
                        />
                        <ContainerSerialNumberOverlay value={item.containerSerialNumber} />
                        {additionalPhotoCount > 0 ? (
                          <span
                            className="absolute bottom-1.5 right-1.5 inline-flex h-6 min-w-8 items-center justify-center gap-1 rounded-md border border-neutral-300 bg-white/95 px-1.5 text-[11px] font-semibold text-neutral-900 shadow-sm backdrop-blur"
                            aria-label={`+${additionalPhotoCount}`}
                            title={`+${additionalPhotoCount}`}
                          >
                            +{additionalPhotoCount}
                          </span>
                        ) : null}
                      </div>
                      <span
                        className={`-mt-px inline-flex w-full items-center justify-center rounded-b-md border px-2 py-1 text-[10px] font-medium sm:hidden ${CONTAINER_CONDITION_COLOR_TOKENS[item.container.condition].badgeClassName}`}
                      >
                        {getContainerConditionLabel(
                          listingMessages,
                          item.container.condition,
                        )}
                      </span>
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
                        <div className="min-w-0 sm:w-0 sm:flex-1">
                          {item.companySlug ? (
                            <div className="flex min-w-0 items-center gap-1">
                              <Link
                                href={`/companies/${item.companySlug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block min-w-0 truncate text-[11px] uppercase leading-[1.15] tracking-[0.08em] text-sky-700 decoration-sky-400 underline underline-offset-2 hover:text-sky-800 sm:text-xs"
                              >
                                {item.companyName}
                              </Link>
                              {item.companyIsVerified ? (
                                <span
                                  className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-emerald-300/80 bg-emerald-100/80 text-emerald-700"
                                  aria-label={listingMessages.results.verifiedCompany}
                                  title={listingMessages.results.verifiedCompany}
                                >
                                  <svg
                                    viewBox="0 0 20 20"
                                    fill="none"
                                    className="h-3 w-3"
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
                            </div>
                          ) : (
                            <p className="truncate text-[11px] uppercase leading-[1.15] tracking-[0.08em] text-neutral-500 sm:text-xs">
                              {item.companyName}
                            </p>
                          )}
                          <h3 className="mt-1 truncate text-[17px] font-semibold leading-tight text-neutral-900 sm:text-xl">
                            {title}
                          </h3>
                          <p className="mt-1 truncate text-sm text-neutral-600">
                            {getContainerListingLocationLabel(
                              item,
                              listingMessages.utils,
                              locale,
                            )}
                          </p>
                          {containerMetaParts.length > 0 ? (
                            <p
                              className="mt-1 w-full truncate text-[12px] text-neutral-500 sm:text-xs"
                              title={containerMetaParts.join(", ")}
                            >
                              {containerMetaParts.join(", ")}
                            </p>
                          ) : null}
                        </div>

                        <div className="hidden w-full justify-items-start gap-1.5 text-left sm:ml-auto sm:grid sm:w-auto sm:shrink-0 sm:justify-items-end sm:gap-2 sm:text-right">
                          <div>
                            <p
                              className={`max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm font-bold sm:text-xl ${
                                priceDisplay.isRequestPrice
                                  ? "text-neutral-700"
                                  : "text-amber-600"
                              }`}
                            >
                              {priceDisplay.amountLabel}
                            </p>
                            {priceDisplay.metaLine ? (
                              <p className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[10px] text-neutral-600 sm:text-xs">
                                {priceDisplay.metaLine}
                              </p>
                            ) : null}
                          </div>
                          <div className="hidden flex-wrap items-center justify-end gap-2 sm:flex">
                            <span
                              className={`rounded-md border px-2 py-1 text-xs font-medium ${CONTAINER_CONDITION_COLOR_TOKENS[item.container.condition].badgeClassName}`}
                            >
                              {getContainerConditionLabel(
                                listingMessages,
                                item.container.condition,
                              )}
                            </span>
                          </div>
                          <p className="hidden text-right text-xs text-neutral-400 sm:block">
                            {copy.addedLabel}:{" "}
                            {new Date(item.createdAt).toLocaleDateString(locale)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-2 flex items-center gap-2 overflow-hidden text-[12px] text-neutral-500 sm:mt-3 sm:flex-wrap sm:overflow-visible sm:text-xs">
                        {logisticsSummaryLabels.length > 0 ? (
                          <p className="min-w-0 truncate text-neutral-600">
                            {logisticsSummaryLabels.join(", ")}
                          </p>
                        ) : null}
                        <p className="ml-auto hidden text-right text-sm text-neutral-700 sm:block">
                          {listingMessages.results.availableFromLabel}:{" "}
                          <span className="font-medium text-neutral-900">
                            {getAvailableFromLabel(item, locale, listingMessages)}
                          </span>
                        </p>
                      </div>

                      <div className="mt-auto flex flex-col gap-2 pt-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                        <p className="text-[12px] text-neutral-700 sm:text-sm">
                          {copy.quantityLabel}:{" "}
                          <span className="font-medium text-neutral-900">
                            {item.quantity}
                          </span>
                        </p>
                        <p className="min-h-[3.2rem] text-center sm:hidden">
                          <span
                            className={`text-[17px] font-semibold ${
                              priceDisplay.isRequestPrice
                                ? "text-neutral-700"
                                : "text-amber-600"
                            }`}
                          >
                            {priceDisplay.amountLabel}
                          </span>
                          {priceDisplay.metaLine ? (
                            <span className="mt-0.5 block text-[14px] font-medium leading-tight text-neutral-700">
                              {priceDisplay.metaLine}
                            </span>
                          ) : null}
                        </p>
                        <div className="ml-auto flex w-full items-center justify-end gap-2 sm:w-auto">
                          <Link
                            href={detailsHref}
                            className="inline-flex w-full items-center justify-center rounded-md border border-[#1d5ea8] bg-[#103b74] px-2.5 py-1.5 text-[12px] font-medium text-white transition hover:border-[#2f76c7] hover:bg-[#16498d] sm:w-auto sm:px-3 sm:py-2 sm:text-sm"
                          >
                            {listingMessages.results.detailsCta}
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="rounded-md border border-dashed border-neutral-300 bg-white p-8 text-center">
            <p className="text-lg font-semibold text-neutral-900">{copy.emptyTitle}</p>
            <p className="mt-2 text-sm leading-6 text-neutral-600">{copy.emptyText}</p>
            <div className="mt-4">
              <Link
                href={browseHref}
                className="inline-flex h-11 items-center justify-center rounded-md border border-neutral-300 bg-neutral-100 px-4 text-sm font-medium text-neutral-800 transition hover:bg-neutral-200"
              >
                {copy.browseList}
              </Link>
            </div>
          </div>
        )}
      </section>

      {seoContext ? (
        <SeoLocalContent
          context={seoContext}
          items={items}
          total={total}
          locale={locale}
          browseHref={browseHref}
          listingMessages={listingMessages}
        />
      ) : null}
    </main>
  );
}
