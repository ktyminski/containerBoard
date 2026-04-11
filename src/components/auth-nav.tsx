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
          className="inline-flex h-9 shrink-0 items-center rounded-md border border-[#2f639a] bg-[#082650]/80 px-3 text-sm text-[#e2efff] whitespace-nowrap transition hover:border-[#4e86c3] hover:bg-[#0c3466]"
        >
          Zaloguj
        </Link>
        <Link
          href={withLang("/register", locale)}
          className="hidden h-9 shrink-0 items-center rounded-md border border-[#67c7ff] bg-[linear-gradient(90deg,#0ea5e9_0%,#38bdf8_52%,#7dd3fc_100%)] px-3 text-sm font-medium text-[#032447] whitespace-nowrap transition hover:brightness-110 md:inline-flex"
        >
          Rejestracja
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-nowrap items-center justify-end gap-2 text-sm whitespace-nowrap">
      <Link
        href={withLang("/containers/mine", locale)}
        className="hidden h-9 shrink-0 items-center rounded-md border border-[#2f639a] bg-[#082650]/80 px-3 text-sm text-[#e2efff] whitespace-nowrap transition hover:border-[#4e86c3] hover:bg-[#0c3466] md:inline-flex"
      >
        Moje kontenery
      </Link>
      {user.role === USER_ROLE.ADMIN ? (
        <Link
          href={withLang("/admin", locale)}
          className="hidden h-9 shrink-0 items-center rounded-md border border-[#46a4e0] bg-[#093161]/80 px-3 text-sm text-[#a7e0ff] whitespace-nowrap transition hover:border-[#74c1ec] hover:bg-[#0f3f75] md:inline-flex"
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
        myListingsLabel="Moje kontenery"
        myListingsHref={withLang("/containers/mine", locale)}
        settingsLabel="Ustawienia"
        settingsHref={withLang("/settings", locale)}
        logoutLabel="Wyloguj"
      />
    </div>
  );
}
