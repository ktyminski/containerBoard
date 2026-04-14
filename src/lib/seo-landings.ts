import type { Filter } from "mongodb";
import type { CompanyDocument } from "@/lib/companies";

type SearchBbox = [number, number, number, number];

export type SeoCity = {
  slug: string;
  name: string;
  lat: number;
  lng: number;
  radiusKm: number;
};

export const SEO_CITIES: SeoCity[] = [
  { slug: "warszawa", name: "Warszawa", lat: 52.2297, lng: 21.0122, radiusKm: 35 },
  { slug: "krakow", name: "Kraków", lat: 50.0647, lng: 19.945, radiusKm: 30 },
  { slug: "lodz", name: "Łódź", lat: 51.7592, lng: 19.455, radiusKm: 30 },
  { slug: "wroclaw", name: "Wrocław", lat: 51.1079, lng: 17.0385, radiusKm: 30 },
  { slug: "poznan", name: "Poznań", lat: 52.4064, lng: 16.9252, radiusKm: 30 },
  { slug: "gdansk", name: "Gdańsk", lat: 54.352, lng: 18.6466, radiusKm: 30 },
  { slug: "szczecin", name: "Szczecin", lat: 53.4285, lng: 14.5528, radiusKm: 25 },
  { slug: "bydgoszcz", name: "Bydgoszcz", lat: 53.1235, lng: 18.0084, radiusKm: 25 },
  { slug: "lublin", name: "Lublin", lat: 51.2465, lng: 22.5684, radiusKm: 25 },
  { slug: "bialystok", name: "Białystok", lat: 53.1325, lng: 23.1688, radiusKm: 25 },
  { slug: "katowice", name: "Katowice", lat: 50.2649, lng: 19.0238, radiusKm: 30 },
  { slug: "gdynia", name: "Gdynia", lat: 54.5189, lng: 18.5305, radiusKm: 25 },
  { slug: "czestochowa", name: "Częstochowa", lat: 50.8118, lng: 19.1203, radiusKm: 20 },
  { slug: "radom", name: "Radom", lat: 51.4027, lng: 21.1471, radiusKm: 20 },
  { slug: "sosnowiec", name: "Sosnowiec", lat: 50.2863, lng: 19.1041, radiusKm: 20 },
  { slug: "torun", name: "Toruń", lat: 53.0138, lng: 18.5984, radiusKm: 20 },
  { slug: "kielce", name: "Kielce", lat: 50.8661, lng: 20.6286, radiusKm: 20 },
  { slug: "rzeszow", name: "Rzeszów", lat: 50.0413, lng: 21.999, radiusKm: 20 },
  { slug: "gliwice", name: "Gliwice", lat: 50.2945, lng: 18.6714, radiusKm: 20 },
  { slug: "zabrze", name: "Zabrze", lat: 50.3249, lng: 18.7857, radiusKm: 20 },
  { slug: "bytom", name: "Bytom", lat: 50.3484, lng: 18.9328, radiusKm: 20 },
  { slug: "olsztyn", name: "Olsztyn", lat: 53.7784, lng: 20.4801, radiusKm: 20 },
  { slug: "bielsko-biala", name: "Bielsko-Biała", lat: 49.8224, lng: 19.0469, radiusKm: 20 },
  { slug: "zielona-gora", name: "Zielona Góra", lat: 51.9355, lng: 15.5062, radiusKm: 20 },
  { slug: "rybnik", name: "Rybnik", lat: 50.1022, lng: 18.5463, radiusKm: 20 },
  { slug: "ruda-slaska", name: "Ruda Śląska", lat: 50.2558, lng: 18.8556, radiusKm: 20 },
  { slug: "tychy", name: "Tychy", lat: 50.1372, lng: 18.9664, radiusKm: 20 },
  {
    slug: "gorzow-wielkopolski",
    name: "Gorzów Wielkopolski",
    lat: 52.7368,
    lng: 15.2288,
    radiusKm: 20,
  },
  {
    slug: "dabrowa-gornicza",
    name: "Dąbrowa Górnicza",
    lat: 50.3217,
    lng: 19.1949,
    radiusKm: 20,
  },
  { slug: "plock", name: "Płock", lat: 52.5468, lng: 19.7064, radiusKm: 20 },
  { slug: "elblag", name: "Elbląg", lat: 54.1522, lng: 19.4045, radiusKm: 20 },
  { slug: "opole", name: "Opole", lat: 50.6751, lng: 17.9213, radiusKm: 20 },
  { slug: "walbrzych", name: "Wałbrzych", lat: 50.7714, lng: 16.2843, radiusKm: 20 },
  { slug: "wloclawek", name: "Włocławek", lat: 52.6482, lng: 19.0678, radiusKm: 20 },
  { slug: "tarnow", name: "Tarnów", lat: 50.0121, lng: 20.9858, radiusKm: 20 },
  { slug: "chorzow", name: "Chorzów", lat: 50.2976, lng: 18.9543, radiusKm: 20 },
  { slug: "koszalin", name: "Koszalin", lat: 54.1944, lng: 16.1722, radiusKm: 20 },
  { slug: "kalisz", name: "Kalisz", lat: 51.7611, lng: 18.091, radiusKm: 20 },
  { slug: "legnica", name: "Legnica", lat: 51.207, lng: 16.1551, radiusKm: 20 },
  { slug: "grudziadz", name: "Grudziądz", lat: 53.4841, lng: 18.7537, radiusKm: 20 },
  { slug: "slupsk", name: "Słupsk", lat: 54.4641, lng: 17.0287, radiusKm: 20 },
  { slug: "jaworzno", name: "Jaworzno", lat: 50.2056, lng: 19.274, radiusKm: 20 },
  {
    slug: "jastrzebie-zdroj",
    name: "Jastrzębie-Zdrój",
    lat: 49.9554,
    lng: 18.6006,
    radiusKm: 20,
  },
  { slug: "nowy-sacz", name: "Nowy Sącz", lat: 49.624, lng: 20.697, radiusKm: 20 },
  {
    slug: "jelenia-gora",
    name: "Jelenia Góra",
    lat: 50.9044,
    lng: 15.7192,
    radiusKm: 20,
  },
  { slug: "siedlce", name: "Siedlce", lat: 52.1677, lng: 22.2901, radiusKm: 20 },
  { slug: "konin", name: "Konin", lat: 52.223, lng: 18.2511, radiusKm: 20 },
  { slug: "pila", name: "Piła", lat: 53.1517, lng: 16.738, radiusKm: 20 },
  {
    slug: "piotrkow-trybunalski",
    name: "Piotrków Trybunalski",
    lat: 51.4052,
    lng: 19.703,
    radiusKm: 20,
  },
  {
    slug: "ostrow-wielkopolski",
    name: "Ostrów Wielkopolski",
    lat: 51.655,
    lng: 17.8066,
    radiusKm: 20,
  },
];

