import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME } from "@/lib/auth-session";
import { getCurrentUserFromToken } from "@/lib/auth-user";
import { getCompaniesCollection } from "@/lib/companies";
import { NewJobAnnouncementForm } from "@/components/new-job-announcement-form";
import { SmartBackButton } from "@/components/smart-back-button";
import { USER_ROLE } from "@/lib/user-roles";
import {
  getLocaleFromRequest,
  getMessages,
  LOCALE_COOKIE_NAME,
  withLang,
} from "@/lib/i18n";

type NewAnnouncementPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewAnnouncementPage({ searchParams }: NewAnnouncementPageProps) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const locale = getLocaleFromRequest({
    params,
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
  });
  const messages = getMessages(locale);

  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    redirect(withLang("/login?next=/announcements/new", locale));
  }

  const currentUser = await getCurrentUserFromToken(token);
  if (!currentUser?._id) {
    redirect(withLang("/login?next=/announcements/new", locale));
  }

  const companies = await getCompaniesCollection();
  const availableCompanies =
    currentUser.role === USER_ROLE.ADMIN
      ? await companies
          .find(
            {},
            {
              projection: {
                _id: 1,
                name: 1,
                email: 1,
                benefits: 1,
                locations: 1,
                updatedAt: 1,
                "logo.size": 1,
                "background.size": 1,
              },
              sort: { name: 1 },
              limit: 500,
            },
          )
          .toArray()
      : await companies
          .find(
            { createdByUserId: currentUser._id },
            {
              projection: {
                _id: 1,
                name: 1,
                email: 1,
                benefits: 1,
                locations: 1,
                updatedAt: 1,
                "logo.size": 1,
                "background.size": 1,
              },
              sort: { name: 1 },
              limit: 100,
            },
          )
          .toArray();

  const needsCompany = availableCompanies.length === 0;
  const serializedCompanies = availableCompanies
    .filter((company) => company._id)
    .map((company) => ({
      id: company._id.toHexString(),
      name: company.name,
      email: company.email ?? "",
      logoUrl: company.logo?.size
        ? `/api/companies/${company._id.toHexString()}/logo?v=${
            company.updatedAt instanceof Date ? company.updatedAt.getTime() : 0
          }`
        : null,
      backgroundUrl: company.background?.size
        ? `/api/companies/${company._id.toHexString()}/background?v=${
            company.updatedAt instanceof Date ? company.updatedAt.getTime() : 0
          }`
        : null,
      benefits: company.benefits ?? [],
      branches: (company.locations ?? []).map((location, index) => ({
        id: `${company._id.toHexString()}:${index}`,
        label: location.label,
        addressText: location.addressText,
        addressParts: location.addressParts ?? null,
        email: location.email ?? "",
        lat: location.point.coordinates[1],
        lng: location.point.coordinates[0],
      })),
    }));

  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -left-28 top-10 h-64 w-64 rounded-full bg-sky-500/15 blur-3xl" />
        <div className="absolute right-[-5rem] top-28 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute bottom-8 left-1/3 h-56 w-56 rounded-full bg-emerald-400/10 blur-3xl" />
      </div>
      <main className="relative mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6">
        <SmartBackButton
          label={messages.companyDetails.back}
          fallbackHref={withLang("/maps/announcements", locale)}
          className="inline-flex w-fit items-center gap-2 rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 transition-colors hover:border-slate-500"
        />
        <header>
          <h1 className="text-2xl font-semibold text-slate-100 sm:text-3xl">
            {messages.announcementCreate.title}
          </h1>
          <p className="text-sm text-slate-300">{messages.announcementCreate.subtitle}</p>
          <p className="mt-1 text-xs text-slate-400">{messages.companyCreate.requiredFieldsHint}</p>
        </header>

        {needsCompany ? (
          <section className="rounded-xl border border-amber-700/60 bg-amber-950/20 p-5">
            <h2 className="text-lg font-semibold text-amber-200">
              {messages.announcementCreate.companyRequiredTitle}
            </h2>
            <p className="mt-2 text-sm text-amber-100/80">
              {messages.announcementCreate.companyRequiredText}
            </p>
            <div className="mt-4 flex items-center gap-2">
              <Link
                href={withLang("/companies/new", locale)}
                className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400"
              >
                {messages.announcementCreate.addCompanyCta}
              </Link>
              <Link
                href={withLang("/maps/announcements", locale)}
                className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"
              >
                {messages.announcementCreate.backToMap}
              </Link>
            </div>
          </section>
        ) : (
          <NewJobAnnouncementForm
            locale={locale}
            messages={messages.announcementCreate}
            companyBenefitLabels={messages.companyCreate.benefitsOptions}
            companyBenefitsTitle={messages.announcementDetails.benefitsLabel}
            companies={serializedCompanies}
          />
        )}
      </main>
    </section>
  );
}


