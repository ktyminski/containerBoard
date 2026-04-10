import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { cookies } from "next/headers";
import { getLocaleFromRequest, getMessages, LOCALE_COOKIE_NAME } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/seo";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function sanitizeNext(next?: string): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/";
  }
  return next;
}

export async function generateMetadata({
  searchParams,
}: LoginPageProps): Promise<Metadata> {
  const params = await searchParams;
  const cookieStore = await cookies();
  const locale = getLocaleFromRequest({
    params,
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
  });
  const messages = getMessages(locale);

  return buildPageMetadata({
    path: "/login",
    locale,
    title: messages.authForm.loginTitle,
    description: messages.authForm.loginSubtitle,
    noIndex: true,
  });
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const locale = getLocaleFromRequest({
    params,
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
  });
  const messages = getMessages(locale);
  const next = Array.isArray(params.next) ? params.next[0] : params.next;
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  const notice = Array.isArray(params.notice) ? params.notice[0] : params.notice;

  return (
    <div className="px-4 py-8 text-slate-100 sm:py-10">
      <main className="mx-auto flex w-full max-w-7xl justify-center">
        <AuthForm
          mode="login"
          next={sanitizeNext(next)}
          error={error}
          notice={notice}
          locale={locale}
          messages={messages.authForm}
        />
      </main>
    </div>
  );
}
