import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME } from "@/lib/auth-session";
import { getCurrentUserFromToken } from "@/lib/auth-user";
import { AdminPanelTabs } from "@/components/admin-panel-tabs";
import { USER_ROLE } from "@/lib/user-roles";
import {
  getLocaleFromRequest,
  getMessages,
  LOCALE_COOKIE_NAME,
} from "@/lib/i18n";

type AdminPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const locale = getLocaleFromRequest({
    params,
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
  });
  const tabParam = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const messages = getMessages(locale);

  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    redirect("/login?next=/admin");
  }

  const currentUser = await getCurrentUserFromToken(token);
  if (!currentUser) {
    redirect("/login?next=/admin");
  }

  if (currentUser.role !== USER_ROLE.ADMIN) {
    redirect("/");
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5">
        <h1 className="text-2xl font-semibold sm:text-3xl">Panel administratora</h1>
        <p className="mt-2 text-sm text-neutral-300">
          Zarzadzaj kontenerami, uzytkownikami i firmami.
        </p>
      </header>
      <AdminPanelTabs
        locale={locale}
        initialTab={tabParam}
        usersMessages={messages.adminUsers}
        companiesMessages={messages.adminCompanies}
        companyStatusMessages={messages.companyStatus}
        roleMessages={messages.roles}
      />
    </main>
  );
}

