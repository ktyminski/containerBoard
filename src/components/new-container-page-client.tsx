"use client";

import { useState } from "react";
import {
  ContainerListingForm,
  type CompanyLocationPrefillOption,
  type ListingIntent,
} from "@/components/container-listing-form";
import { SmartBackButton } from "@/components/smart-back-button";

const LISTING_INTENT_OPTIONS: Array<{ value: ListingIntent; label: string }> = [
  { value: "sell", label: "Sprzedaz" },
  { value: "rent", label: "Wynajem" },
  { value: "buy", label: "Chce zakupic" },
];

const LISTING_INTENT_HEADER_LABEL: Record<ListingIntent, string> = {
  sell: "Sprzedaj kontener",
  rent: "Wynajmij kontener",
  buy: "Kup kontener",
};

type NewContainerPageClientProps = {
  contactPrefill: {
    companyName: string;
    contactEmail: string;
    contactPhone: string;
  };
  ownedCompanyProfile?: {
    name: string;
    slug?: string;
  } | null;
  companyLocationPrefillOptions?: CompanyLocationPrefillOption[];
};

export function NewContainerPageClient({
  contactPrefill,
  ownedCompanyProfile,
  companyLocationPrefillOptions,
}: NewContainerPageClientProps) {
  const [listingIntent, setListingIntent] = useState<ListingIntent | null>(null);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <SmartBackButton
        label="Wroc"
        fallbackHref="/list"
        className="mb-4 inline-flex w-fit items-center gap-2 rounded-md border border-neutral-400 bg-white px-3 py-2 text-sm text-neutral-700 transition-colors hover:border-neutral-500"
      />

      {listingIntent ? (
        <header className="mb-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-lg font-semibold text-neutral-900">
                {LISTING_INTENT_HEADER_LABEL[listingIntent]}
              </p>
              <button
                type="button"
                onClick={() => {
                  setListingIntent(null);
                }}
                className="text-sm lowercase text-neutral-700 underline underline-offset-2 decoration-neutral-600 transition hover:text-neutral-900"
              >
                zmien
              </button>
            </div>
            <p className="mt-1 text-sm text-neutral-700">
              Pola oznaczone gwiazdka sa obowiazkowe.
            </p>
          </div>
        </header>
      ) : null}

      {listingIntent === null ? (
        <section className="mb-4 grid gap-4 rounded-lg bg-white p-4">
          <h2 className="text-center text-base font-semibold text-neutral-900">
            Jaki rodzaj ogloszenia publikujesz?
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {LISTING_INTENT_OPTIONS.map((option) => {
              const isPrimaryOption = option.value === "sell";
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setListingIntent(option.value);
                  }}
                  className={`rounded-md border px-3 text-center font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f639a]/35 ${
                    isPrimaryOption
                      ? "h-14 text-base sm:col-span-2 border-[#2f639a] bg-[linear-gradient(180deg,#082650_0%,#0c3466_100%)] text-[#e2efff] hover:bg-[#0f3f75] hover:text-white"
                      : "h-11 text-sm border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      <ContainerListingForm
        mode="create"
        submitEndpoint="/api/containers"
        submitMethod="POST"
        submitLabel="Publikuj kontener"
        successMessage="Kontener opublikowany"
        backHref="/list"
        backLabel="Powrot do listy kontenerow"
        initialValues={{
          companyName: contactPrefill.companyName,
          publishedAsCompany: Boolean(ownedCompanyProfile?.name?.trim()),
          contactEmail: contactPrefill.contactEmail,
          contactPhone: contactPrefill.contactPhone,
        }}
        ownedCompanyProfile={ownedCompanyProfile}
        companyLocationPrefillOptions={companyLocationPrefillOptions}
        selectedListingIntent={listingIntent}
        onSelectedListingIntentChange={setListingIntent}
        showListingIntentSelector={false}
      />
    </main>
  );
}
