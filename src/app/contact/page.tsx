import type { Metadata } from "next";
import { cookies } from "next/headers";
import { FacebookIcon, InstagramIcon, LinkedInIcon } from "@/components/social-icons";
import { StaticPageFrame } from "@/components/static-page-frame";
import { getLocaleFromRequest, getMessages, LOCALE_COOKIE_NAME } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/seo";

type ContactPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  searchParams,
}: ContactPageProps): Promise<Metadata> {
  const params = await searchParams;
  const cookieStore = await cookies();
  const locale = getLocaleFromRequest({
    params,
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
  });
  const messages = getMessages(locale);
  const page = messages.infoPages.contact;

  return buildPageMetadata({
    path: "/contact",
    locale,
    title: page.title,
    description: page.intro,
  });
}

export default async function ContactPage({ searchParams }: ContactPageProps) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const locale = getLocaleFromRequest({
    params,
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
  });
  const messages = getMessages(locale);
  const page = messages.infoPages.contact;
  const contactEmail = "hello@containerboard.pl";
  const contactPhone = process.env.CONTACT_PHONE?.trim() || "+48 514 443 548 (Polski | English)";
  const contactPhoneHref = contactPhone.replace(/[^\d+]/g, "");

  return (
    <StaticPageFrame
      locale={locale}
      backLabel={messages.companyDetails.back}
      mapLabel={messages.staticPages.viewListings}
      mapHref="/list"
      title={page.title}
      intro={page.intro}
      links={[
        { href: "/about", label: messages.footer.about },
      ]}
    >
      <div className="space-y-4">
        <p>{page.pointOne}</p>
        <p>{page.pointTwo}</p>
        <p>{page.pointThree}</p>
      </div>
      <div className="mt-6 space-y-4 border-t border-neutral-800/70 pt-5">
        <div className="flex flex-col gap-2 text-sm">
          <a
            href={`mailto:${contactEmail}`}
            className="inline-flex w-fit font-semibold text-sky-300 hover:text-sky-200"
          >
            {contactEmail}
          </a>
          <a
            href={`tel:${contactPhoneHref}`}
            className="inline-flex w-fit font-semibold text-neutral-100 hover:text-sky-200"
          >
            {page.phoneLabel}: {contactPhone}
          </a>
        </div>
        <div className="flex items-center gap-2 text-neutral-300">
          <a
            href="https://www.linkedin.com/"
            target="_blank"
            rel="noreferrer noopener"
            aria-label={messages.footer.linkedinAria}
            className="rounded-md border border-neutral-700 p-2.5 transition hover:border-neutral-500 hover:text-neutral-100"
          >
            <LinkedInIcon />
          </a>
          <a
            href="https://www.facebook.com/"
            target="_blank"
            rel="noreferrer noopener"
            aria-label={messages.footer.facebookAria}
            className="rounded-md border border-neutral-700 p-2.5 transition hover:border-neutral-500 hover:text-neutral-100"
          >
            <FacebookIcon />
          </a>
          <a
            href="https://www.instagram.com/"
            target="_blank"
            rel="noreferrer noopener"
            aria-label={messages.footer.instagramAria}
            className="rounded-md border border-neutral-700 p-2.5 transition hover:border-neutral-500 hover:text-neutral-100"
          >
            <InstagramIcon />
          </a>
        </div>
      </div>
    </StaticPageFrame>
  );
}
