import Link from "next/link";
import type { AppLocale } from "@/lib/i18n";
import { withLang } from "@/lib/i18n";

type AddActionsMenuProps = {
  locale: AppLocale;
};

export function AddActionsMenu({ locale }: AddActionsMenuProps) {
  return (
    <Link
      href={withLang("/containers/new", locale)}
      aria-label="Dodaj ogloszenie"
      className="inline-flex h-9 shrink-0 items-center gap-1 rounded-md border border-[#67c7ff] bg-[linear-gradient(90deg,#0ea5e9_0%,#38bdf8_52%,#7dd3fc_100%)] px-3 text-sm font-medium text-[#032447] shadow-[0_10px_24px_-14px_rgba(56,189,248,0.95)] transition hover:brightness-110"
    >
      + Dodaj
    </Link>
  );
}
