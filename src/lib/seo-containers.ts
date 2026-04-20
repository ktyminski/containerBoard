import { type Filter } from "mongodb";
import { getContainerShortLabelLocalized } from "@/components/container-listings-i18n";
import {
  buildContainerListingsFilter,
  ensureContainerListingsIndexes,
  expireContainerListingsIfNeeded,
  getContainerListingsCollection,
  mapContainerListingToItem,
  type ContainerListingDocument,
  type ContainerListingItem,
} from "@/lib/container-listings";
import { getCountryNamesForCode } from "@/lib/country-flags";
import { type AppLocale, getMessages } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/seo";
import { SEO_CITIES } from "@/lib/seo-landings";

export const CONTAINER_SALE_SEO_HUB_PATH = "/kontenery/na-sprzedaz";

export type ContainerSeoCity = {
  slug: string;
  name: string;
  lat: number;
  lng: number;
  radiusKm: number;
};

export type ContainerSeoCountry = {
  slug: string;
  name: string;
  countryCode: string;
};

export type ContainerSeoListingsResult = {
  items: ContainerListingItem[];
  total: number;
};

export const CONTAINER_SEO_CITIES: ContainerSeoCity[] = SEO_CITIES.slice(0, 30).map((city) => ({
  slug: city.slug,
  name: city.name,
  lat: city.lat,
  lng: city.lng,
  radiusKm: city.radiusKm,
}));

export const CONTAINER_SEO_COUNTRIES: ContainerSeoCountry[] = [
  { slug: "albania", name: "Albania", countryCode: "AL" },
  { slug: "andora", name: "Andora", countryCode: "AD" },
  { slug: "austria", name: "Austria", countryCode: "AT" },
  { slug: "belgia", name: "Belgia", countryCode: "BE" },
  { slug: "bialorus", name: "Białoruś", countryCode: "BY" },
  { slug: "bosnia-i-hercegowina", name: "Bośnia i Hercegowina", countryCode: "BA" },
  { slug: "bulgaria", name: "Bułgaria", countryCode: "BG" },
  { slug: "chorwacja", name: "Chorwacja", countryCode: "HR" },
  { slug: "czarnogora", name: "Czarnogóra", countryCode: "ME" },
  { slug: "czechy", name: "Czechy", countryCode: "CZ" },
  { slug: "dania", name: "Dania", countryCode: "DK" },
  { slug: "estonia", name: "Estonia", countryCode: "EE" },
  { slug: "finlandia", name: "Finlandia", countryCode: "FI" },
  { slug: "francja", name: "Francja", countryCode: "FR" },
  { slug: "grecja", name: "Grecja", countryCode: "GR" },
  { slug: "hiszpania", name: "Hiszpania", countryCode: "ES" },
  { slug: "holandia", name: "Holandia", countryCode: "NL" },
  { slug: "irlandia", name: "Irlandia", countryCode: "IE" },
  { slug: "islandia", name: "Islandia", countryCode: "IS" },
  { slug: "kosowo", name: "Kosowo", countryCode: "XK" },
  { slug: "liechtenstein", name: "Liechtenstein", countryCode: "LI" },
  { slug: "litwa", name: "Litwa", countryCode: "LT" },
  { slug: "lotwa", name: "Łotwa", countryCode: "LV" },
  { slug: "luksemburg", name: "Luksemburg", countryCode: "LU" },
  { slug: "macedonia-polnocna", name: "Macedonia Północna", countryCode: "MK" },
  { slug: "malta", name: "Malta", countryCode: "MT" },
  { slug: "modlawia", name: "Mołdawia", countryCode: "MD" },
  { slug: "monako", name: "Monako", countryCode: "MC" },
  { slug: "niemcy", name: "Niemcy", countryCode: "DE" },
  { slug: "norwegia", name: "Norwegia", countryCode: "NO" },
  { slug: "polska", name: "Polska", countryCode: "PL" },
  { slug: "portugalia", name: "Portugalia", countryCode: "PT" },
  { slug: "rumunia", name: "Rumunia", countryCode: "RO" },
  { slug: "serbia", name: "Serbia", countryCode: "RS" },
  { slug: "slowacja", name: "Słowacja", countryCode: "SK" },
  { slug: "slowenia", name: "Słowenia", countryCode: "SI" },
  { slug: "szwajcaria", name: "Szwajcaria", countryCode: "CH" },
  { slug: "szwecja", name: "Szwecja", countryCode: "SE" },
  { slug: "turcja", name: "Turcja", countryCode: "TR" },
  { slug: "ukraina", name: "Ukraina", countryCode: "UA" },
  { slug: "weggry", name: "Węgry", countryCode: "HU" },
  { slug: "wielka-brytania", name: "Wielka Brytania", countryCode: "GB" },
  { slug: "wlochy", name: "Włochy", countryCode: "IT" },
];

