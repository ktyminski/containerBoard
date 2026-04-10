"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/toast-provider";

type AddActionsMenuProps = {
  buttonLabel: string;
  addCompanyLabel: string;
  addAnnouncementLabel: string;
  addOfferLabel: string;
  addLeadRequestLabel: string;
  addCompanyHref: string;
  addAnnouncementHref: string;
  addOfferHref: string;
  addLeadRequestHref: string;
  blockAddCompany?: boolean;
  addCompanyBlockedMessage?: string;
  buttonClassName?: string;
  menuClassName?: string;
  collapseLabelOnMobile?: boolean;
};

export function AddActionsMenu({
  buttonLabel,
  addCompanyLabel,
  addAnnouncementLabel,
  addOfferLabel,
  addLeadRequestLabel,
  addCompanyHref,
  addAnnouncementHref,
  addOfferHref,
  addLeadRequestHref,
  blockAddCompany = false,
  addCompanyBlockedMessage = "",
  buttonClassName,
  menuClassName,
  collapseLabelOnMobile = true,
}: AddActionsMenuProps) {
  const toast = useToast();
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
        className={
          buttonClassName ??
          "inline-flex h-10 w-10 items-center justify-center rounded-md border border-emerald-700 text-lg font-semibold text-emerald-200 hover:border-emerald-500 md:h-auto md:w-auto md:px-3 md:py-2 md:text-sm md:font-normal"
        }
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={buttonLabel}
        title={buttonLabel}
        onClick={() => {
          setIsOpen((current) => !current);
        }}
      >
        {collapseLabelOnMobile ? (
          <>
            <span className="md:hidden">+</span>
            <span className="hidden md:inline">{buttonLabel}</span>
          </>
        ) : (
          <span>{buttonLabel}</span>
        )}
      </button>
      {isOpen ? (
        <div
          className={
            menuClassName ??
            "absolute right-0 z-20 mt-2 grid min-w-64 gap-1 rounded-md border border-slate-700 bg-slate-900 p-2 shadow-lg"
          }
        >
          <Link
            href={addCompanyHref}
            className="whitespace-nowrap rounded-md px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
            onClick={(event) => {
              if (blockAddCompany) {
                event.preventDefault();
                if (addCompanyBlockedMessage) {
                  toast.warning(addCompanyBlockedMessage);
                }
              }
              setIsOpen(false);
            }}
          >
            {addCompanyLabel}
          </Link>
          <Link
            href={addAnnouncementHref}
            className="whitespace-nowrap rounded-md px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
            onClick={() => {
              setIsOpen(false);
            }}
          >
            {addAnnouncementLabel}
          </Link>
          <Link
            href={addOfferHref}
            className="whitespace-nowrap rounded-md px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
            onClick={() => {
              setIsOpen(false);
            }}
          >
            {addOfferLabel}
          </Link>
          <Link
            href={addLeadRequestHref}
            className="whitespace-nowrap rounded-md px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
            onClick={() => {
              setIsOpen(false);
            }}
          >
            {addLeadRequestLabel}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
