import Link from "next/link";
import { FacebookIcon, LinkedInIcon } from "@/components/social-icons";
import { withLang, withLocalePrefix, type AppLocale, type AppMessages } from "@/lib/i18n";
import { SITE_FACEBOOK_URL, SITE_LINKEDIN_URL } from "@/lib/site-links";

type AppFooterProps = {
  locale: AppLocale;
  messages: AppMessages["footer"];
};

export function AppFooter({ locale, messages }: AppFooterProps) {
  return (
    <footer className="relative overflow-hidden border-t border-[#1f4f86] bg-[linear-gradient(180deg,#031a3c_0%,#05244f_100%)]">
      <div className="relative z-10 mx-auto w-full max-w-5xl px-4 py-8 text-xs text-[#bcd6f3]">
        <div className="flex flex-col items-start gap-0.5">
          <p className="text-left text-[15px] font-semibold tracking-[0.06em] drop-shadow-[0_1px_8px_rgba(3,169,244,0.22)]">
            <span className="text-[#e2efff]">Container</span>
            <span className="text-[#38bdf8]">Board</span>
          </p>
          <p className="pl-px text-left text-[9px] font-medium uppercase tracking-[0.18em] text-[#8fb4dd]">
            {messages.brandTagline}
          </p>
        </div>
        <nav
          aria-label={messages.infoLinksAria}
          className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2"
        >
          <Link href={withLang("/", locale)} className="transition hover:text-[#7dd3fc]">
            {messages.home}
          </Link>
          <Link href={withLang("/list", locale)} className="transition hover:text-[#7dd3fc]">
            {messages.browseListings}
          </Link>
          <Link
            href={withLocalePrefix("/shipping-containers/for-sale", locale)}
            className="transition hover:text-[#7dd3fc]"
          >
            {messages.saleSeo}
          </Link>
          <Link href={withLang("/containers/new", locale)} className="transition hover:text-[#7dd3fc]">
            {messages.addContainer}
          </Link>
          <Link href={withLang("/about", locale)} className="transition hover:text-[#7dd3fc]">
            {messages.about}
          </Link>
          <Link href={withLang("/contact", locale)} className="transition hover:text-[#7dd3fc]">
            {messages.contact}
          </Link>
          <Link href={withLang("/privacy-policy", locale)} className="transition hover:text-[#7dd3fc]">
            {messages.privacyPolicy}
          </Link>
          <Link href={withLang("/cookies", locale)} className="transition hover:text-[#7dd3fc]">
            {messages.cookies}
          </Link>
          <Link href={withLang("/terms", locale)} className="transition hover:text-[#7dd3fc]">
            {messages.terms}
          </Link>
        </nav>
        <div className="mt-6 h-px w-full max-w-3xl bg-[#1f4f86]" />
        <div className="mt-4 flex items-center gap-2 text-[#bcd6f3]">
          <a
            href={SITE_LINKEDIN_URL}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={messages.linkedinAria}
            className="rounded-md border border-[#2f639a] bg-[#082650]/70 p-2.5 transition hover:border-[#67c7ff] hover:text-[#e2efff]"
          >
            <LinkedInIcon />
          </a>
          <a
            href={SITE_FACEBOOK_URL}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={messages.facebookAria}
            className="rounded-md border border-[#2f639a] bg-[#082650]/70 p-2.5 transition hover:border-[#67c7ff] hover:text-[#e2efff]"
          >
            <FacebookIcon />
          </a>
        </div>
        <p className="mt-4 text-left text-[11px] tracking-wide text-[#8fb4dd]">
          {messages.copyrightShort}
        </p>
      </div>
    </footer>
  );
}
