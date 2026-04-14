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
  roleMessages: AppMessages["roles"];
};

export async function AuthNav({ locale, roleMessages }: AuthNavProps) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const user = token ? await getCurrentUserFromToken(token) : null;

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href={withLang("/login", locale)}
          className="inline-flex h-9 shrink-0 items-center rounded-md border border-[#2f639a] bg-[#082650]/80 px-3 text-sm text-[#e2efff] whitespace-nowrap transition hover:border-[#4e86c3] hover:bg-[#0c3466]"
        >
          Zaloguj
        </Link>
        <Link
          href={withLang("/register", locale)}
          className="hidden h-9 shrink-0 items-center rounded-md border border-[#2f639a] bg-[#082650]/80 px-3 text-sm font-medium text-[#e2efff] whitespace-nowrap transition hover:border-[#4e86c3] hover:bg-[#0c3466] md:inline-flex"
        >
          Rejestracja
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
      {user.role === USER_ROLE.ADMIN ? (
        <Link
          href={withLang("/admin", locale)}
          className="hidden h-9 shrink-0 items-center rounded-md border border-[#46a4e0] bg-[#093161]/80 px-3 text-sm text-[#a7e0ff] whitespace-nowrap transition hover:border-[#74c1ec] hover:bg-[#0f3f75] md:inline-flex"
        >
          Admin
        </Link>
      ) : null}
      <Link
        href={myListingsHref}
        className="hidden h-9 shrink-0 items-center rounded-md border border-[#2f639a] bg-[#082650]/80 px-3 text-sm text-[#dbeafe] whitespace-nowrap transition hover:border-[#4e86c3] hover:bg-[#0c3466] md:inline-flex"
      >
        Moje ogloszenia
      </Link>
      <UserAccountMenu
        userName={user.name}
        accountTypeLabel="Rola"
        roleLabel={roleMessages[user.role]}
        isEmailVerified={user.authProvider !== "local" || user.isEmailVerified !== false}
        unverifiedAccountLabel="Konto niezweryfikowane"
        isUserBlocked={user.isBlocked === true}
        hasBlockedCompany={ownedCompany?.isBlocked === true}
        blockedUserLabel="Konto zablokowane"
        blockedCompanyLabel="Firma zablokowana"
        adminPanelLabel={user.role === USER_ROLE.ADMIN ? "Admin" : undefined}
        adminPanelHref={user.role === USER_ROLE.ADMIN ? withLang("/admin", locale) : undefined}
        companyPanelLabel={hasOwnedCompany && companyPanelHref ? "Moja firma" : undefined}
        companyPanelHref={companyPanelHref}
        myListingsLabel="Moje ogloszenia"
        myListingsHref={myListingsHref}
        settingsLabel="Ustawienia"
        settingsHref={withLang("/settings", locale)}
        logoutLabel="Wyloguj"
      />
    </div>
  );
}
