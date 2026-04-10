import Link from "next/link";
import { cookies } from "next/headers";
import { UserAccountMenu } from "@/components/user-account-menu";
import { SESSION_COOKIE_NAME } from "@/lib/auth-session";
import { getCurrentUserFromToken } from "@/lib/auth-user";
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
          className="shrink-0 rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 whitespace-nowrap hover:border-slate-500"
        >
          Zaloguj
        </Link>
        <Link
          href={withLang("/register", locale)}
          className="hidden shrink-0 rounded-md bg-sky-500 px-3 py-2 text-sm font-medium text-slate-950 whitespace-nowrap hover:bg-sky-400 md:inline-flex"
        >
          Rejestracja
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-nowrap items-center justify-end gap-2 text-sm whitespace-nowrap">
      <Link
        href={withLang("/containers/new", locale)}
        className="hidden shrink-0 rounded-md border border-emerald-700 px-3 py-2 text-sm text-emerald-200 whitespace-nowrap hover:border-emerald-500 md:inline-flex"
      >
        Dodaj kontener
      </Link>
      <Link
        href={withLang("/containers/mine", locale)}
        className="hidden shrink-0 rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 whitespace-nowrap hover:border-slate-500 md:inline-flex"
      >
        Moje kontenery
      </Link>
      {user.role === USER_ROLE.ADMIN ? (
        <Link
          href={withLang("/admin", locale)}
          className="hidden shrink-0 rounded-md border border-sky-700 px-3 py-2 text-sm text-sky-200 whitespace-nowrap hover:border-sky-500 md:inline-flex"
        >
          Admin
        </Link>
      ) : null}
      <UserAccountMenu
        userName={user.name}
        accountTypeLabel="Rola"
        roleLabel={roleMessages[user.role]}
        isEmailVerified={user.authProvider !== "local" || user.isEmailVerified !== false}
        unverifiedAccountLabel="Konto niezweryfikowane"
        isUserBlocked={user.isBlocked === true}
        hasBlockedCompany={false}
        blockedUserLabel="Konto zablokowane"
        blockedCompanyLabel="Firma zablokowana"
        adminPanelLabel={user.role === USER_ROLE.ADMIN ? "Admin" : undefined}
        adminPanelHref={user.role === USER_ROLE.ADMIN ? withLang("/admin", locale) : undefined}
        companyPanelLabel={undefined}
        companyPanelHref={undefined}
        myLeadRequestsLabel="Moje kontenery"
        myLeadRequestsHref={withLang("/containers/mine", locale)}
        settingsLabel="Ustawienia"
        settingsHref={withLang("/settings", locale)}
        logoutLabel="Wyloguj"
      />
    </div>
  );
}
