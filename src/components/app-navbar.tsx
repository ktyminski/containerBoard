import Link from "next/link";
import { AuthNav } from "@/components/auth-nav";
import { LanguageSwitcher } from "@/components/language-switcher";
import type { AppLocale, AppMessages } from "@/lib/i18n";
import { withLang } from "@/lib/i18n";

type AppNavbarProps = {
  locale: AppLocale;
  messages: AppMessages;
};

export async function AppNavbar({ locale, messages }: AppNavbarProps) {
  return (
    <header className="sticky top-0 z-40 h-16 max-h-16 border-b border-slate-800/80 bg-slate-950/95 backdrop-blur">
      <div className="flex h-full w-full items-center justify-between gap-3 px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-3 whitespace-nowrap">
          <Link
            href={withLang("/", locale)}
            className="text-sm font-semibold tracking-[0.16em] text-slate-100 uppercase"
          >
            ContainerBoard
          </Link>
          <Link
            href={withLang("/list", locale)}
            className="hidden shrink-0 rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 whitespace-nowrap hover:border-slate-500 md:inline-flex"
          >
            Tablica kontenerow
          </Link>
        </div>
        <div className="flex min-w-0 items-center gap-2 whitespace-nowrap">
          <LanguageSwitcher locale={locale} messages={messages.languageSwitcher} />
          <AuthNav locale={locale} roleMessages={messages.roles} />
        </div>
      </div>
    </header>
  );
}

