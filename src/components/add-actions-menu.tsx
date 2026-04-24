import Link from "next/link";
import type { AppLocale } from "@/lib/i18n";
import { withLang } from "@/lib/i18n";

type AddActionsMenuProps = {
  locale: AppLocale;
  label: string;
  desktopLabel?: string;
};

export function AddActionsMenu({ locale, label, desktopLabel }: AddActionsMenuProps) {
  return (
    <Link
      href={withLang("/containers/new", locale)}
      aria-label={label}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#67c7ff] bg-[linear-gradient(90deg,#0ea5e9_0%,#38bdf8_52%,#7dd3fc_100%)] text-sm font-medium text-[#032447] shadow-[0_10px_24px_-14px_rgba(56,189,248,0.95)] transition hover:brightness-110 sm:w-auto sm:gap-1 sm:px-3"
    >
      <span aria-hidden="true" className="text-base leading-none">
        +
      </span>
      <span className="hidden sm:inline">{desktopLabel ?? label}</span>
    </Link>
  );
}
