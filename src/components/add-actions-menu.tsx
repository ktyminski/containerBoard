"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { AppLocale } from "@/lib/i18n";
import { withLang } from "@/lib/i18n";

type AddActionsMenuProps = {
  locale: AppLocale;
};

export function AddActionsMenu({ locale }: AddActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target || containerRef.current?.contains(target)) {
        return;
      }
      setIsOpen(false);
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        className="inline-flex h-9 shrink-0 items-center gap-1 rounded-md border border-[#67c7ff] bg-[linear-gradient(90deg,#0ea5e9_0%,#38bdf8_52%,#7dd3fc_100%)] px-2.5 text-xs font-semibold text-[#032447] shadow-[0_10px_24px_-14px_rgba(56,189,248,0.95)] transition hover:brightness-110"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Dodaj"
        onClick={() => {
          setIsOpen((current) => !current);
        }}
      >
        + Dodaj
        <svg
          viewBox="0 0 20 20"
          aria-hidden="true"
          className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
        >
          <path d="M5.5 7.25 10 12.75l4.5-5.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      </button>
      {isOpen ? (
        <div className="absolute right-0 top-[calc(100%+0.45rem)] z-50 grid min-w-44 gap-1 rounded-md border border-[#24558d] bg-[#051c3f] p-1.5 shadow-[0_20px_40px_-22px_rgba(3,16,38,0.95)]">
          <Link
            href={withLang("/containers/new", locale)}
            className="rounded-md px-3 py-2 text-sm text-[#dbeafe] transition hover:bg-[#103969]"
            onClick={() => {
              setIsOpen(false);
            }}
          >
            Ogloszenie
          </Link>
          <Link
            href={withLang("/companies/new", locale)}
            className="rounded-md px-3 py-2 text-sm text-[#dbeafe] transition hover:bg-[#103969]"
            onClick={() => {
              setIsOpen(false);
            }}
          >
            Dodaj firme
          </Link>
        </div>
      ) : null}
    </div>
  );
}
