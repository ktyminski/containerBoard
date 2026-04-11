import type { Metadata } from "next";
import { ObjectId } from "mongodb";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ContainerListingForm } from "@/components/container-listing-form";
import { SESSION_COOKIE_NAME } from "@/lib/auth-session";
import { getCurrentUserFromToken } from "@/lib/auth-user";
import {
  ensureContainerListingsIndexes,
  getContainerListingsCollection,
  mapContainerListingToItem,
} from "@/lib/container-listings";
import { USER_ROLE } from "@/lib/user-roles";

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

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold text-slate-100">Edytuj kontener</h1>
      </header>

      <ContainerListingForm
        mode="edit"
        submitEndpoint={`/api/containers/${listing._id.toHexString()}`}
        submitMethod="PATCH"
        submitLabel="Zapisz zmiany"
        successMessage="Kontener zaktualizowany"
        backHref={`/containers/${listing._id.toHexString()}`}
        backLabel="Powrot do szczegolow"
        initialValues={{
          type: listingItem.type,
          containerSize: listingItem.container.size,
          containerHeight: listingItem.container.height,
          containerType: listingItem.container.type,
          containerFeatures: listingItem.container.features,
          containerCondition: listingItem.container.condition,
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
          locationAddressCity: listingItem.locationAddressParts?.city ?? listingItem.locationCity,
          locationAddressCountry: listingItem.locationAddressParts?.country ?? listingItem.locationCountry,
          availableFrom: listingItem.availableFrom.slice(0, 10),
          dealType: listingItem.dealType,
          price: listingItem.price ?? "",
          description: listingItem.description ?? "",
          companyName: listingItem.companyName,
          contactEmail: listingItem.contactEmail,
          contactPhone: listingItem.contactPhone ?? "",
        }}
      />
    </main>
  );
}

