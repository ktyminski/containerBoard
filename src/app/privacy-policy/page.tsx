import type { Metadata } from "next";
import { cookies } from "next/headers";
import { StaticPageFrame } from "@/components/static-page-frame";
import { StaticRichSections } from "@/components/static-rich-sections";
import { getLocaleFromRequest, getMessages, LOCALE_COOKIE_NAME } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/seo";

type PrivacyPolicyPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  searchParams,
}: PrivacyPolicyPageProps): Promise<Metadata> {
  const params = await searchParams;
  const cookieStore = await cookies();
  const locale = getLocaleFromRequest({
    params,
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
  });
  const messages = getMessages(locale);
  const page = messages.legalPages.privacy;

  return buildPageMetadata({
    path: "/privacy-policy",
    locale,
    title: page.title,
    description: page.intro,
  });
}

export default async function PrivacyPolicyPage({
  searchParams,
}: PrivacyPolicyPageProps) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const locale = getLocaleFromRequest({
    params,
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
  });
  const messages = getMessages(locale);
  const page = messages.legalPages.privacy;

  return (
    <StaticPageFrame
      locale={locale}
      backLabel={messages.companyDetails.back}
      mapLabel={messages.staticPages.viewListings}
      mapHref="/list"
      title={page.title}
      intro={page.intro}
      links={[
        { href: "/terms", label: messages.footer.terms },
        { href: "/cookies", label: messages.footer.cookies },
      ]}
    >
      <StaticRichSections sections={messages.staticPages.privacySections} />
    </StaticPageFrame>
  );
}
