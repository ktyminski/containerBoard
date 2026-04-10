"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { withLang, type AppLocale, type AppMessages } from "@/lib/i18n";
import { FacebookIcon, InstagramIcon, LinkedInIcon } from "@/components/social-icons";

type AppFooterProps = {
  locale: AppLocale;
  messages: AppMessages["footer"];
};

export function AppFooter({ locale, messages }: AppFooterProps) {
  const pathname = usePathname();

  if (pathname.startsWith("/maps")) {
    return null;
  }

  return (
    <footer className="mt-10 border-t border-slate-800">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 text-xs text-slate-400">
        <p className="text-left text-sm font-medium tracking-wide text-slate-200">ContainerBoard</p>
        <nav aria-label={messages.infoLinksAria} className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link href={withLang("/list", locale)} className="hover:text-slate-200">
            Tablica kontenerow
          </Link>
          <Link href={withLang("/containers/new", locale)} className="hover:text-slate-200">
            Dodaj kontener
          </Link>
          <Link href={withLang("/containers/mine", locale)} className="hover:text-slate-200">
            Moje kontenery
          </Link>
          <Link href={withLang("/privacy-policy", locale)} className="hover:text-slate-200">
            {messages.privacyPolicy}
          </Link>
          <Link href={withLang("/terms", locale)} className="hover:text-slate-200">
            {messages.terms}
          </Link>
        </nav>
        <div className="mt-6 h-px w-full max-w-3xl bg-slate-800" />
        <div className="mt-4 flex items-center gap-2 text-slate-300">
          <a
            href="https://www.linkedin.com/"
            target="_blank"
            rel="noreferrer noopener"
            aria-label={messages.linkedinAria}
            className="rounded-md border border-slate-700 p-2.5 transition hover:border-slate-500 hover:text-slate-100"
          >
            <LinkedInIcon />
          </a>
          <a
            href="https://www.facebook.com/"
            target="_blank"
            rel="noreferrer noopener"
            aria-label={messages.facebookAria}
            className="rounded-md border border-slate-700 p-2.5 transition hover:border-slate-500 hover:text-slate-100"
          >
            <FacebookIcon />
          </a>
          <a
            href="https://www.instagram.com/"
            target="_blank"
            rel="noreferrer noopener"
            aria-label={messages.instagramAria}
            className="rounded-md border border-slate-700 p-2.5 transition hover:border-slate-500 hover:text-slate-100"
          >
            <InstagramIcon />
          </a>
        </div>
        <p className="mt-4 text-left text-[11px] tracking-wide text-slate-500">
          © 2026 ContainerBoard. Wszystkie prawa zastrzezone.
        </p>
      </div>
    </footer>
  );
}

