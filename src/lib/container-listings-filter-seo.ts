import {
  buildContainerListingsPageSearchParams,
  parseContainerListingsPageFilters,
} from "@/components/container-listings-utils";
import {
  FILTER_FORM_DEFAULTS,
  type AppliedFilters,
  type FormContainerSize,
} from "@/components/container-listings-shared";
import { getCountryDisplayName } from "@/lib/country-flags";
import type {
  AppLocale,
  AppMessages,
} from "@/lib/i18n";

type ListPageMessages = AppMessages["listPage"];
type ContainerListingsMessages = AppMessages["containerListings"];

type FilterSeoCopy = {
  titleByKind: Record<AppliedFilters["listingKind"], string>;
  companyTitleByKind: Record<AppliedFilters["listingKind"], (companyName: string) => string>;
  descriptionStartByKind: Record<AppliedFilters["listingKind"], string>;
  companyDescriptionStartByKind: Record<
    AppliedFilters["listingKind"],
    (companyName: string) => string
  >;
  detailsIntro: string;
  detailsSeparator: string;
  cta: string;
  labels: {
    location: string;
    radius: (radiusKm: string) => string;
    size: string;
    height: string;
    type: string;
    condition: string;
    feature: string;
    ral: string;
    price: string;
    productionYear: string;
    negotiable: string;
    transport: string;
    unloading: string;
    cscPlate: string;
    cscCertification: string;
  };
};

