import type { MetadataRoute } from "next";
import { getContainerListingsCollection } from "@/lib/container-listings";
import { LISTING_STATUS } from "@/lib/container-listing-types";
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
import { getAbsoluteUrl, getLanguageAlternates } from "@/lib/seo";

const STATIC_PATHS = [
  "/",
  "/list",
  "/containers/new",
  "/about",
  "/contact",
  "/privacy-policy",
  "/terms",
  "/cookies",
] as const;

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

  const listingEntries: MetadataRoute.Sitemap = listingRows
    .filter((row) => row._id)
    .map((row) => {
      const path = `/containers/${row._id.toHexString()}`;
      return {
        url: getAbsoluteUrl(path),
        lastModified: row.updatedAt ?? row.createdAt ?? now,
        changeFrequency: "daily",
        priority: 0.8,
        alternates: {
          languages: getLanguageAlternates(path),
        },
      };
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
    .map(({ city }) => {
      const path = getContainerSaleCityPath(city.slug);
      return {
        url: getAbsoluteUrl(path),
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.8,
        alternates: {
          languages: getLanguageAlternates(path),
        },
      };
    });

  const countryEntries: MetadataRoute.Sitemap = countryCounts
    .filter((entry) => entry.total >= 3)
    .map(({ country }) => {
      const path = getContainerSaleCountryPath(country.slug);
      return {
        url: getAbsoluteUrl(path),
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.8,
        alternates: {
          languages: getLanguageAlternates(path),
        },
      };
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
    .map((entry) => ({
      url: getAbsoluteUrl(entry.path),
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.8,
      alternates: {
        languages: getLanguageAlternates(entry.path),
      },
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
    .map(({ city }) => {
      const path = getContainerSeoCityPath(city.slug, "rent");
      return {
        url: getAbsoluteUrl(path),
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.8,
        alternates: {
          languages: getLanguageAlternates(path),
        },
      };
    });

  const rentCountryEntries: MetadataRoute.Sitemap = rentCountryCounts
    .filter((entry) => entry.total >= 3)
    .map(({ country }) => {
      const path = getContainerSeoCountryPath(country.slug, "rent");
      return {
        url: getAbsoluteUrl(path),
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.8,
        alternates: {
          languages: getLanguageAlternates(path),
        },
      };
    });

  const buyCityEntries: MetadataRoute.Sitemap = buyCityCounts
    .filter((entry) => entry.total >= 3)
    .map(({ city }) => {
      const path = getContainerSeoCityPath(city.slug, "buy");
      return {
        url: getAbsoluteUrl(path),
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.8,
        alternates: {
          languages: getLanguageAlternates(path),
        },
      };
    });

  const buyCountryEntries: MetadataRoute.Sitemap = buyCountryCounts
    .filter((entry) => entry.total >= 3)
    .map(({ country }) => {
      const path = getContainerSeoCountryPath(country.slug, "buy");
      return {
        url: getAbsoluteUrl(path),
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.8,
        alternates: {
          languages: getLanguageAlternates(path),
        },
      };
    });

  return [
    ...staticEntries,
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
