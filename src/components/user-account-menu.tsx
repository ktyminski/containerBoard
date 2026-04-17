"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type UserAccountMenuProps = {
  userName: string;
  accountTypeLabel: string;
  roleLabel: string;
  isEmailVerified: boolean;
  unverifiedAccountLabel: string;
  isUserBlocked: boolean;
  hasBlockedCompany: boolean;
  blockedUserLabel: string;
  blockedCompanyLabel: string;
  adminPanelLabel?: string;
  adminPanelHref?: string;
  companyPanelLabel?: string;
  companyPanelHref?: string;
  myListingsLabel?: string;
  myListingsHref?: string;
  settingsLabel: string;
  settingsHref: string;
  logoutLabel: string;
};

export function UserAccountMenu({
  userName,
  accountTypeLabel,
  roleLabel,
  isEmailVerified,
  unverifiedAccountLabel,
  isUserBlocked,
  hasBlockedCompany,
  blockedUserLabel,
  blockedCompanyLabel,
  adminPanelLabel,
  adminPanelHref,
  companyPanelLabel,
  companyPanelHref,
  myListingsLabel,
  myListingsHref,
  settingsLabel,
  settingsHref,
  logoutLabel,
}: UserAccountMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonUserName =
    userName.length > 20 ? `${userName.slice(0, 20).trimEnd()}...` : userName;
  const statusLabel = isUserBlocked
    ? blockedUserLabel
    : hasBlockedCompany
      ? blockedCompanyLabel
      : !isEmailVerified
        ? unverifiedAccountLabel
        : null;

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
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#2f639a] bg-[#082650]/80 text-[#e2efff] transition hover:border-[#4e86c3] hover:bg-[#0c3466] md:h-9 md:w-auto md:gap-2 md:px-3 md:py-0 md:text-sm"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={userName}
        onClick={() => {
          setIsOpen((current) => !current);
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 md:hidden" fill="none">
          <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M5.5 19.25C6.3 16.55 8.73 14.75 12 14.75C15.27 14.75 17.7 16.55 18.5 19.25"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
        <span className="hidden max-w-36 truncate md:inline">{buttonUserName}</span>
        {statusLabel ? (
          <span
            className={
              isUserBlocked || hasBlockedCompany
                ? "absolute -top-1 -right-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-rose-600 bg-rose-500/10 text-[10px] font-bold text-rose-300 md:hidden"
                : "absolute -top-1 -right-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-amber-600 bg-amber-500/10 text-[10px] font-bold text-amber-300 md:hidden"
            }
            title={statusLabel}
            aria-label={statusLabel}
          >
            !
          </span>
        ) : null}
        {!isEmailVerified ? (
          <span
            className="hidden h-5 w-5 items-center justify-center rounded-full border border-amber-600 bg-amber-500/10 text-[11px] font-bold text-amber-300 md:inline-flex"
            title={unverifiedAccountLabel}
            aria-label={unverifiedAccountLabel}
          >
            !
          </span>
        ) : null}
        {isUserBlocked || hasBlockedCompany ? (
          <span
            className="hidden h-5 w-5 items-center justify-center rounded-full border border-rose-600 bg-rose-500/10 text-[11px] font-bold text-rose-300 md:inline-flex"
            title={isUserBlocked ? blockedUserLabel : blockedCompanyLabel}
            aria-label={isUserBlocked ? blockedUserLabel : blockedCompanyLabel}
          >
            !
          </span>
        ) : null}
        <svg
          viewBox="0 0 20 20"
          aria-hidden="true"
          className={`hidden h-4 w-4 text-[#9ecbf0] transition-transform md:inline ${isOpen ? "rotate-180" : ""}`}
        >
          <path d="M5.5 7.25 10 12.75l4.5-5.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      </button>
      {isOpen ? (
        <div className="absolute right-0 z-20 mt-2 grid min-w-52 gap-1 rounded-md border border-[#24558d] bg-[#051c3f] p-2 shadow-[0_20px_40px_-22px_rgba(3,16,38,0.95)]">
          <div className="rounded-md border border-[#2f639a] bg-[#082650]/85 px-3 py-2">
            <p className="truncate text-sm text-[#e2efff]">{userName}</p>
            <p className="mt-1 text-xs text-[#9ecbf0]">
              {accountTypeLabel}: {roleLabel}
            </p>
            {!isEmailVerified ? (
              <p className="mt-1 text-xs text-amber-300">{unverifiedAccountLabel}</p>
            ) : null}
            {isUserBlocked || hasBlockedCompany ? (
              <p className="mt-1 text-xs text-rose-300">
                {isUserBlocked ? blockedUserLabel : blockedCompanyLabel}
              </p>
            ) : null}
          </div>
          {adminPanelLabel && adminPanelHref ? (
            <Link
              href={adminPanelHref}
              className="whitespace-nowrap rounded-md px-3 py-2 text-left text-sm text-[#a7e0ff] transition hover:bg-[#103969]"
              onClick={() => {
                setIsOpen(false);
              }}
            >
              {adminPanelLabel}
            </Link>
          ) : null}
          {myListingsLabel && myListingsHref ? (
            <Link
              href={myListingsHref}
              className="whitespace-nowrap rounded-md px-3 py-2 text-left text-sm text-[#dbeafe] transition hover:bg-[#103969]"
              onClick={() => {
                setIsOpen(false);
              }}
            >
              {myListingsLabel}
            </Link>
          ) : null}
          {companyPanelLabel && companyPanelHref ? (
            <Link
              href={companyPanelHref}
              className="inline-flex items-center justify-between gap-2 whitespace-nowrap rounded-md px-3 py-2 text-left text-sm text-[#dbeafe] transition hover:bg-[#103969]"
              onClick={() => {
                setIsOpen(false);
              }}
            >
              <span>{companyPanelLabel}</span>
              {hasBlockedCompany ? (
                <span
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-rose-600 bg-rose-500/10 text-[11px] font-bold"
                  title={blockedCompanyLabel}
                  aria-label={blockedCompanyLabel}
                >
                  !
                </span>
              ) : null}
            </Link>
          ) : null}
          <Link
            href={settingsHref}
            className="whitespace-nowrap rounded-md px-3 py-2 text-left text-sm text-[#dbeafe] transition hover:bg-[#103969]"
            onClick={() => {
              setIsOpen(false);
            }}
          >
            {settingsLabel}
          </Link>
          <form action="/api/auth/logout?redirect=1" method="post">
            <button
              type="submit"
              className="w-full rounded-md px-3 py-2 text-left text-sm text-[#dbeafe] transition hover:bg-[#103969]"
            >
              {logoutLabel}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
