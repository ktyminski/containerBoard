import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { UserSettingsAssignedCompanies } from "@/components/user-settings-assigned-companies";
import { UserSettingsAccountSection } from "@/components/user-settings-account-section";
import { UserSettingsDangerZone } from "@/components/user-settings-danger-zone";
import { SESSION_COOKIE_NAME } from "@/lib/auth-session";
import { getCurrentUserFromToken } from "@/lib/auth-user";
import { getCompaniesCollection } from "@/lib/companies";
import {
  getLocaleFromRequest,
  getMessages,
  LOCALE_COOKIE_NAME,
  withLang,
} from "@/lib/i18n";
import { USER_ROLE } from "@/lib/user-roles";

type SettingsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const locale = getLocaleFromRequest({
    params,
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
  });
  const messages = getMessages(locale);

  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    redirect(withLang("/login?next=/settings", locale));
  }

  const currentUser = await getCurrentUserFromToken(token);
  if (!currentUser?._id) {
    redirect(withLang("/login?next=/settings", locale));
  }

  const shouldShowAssignedCompanies = currentUser.role !== USER_ROLE.ADMIN;
  const assignedCompanies = shouldShowAssignedCompanies
    ? await (await getCompaniesCollection())
        .find(
          { createdByUserId: currentUser._id },
          {
            projection: { _id: 1, name: 1, slug: 1, isBlocked: 1 },
            sort: { name: 1 },
            limit: 500,
          },
        )
        .toArray()
    : [];
  const hasBlockedAssignedCompany = assignedCompanies.some(
    (company) => company.isBlocked === true,
  );
  const shouldRenderAssignedCompaniesSection =
    shouldShowAssignedCompanies && assignedCompanies.length > 0;
  const shouldShowBlockedNotice =
    currentUser.isBlocked === true || hasBlockedAssignedCompany;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold sm:text-3xl">{messages.settingsPage.title}</h1>
        <p className="mt-2 text-sm text-slate-300">{messages.settingsPage.subtitle}</p>
      </header>

      {shouldShowBlockedNotice ? (
        <section className="rounded-xl border border-rose-700/70 bg-rose-950/30 p-5">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-rose-200">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-rose-600 bg-rose-500/10 text-sm font-bold">
              !
            </span>
            {messages.settingsPage.blockedTitle}
          </h2>
          {currentUser.isBlocked ? (
            <p className="mt-2 text-sm text-rose-100/90">
              {messages.settingsPage.blockedAccountNotice}
            </p>
          ) : null}
          {hasBlockedAssignedCompany ? (
            <p className="mt-2 text-sm text-rose-100/90">
              {messages.settingsPage.blockedCompanyNotice}
            </p>
          ) : null}
          <p className="mt-2 text-sm font-medium text-rose-100">
            {messages.settingsPage.blockedContactAdmin}
          </p>
        </section>
      ) : null}

      <UserSettingsAccountSection
        messages={messages.settingsPage}
        user={{
          name: currentUser.name,
          email: currentUser.email,
          phone: currentUser.phone ?? "",
          canChangePassword: currentUser.sessionAuthProvider === "local",
          isEmailVerified:
            currentUser.authProvider !== "local" || currentUser.isEmailVerified !== false,
        }}
      />

      {shouldRenderAssignedCompaniesSection ? (
        <UserSettingsAssignedCompanies
          locale={locale}
          messages={messages.settingsPage}
          companies={assignedCompanies.map((company) => ({
            id: company._id.toHexString(),
            name: company.name,
            slug: company.slug,
            isBlocked: company.isBlocked === true,
          }))}
        />
      ) : null}

      {currentUser.role !== USER_ROLE.ADMIN ? (
        <UserSettingsDangerZone locale={locale} messages={messages.settingsPage} />
      ) : null}
    </main>
  );
}
