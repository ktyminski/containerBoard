"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  SUPPORTED_LOCALES,
  type AppLocale,
  type AppMessages,
} from "@/lib/i18n";

type LanguageSwitcherProps = {
  locale: AppLocale;
  messages: AppMessages["languageSwitcher"];
};

function FlagIcon({ locale }: { locale: AppLocale }) {
  if (locale === "pl") {
    return (
      <svg viewBox="0 0 28 20" className="h-4 w-6 rounded-[3px] shadow-sm" aria-hidden="true">
        <rect width="28" height="10" fill="#ffffff" />
        <rect y="10" width="28" height="10" fill="#dc2626" />
      </svg>
    );
  }

  if (locale === "de") {
    return (
      <svg viewBox="0 0 28 20" className="h-4 w-6 rounded-[3px] shadow-sm" aria-hidden="true">
        <rect width="28" height="6.67" fill="#111827" />
        <rect y="6.67" width="28" height="6.67" fill="#dc2626" />
        <rect y="13.34" width="28" height="6.66" fill="#f59e0b" />
      </svg>
    );
  }

  if (locale === "uk") {
    return (
      <svg viewBox="0 0 28 20" className="h-4 w-6 rounded-[3px] shadow-sm" aria-hidden="true">
        <rect width="28" height="10" fill="#2563eb" />
        <rect y="10" width="28" height="10" fill="#facc15" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 28 20" className="h-4 w-6 rounded-[3px] shadow-sm" aria-hidden="true">
      <rect width="28" height="20" fill="#1d4ed8" />
      <path d="M0 2.2V0h3.1L28 17.8V20h-3.1L0 2.2Z" fill="#ffffff" />
      <path d="M24.9 0H28v2.2L3.1 20H0v-2.2L24.9 0Z" fill="#ffffff" />
      <path d="M0 4V0h1.7L28 16v4h-1.7L0 4Z" fill="#dc2626" />
      <path d="M26.3 0H28v4L1.7 20H0v-4L26.3 0Z" fill="#dc2626" />
      <rect x="11" width="6" height="20" fill="#ffffff" />
      <rect y="7" width="28" height="6" fill="#ffffff" />
      <rect x="12" width="4" height="20" fill="#dc2626" />
      <rect y="8" width="28" height="4" fill="#dc2626" />
    </svg>
  );
}

export function LanguageSwitcher({ locale, messages }: LanguageSwitcherProps) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const activeLocale = SUPPORTED_LOCALES.includes(locale) ? locale : "pl";
  const labels = messages.labels as Record<string, string>;
  const activeLabel = labels[activeLocale] ?? "Polski";

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (nextLocale: AppLocale) => {
    setIsOpen(false);
    void (async () => {
      try {
        await fetch("/api/locale", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ locale: nextLocale }),
        });
      } finally {
        router.refresh();
      }
    })();
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        aria-label={messages.ariaLabel}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        className="inline-flex h-9 items-center gap-2 rounded-md border border-[#2f639a] bg-[#082650]/80 px-2.5 text-sm font-medium text-[#e2efff] transition hover:border-[#4e86c3] hover:bg-[#0c3466]"
      >
        <FlagIcon locale={activeLocale} />
        <svg
          viewBox="0 0 12 12"
          className={`h-3 w-3 text-[#bfdbfe] transition-transform ${isOpen ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <path
            d="M2.25 4.5 6 8.25 9.75 4.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="sr-only">{activeLabel}</span>
      </button>

      {isOpen ? (
        <div
          role="menu"
          aria-label={messages.ariaLabel}
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 min-w-[12rem] overflow-hidden rounded-md border border-[#2f639a] bg-[#082650] shadow-[0_18px_40px_-24px_rgba(2,6,23,0.9)]"
        >
          <ul className="py-1">
            {SUPPORTED_LOCALES.map((optionLocale) => {
              const optionLabel = labels[optionLocale] ?? optionLocale.toUpperCase();
              const isActive = optionLocale === activeLocale;

              return (
                <li key={optionLocale}>
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={isActive}
                    onClick={() => handleSelect(optionLocale)}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition ${
                      isActive
                        ? "bg-[#103b74] text-white"
                        : "text-[#dbeafe] hover:bg-[#0c3466]"
                    }`}
                  >
                    <FlagIcon locale={optionLocale} />
                    <span className="flex-1">{optionLabel}</span>
                    {isActive ? (
                      <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
                        <path
                          d="M3.5 8.25 6.5 11.25 12.5 5.25"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.75"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