const CITY_BY_SLUG = new Map(CONTAINER_SEO_CITIES.map((city) => [city.slug, city]));
const COUNTRY_BY_SLUG = new Map(CONTAINER_SEO_COUNTRIES.map((country) => [country.slug, country]));

const SEO_COPY = {
  pl: {
    hubTitle: "Kontenery na sprzedaż",
    hubDescription:
      "Przeglądaj strony SEO dla największych miast w Polsce i krajów Europy, aby szybciej znaleźć kontenery na sprzedaż w konkretnej lokalizacji.",
    hubHeading: "Kontenery na sprzedaż w miastach i krajach Europy",
    hubLead:
      "Wejdź w wybraną lokalizację, zobacz aktywne oferty i przejdź do pełnej listy, aby dalej filtrować wyniki po typie kontenera, cenie i stanie.",
    citiesHeading: "Największe miasta w Polsce",
    countriesHeading: "Kraje Europy",
    cityTitle: (name: string) => `Kontenery na sprzedaż ${name}`,
    cityDescription: (name: string) =>
      `Aktualne oferty kontenerów na sprzedaż w lokalizacji ${name}. Sprawdź dostępne ogłoszenia i przejdź do pełnej listy ofert.`,
    countryTitle: (name: string) => `Kontenery na sprzedaż ${name}`,
    countryDescription: (name: string) =>
      `Aktualne oferty kontenerów na sprzedaż w kraju ${name}. Zobacz dostępne ogłoszenia i przejdź do szczegółów wybranych ofert.`,
    cityHeading: (name: string) => `Kontenery na sprzedaż ${name}`,
    countryHeading: (name: string) => `Kontenery na sprzedaż ${name}`,
    cityLead: (name: string) =>
      `Poniżej znajdziesz najnowsze oferty sprzedaży kontenerów dostępne w obszarze ${name}.`,
    countryLead: (name: string) =>
      `Poniżej znajdziesz aktywne oferty sprzedaży kontenerów dostępne w kraju ${name}.`,
    totalLabel: (total: number) => `${total} aktywnych ofert`,
    browseList: "Przejdź do pełnej listy",
    emptyTitle: "Brak aktywnych ofert w tej lokalizacji",
    emptyText:
      "Ta strona zostaje jako landing pod wyszukiwarkę, ale aktualnie nie ma tu aktywnych ofert. Przejdź do pełnej listy i sprawdź inne lokalizacje.",
    latestHeading: "Najnowsze oferty",
    quantityLabel: "Ilość",
    addedLabel: "Dodano",
    askPrice: "Zapytaj o cenę",
    noIndexReason: "Strona bez aktywnych ofert pozostaje poza indeksem.",
  },
  en: {
    hubTitle: "Containers for sale",
    hubDescription:
      "Browse SEO landing pages for the biggest Polish cities and European countries to find containers for sale in a specific location.",
    hubHeading: "Containers for sale in cities and European countries",
    hubLead:
      "Open a selected location, review active listings, and jump to the full board to keep filtering by container type, price, and condition.",
    citiesHeading: "Largest cities in Poland",
    countriesHeading: "European countries",
    cityTitle: (name: string) => `Containers for sale ${name}`,
    cityDescription: (name: string) =>
      `Current container sale listings in ${name}. Review available offers and open the full listings board for more filters.`,
    countryTitle: (name: string) => `Containers for sale ${name}`,
    countryDescription: (name: string) =>
      `Current container sale listings in ${name}. Review available offers and open the full listings board for more filters.`,
    cityHeading: (name: string) => `Containers for sale ${name}`,
    countryHeading: (name: string) => `Containers for sale ${name}`,
    cityLead: (name: string) =>
      `Below you will find the latest container sale listings available around ${name}.`,
    countryLead: (name: string) =>
      `Below you will find active container sale listings available in ${name}.`,
    totalLabel: (total: number) => `${total} active listings`,
    browseList: "Open full listings board",
    emptyTitle: "No active listings in this location",
    emptyText:
      "This page remains available as a search landing page, but there are currently no active offers here. Open the full listings board and check other locations.",
    latestHeading: "Latest listings",
    quantityLabel: "Quantity",
    addedLabel: "Added",
    askPrice: "Ask for price",
    noIndexReason: "Pages without active listings stay out of the index.",
  },
  de: {
    hubTitle: "Container zum Verkauf",
    hubDescription:
      "Durchsuchen Sie SEO-Landingpages für die größten polnischen Städte und europäische Länder, um Container zum Verkauf nach Standort zu finden.",
    hubHeading: "Container zum Verkauf nach Städten und Ländern Europas",
    hubLead:
      "Wählen Sie einen Standort, prüfen Sie aktive Angebote und wechseln Sie zur vollständigen Liste, um weiter nach Containertyp, Preis und Zustand zu filtern.",
    citiesHeading: "Größte Städte in Polen",
    countriesHeading: "Länder Europas",
    cityTitle: (name: string) => `Container zum Verkauf ${name}`,
    cityDescription: (name: string) =>
      `Aktuelle Container-Angebote zum Verkauf in ${name}. Prüfen Sie verfügbare Einträge und wechseln Sie zur vollständigen Liste für weitere Filter.`,
    countryTitle: (name: string) => `Container zum Verkauf ${name}`,
    countryDescription: (name: string) =>
      `Aktuelle Container-Angebote zum Verkauf in ${name}. Prüfen Sie verfügbare Einträge und wechseln Sie zur vollständigen Liste für weitere Filter.`,
    cityHeading: (name: string) => `Container zum Verkauf ${name}`,
    countryHeading: (name: string) => `Container zum Verkauf ${name}`,
    cityLead: (name: string) =>
      `Unten finden Sie die neuesten Container-Angebote zum Verkauf im Raum ${name}.`,
    countryLead: (name: string) =>
      `Unten finden Sie aktive Container-Angebote zum Verkauf in ${name}.`,
    totalLabel: (total: number) => `${total} aktive Angebote`,
    browseList: "Zur vollständigen Liste",
    emptyTitle: "Keine aktiven Angebote an diesem Standort",
    emptyText:
      "Diese Seite bleibt als SEO-Landingpage verfügbar, derzeit gibt es hier jedoch keine aktiven Angebote. Öffnen Sie die vollständige Liste und prüfen Sie andere Standorte.",
    latestHeading: "Neueste Angebote",
    quantityLabel: "Menge",
    addedLabel: "Hinzugefügt",
    askPrice: "Preis anfragen",
    noIndexReason: "Seiten ohne aktive Angebote bleiben aus dem Index.",
  },
  uk: {
    hubTitle: "Konteinery na prodazh",
    hubDescription:
      "Perehliadaite SEO-storinky dlia naibilshykh mist Polshchi ta krain Yevropy, shchob znakhodyty konteinery na prodazh za lokaciieiu.",
    hubHeading: "Konteinery na prodazh u mistakh ta krainakh Yevropy",
    hubLead:
      "Obyrait lokatsiiu, perehliadaite aktyvni oholoshennia ta perekhodte do povnoho spysku, shchob dodatkovo filtruvaly za typom, tsinoiu ta stanom.",
    citiesHeading: "Naibilshi mista Polshchi",
    countriesHeading: "Krainy Yevropy",
    cityTitle: (name: string) => `Konteinery na prodazh ${name}`,
    cityDescription: (name: string) =>
      `Aktualni oholoshennia pro prodazh konteineriv u ${name}. Perehlian te dostupni propozytsii ta vidkryi povnyi spysok dlia dodatkovoho filtru.`,
    countryTitle: (name: string) => `Konteinery na prodazh ${name}`,
    countryDescription: (name: string) =>
      `Aktualni oholoshennia pro prodazh konteineriv u ${name}. Perehlian te dostupni propozytsii ta vidkryi povnyi spysok dlia dodatkovoho filtru.`,
    cityHeading: (name: string) => `Konteinery na prodazh ${name}`,
    countryHeading: (name: string) => `Konteinery na prodazh ${name}`,
    cityLead: (name: string) =>
      `Nyzhche zibrani ostanni aktyvni propozytsii prodazhu konteineriv u rayoni ${name}.`,
    countryLead: (name: string) =>
      `Nyzhche zibrani aktyvni propozytsii prodazhu konteineriv u kraini ${name}.`,
    totalLabel: (total: number) => `${total} aktyvnykh oholoshen`,
    browseList: "Pereity do povnoho spysku",
    emptyTitle: "U tsii lokatsii nemaie aktyvnykh propozytsii",
    emptyText:
      "Storinka zalyshaetsia yak SEO-landing, ale zaraz tut nemaie aktyvnykh ofert. Pereidit do povnoho spysku ta perevirte inshi lokatsii.",
    latestHeading: "Ostanni propozytsii",
    quantityLabel: "Kilkyist",
    addedLabel: "Dodano",
    askPrice: "Zapytaty tsinu",
    noIndexReason: "Storinky bez aktyvnykh propozytsii ne indeksuiutsia.",
  },
} as const;