const FILTER_SEO_COPY: Record<AppLocale, FilterSeoCopy> = {
  pl: {
    titleByKind: {
      sell: "Kontenery na sprzedaz",
      rent: "Kontenery na wynajem",
      buy: "Oferty kupna kontenerow",
    },
    companyTitleByKind: {
      sell: (companyName) => `Kontenery na sprzedaz - ${companyName}`,
      rent: (companyName) => `Kontenery na wynajem - ${companyName}`,
      buy: (companyName) => `Oferty kupna kontenerow - ${companyName}`,
    },
    descriptionStartByKind: {
      sell: "Przegladaj aktywne oferty sprzedazy kontenerow",
      rent: "Przegladaj aktywne oferty wynajmu kontenerow",
      buy: "Przegladaj ogloszenia kupna kontenerow",
    },
    companyDescriptionStartByKind: {
      sell: (companyName) => `Przegladaj aktywne oferty sprzedazy kontenerow firmy ${companyName}`,
      rent: (companyName) => `Przegladaj aktywne oferty wynajmu kontenerow firmy ${companyName}`,
      buy: (companyName) => `Przegladaj ogloszenia kupna kontenerow firmy ${companyName}`,
    },
    detailsIntro: "Filtry",
    detailsSeparator: "; ",
    cta: "Sprawdz dostepne ogloszenia i przejdz do kontaktu na ContainerBoard.",
    labels: {
      location: "lokalizacja",
      radius: (radiusKm) => `promien ${radiusKm} km`,
      size: "dlugosc",
      height: "wysokosc",
      type: "typ",
      condition: "stan",
      feature: "cechy",
      ral: "RAL",
      price: "cena",
      productionYear: "rok produkcji od",
      negotiable: "cena do negocjacji",
      transport: "transport",
      unloading: "rozladunek",
      cscPlate: "tabliczka CSC",
      cscCertification: "certyfikacja CSC",
    },
  },
  en: {
    titleByKind: {
      sell: "Containers for sale",
      rent: "Containers for rent",
      buy: "Container wanted listings",
    },
    companyTitleByKind: {
      sell: (companyName) => `Containers for sale - ${companyName}`,
      rent: (companyName) => `Containers for rent - ${companyName}`,
      buy: (companyName) => `Container wanted listings - ${companyName}`,
    },
    descriptionStartByKind: {
      sell: "Browse active shipping container sale listings",
      rent: "Browse active shipping container rental listings",
      buy: "Browse active container wanted listings",
    },
    companyDescriptionStartByKind: {
      sell: (companyName) => `Browse active shipping container sale listings from ${companyName}`,
      rent: (companyName) => `Browse active shipping container rental listings from ${companyName}`,
      buy: (companyName) => `Browse active container wanted listings from ${companyName}`,
    },
    detailsIntro: "Filters",
    detailsSeparator: "; ",
    cta: "Check current listings and contact sellers on ContainerBoard.",
    labels: {
      location: "location",
      radius: (radiusKm) => `${radiusKm} km radius`,
      size: "length",
      height: "height",
      type: "type",
      condition: "condition",
      feature: "features",
      ral: "RAL",
      price: "price",
      productionYear: "production year from",
      negotiable: "negotiable price",
      transport: "transport",
      unloading: "unloading",
      cscPlate: "CSC plate",
      cscCertification: "CSC certification",
    },
  },
  de: {
    titleByKind: {
      sell: "Container zum Verkauf",
      rent: "Container zur Miete",
      buy: "Container-Gesuche",
    },
    companyTitleByKind: {
      sell: (companyName) => `Container zum Verkauf - ${companyName}`,
      rent: (companyName) => `Container zur Miete - ${companyName}`,
      buy: (companyName) => `Container-Gesuche - ${companyName}`,
    },
    descriptionStartByKind: {
      sell: "Durchsuchen Sie aktive Verkaufsangebote fur Container",
      rent: "Durchsuchen Sie aktive Mietangebote fur Container",
      buy: "Durchsuchen Sie aktive Container-Gesuche",
    },
    companyDescriptionStartByKind: {
      sell: (companyName) => `Durchsuchen Sie aktive Verkaufsangebote fur Container von ${companyName}`,
      rent: (companyName) => `Durchsuchen Sie aktive Mietangebote fur Container von ${companyName}`,
      buy: (companyName) => `Durchsuchen Sie aktive Container-Gesuche von ${companyName}`,
    },
    detailsIntro: "Filter",
    detailsSeparator: "; ",
    cta: "Prufen Sie aktuelle Inserate und kontaktieren Sie Anbieter auf ContainerBoard.",
    labels: {
      location: "Standort",
      radius: (radiusKm) => `${radiusKm} km Radius`,
      size: "Lange",
      height: "Hohe",
      type: "Typ",
      condition: "Zustand",
      feature: "Merkmale",
      ral: "RAL",
      price: "Preis",
      productionYear: "Baujahr ab",
      negotiable: "verhandelbarer Preis",
      transport: "Transport",
      unloading: "Entladung",
      cscPlate: "CSC-Schild",
      cscCertification: "CSC-Zertifizierung",
    },
  },
  uk: {
    titleByKind: {
      sell: "Konteinery na prodazh",
      rent: "Konteinery v orendu",
      buy: "Zapyt na kupivliu konteineriv",
    },
    companyTitleByKind: {
      sell: (companyName) => `Konteinery na prodazh - ${companyName}`,
      rent: (companyName) => `Konteinery v orendu - ${companyName}`,
      buy: (companyName) => `Zapyt na kupivliu konteineriv - ${companyName}`,
    },
    descriptionStartByKind: {
      sell: "Perehliadaite aktyvni propozytsii prodazhu konteineriv",
      rent: "Perehliadaite aktyvni propozytsii orendy konteineriv",
      buy: "Perehliadaite aktyvni zapyty na kupivliu konteineriv",
    },
    companyDescriptionStartByKind: {
      sell: (companyName) => `Perehliadaite aktyvni propozytsii prodazhu konteineriv vid ${companyName}`,
      rent: (companyName) => `Perehliadaite aktyvni propozytsii orendy konteineriv vid ${companyName}`,
      buy: (companyName) => `Perehliadaite aktyvni zapyty na kupivliu konteineriv vid ${companyName}`,
    },
    detailsIntro: "Filtry",
    detailsSeparator: "; ",
    cta: "Perevirte aktualni oholoshennia ta zviazhetsia z prodavtsiamy na ContainerBoard.",
    labels: {
      location: "lokatsiia",
      radius: (radiusKm) => `radius ${radiusKm} km`,
      size: "dovzhyna",
      height: "vysota",
      type: "typ",
      condition: "stan",
      feature: "funktsii",
      ral: "RAL",
      price: "tsina",
      productionYear: "rik vyrobnytstva vid",
      negotiable: "tsina do obhovorennia",
      transport: "transport",
      unloading: "rozvantazhennia",
      cscPlate: "CSC plate",
      cscCertification: "CSC certification",
    },
  },
};

function trimParamValue(value: string | string[] | undefined): string | undefined {
  const raw = typeof value === "string" ? value : value?.[0];
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

function toSearchParams(
  params: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const output = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const resolved = trimParamValue(value);
    if (resolved) {
      output.set(key, resolved);
    }
  }
  return output;
}

