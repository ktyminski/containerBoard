import type { ReactNode } from "react";
import Link from "next/link";
import { SmartBackButton } from "@/components/smart-back-button";
import { withLang, type AppLocale } from "@/lib/i18n";

type StaticPageFrameProps = {
  locale: AppLocale;
  backLabel: string;
  mapLabel?: string;
  title: string;
  intro: string;
  children?: ReactNode;
  links?: Array<{
    href: string;
    label: string;
  }>;
  backHref?: string;
  mapHref?: string;
};

export function StaticPageFrame({
  locale,
  backLabel,
  mapLabel,
  title,
  intro,
  children,
  links = [],
  backHref = "/",
  mapHref = "/maps",
}: StaticPageFrameProps) {
  return (
    <section className="relative overflow-hidden">
      <main className="relative mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SmartBackButton
            label={backLabel}
            fallbackHref={withLang(backHref, locale)}
            className="inline-flex w-fit items-center gap-2 rounded-md border border-neutral-500 bg-white px-3 py-2 text-sm text-neutral-700 transition-colors hover:border-neutral-700 hover:bg-neutral-100"
          />
          {mapLabel ? (
            <Link
              href={withLang(mapHref, locale)}
              className="inline-flex items-center gap-2 rounded-md border border-sky-700 px-3 py-2 text-sm text-sky-200 transition-colors hover:border-sky-500"
            >
              <span>{mapLabel}</span>
              <span aria-hidden="true">&rarr;</span>
            </Link>
          ) : null}
        </div>
        <article className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-6">
          <h1 className="text-2xl font-semibold text-neutral-100 sm:text-3xl">{title}</h1>
          <div className="mt-4 space-y-4 text-sm leading-6 text-neutral-300">
            <p>{intro}</p>
            {children}
          </div>
          {links.length > 0 ? (
            <div className="mt-6 flex flex-wrap gap-3 text-xs">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={withLang(link.href, locale)}
                  className="text-sky-300 hover:text-sky-200"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          ) : null}
        </article>
      </main>
    </section>
  );
}
