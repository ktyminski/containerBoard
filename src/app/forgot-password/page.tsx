import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ForgotPasswordForm } from "@/components/forgot-password-form";
import { getLocaleFromRequest, getMessages, LOCALE_COOKIE_NAME } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/seo";
import { getTurnstileSiteKey } from "@/lib/turnstile";

type ForgotPasswordPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  searchParams,
}: ForgotPasswordPageProps): Promise<Metadata> {
  const params = await searchParams;
  const cookieStore = await cookies();
  const locale = getLocaleFromRequest({
    params,
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
  });
  const messages = getMessages(locale);

  return buildPageMetadata({
    path: "/forgot-password",
    locale,
    title: messages.authForm.forgotPasswordTitle,
    description: messages.authForm.forgotPasswordSubtitle,
    noIndex: true,
  });
}

export default async function ForgotPasswordPage({
  searchParams,
}: ForgotPasswordPageProps) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const locale = getLocaleFromRequest({
    params,
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
  });
  const messages = getMessages(locale);
  const turnstileSiteKey = getTurnstileSiteKey();

  return (
    <div className="px-4 py-8 text-slate-100 sm:py-10">
      <main className="mx-auto flex w-full max-w-7xl justify-center">
        <ForgotPasswordForm
          locale={locale}
          messages={messages.authForm}
          turnstileSiteKey={turnstileSiteKey}
        />
      </main>
    </div>
  );
}
