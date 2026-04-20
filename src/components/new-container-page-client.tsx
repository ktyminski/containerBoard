"use client";

import { useState } from "react";
import type { ContainerModuleMessages } from "@/components/container-modules-i18n";
import type { ContainerListingsMessages } from "@/components/container-listings-i18n";
import {
  ContainerListingForm,
  type CompanyLocationPrefillOption,
  type ListingIntent,
} from "@/components/container-listing-form";
import { NoCompanyBenefitsBanner } from "@/components/no-company-benefits-banner";
import { SmartBackButton } from "@/components/smart-back-button";

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
  locale: "pl" | "en" | "de" | "uk";
  messages: ContainerModuleMessages;
  listingMessages: ContainerListingsMessages;
};

export function NewContainerPageClient({
  contactPrefill,
  initialListingIntent,
  ownedCompanyProfile,
  companyLocationPrefillOptions,
  locale,
  messages,
  listingMessages,
}: NewContainerPageClientProps) {
  const [listingIntent, setListingIntent] = useState<ListingIntent>(
    initialListingIntent ?? "sell",
  );
  const [isIntentModalOpen, setIsIntentModalOpen] = useState(false);
  const listingIntentOptions: Array<{ value: ListingIntent; label: string }> = [
    { value: "sell", label: messages.newPage.intentOptions.sell },
    { value: "rent", label: messages.newPage.intentOptions.rent },
    { value: "buy", label: messages.newPage.intentOptions.buy },
  ];

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <SmartBackButton
        label={messages.shared.back}
        fallbackHref="/list"
        className="mb-4 inline-flex w-fit items-center gap-2 rounded-md border border-neutral-400 bg-white px-3 py-2 text-sm text-neutral-700 transition-colors hover:border-neutral-500"
      />

      <header className="mb-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-semibold text-neutral-900">
              {messages.newPage.titleByIntent[listingIntent]}
            </p>
            <button
              type="button"
              onClick={() => {
                setIsIntentModalOpen(true);
              }}
              className="text-sm text-neutral-900 underline underline-offset-2 decoration-neutral-500 transition hover:text-neutral-700"
            >
              {messages.newPage.switchByIntent[listingIntent]}
            </button>
          </div>
          <p className="mt-1 text-sm text-neutral-700">
            {messages.newPage.requiredHint}
          </p>
        </div>
      </header>

      {!ownedCompanyProfile?.name?.trim() && listingIntent !== "buy" ? (
        <NoCompanyBenefitsBanner
          className="mb-3"
          messages={messages.banner}
        />
      ) : null}

      <ContainerListingForm
        locale={locale}
        messages={messages}
        listingMessages={listingMessages}
        mode="create"
        submitEndpoint="/api/containers"
        submitMethod="POST"
        submitLabel={messages.newPage.submitLabel}
        successMessage={messages.newPage.successMessage}
        backHref="/list"
        backLabel={messages.newPage.backToList}
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
                {messages.newPage.intentModalTitle}
              </p>
            </div>
            <div className="grid gap-2">
              {listingIntentOptions.map((option) => {
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
                {messages.shared.cancel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
