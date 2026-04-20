import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME } from "@/lib/auth-session";
import { getCurrentUserFromToken } from "@/lib/auth-user";
import {
  formatTemplate,
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

  const cases = getMailPreviewCases();
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

      <section className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-3">
          <p className="px-2 pb-2 text-xs uppercase tracking-[0.12em] text-neutral-400">
            {messages.adminMailPreviews.templates}
          </p>
          <nav className="flex flex-col gap-1">
            {cases.map((mailCase) => {
              const isActive = mailCase.id === selectedCase.id;
              return (
                <Link
                  key={mailCase.id}
                  href={withLang(
                    `/admin/mail-previews?template=${encodeURIComponent(mailCase.id)}`,
                    locale,
                  )}
                  className={[
                    "rounded-md border px-3 py-2 text-sm transition",
                    isActive
                      ? "border-sky-500/60 bg-sky-500/10 text-sky-200"
                      : "border-neutral-800 text-neutral-300 hover:border-neutral-600 hover:text-neutral-100",
                  ].join(" ")}
                >
                  <span className="block font-medium">{mailCase.label}</span>
                  <span className="mt-0.5 block text-xs text-neutral-400">
                    {mailCase.description}
                  </span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-col gap-4">
          <article className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-neutral-400">
              {messages.adminMailPreviews.subject}
            </p>
            <p className="mt-1 text-lg font-semibold text-neutral-100">
              {selectedCase.content.subject}
            </p>
            <p className="mt-3 text-xs uppercase tracking-[0.12em] text-neutral-400">
              {messages.adminMailPreviews.mockedRecipient}
            </p>
            <p className="mt-1 text-sm text-neutral-300">{selectedCase.mockedRecipient}</p>
          </article>

          <article className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
            <p className="mb-3 text-xs uppercase tracking-[0.12em] text-neutral-400">
              {messages.adminMailPreviews.html}
            </p>
            <div className="overflow-hidden rounded-lg border border-neutral-700 bg-white">
              <iframe
                title={formatTemplate(messages.adminMailPreviews.frameTitle, {
                  label: selectedCase.label,
                })}
                sandbox=""
                srcDoc={selectedCase.content.html}
                className="h-[760px] w-full"
              />
            </div>
          </article>

          <article className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
            <p className="mb-3 text-xs uppercase tracking-[0.12em] text-neutral-400">
              {messages.adminMailPreviews.textVersion}
            </p>
            <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-neutral-700 bg-neutral-950 p-3 text-xs leading-6 text-neutral-200">
              {selectedCase.content.text}
            </pre>
          </article>
        </div>
      </section>
    </main>
  );
}
