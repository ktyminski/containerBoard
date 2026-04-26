import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminMailPreviewsPanel } from "@/components/admin-mail-previews-panel";
import { SESSION_COOKIE_NAME } from "@/lib/auth-session";
import { getCurrentUserFromToken } from "@/lib/auth-user";
import {
  getLocaleFromRequest,
  getMessages,
  LOCALE_COOKIE_NAME,
  withLang,
} from "@/lib/i18n";
import { getMailPreviewCases } from "@/lib/mail-preview-cases";
import { USER_ROLE } from "@/lib/user-roles";

type MailPreviewsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function MailPreviewsPage({ searchParams }: MailPreviewsPageProps) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const locale = getLocaleFromRequest({
    params,
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
  });
  const messages = getMessages(locale);

  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    redirect(withLang("/login?next=/admin/mail-previews", locale));
  }

  const currentUser = await getCurrentUserFromToken(token);
  if (!currentUser) {
    redirect(withLang("/login?next=/admin/mail-previews", locale));
  }

  if (currentUser.role !== USER_ROLE.ADMIN) {
    redirect(withLang("/list", locale));
  }

  const cases = getMailPreviewCases(messages.adminMailPreviews.cases);
  const requestedTemplate = Array.isArray(params.template) ? params.template[0] : params.template;
  const selectedCase = cases.find((item) => item.id === requestedTemplate) ?? cases[0];

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5">
        <h1 className="text-2xl font-semibold sm:text-3xl">
          {messages.adminMailPreviews.title}
        </h1>
        <p className="mt-2 text-sm text-neutral-300">{messages.adminMailPreviews.subtitle}</p>
        <div className="mt-4">
          <Link
            href={withLang("/admin", locale)}
            className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-200 hover:border-neutral-500"
          >
            {messages.adminMailPreviews.backToAdmin}
          </Link>
        </div>
      </header>
      <AdminMailPreviewsPanel
        messages={messages.adminMailPreviews}
        previewCases={cases}
        initialTemplateId={selectedCase.id}
      />
    </main>
  );
}
