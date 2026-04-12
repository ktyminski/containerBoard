import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ResetPasswordForm } from "@/components/reset-password-form";
import { getLocaleFromRequest, getMessages, LOCALE_COOKIE_NAME } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/seo";
import { getTurnstileSiteKey } from "@/lib/turnstile";

type ResetPasswordPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  searchParams,
}: ResetPasswordPageProps): Promise<Metadata> {
  const params = await searchParams;
  const cookieStore = await cookies();
  const locale = getLocaleFromRequest({
    params,
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
  });
  const messages = getMessages(locale);

  return buildPageMetadata({
    path: "/reset-password",
    locale,
    title: messages.authForm.resetPasswordTitle,
    description: messages.authForm.resetPasswordSubtitle,
    noIndex: true,
  });
}

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const locale = getLocaleFromRequest({
    params,
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
  });
  const messages = getMessages(locale);
  const turnstileSiteKey = getTurnstileSiteKey();
  const token = Array.isArray(params.token) ? params.token[0] : params.token ?? "";

  return (
    <div className="px-4 py-8 text-neutral-100 sm:py-10">
      <main className="mx-auto flex w-full max-w-7xl justify-center">
        <ResetPasswordForm
          locale={locale}
          messages={messages.authForm}
          token={token}
          turnstileSiteKey={turnstileSiteKey}
        />
      </main>
    </div>
  );
}

