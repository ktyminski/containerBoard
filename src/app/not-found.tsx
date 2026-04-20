import Link from "next/link";
import { cookies } from "next/headers";
import { getMessages, LOCALE_COOKIE_NAME, resolveLocale, withLang } from "@/lib/i18n";

export default async function NotFoundPage() {
  const cookieStore = await cookies();
  const locale = resolveLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
  const messages = getMessages(locale).notFoundPage;

  return (
    <main className="flex h-full min-h-full items-center justify-center bg-neutral-200 px-4 py-8 sm:px-6 sm:py-10">
      <section className="w-full max-w-3xl">
        <div className="w-full rounded-md border border-neutral-300 bg-white p-8 text-center shadow-[0_24px_40px_-34px_rgba(15,23,42,0.45)] sm:p-10">
          <p className="text-xs font-semibold tracking-[0.24em] text-[#155e75] uppercase">
            {messages.eyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-[#10233f] sm:text-4xl">
            {messages.title}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[#4e6178] sm:text-base">
            {messages.description}
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href={withLang("/list", locale)}
              className="inline-flex items-center justify-center rounded-md bg-[linear-gradient(135deg,#c026d3_0%,#db2777_50%,#ea580c_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_22px_44px_-26px_rgba(192,38,211,0.7)] transition duration-200 hover:shadow-[0_28px_54px_-28px_rgba(192,38,211,0.85)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c026d3]"
            >
              {messages.cta}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