function formatList(labels: string[], limit = 2): string {
  const visible = labels.slice(0, limit);
  const remaining = labels.length - visible.length;
  return remaining > 0 ? `${visible.join(", ")} +${remaining}` : visible.join(", ");
}

function formatLabelValue(label: string, value: string): string {
  return `${label}: ${value}`;
}

function getContainerSizeLabel(
  messages: ContainerListingsMessages,
  size: FormContainerSize,
): string {
  return size === "custom" ? messages.shared.customContainerSize : `${size} ft`;
}

function getLocationLabel(
  filters: AppliedFilters,
  locale: AppLocale,
): string | null {
  const city = filters.city.trim();
  const country = filters.country.trim();
  const countryCode = filters.countryCode.trim().toUpperCase();
  const countryLabel = countryCode
    ? getCountryDisplayName(countryCode, locale, country || countryCode)
    : country;
  const administrative = [city, countryLabel].filter(Boolean).join(", ");
  if (administrative) {
    return administrative;
  }

  return filters.locationQuery.trim() || null;
}

function getPriceLabel(filters: AppliedFilters): string | null {
  const min = filters.priceMinInput.trim();
  const max = filters.priceMaxInput.trim();
  if (!min && !max) {
    return null;
  }

  const currency = filters.priceCurrency === "all" ? "" : ` ${filters.priceCurrency}`;
  const taxMode = filters.priceTaxMode === "gross" ? " brutto" : " netto";
  if (min && max) {
    return `${min}-${max}${currency}${taxMode}`;
  }
  if (min) {
    return `od ${min}${currency}${taxMode}`;
  }
  return `do ${max}${currency}${taxMode}`;
}

function getTitleSegments(input: {
  filters: AppliedFilters;
  locale: AppLocale;
  messages: ContainerListingsMessages;
}): string[] {
  const { filters, locale, messages } = input;
  const location = getLocationLabel(filters, locale);
  const sizes = filters.containerSizes.map((size) => getContainerSizeLabel(messages, size));
  const heights = filters.containerHeights.map(
    (height) => messages.shared.containerHeights[height],
  );
  const types = filters.containerTypes.map(
    (type) => messages.shared.containerTypes[type],
  );
  const conditions = filters.containerConditions.map(
    (condition) => messages.shared.containerConditions[condition],
  );

  return [
    location,
    sizes.length > 0 ? formatList(sizes) : null,
    heights.length > 0 ? formatList(heights) : null,
    types.length > 0 ? formatList(types) : null,
    conditions.length > 0 ? formatList(conditions) : null,
  ].filter((value): value is string => Boolean(value));
}

function getDescriptionDetails(input: {
  filters: AppliedFilters;
  locale: AppLocale;
  messages: ContainerListingsMessages;
  copy: FilterSeoCopy;
}): string[] {
  const { filters, locale, messages, copy } = input;
  const location = getLocationLabel(filters, locale);
  const price = getPriceLabel(filters);
  const details: string[] = [];

  if (location) {
    const value = filters.locationCenter
      ? `${location}, ${copy.labels.radius(filters.locationRadiusKm)}`
      : location;
    details.push(formatLabelValue(copy.labels.location, value));
  }
  if (filters.containerSizes.length > 0) {
    details.push(
      formatLabelValue(
        copy.labels.size,
        formatList(filters.containerSizes.map((size) => getContainerSizeLabel(messages, size)), 3),
      ),
    );
  }
  if (filters.containerHeights.length > 0) {
    details.push(
      formatLabelValue(
        copy.labels.height,
        formatList(
          filters.containerHeights.map((height) => messages.shared.containerHeights[height]),
          3,
        ),
      ),
    );
  }
  if (filters.containerTypes.length > 0) {
    details.push(
      formatLabelValue(
        copy.labels.type,
        formatList(
          filters.containerTypes.map((type) => messages.shared.containerTypes[type]),
          3,
        ),
      ),
    );
  }
  if (filters.containerConditions.length > 0) {
    details.push(
      formatLabelValue(
        copy.labels.condition,
        formatList(
          filters.containerConditions.map(
            (condition) => messages.shared.containerConditions[condition],
          ),
          3,
        ),
      ),
    );
  }
  if (filters.containerFeatures.length > 0) {
    details.push(
      formatLabelValue(
        copy.labels.feature,
        formatList(
          filters.containerFeatures.map((feature) => messages.shared.containerFeatures[feature]),
          3,
        ),
      ),
    );
  }
  if (filters.containerRalColors.length > 0) {
    details.push(formatLabelValue(copy.labels.ral, formatList(filters.containerRalColors, 4)));
  }
  if (price) {
    details.push(formatLabelValue(copy.labels.price, price));
  }
  if (filters.productionYearInput.trim()) {
    details.push(
      formatLabelValue(copy.labels.productionYear, filters.productionYearInput.trim()),
    );
  }
  if (filters.priceNegotiableOnly) {
    details.push(copy.labels.negotiable);
  }
  if (filters.logisticsTransportOnly) {
    details.push(copy.labels.transport);
  }
  if (filters.logisticsUnloadingOnly) {
    details.push(copy.labels.unloading);
  }
  if (filters.hasCscPlateOnly) {
    details.push(copy.labels.cscPlate);
  }
  if (filters.hasCscCertificationOnly) {
    details.push(copy.labels.cscCertification);
  }

  return details;
}

