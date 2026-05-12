import type { MetadataRoute } from "next";
import { getContainerListingsCollection } from "@/lib/container-listings";
import { LISTING_STATUS } from "@/lib/container-listing-types";
import { SUPPORTED_LOCALES, withLocalePrefix } from "@/lib/i18n";
import {
  CONTAINER_BUY_SEO_HUB_PATH,
  CONTAINER_RENT_SEO_HUB_PATH,
  CONTAINER_SALE_SEO_HUB_PATH,
  CONTAINER_SEO_CITIES,
  CONTAINER_SEO_COUNTRIES,
  getContainerSeoCountryPath,
  getContainerSeoCityPath,
  getSeoContainerKindCityCount,
  getSeoContainerKindCountryCount,
  getSeoContainerKindTotalCount,
  getContainerSaleCountryPath,
  getContainerSaleCityPath,
  getSeoContainerCityCount,
  getSeoContainerCountryCount,
} from "@/lib/seo-containers";
import { SEO_CITIES } from "@/lib/seo-landings";
import { getAbsoluteUrl, getLanguageAlternates } from "@/lib/seo";

const STATIC_PATHS = [
  "/",
  "/list",
  "/about",
  "/contact",
  "/privacy-policy",
  "/terms",
  "/cookies",
] as const;

function getLocalizedSitemapEntries(input: {
  path: string;
  lastModified: Date;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}): MetadataRoute.Sitemap {
  const languages = getLanguageAlternates(input.path, { localePrefix: true });
  return SUPPORTED_LOCALES.map((locale) => ({
    url: getAbsoluteUrl(withLocalePrefix(input.path, locale)),
    lastModified: input.lastModified,
    changeFrequency: input.changeFrequency,
    priority: input.priority,
    alternates: {
      languages,
    },
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const listings = await getContainerListingsCollection();
  const listingRows = await listings
    .find(
      {
        status: LISTING_STATUS.ACTIVE,
        expiresAt: { $gt: now },
      },
      {
        projection: {
          _id: 1,
          updatedAt: 1,
          createdAt: 1,
        },
      },
    )
    .toArray();

  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: getAbsoluteUrl(path),
    lastModified: now,
    changeFrequency: path === "/" || path === "/list" ? "daily" : "weekly",
    priority: path === "/" || path === "/list" ? 1 : 0.7,
    alternates: {
      languages: getLanguageAlternates(path),
    },
  }));

  const transportCompanyEntries: MetadataRoute.Sitemap = [
    ...getLocalizedSitemapEntries({
      path: "/transport-companies",
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    }),
    ...SEO_CITIES.slice(0, 30).flatMap((city) =>
      getLocalizedSitemapEntries({
        path: `/transport-companies/${city.slug}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.7,
      }),
    ),
  ];

  const listingEntries: MetadataRoute.Sitemap = listingRows
    .filter((row) => row._id)
    .flatMap((row) => {
      const path = `/containers/${row._id.toHexString()}`;
      return getLocalizedSitemapEntries({
        path,
        lastModified: row.updatedAt ?? row.createdAt ?? now,
        changeFrequency: "daily",
        priority: 0.8,
      });
    });

  const [cityCounts, countryCounts] = await Promise.all([
    Promise.all(
      CONTAINER_SEO_CITIES.map(async (city) => ({
        city,
        total: await getSeoContainerCityCount(city),
      })),
    ),
    Promise.all(
      CONTAINER_SEO_COUNTRIES.map(async (country) => ({
        country,
        total: await getSeoContainerCountryCount(country),
      })),
    ),
  ]);

  const cityEntries: MetadataRoute.Sitemap = cityCounts
    .filter((entry) => entry.total >= 3)
    .flatMap(({ city }) => {
      const path = getContainerSaleCityPath(city.slug);
      return getLocalizedSitemapEntries({
        path,
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.8,
      });
    });

  const countryEntries: MetadataRoute.Sitemap = countryCounts
    .filter((entry) => entry.total >= 3)
    .flatMap(({ country }) => {
      const path = getContainerSaleCountryPath(country.slug);
      return getLocalizedSitemapEntries({
        path,
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.8,
      });
    });

  const [saleHubTotal, rentHubTotal, buyHubTotal] = await Promise.all([
    getSeoContainerKindTotalCount("sell"),
    getSeoContainerKindTotalCount("rent"),
    getSeoContainerKindTotalCount("buy"),
  ]);

  const hubEntries: MetadataRoute.Sitemap = [
    { path: CONTAINER_SALE_SEO_HUB_PATH, total: saleHubTotal },
    { path: CONTAINER_RENT_SEO_HUB_PATH, total: rentHubTotal },
    { path: CONTAINER_BUY_SEO_HUB_PATH, total: buyHubTotal },
  ]
    .filter((entry) => entry.total >= 3)
    .flatMap((entry) => getLocalizedSitemapEntries({
      path: entry.path,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    }));

  const [rentCityCounts, rentCountryCounts, buyCityCounts, buyCountryCounts] = await Promise.all([
    Promise.all(
      CONTAINER_SEO_CITIES.map(async (city) => ({
        city,
        total: await getSeoContainerKindCityCount("rent", city),
      })),
    ),
    Promise.all(
      CONTAINER_SEO_COUNTRIES.map(async (country) => ({
        country,
        total: await getSeoContainerKindCountryCount("rent", country),
      })),
    ),
    Promise.all(
      CONTAINER_SEO_CITIES.map(async (city) => ({
        city,
        total: await getSeoContainerKindCityCount("buy", city),
      })),
    ),
    Promise.all(
      CONTAINER_SEO_COUNTRIES.map(async (country) => ({
        country,
        total: await getSeoContainerKindCountryCount("buy", country),
      })),
    ),
  ]);

  const rentCityEntries: MetadataRoute.Sitemap = rentCityCounts
    .filter((entry) => entry.total >= 3)
    .flatMap(({ city }) => {
      const path = getContainerSeoCityPath(city.slug, "rent");
      return getLocalizedSitemapEntries({
        path,
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.8,
      });
    });

  const rentCountryEntries: MetadataRoute.Sitemap = rentCountryCounts
    .filter((entry) => entry.total >= 3)
    .flatMap(({ country }) => {
      const path = getContainerSeoCountryPath(country.slug, "rent");
      return getLocalizedSitemapEntries({
        path,
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.8,
      });
    });

  const buyCityEntries: MetadataRoute.Sitemap = buyCityCounts
    .filter((entry) => entry.total >= 3)
    .flatMap(({ city }) => {
      const path = getContainerSeoCityPath(city.slug, "buy");
      return getLocalizedSitemapEntries({
        path,
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.8,
      });
    });

  const buyCountryEntries: MetadataRoute.Sitemap = buyCountryCounts
    .filter((entry) => entry.total >= 3)
    .flatMap(({ country }) => {
      const path = getContainerSeoCountryPath(country.slug, "buy");
      return getLocalizedSitemapEntries({
        path,
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.8,
      });
    });

  return [
    ...staticEntries,
    ...transportCompanyEntries,
    ...hubEntries,
    ...listingEntries,
    ...cityEntries,
    ...countryEntries,
    ...rentCityEntries,
    ...rentCountryEntries,
    ...buyCityEntries,
    ...buyCountryEntries,
  ];
}
