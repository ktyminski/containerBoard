import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME } from "@/lib/auth-session";
import { getCurrentUserFromToken } from "@/lib/auth-user";
import { getCompanyCreationLimitState } from "@/lib/company-creation-limit";
import { VerifiedActionLink } from "@/components/verified-action-link";
import { CompanyDeletionRequestButton } from "@/components/company-deletion-request-button";
import { getCompaniesCollection } from "@/lib/companies";
import {
  formatTemplate,
  getLocaleFromRequest,
  getMessages,
  LOCALE_COOKIE_NAME,
  withLang,
} from "@/lib/i18n";
import { USER_ROLE } from "@/lib/user-roles";
import {
  getCompanyFallbackColor,
  getCompanyFallbackGradient,
  getCompanyInitial,
} from "@/lib/company-logo-fallback";

type CompanyPanelPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CompanyPanelPage({ searchParams }: CompanyPanelPageProps) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const locale = getLocaleFromRequest({
    params,
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
  });
  const messages = getMessages(locale);
  const panelMessages = messages.companyPanelPage;

  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    redirect(withLang("/login?next=/companies/panel", locale));
  }

  const currentUser = await getCurrentUserFromToken(token);
  if (!currentUser?._id) {
    redirect(withLang("/login?next=/companies/panel", locale));
  }

  const companies = await getCompaniesCollection();
  const companyCreationLimit =
    currentUser.role === USER_ROLE.ADMIN
      ? null
      : await getCompanyCreationLimitState({
          companies,
          userId: currentUser._id,
        });
  const ownedCompanies = await companies
    .find(
      { createdByUserId: currentUser._id },
      {
        projection: {
          _id: 1,
          name: 1,
          slug: 1,
          description: 1,
          updatedAt: 1,
          isBlocked: 1,
          isPremium: 1,
          deletionRequest: 1,
          "logo.filename": 1,
          "logo.size": 1,
          "background.filename": 1,
          "background.size": 1,
        },
        sort: { name: 1 },
        limit: 200,
      },
    )
    .toArray();
  const hasBlockedOwnedCompany = ownedCompanies.some(
    (company) => company.isBlocked === true,
  );
  const isUserBlocked = currentUser.isBlocked === true;
  const requiresEmailVerificationForAdd =
    currentUser.authProvider === "local" && currentUser.isEmailVerified === false;
  const isCompanyCreationLimited = companyCreationLimit?.isLimited === true;
  const addCompanyBlocked = requiresEmailVerificationForAdd || isCompanyCreationLimited;
  const addCompanyBlockedMessage = requiresEmailVerificationForAdd
    ? messages.authNav.emailVerificationRequiredForAdd
    : isCompanyCreationLimited
      ? formatTemplate(messages.authNav.companyCreationLimitForAdd, {
          limit: companyCreationLimit.limit,
          windowHours: companyCreationLimit.windowHours,
        })
      : "";
  const shouldShowBlockedNotice =
    isUserBlocked || hasBlockedOwnedCompany;

  return (
    <section className="relative overflow-hidden bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]">
      <main className="relative mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">{panelMessages.title}</h1>
        <p className="mt-2 text-sm text-slate-600">{panelMessages.subtitle}</p>
      </header>

      {shouldShowBlockedNotice ? (
        <section className="rounded-xl border border-rose-700/70 bg-rose-950/30 p-5">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-rose-200">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-rose-600 bg-rose-500/10 text-sm font-bold">
              !
            </span>
            {panelMessages.blockedTitle}
          </h2>
          {currentUser.isBlocked ? (
            <p className="mt-2 text-sm text-rose-100/90">{panelMessages.blockedAccountNotice}</p>
          ) : null}
          {hasBlockedOwnedCompany ? (
            <p className="mt-2 text-sm text-rose-100/90">{panelMessages.blockedCompanyNotice}</p>
          ) : null}
          <p className="mt-2 text-sm font-medium text-rose-100">{panelMessages.blockedContactAdmin}</p>
        </section>
      ) : null}

      {ownedCompanies.length === 0 ? (
        <section className="rounded-xl border border-slate-300 bg-slate-100 p-5">
          <h2 className="text-lg font-semibold text-slate-800">{panelMessages.noCompaniesTitle}</h2>
          <p className="mt-2 text-sm text-slate-700">{panelMessages.noCompaniesText}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <VerifiedActionLink
              href={withLang("/companies/new", locale)}
              label={panelMessages.addCompany}
              className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
              requiresEmailVerification={addCompanyBlocked}
              blockedMessage={addCompanyBlockedMessage}
            />
            <Link
              href={withLang("/maps", locale)}
              className="rounded-md border border-slate-400 bg-white px-4 py-2 text-sm text-slate-800 hover:bg-slate-50"
            >
              {panelMessages.backToMap}
            </Link>
          </div>
        </section>
      ) : (
        <section className="grid gap-12">
          {ownedCompanies.map((company) => {
            const companyId = company._id.toHexString();
            const mediaVersion = company.updatedAt instanceof Date
              ? company.updatedAt.getTime()
              : 0;
            const withMediaVersion = (url: string) => `${url}?v=${mediaVersion}`;
            const logoUrl =
              company.logo?.size || company.logo?.filename
                ? withMediaVersion(`/api/companies/${companyId}/logo`)
                : null;
            const backgroundUrl = company.background?.size || company.background?.filename
              ? withMediaVersion(`/api/companies/${companyId}/background`)
              : null;
            const logoFallbackColor = getCompanyFallbackColor(companyId);
            const backgroundFallbackGradient = getCompanyFallbackGradient(logoFallbackColor);
            const logoFallbackInitial = getCompanyInitial(company.name);
            const isPremium = company.isPremium === true;
            const deletionRequest = company.deletionRequest;
            const deletionReason = deletionRequest?.reason?.trim() ?? "";
            const isDeletionRequested = deletionRequest?.isRequested === true;

            return (
              <article
                key={companyId}
                className="overflow-hidden rounded-xl border border-slate-300 bg-[#eef2f7]"
              >
                <div className="relative aspect-[4/1] w-full">
                  {backgroundUrl ? (
                    <Image
                      src={backgroundUrl}
                      alt={`${company.name} background`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 1024px) 100vw, 1280px"
                    />
                  ) : (
                    <div className="h-full w-full" style={{ backgroundImage: backgroundFallbackGradient }} />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/70 to-transparent" />
                  <div className="absolute inset-x-4 bottom-4 flex items-end gap-3">
                    <div
                      className={`relative h-12 w-12 rounded-lg border border-[#cbd5e1] bg-[#0b1730] sm:h-12 sm:w-12 md:h-20 md:w-20 lg:h-28 lg:w-28 ${
                        isPremium ? "overflow-visible" : "overflow-hidden"
                      }`}
                    >
                      <div className="h-full w-full overflow-hidden rounded-[inherit]">
                        {logoUrl ? (
                          <Image
                            src={logoUrl}
                            alt={`${company.name} logo`}
                            fill
                            className="object-cover"
                            sizes="(max-width: 767px) 48px, (max-width: 1023px) 80px, 112px"
                          />
                        ) : null}
                        {!logoUrl ? (
                          <div
                            className="flex h-full w-full items-center justify-center text-lg font-semibold text-white md:text-3xl"
                            style={{ backgroundColor: logoFallbackColor }}
                            aria-label={`${company.name} logo`}
                          >
                            {logoFallbackInitial}
                          </div>
                        ) : null}
                      </div>
                      {isPremium ? (
                        <span
                          className="absolute left-0 top-0 z-20 inline-flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-amber-400/80 bg-[rgba(2,6,23,0.9)] text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.35)] md:h-6 md:w-6"
                          aria-hidden="true"
                        >
                          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 md:h-4 md:w-4" aria-hidden="true">
                            <path
                              d="M10 2.9l2.15 4.35 4.8.7-3.47 3.38.82 4.78L10 13.95 5.7 16.1l.82-4.78L3.05 7.95l4.8-.7L10 2.9Z"
                              fill="currentColor"
                            />
                          </svg>
                        </span>
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs uppercase tracking-[0.12em] text-[#d4def0]">
                        {panelMessages.companyLabel}
                      </p>
                      <h2 className="flex min-w-0 items-center gap-2 text-lg font-semibold text-[#f8fbff] sm:text-lg md:text-2xl">
                        <span className="min-w-0 truncate" title={company.name}>
                          {company.name}
                        </span>
                        {company.isBlocked ? (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-rose-700 bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-200">
                            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-rose-600 bg-rose-500/10 text-[10px] font-bold">
                              !
                            </span>
                            {panelMessages.blockedBadge}
                          </span>
                        ) : null}
                      </h2>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 p-5">
                  <p className="whitespace-pre-wrap text-sm text-slate-700">{company.description}</p>

                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={withLang(`/companies/${company.slug}`, locale)}
                      className="rounded-md border border-slate-400 bg-white px-3 py-2 text-sm text-slate-800 transition-colors hover:bg-slate-50"
                    >
                      {panelMessages.previewCompany}
                    </Link>
                    <Link
                      href={withLang(`/companies/${company.slug}/edit`, locale)}
                      className="rounded-md border border-slate-400 bg-white px-3 py-2 text-sm text-slate-800 transition-colors hover:bg-slate-50"
                    >
                      {panelMessages.editCompany}
                    </Link>
                  </div>

                  {isDeletionRequested ? (
                    <section className="rounded-lg border border-rose-700/60 bg-rose-950/20 p-3">
                      <p className="text-xs font-semibold text-rose-200">
                        {panelMessages.deletionRequestActiveBadge}
                      </p>
                      <p className="mt-1 text-xs text-rose-100/85">
                        {panelMessages.deletionRequestReasonPreview}:{" "}
                        {deletionReason || panelMessages.deletionRequestNoReason}
                      </p>
                    </section>
                  ) : null}

                  <div className="flex justify-end">
                    <CompanyDeletionRequestButton
                      companyId={companyId}
                      locale={locale}
                      messages={panelMessages}
                      initialReason={deletionReason}
                      isAlreadyRequested={isDeletionRequested}
                      triggerClassName="cursor-pointer text-xs text-slate-600 underline decoration-slate-500 underline-offset-2 transition-colors hover:text-slate-800 hover:decoration-slate-700"
                    />
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}

      <div>
        <Link
          href={withLang("/maps", locale)}
          className="rounded-md border border-slate-400 bg-white px-4 py-2 text-sm text-slate-800 hover:bg-slate-50"
        >
          {panelMessages.backToMap}
        </Link>
      </div>
    </main>
    </section>
  );
}

