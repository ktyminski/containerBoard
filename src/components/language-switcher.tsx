"use client";

import { SUPPORTED_LOCALES, type AppLocale, type AppMessages } from "@/lib/i18n";

type LanguageSwitcherProps = {
  locale: AppLocale;
  messages: AppMessages["languageSwitcher"];
};

export function LanguageSwitcher({ locale, messages }: LanguageSwitcherProps) {
  const activeLocale: AppLocale = locale === "pl" ? "pl" : "pl";
  const labels = messages.labels as Record<string, string>;
  const activeLabel = labels[activeLocale] ?? "Polski";
  const isSingleLanguage = SUPPORTED_LOCALES.length <= 1;

  return (
    <button
      type="button"
      aria-label={messages.ariaLabel}
      title={isSingleLanguage ? "Na razie tylko jezyk polski" : messages.ariaLabel}
      disabled={isSingleLanguage}
      className={
        isSingleLanguage
          ? "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md border border-slate-700 bg-slate-950 px-2.5 text-sm font-medium text-slate-300 opacity-80 md:px-3"
          : "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md border border-slate-700 bg-slate-950 px-2.5 text-sm font-medium text-slate-100 md:px-3"
      }
    >
      <span className="rounded border border-slate-600 px-1.5 py-0.5 text-[10px] leading-none tracking-wide uppercase">
        {activeLocale}
      </span>
      <span className="hidden md:inline">{activeLabel}</span>
    </button>
  );
}
