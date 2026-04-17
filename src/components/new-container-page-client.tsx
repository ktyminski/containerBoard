"use client";

import { useState } from "react";
import {
  ContainerListingForm,
  type CompanyLocationPrefillOption,
  type ListingIntent,
} from "@/components/container-listing-form";
import { SmartBackButton } from "@/components/smart-back-button";

const LISTING_INTENT_OPTIONS: Array<{ value: ListingIntent; label: string }> = [
  { value: "sell", label: "Chce sprzedac" },
  { value: "rent", label: "Chce wynajac" },
  { value: "buy", label: "Szukam kontenera" },
];

const LISTING_INTENT_HEADER_LABEL: Record<ListingIntent, string> = {
  sell: "Sprzedaj kontener",
  rent: "Wynajmij kontener",
  buy: "Szukam kontenera",
};

const LISTING_INTENT_SWITCH_LABEL: Record<ListingIntent, string> = {
  sell: "Chcesz wynajac albo szukasz kontenera?",
  rent: "Chcesz sprzedac albo szukasz kontenera?",
  buy: "Chcesz sprzedac albo wynajac?",
};

type NewContainerPageClientProps = {
  contactPrefill: {
    companyName: string;
    contactEmail: string;
    contactPhone: string;
  };
  initialListingIntent?: ListingIntent;
  ownedCompanyProfile?: {
    name: string;
    slug?: string;
  } | null;
  companyLocationPrefillOptions?: CompanyLocationPrefillOption[];
};

export function NewContainerPageClient({
  contactPrefill,
  initialListingIntent,
  ownedCompanyProfile,
  companyLocationPrefillOptions,
}: NewContainerPageClientProps) {
  const [listingIntent, setListingIntent] = useState<ListingIntent>(
    initialListingIntent ?? "sell",
  );
  const [isIntentModalOpen, setIsIntentModalOpen] = useState(false);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <SmartBackButton
        label="Wroc"
        fallbackHref="/list"
        className="mb-4 inline-flex w-fit items-center gap-2 rounded-md border border-neutral-400 bg-white px-3 py-2 text-sm text-neutral-700 transition-colors hover:border-neutral-500"
      />

      <header className="mb-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-semibold text-neutral-900">
              {LISTING_INTENT_HEADER_LABEL[listingIntent]}
            </p>
            <button
              type="button"
              onClick={() => {
                setIsIntentModalOpen(true);
              }}
              className="text-sm text-neutral-900 underline underline-offset-2 decoration-neutral-500 transition hover:text-neutral-700"
            >
              {LISTING_INTENT_SWITCH_LABEL[listingIntent]}
            </button>
          </div>
          <p className="mt-1 text-sm text-neutral-700">
            Pola oznaczone gwiazdka sa obowiazkowe.
          </p>
        </div>
      </header>

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
        onSelectedListingIntentChange={(nextValue) => {
          setListingIntent(nextValue ?? "sell");
        }}
        showListingIntentSelector={false}
      />

      {isIntentModalOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center px-4 py-6"
          style={{
            backgroundColor: "rgba(2, 6, 23, 0.58)",
            backdropFilter: "blur(4px)",
          }}
          onMouseDown={(event) => {
            if (event.target !== event.currentTarget) {
              return;
            }
            setIsIntentModalOpen(false);
          }}
        >
          <div className="w-full max-w-sm rounded-xl border border-neutral-200/90 bg-white/95 p-4 shadow-2xl">
            <div className="mb-3 text-center">
              <p className="text-base font-semibold text-neutral-900">
                Wybierz typ ogloszenia
              </p>
            </div>
            <div className="grid gap-2">
              {LISTING_INTENT_OPTIONS.map((option) => {
                const isActive = option.value === listingIntent;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setListingIntent(option.value);
                      setIsIntentModalOpen(false);
                    }}
                    className={`inline-flex h-10 items-center justify-center rounded-md border px-3 text-sm font-semibold transition ${
                      isActive
                        ? "border-[#2f639a] bg-[linear-gradient(180deg,#082650_0%,#0c3466_100%)] text-[#e2efff] shadow-[0_1px_0_rgba(12,52,102,0.35)]"
                        : "border-[#95b6df] bg-[#eaf2ff] text-[#153a66] hover:border-[#6f98ca] hover:bg-[#dceaff]"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsIntentModalOpen(false);
                }}
                className="inline-flex h-10 items-center justify-center rounded-md border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-50 hover:text-neutral-900"
              >
                Anuluj
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
