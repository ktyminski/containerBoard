import type { Metadata } from "next";
import { ObjectId } from "mongodb";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ContainerListingForm } from "@/components/container-listing-form";
import { SmartBackButton } from "@/components/smart-back-button";
import { SESSION_COOKIE_NAME } from "@/lib/auth-session";
import { getCurrentUserFromToken } from "@/lib/auth-user";
import { getCompaniesCollection } from "@/lib/companies";
import {
  ensureContainerListingsIndexes,
  getContainerListingsCollection,
  mapContainerListingToItem,
} from "@/lib/container-listings";
import type { ListingType } from "@/lib/container-listing-types";
import { buildShortAddressLabelFromParts } from "@/lib/geocode-address";
import { USER_ROLE } from "@/lib/user-roles";

const LISTING_TYPE_LABEL: Record<ListingType, string> = {
  sell: "Sprzedaz",
  rent: "Wynajem",
  buy: "Chce zakupic",
};

type EditContainerPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: EditContainerPageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Edytuj kontener ${id} | ContainerBoard`,
  };
}

export default async function EditContainerPage({ params }: EditContainerPageProps) {
  await ensureContainerListingsIndexes();

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    notFound();
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    redirect(`/login?next=/containers/${id}/edit`);
  }

  const currentUser = await getCurrentUserFromToken(token);
  if (!currentUser?._id) {
    redirect(`/login?next=/containers/${id}/edit`);
  }

  const listings = await getContainerListingsCollection();
  const listing = await listings.findOne({ _id: new ObjectId(id) });
  if (!listing?._id) {
    notFound();
  }
  const listingItem = mapContainerListingToItem(listing);

  const canEdit =
    currentUser.role === USER_ROLE.ADMIN ||
    currentUser._id.toHexString() === listing.createdByUserId.toHexString();

  if (!canEdit) {
    redirect(`/containers/${id}`);
  }
  const companies = await getCompaniesCollection();
  const ownedCompany = await companies.findOne(
    { createdByUserId: listing.createdByUserId },
    {
      projection: {
        name: 1,
        slug: 1,
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

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <SmartBackButton
        label="Wroc"
        fallbackHref={`/containers/${listing._id.toHexString()}`}
        className="mb-4 inline-flex w-fit items-center gap-2 rounded-md border border-neutral-400 bg-white px-3 py-2 text-sm text-neutral-700 transition-colors hover:border-neutral-500"
      />

      <header className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold text-neutral-100">Edytuj kontener</h1>
        <span className="inline-flex h-8 items-center rounded-md border border-neutral-700 bg-neutral-950 px-3 text-sm text-neutral-100">
          {LISTING_TYPE_LABEL[listingItem.type]}
        </span>
      </header>

      <ContainerListingForm
        mode="edit"
        submitEndpoint={`/api/containers/${listing._id.toHexString()}`}
        submitMethod="PATCH"
        submitLabel="Zapisz zmiany"
        successMessage="Kontener zaktualizowany"
        backHref={`/containers/${listing._id.toHexString()}`}
        backLabel="Powrot do szczegolow"
        ownedCompanyProfile={
          ownedCompany
            ? {
                name: ownedCompany.name,
                slug: ownedCompany.slug,
              }
            : null
        }
        initialPhotoUrls={listingItem.photoUrls}
        initialAdditionalLocations={(listingItem.locations ?? [])
          .slice(1)
          .map((location) => ({
            locationLat: location.locationLat,
            locationLng: location.locationLng,
            locationAddressLabel: location.locationAddressLabel,
            locationAddressParts: location.locationAddressParts,
          }))}
        companyLocationPrefillOptions={companyLocationPrefillOptions}
        initialValues={{
          type: listingItem.type,
          containerSize: listingItem.container.size,
          containerHeight: listingItem.container.height,
          containerType: listingItem.container.type,
          containerFeatures: listingItem.container.features,
          containerCondition: listingItem.container.condition,
          containerColorsRal:
            listingItem.containerColors?.map((color) => color.ral).join(", ") ?? "",
          hasCscPlate: listingItem.hasCscPlate,
          hasCscCertification: listingItem.hasCscCertification,
          hasWarranty: listingItem.hasWarranty,
          cscValidToMonth:
            typeof listingItem.cscValidToMonth === "number"
              ? String(listingItem.cscValidToMonth)
              : "",
          cscValidToYear:
            typeof listingItem.cscValidToYear === "number"
              ? String(listingItem.cscValidToYear)
              : "",
          productionYear:
            typeof listingItem.productionYear === "number"
              ? String(listingItem.productionYear)
              : "",
          quantity: listingItem.quantity,
          locationLat:
            typeof listingItem.locationLat === "number"
              ? listingItem.locationLat.toFixed(6)
              : "",
          locationLng:
            typeof listingItem.locationLng === "number"
              ? listingItem.locationLng.toFixed(6)
              : "",
          locationAddressLabel: listingItem.locationAddressLabel ?? "",
          locationStreet: listingItem.locationAddressParts?.street ?? "",
          locationHouseNumber: listingItem.locationAddressParts?.houseNumber ?? "",
          locationPostalCode: listingItem.locationAddressParts?.postalCode ?? "",
          locationAddressCity: listingItem.locationAddressParts?.city ?? listingItem.locationCity,
          locationAddressCountry: listingItem.locationAddressParts?.country ?? listingItem.locationCountry,
          availableNow: listingItem.availableNow,
          availableFromApproximate: listingItem.availableFromApproximate,
          availableFrom: listingItem.availableFrom.slice(0, 10),
          logisticsTransportAvailable: listingItem.logisticsTransportAvailable,
          logisticsTransportIncluded: listingItem.logisticsTransportIncluded,
          logisticsTransportFreeDistanceKm:
            typeof listingItem.logisticsTransportFreeDistanceKm === "number"
              ? String(listingItem.logisticsTransportFreeDistanceKm)
              : "",
          logisticsUnloadingAvailable: listingItem.logisticsUnloadingAvailable,
          logisticsUnloadingIncluded: listingItem.logisticsUnloadingIncluded,
          logisticsComment: listingItem.logisticsComment ?? "",
          priceValueAmount:
            typeof listingItem.pricing?.original.amount === "number"
              ? String(Math.round(listingItem.pricing.original.amount))
              : typeof listingItem.priceAmount === "number"
                ? String(Math.round(listingItem.priceAmount))
                : "",
          priceCurrency: listingItem.pricing?.original.currency ?? "PLN",
          priceTaxMode: listingItem.pricing?.original.taxMode ?? "net",
          priceVatRate:
            typeof listingItem.pricing?.original.vatRate === "number"
              ? String(listingItem.pricing.original.vatRate)
              : "",
          priceNegotiable: listingItem.priceNegotiable,
          description: listingItem.description ?? "",
          companyName: listingItem.companyName,
          publishedAsCompany: listingItem.publishedAsCompany === true,
          contactEmail: listingItem.contactEmail,
          contactPhone: listingItem.contactPhone ?? "",
        }}
      />
    </main>
  );
}



