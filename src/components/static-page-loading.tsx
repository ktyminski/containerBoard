import { cookies } from "next/headers";
import { getMessages, LOCALE_COOKIE_NAME, resolveLocale } from "@/lib/i18n";

export default async function StaticPageLoading() {
  const cookieStore = await cookies();
  const locale = resolveLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
  const messages = getMessages(locale);

  return (
    <main className="mx-auto flex min-h-[50vh] w-full max-w-4xl flex-col items-center justify-center gap-4 px-4 py-10 text-center sm:px-6">
      <div
        className="h-10 w-10 animate-spin rounded-full border-2 border-slate-500 border-t-sky-400"
        aria-label={messages.common.loading}
      />
      <p className="text-sm text-slate-300">{messages.common.loading}</p>
    </main>
  );
}
