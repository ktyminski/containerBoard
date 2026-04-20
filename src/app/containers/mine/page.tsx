import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MyContainerListings } from "@/components/my-container-listings";
import { NoCompanyBenefitsBanner } from "@/components/no-company-benefits-banner";
import { CompanyDeletionRequestButton } from "@/components/company-deletion-request-button";
import { SESSION_COOKIE_NAME } from "@/lib/auth-session";
import { getCurrentUserFromToken } from "@/lib/auth-user";
import { getCompaniesCollection } from "@/lib/companies";
import {
  getLocaleFromRequest,
  getMessages,
  LOCALE_COOKIE_NAME,
} from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Moje kontenery | ContainerBoard",
  description: "Zarzadzaj swoimi ogloszeniami kontenerow.",
};

type MyContainersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function MyContainersPage({
  searchParams,
}: MyContainersPageProps) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const locale = getLocaleFromRequest({
    params,
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
  });
  const messages = getMessages(locale);
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    redirect("/login?next=/containers/mine");
  }

  const user = await getCurrentUserFromToken(token);
  if (!user?._id) {
    redirect("/login?next=/containers/mine");
  }

  const companies = await getCompaniesCollection();
  const ownedCompany = await companies.findOne(
    { createdByUserId: user._id },
    {
      projection: {
        _id: 1,
        name: 1,
        slug: 1,
      },
      sort: { createdAt: -1 },
    },
  );
  const hasOwnedCompany = Boolean(ownedCompany?._id);
  const ownedCompanyId = ownedCompany?._id?.toHexString();
  const moduleMessages = messages.containerModules;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <section className="mb-4 rounded-md border border-neutral-300 bg-neutral-50/95 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">
              {hasOwnedCompany && ownedCompany?.name
                ? `${moduleMessages.minePage.companyTitle} - ${ownedCompany.name}`
                : moduleMessages.minePage.companyTitle}
            </h2>
          </div>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            {hasOwnedCompany && ownedCompany?.slug ? (
              <>
                <Link
                  href={`/companies/${ownedCompany.slug}`}
                  className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-100"
                >
                  {moduleMessages.minePage.companyPreview}
                </Link>
                <Link
                  href={`/companies/${ownedCompany.slug}/edit`}
                  className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-100"
                >
                  {moduleMessages.minePage.companyEdit}
                </Link>
                {ownedCompanyId ? (
                  <CompanyDeletionRequestButton
                    companyId={ownedCompanyId}
                    locale={locale}
                    messages={messages.companyPanelPage}
                    triggerClassName="rounded-md border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-500 transition-colors hover:bg-neutral-200"
                  />
                ) : null}
              </>
            ) : null}
          </div>
        </div>
        {!hasOwnedCompany ? (
          <NoCompanyBenefitsBanner
            className="mt-3"
            messages={moduleMessages.banner}
          />
        ) : null}
      </section>
      <MyContainerListings
        canUseBulkImport={hasOwnedCompany}
        locale={locale}
        messages={moduleMessages}
        listingMessages={messages.containerListings}
      />
    </main>
  );
}
