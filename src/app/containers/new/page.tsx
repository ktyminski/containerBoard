import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NewContainerPageClient } from "@/components/new-container-page-client";
import { SESSION_COOKIE_NAME } from "@/lib/auth-session";
import { getCurrentUserFromToken } from "@/lib/auth-user";
import { getCompaniesCollection } from "@/lib/companies";
import { buildShortAddressLabelFromParts } from "@/lib/geocode-address";
import {
  getLocaleFromRequest,
  getMessages,
  LOCALE_COOKIE_NAME,
} from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Dodaj kontener | ContainerBoard",
  description: "Dodaj nowe ogłoszenie kontenera w mniej niż minutę.",
};

type NewContainerPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewContainerPage({
  searchParams,
}: NewContainerPageProps) {
  const params = await searchParams;
  const intentParam = Array.isArray(params.intent)
    ? params.intent[0]
    : params.intent;
  const initialListingIntent =
    intentParam === "sell" || intentParam === "rent" || intentParam === "buy"
      ? intentParam
      : undefined;
  const nextPath = initialListingIntent
    ? `/containers/new?intent=${initialListingIntent}`
    : "/containers/new";

  const cookieStore = await cookies();
  const locale = getLocaleFromRequest({
    params,
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
  });
  const messages = getMessages(locale);
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  const user = await getCurrentUserFromToken(token);
  if (!user?._id) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  const companies = await getCompaniesCollection();
  const ownedCompany = await companies.findOne(
    { createdByUserId: user._id },
    {
      projection: {
        _id: 1,
        name: 1,
        slug: 1,
        email: 1,
        phone: 1,
        "locations.label": 1,
        "locations.point": 1,
        "locations.addressText": 1,
        "locations.addressParts": 1,
      },
      sort: { updatedAt: -1 },
    },
  );
  const companyLocationPrefillOptions = (ownedCompany?.locations ?? [])
    .map((location, index) => {
      const coordinates = location?.point?.coordinates;
      const hasValidCoordinates =
        Array.isArray(coordinates) &&
        coordinates.length === 2 &&
        typeof coordinates[0] === "number" &&
        Number.isFinite(coordinates[0]) &&
        typeof coordinates[1] === "number" &&
        Number.isFinite(coordinates[1]);
      if (!hasValidCoordinates) {
        return null;
      }

      const shortAddress = buildShortAddressLabelFromParts({
        parts: location?.addressParts,
        fallbackLabel: location?.addressText,
      });
      return {
        id: `company-location-${index + 1}`,
        name:
          location?.label?.trim() ||
          shortAddress ||
          `Lokalizacja ${index + 1}`,
        locationLng: coordinates[0],
        locationLat: coordinates[1],
        locationAddressLabel: shortAddress || location?.addressText?.trim(),
        locationAddressParts: location?.addressParts ?? null,
      };
    })
    .filter((location) => location !== null);

  const contactPrefill = {
    companyName:
      ownedCompany?.name?.trim() ||
      user.name?.trim() ||
      "",
    contactEmail:
      ownedCompany?.email?.trim() ||
      user.email?.trim() ||
      "",
    contactPhone:
      ownedCompany?.phone?.trim() ||
      user.phone?.trim() ||
      "",
  };

  return (
    <NewContainerPageClient
      locale={locale}
      messages={messages.containerModules}
      listingMessages={messages.containerListings}
      contactPrefill={contactPrefill}
      initialListingIntent={initialListingIntent}
      ownedCompanyProfile={
        ownedCompany
          ? {
              name: ownedCompany.name,
              slug: ownedCompany.slug,
            }
          : null
      }
      companyLocationPrefillOptions={companyLocationPrefillOptions}
    />
  );
}
