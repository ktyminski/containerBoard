"use client";

import Link from "next/link";
import { withLang, type AppLocale, type AppMessages } from "@/lib/i18n";
import { FacebookIcon, InstagramIcon, LinkedInIcon } from "@/components/social-icons";

type AppFooterProps = {
  locale: AppLocale;
  messages: AppMessages["footer"];
};

export function AppFooter({ locale, messages }: AppFooterProps) {
  return (
    <footer className="relative mt-10 overflow-hidden border-t border-[#1f4f86] bg-[linear-gradient(180deg,#031a3c_0%,#05244f_100%)]">
      <div className="relative z-10 mx-auto w-full max-w-5xl px-4 py-8 text-xs text-[#bcd6f3]">
        <p className="text-left text-sm font-medium tracking-wide">
          <span className="text-[#e2efff]">Container</span>
          <span className="text-[#38bdf8]">Board</span>
        </p>
        <nav aria-label={messages.infoLinksAria} className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link href={withLang("/list", locale)} className="transition hover:text-[#7dd3fc]">
            Wyszukiwarka
          </Link>
          <Link href={withLang("/containers/new", locale)} className="transition hover:text-[#7dd3fc]">
            Dodaj kontener
          </Link>
          <Link href={withLang("/privacy-policy", locale)} className="transition hover:text-[#7dd3fc]">
            {messages.privacyPolicy}
          </Link>
          <Link href={withLang("/cookies", locale)} className="transition hover:text-[#7dd3fc]">
            Cookies
          </Link>
          <Link href={withLang("/terms", locale)} className="transition hover:text-[#7dd3fc]">
            {messages.terms}
          </Link>
        </nav>
        <div className="mt-6 h-px w-full max-w-3xl bg-[#1f4f86]" />
        <div className="mt-4 flex items-center gap-2 text-[#bcd6f3]">
          <a
            href="https://www.linkedin.com/"
            target="_blank"
            rel="noreferrer noopener"
            aria-label={messages.linkedinAria}
            className="rounded-md border border-[#2f639a] bg-[#082650]/70 p-2.5 transition hover:border-[#67c7ff] hover:text-[#e2efff]"
          >
            <LinkedInIcon />
          </a>
          <a
            href="https://www.facebook.com/"
            target="_blank"
            rel="noreferrer noopener"
            aria-label={messages.facebookAria}
            className="rounded-md border border-[#2f639a] bg-[#082650]/70 p-2.5 transition hover:border-[#67c7ff] hover:text-[#e2efff]"
          >
            <FacebookIcon />
          </a>
          <a
            href="https://www.instagram.com/"
            target="_blank"
            rel="noreferrer noopener"
            aria-label={messages.instagramAria}
            className="rounded-md border border-[#2f639a] bg-[#082650]/70 p-2.5 transition hover:border-[#67c7ff] hover:text-[#e2efff]"
          >
            <InstagramIcon />
          </a>
        </div>
        <p className="mt-4 text-left text-[11px] tracking-wide text-[#8fb4dd]">
          © 2026 ContainerBoard. Wszystkie prawa zastrzezone.
        </p>
      </div>
    </footer>
  );
}