function getSeoCopy(locale: AppLocale) {
  return SEO_COPY[locale];
}

function buildCityPath(citySlug: string) {
  return `${CONTAINER_SALE_SEO_HUB_PATH}/miasta/${citySlug}`;
}

function buildCountryPath(countrySlug: string) {
  return `${CONTAINER_SALE_SEO_HUB_PATH}/kraje/${countrySlug}`;
}

function appendAndCondition(
  filter: Filter<ContainerListingDocument>,
  condition: Filter<ContainerListingDocument>,
): Filter<ContainerListingDocument> {
  const existingAnd = Array.isArray(filter.$and) ? filter.$and : [];
  return {
    ...filter,
    $and: [...existingAnd, condition],
  };
}

function buildCountrySeoFilter(country: ContainerSeoCountry, now: Date) {
  const baseFilter = buildContainerListingsFilter({
    type: "sell",
    includeOnlyPublic: true,
    now,
    countryCode: country.countryCode,
  }) as Filter<ContainerListingDocument>;

  const countryNames = getCountryNamesForCode(country.countryCode);
  if (countryNames.length === 0) {
    return baseFilter;
  }

  const legacyCountryConditions = countryNames.map(
    (name) =>
      ({
        $or: [
          { locationCountry: new RegExp(`^${escapeRegex(name)}$`, "i") },
          { "locations.locationCountry": new RegExp(`^${escapeRegex(name)}$`, "i") },
        ],
      }) as Filter<ContainerListingDocument>,
  );

  return appendAndCondition(baseFilter, {
    $or: [
      { locationCountryCode: country.countryCode } as Filter<ContainerListingDocument>,
      { "locations.locationCountryCode": country.countryCode } as Filter<ContainerListingDocument>,
      ...legacyCountryConditions,
    ],
  } as Filter<ContainerListingDocument>);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function getContainerSeoCityBySlug(slug: string) {
  return CITY_BY_SLUG.get(slug);
}

export function getContainerSeoCountryBySlug(slug: string) {
  return COUNTRY_BY_SLUG.get(slug);
}

export function getContainerSaleSeoHubMetadata(locale: AppLocale) {
  const copy = getSeoCopy(locale);
  return buildPageMetadata({
    path: CONTAINER_SALE_SEO_HUB_PATH,
    locale,
    title: copy.hubTitle,
    description: copy.hubDescription,
  });
}

export function getContainerSaleCityMetadata(input: {
  locale: AppLocale;
  city: ContainerSeoCity;
  hasResults: boolean;
}) {
  const copy = getSeoCopy(input.locale);
  return {
    ...buildPageMetadata({
      path: buildCityPath(input.city.slug),
      locale: input.locale,
      title: copy.cityTitle(input.city.name),
      description: copy.cityDescription(input.city.name),
    }),
    robots: input.hasResults ? undefined : { index: false, follow: true },
  };
}

export function getContainerSaleCountryMetadata(input: {
  locale: AppLocale;
  country: ContainerSeoCountry;
  hasResults: boolean;
}) {
  const copy = getSeoCopy(input.locale);
  return {
    ...buildPageMetadata({
      path: buildCountryPath(input.country.slug),
      locale: input.locale,
      title: copy.countryTitle(input.country.name),
      description: copy.countryDescription(input.country.name),
    }),
    robots: input.hasResults ? undefined : { index: false, follow: true },
  };
}

export async function getSeoContainerListingsByCity(
  city: ContainerSeoCity,
  limit = 12,
): Promise<ContainerSeoListingsResult> {
  await ensureContainerListingsIndexes();
  await expireContainerListingsIfNeeded();

  const now = new Date();
  const listings = await getContainerListingsCollection();
  const filter = buildContainerListingsFilter({
    type: "sell",
    includeOnlyPublic: true,
    now,
    locationLat: city.lat,
    locationLng: city.lng,
    radiusKm: city.radiusKm,
  });

  const [rows, total] = await Promise.all([
    listings.find(filter).sort({ createdAt: -1 }).limit(limit).toArray(),
    listings.countDocuments(filter),
  ]);

  return {
    items: rows.map(mapContainerListingToItem),
    total,
  };
}

export async function getSeoContainerListingsByCountry(
  country: ContainerSeoCountry,
  limit = 12,
): Promise<ContainerSeoListingsResult> {
  await ensureContainerListingsIndexes();
  await expireContainerListingsIfNeeded();

  const now = new Date();
  const listings = await getContainerListingsCollection();
  const filter = buildCountrySeoFilter(country, now);

  const [rows, total] = await Promise.all([
    listings.find(filter).sort({ createdAt: -1 }).limit(limit).toArray(),
    listings.countDocuments(filter),
  ]);

  return {
    items: rows.map(mapContainerListingToItem),
    total,
  };
}

export async function getSeoContainerCityCount(city: ContainerSeoCity): Promise<number> {
  const result = await getSeoContainerListingsByCity(city, 1);
  return result.total;
}

export async function getSeoContainerCountryCount(country: ContainerSeoCountry): Promise<number> {
  const result = await getSeoContainerListingsByCountry(country, 1);
  return result.total;
}

export function getContainerSaleSeoHubCopy(locale: AppLocale) {
  return getSeoCopy(locale);
}

export function getContainerSaleCityPath(citySlug: string) {
  return buildCityPath(citySlug);
}

export function getContainerSaleCountryPath(countrySlug: string) {
  return buildCountryPath(countrySlug);
}

export function getContainerSeoListingSummary(
  item: ContainerListingItem,
  locale: AppLocale,
): { title: string; price: string | null } {
  const listingMessages = getMessages(locale).containerListings;
  const title = getContainerShortLabelLocalized(listingMessages, item.container);
  const price =
    typeof item.pricing?.original.amount === "number" && item.pricing.original.currency
      ? `${Math.round(item.pricing.original.amount).toLocaleString(locale)} ${item.pricing.original.currency}`
      : typeof item.priceAmount === "number"
        ? `${Math.round(item.priceAmount).toLocaleString(locale)} PLN`
        : null;

  return { title, price };
}

export function getContainerSeoIndexable(total: number) {
  return total >= 3;
}
