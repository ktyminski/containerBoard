import type { Metadata } from "next";
import { cookies } from "next/headers";
import { StaticPageFrame } from "@/components/static-page-frame";
import { getLocaleFromRequest, getMessages, LOCALE_COOKIE_NAME } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/seo";

type AboutPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  searchParams,
}: AboutPageProps): Promise<Metadata> {
  const params = await searchParams;
  const cookieStore = await cookies();
  const locale = getLocaleFromRequest({
    params,
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
  });
  const messages = getMessages(locale);
  const page = messages.infoPages.about;

  return buildPageMetadata({
    path: "/about",
    locale,
    title: page.title,
    description: page.intro,
  });
}

export default async function AboutPage({ searchParams }: AboutPageProps) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const locale = getLocaleFromRequest({
    params,
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
  });
  const messages = getMessages(locale);
  const page = messages.infoPages.about;

  return (
    <StaticPageFrame
      locale={locale}
      backLabel={messages.companyDetails.back}
      mapLabel={locale === "pl" ? "PrzejdÅº do ogÅ‚oszeÅ„" : messages.home.whatBrowseAnnouncementsCta}
      mapHref="/list"
      title={page.title}
      intro={page.intro}
      links={[
        { href: "/contact", label: messages.footer.contact },
        { href: "/list", label: messages.mapModules.tabs.companies },
      ]}
    >
      <p className="whitespace-pre-line">{page.body}</p>
    </StaticPageFrame>
  );
}

