import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NewCompanyForm } from "@/components/new-company-form";
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
import { getTurnstileSiteKey } from "@/lib/turnstile";

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
  const turnstileSiteKey = getTurnstileSiteKey();

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
    redirect(withLang("/maps", locale));
  }

  const companyCreationLimit =
    currentUser.role === USER_ROLE.ADMIN
      ? null
      : await getCompanyCreationLimitState({
          companies: await getCompaniesCollection(),
          userId: currentUser._id,
        });

  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -left-28 top-10 h-64 w-64 rounded-full bg-sky-500/15 blur-3xl" />
        <div className="absolute right-[-5rem] top-28 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute bottom-8 left-1/3 h-56 w-56 rounded-full bg-emerald-400/10 blur-3xl" />
      </div>
      <main className="relative mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6">
        <header>
          <h1 className="text-2xl font-semibold text-slate-100 sm:text-3xl">
            {messages.companyCreate.title}
          </h1>
          <p className="mt-2 text-sm whitespace-pre-line text-slate-300">
            {messages.companyCreate.subtitle}
          </p>
          <p className="mt-1 text-xs text-slate-400">{messages.companyCreate.requiredFieldsHint}</p>
        </header>
        <NewCompanyForm
          locale={locale}
          messages={messages.companyCreate}
          turnstileSiteKey={turnstileSiteKey}
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

