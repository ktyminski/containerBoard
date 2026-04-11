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
          ? "inline-flex h-9 w-10 shrink-0 items-center justify-center rounded-md border border-[#2f639a] bg-[#082650]/80 text-sm font-medium text-[#bfdbfe] opacity-80"
          : "inline-flex h-9 w-10 shrink-0 items-center justify-center rounded-md border border-[#2f639a] bg-[#082650]/80 text-sm font-medium text-[#e2efff] transition hover:border-[#4e86c3] hover:bg-[#0c3466]"
      }
    >
      <span className="sr-only">{activeLabel}</span>
      <span className="relative block h-4 w-6 overflow-hidden rounded-sm border border-[#4e86c3]">
        <span className="absolute inset-x-0 top-0 h-1/2 bg-white" />
        <span className="absolute inset-x-0 bottom-0 h-1/2 bg-[#dc2626]" />
      </span>
    </button>
  );
}
