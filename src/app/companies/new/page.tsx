import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NewCompanyForm } from "@/components/new-company-form";
import { SmartBackButton } from "@/components/smart-back-button";
import { SESSION_COOKIE_NAME } from "@/lib/auth-session";
import { getCurrentUserFromToken } from "@/lib/auth-user";
import { getCompanyCreationLimitState } from "@/lib/company-creation-limit";
import { getCompaniesCollection } from "@/lib/companies";
import { USER_ROLE } from "@/lib/user-roles";
import {
  getLocaleFromRequest,
  getMessages,
  LOCALE_COOKIE_NAME,
  withLang,
} from "@/lib/i18n";

type NewCompanyPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewCompanyPage({ searchParams }: NewCompanyPageProps) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const locale = getLocaleFromRequest({
    params,
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
  });
  const messages = getMessages(locale);

  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    redirect(withLang("/login?next=/companies/new", locale));
  }

  const currentUser = await getCurrentUserFromToken(token);
  if (!currentUser?._id) {
    redirect(withLang("/login?next=/companies/new", locale));
  }

  if (
    currentUser.role !== USER_ROLE.USER &&
    currentUser.role !== USER_ROLE.COMPANY_OWNER &&
    currentUser.role !== USER_ROLE.ADMIN
  ) {
    redirect(withLang("/list", locale));
  }

  const companies = await getCompaniesCollection();
  const existingOwnedCompany = await companies.findOne(
    { createdByUserId: currentUser._id },
    { projection: { _id: 1 } },
  );
  if (existingOwnedCompany) {
    redirect(withLang("/containers/mine", locale));
  }

  const companyCreationLimit =
    currentUser.role === USER_ROLE.ADMIN
      ? null
      : await getCompanyCreationLimitState({
          companies,
          userId: currentUser._id,
        });

  return (
    <section className="bg-neutral-200/90">
      <main className="relative mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6">
        <SmartBackButton
          label="Wroc"
          fallbackHref={withLang("/containers/mine", locale)}
          className="inline-flex w-fit items-center gap-2 rounded-md border border-neutral-400 bg-white px-3 py-2 text-sm text-neutral-700 transition-colors hover:border-neutral-500"
        />
        <header>
          <h1 className="text-2xl font-semibold text-neutral-900 sm:text-3xl">
            {messages.companyCreate.title}
          </h1>
          <p className="mt-2 text-sm whitespace-pre-line text-neutral-800">
            {messages.companyCreate.subtitle}
          </p>
          <p className="mt-1 text-xs text-neutral-700">{messages.companyCreate.requiredFieldsHint}</p>
        </header>
        <NewCompanyForm
          locale={locale}
          messages={messages.companyCreate}
          companyCreationLimit={
            companyCreationLimit
              ? {
                  isLimited: companyCreationLimit.isLimited,
                  limit: companyCreationLimit.limit,
                  windowHours: companyCreationLimit.windowHours,
                  createdInWindow: companyCreationLimit.createdInWindow,
                  nextAllowedAt: companyCreationLimit.nextAllowedAt?.toISOString() ?? null,
                }
              : null
          }
        />
      </main>
    </section>
  );
}