function hasMeaningfulListFilters(
  filters: AppliedFilters,
  companySlug?: string,
): boolean {
  return (
    Boolean(companySlug?.trim()) ||
    filters.listingKind !== FILTER_FORM_DEFAULTS.listingKind ||
    filters.locationQuery.trim().length > 0 ||
    filters.locationCenter !== null ||
    filters.city.trim().length > 0 ||
    filters.country.trim().length > 0 ||
    filters.countryCode.trim().length > 0 ||
    filters.containerSizes.length > 0 ||
    filters.containerHeights.length > 0 ||
    filters.containerTypes.length > 0 ||
    filters.containerConditions.length > 0 ||
    filters.containerFeatures.length > 0 ||
    filters.containerRalColors.length > 0 ||
    filters.priceNegotiableOnly ||
    filters.logisticsTransportOnly ||
    filters.logisticsUnloadingOnly ||
    filters.hasCscPlateOnly ||
    filters.hasCscCertificationOnly ||
    filters.priceMinInput.trim().length > 0 ||
    filters.priceMaxInput.trim().length > 0 ||
    filters.productionYearInput.trim().length > 0
  );
}

function getFilteredListPath(
  filters: AppliedFilters,
  companySlug?: string,
): string {
  const params = buildContainerListingsPageSearchParams({
    appliedFilters: filters,
    companySlug,
  });
  const query = params.toString();
  return query ? `/list?${query}` : "/list";
}

export function buildContainerListingsFilterMetadata(input: {
  searchParams: Record<string, string | string[] | undefined>;
  locale: AppLocale;
  listMessages: ListPageMessages;
  containerMessages: ContainerListingsMessages;
  company?: {
    slug: string;
    name: string;
  };
}): {
  path: string;
  title: string;
  description: string;
} {
  const params = toSearchParams(input.searchParams);
  const filters = parseContainerListingsPageFilters(params).appliedFilters;
  const companySlug = input.company?.slug.trim();
  const companyName = input.company?.name.trim();

  if (!hasMeaningfulListFilters(filters, companySlug)) {
    return {
      path: "/list",
      title: input.listMessages.metaTitle,
      description: input.listMessages.metaDescription,
    };
  }

  const copy = FILTER_SEO_COPY[input.locale];
  const titleSegments = getTitleSegments({
    filters,
    locale: input.locale,
    messages: input.containerMessages,
  });
  const titleSuffix = titleSegments.slice(0, 4).join(" - ");
  const baseTitle = companyName
    ? copy.companyTitleByKind[filters.listingKind](companyName)
    : copy.titleByKind[filters.listingKind];
  const title = titleSuffix ? `${baseTitle} - ${titleSuffix}` : baseTitle;
  const details = getDescriptionDetails({
    filters,
    locale: input.locale,
    messages: input.containerMessages,
    copy,
  });
  const descriptionDetails = details.slice(0, 8).join(copy.detailsSeparator);
  const descriptionStart = companyName
    ? copy.companyDescriptionStartByKind[filters.listingKind](companyName)
    : copy.descriptionStartByKind[filters.listingKind];
  const description = descriptionDetails
    ? `${descriptionStart}. ${copy.detailsIntro}: ${descriptionDetails}. ${copy.cta}`
    : `${descriptionStart}. ${copy.cta}`;

  return {
    path: getFilteredListPath(filters, companySlug),
    title,
    description,
  };
}
