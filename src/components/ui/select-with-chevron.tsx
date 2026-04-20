"use client";

import type { ReactNode, SelectHTMLAttributes } from "react";

type SelectWithChevronProps = SelectHTMLAttributes<HTMLSelectElement> & {
  children: ReactNode;
  tone?: "light" | "dark";
  wrapperClassName?: string;
};

const BASE_WRAPPER_CLASS = "relative min-w-0";
const BASE_SELECT_CLASS =
  "h-10 w-full min-w-0 appearance-none rounded-md px-3 pr-10 text-sm transition";

const SELECT_TONE_CLASS: Record<NonNullable<SelectWithChevronProps["tone"]>, string> = {
  light:
    "border border-neutral-300 bg-white text-neutral-900",
  dark:
    "border border-neutral-700 bg-neutral-950 text-neutral-100",
};

const ICON_TONE_CLASS: Record<NonNullable<SelectWithChevronProps["tone"]>, string> = {
  light: "text-neutral-500",
  dark: "text-neutral-400",
};

export function SelectWithChevron({
  className,
  children,
  wrapperClassName,
  tone = "light",
  ...selectProps
}: SelectWithChevronProps) {
  return (
    <div className={`${BASE_WRAPPER_CLASS} ${wrapperClassName ?? ""}`}>
      <select
        {...selectProps}
        className={`${BASE_SELECT_CLASS} ${SELECT_TONE_CLASS[tone]} ${className ?? ""}`}
      >
        {children}
      </select>
      <svg
        viewBox="0 0 20 20"
        aria-hidden="true"
        className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 ${ICON_TONE_CLASS[tone]}`}
        fill="none"
      >
        <path
          d="M5 7.5L10 12.5L15 7.5"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
