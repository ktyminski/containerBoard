import type { MetadataRoute } from "next";
import { getContainerListingsCollection } from "@/lib/container-listings";
import { LISTING_STATUS } from "@/lib/container-listing-types";
import {
  CONTAINER_SALE_SEO_HUB_PATH,
  CONTAINER_SEO_CITIES,
  CONTAINER_SEO_COUNTRIES,
  getContainerSaleCountryPath,
  getContainerSaleCityPath,
  getSeoContainerCityCount,
  getSeoContainerCountryCount,
} from "@/lib/seo-containers";
import { getAbsoluteUrl, getLanguageAlternates } from "@/lib/seo";

const STATIC_PATHS = [
  "/",
  "/list",
  CONTAINER_SALE_SEO_HUB_PATH,
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

  return [...staticEntries, ...listingEntries, ...cityEntries, ...countryEntries];
}
