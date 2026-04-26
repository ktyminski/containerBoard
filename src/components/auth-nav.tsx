import Link from "next/link";
import { cookies } from "next/headers";
import { UserAccountMenu } from "@/components/user-account-menu";
import { SESSION_COOKIE_NAME } from "@/lib/auth-session";
import { getCurrentUserFromToken } from "@/lib/auth-user";
import { getCompaniesCollection } from "@/lib/companies";
import type { AppLocale, AppMessages } from "@/lib/i18n";
import { withLang } from "@/lib/i18n";
import { USER_ROLE } from "@/lib/user-roles";

type AuthNavProps = {
  locale: AppLocale;
  messages: AppMessages["authNav"];
  roleMessages: AppMessages["roles"];
};

export async function AuthNav({ locale, messages, roleMessages }: AuthNavProps) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const user = token ? await getCurrentUserFromToken(token) : null;

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href={withLang("/login", locale)}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#2f639a] bg-[#082650]/80 text-sm text-[#e2efff] whitespace-nowrap transition hover:border-[#4e86c3] hover:bg-[#0c3466] sm:w-auto sm:px-3"
          aria-label={messages.login}
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="h-5 w-5 shrink-0 sm:hidden"
            fill="none"
          >
            <path
              d="M13 4.75h4a1.75 1.75 0 0 1 1.75 1.75v11A1.75 1.75 0 0 1 17 19.25h-4"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M10 7.5 14.5 12 10 16.5M14 12H5.25"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="hidden sm:inline">{messages.login}</span>
        </Link>
        <Link
          href={withLang("/register", locale)}
          className="hidden h-9 shrink-0 items-center rounded-md border border-[#2f639a] bg-[#082650]/80 px-3 text-sm font-medium text-[#e2efff] whitespace-nowrap transition hover:border-[#4e86c3] hover:bg-[#0c3466] md:inline-flex"
        >
          {messages.register}
        </Link>
      </div>
    );
  }

  const myListingsHref = withLang("/containers/mine", locale);
  const companies = await getCompaniesCollection();
  const ownedCompany = await companies.findOne(
    { createdByUserId: user._id },
    { projection: { _id: 1, slug: 1, isBlocked: 1 } },
  );
  const hasOwnedCompany = Boolean(ownedCompany?._id);
  const companyPanelHref = ownedCompany?.slug
    ? withLang(`/companies/${ownedCompany.slug}`, locale)
    : undefined;

  return (
    <div className="flex min-w-0 flex-nowrap items-center justify-end gap-2 text-sm whitespace-nowrap">
      <Link
        href={myListingsHref}
        className="hidden h-9 shrink-0 items-center rounded-md border border-[#2f639a] bg-[#082650]/80 px-3 text-sm text-[#dbeafe] whitespace-nowrap transition hover:border-[#4e86c3] hover:bg-[#0c3466] md:inline-flex"
      >
        {messages.myListings}
      </Link>
      <UserAccountMenu
        userName={user.name}
        accountTypeLabel={messages.accountType}
        roleLabel={roleMessages[user.role]}
        isEmailVerified={user.authProvider !== "local" || user.isEmailVerified !== false}
        unverifiedAccountLabel={messages.unverifiedAccount}
        isUserBlocked={user.isBlocked === true}
        hasBlockedCompany={ownedCompany?.isBlocked === true}
        blockedUserLabel={messages.blockedUser}
        blockedCompanyLabel={messages.blockedCompany}
        adminPanelLabel={user.role === USER_ROLE.ADMIN ? messages.admin : undefined}
        adminPanelHref={user.role === USER_ROLE.ADMIN ? withLang("/admin", locale) : undefined}
        companyPanelLabel={
          hasOwnedCompany && companyPanelHref ? messages.companyPanel : undefined
        }
        companyPanelHref={companyPanelHref}
        myListingsLabel={messages.myListings}
        myListingsHref={myListingsHref}
        settingsLabel={messages.settings}
        settingsHref={withLang("/settings", locale)}
        logoutLabel={messages.logout}
      />
    </div>
  );
}