type SeoSector = {
  slug: string;
  name: string;
  companyKeywords?: string[];
};

export const SEO_SECTORS: SeoSector[] = [
  {
    slug: "spedycja",
    name: "Spedycja",
    companyKeywords: ["spedy", "spedyt", "freight", "forward"],
  },
  { slug: "transport", name: "Transport" },
  { slug: "logistyka", name: "Logistyka" },
];

const CITY_BY_SLUG = new Map(SEO_CITIES.map((city) => [city.slug, city]));
const SECTOR_BY_SLUG = new Map(SEO_SECTORS.map((sector) => [sector.slug, sector]));

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildKeywordRegex(keywords: string[]): RegExp {
  const cleaned = keywords
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .map((item) => escapeRegex(item));
  return new RegExp(cleaned.join("|"), "i");
}

function toBboxFromRadius(input: {
  lat: number;
  lng: number;
  radiusKm: number;
}): SearchBbox {
  const latDelta = input.radiusKm / 110.574;
  const cosLat = Math.cos((input.lat * Math.PI) / 180);
  const lngDelta = input.radiusKm / (111.32 * Math.max(0.1, Math.abs(cosLat)));

  const minLng = Math.max(-180, input.lng - lngDelta);
  const maxLng = Math.min(180, input.lng + lngDelta);
  const minLat = Math.max(-90, input.lat - latDelta);
  const maxLat = Math.min(90, input.lat + latDelta);

  return [minLng, minLat, maxLng, maxLat];
}

function toGeoWithinPolygon(bbox: SearchBbox) {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  return {
    $geoWithin: {
      $geometry: {
        type: "Polygon",
        coordinates: [
          [
            [minLng, minLat],
            [maxLng, minLat],
            [maxLng, maxLat],
            [minLng, maxLat],
            [minLng, minLat],
          ],
        ],
      },
    },
  };
}

export function getSeoCityBySlug(slug: string): SeoCity | undefined {
  return CITY_BY_SLUG.get(slug);
}

export function getSeoSectorBySlug(slug: string): SeoSector | undefined {
  return SECTOR_BY_SLUG.get(slug);
}

export function getCityBbox(city: SeoCity): SearchBbox {
  return toBboxFromRadius({
    lat: city.lat,
    lng: city.lng,
    radiusKm: city.radiusKm,
  });
}

export function buildSeoMapsHref(input: {
  view: "companies";
  city: SeoCity;
  keyword?: string;
}): string {
  void input.view;
  const keyword = [input.keyword?.trim(), input.city.name].filter(Boolean).join(" ").trim();
  if (!keyword) {
    return "/list";
  }

  const search = new URLSearchParams();
  search.set("q", keyword);
  return `/list?${search.toString()}`;
}

export function buildCompaniesLandingFilter(input: {
  city: SeoCity;
  sectorSlug?: string;
}): Filter<CompanyDocument> {
  const bbox = getCityBbox(input.city);
  const clauses: Array<Record<string, unknown>> = [
    { isBlocked: { $ne: true } },
    {
      locations: {
        $elemMatch: {
          point: toGeoWithinPolygon(bbox),
        },
      },
    },
  ];

  if (input.sectorSlug) {
    const sector = getSeoSectorBySlug(input.sectorSlug);
    if (sector?.companyKeywords && sector.companyKeywords.length > 0) {
      const regex = buildKeywordRegex(sector.companyKeywords);
      clauses.push({
        $or: [{ name: regex }, { description: regex }, { tags: regex }, { services: regex }],
      });
    }
  }

  if (clauses.length === 1) {
    return clauses[0] as Filter<CompanyDocument>;
  }

  return { $and: clauses } as Filter<CompanyDocument>;
}

