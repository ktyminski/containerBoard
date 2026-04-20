import Link from "next/link";
import { AddActionsMenu } from "@/components/add-actions-menu";
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
    <header className="sticky top-0 z-40 h-16 max-h-16 border-b border-[#1f4f86] bg-[linear-gradient(180deg,#031a3c_0%,#05244f_100%)] backdrop-blur">
      <div className="flex h-full w-full items-center justify-between gap-3 px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-3 whitespace-nowrap">
          <Link
            href={withLang("/", locale)}
            className="text-[15px] font-semibold tracking-[0.06em] drop-shadow-[0_1px_8px_rgba(3,169,244,0.22)]"
            aria-label="ContainerBoard"
          >
            <span className="text-[#e2efff]">Container</span>
            <span className="text-[#38bdf8]">Board</span>
          </Link>
          <Link
            href={withLang("/list", locale)}
            className="hidden shrink-0 rounded-md border border-[#2f639a] bg-[#082650]/80 px-3 py-1.5 text-xs text-[#dbeafe] whitespace-nowrap transition hover:border-[#4e86c3] hover:bg-[#0c3466] md:inline-flex"
          >
            {messages.footer.browseListings}
          </Link>
        </div>
        <div className="ml-auto flex min-w-0 items-center gap-2 whitespace-nowrap">
          <AddActionsMenu locale={locale} label={messages.footer.addContainer} />
          <AuthNav locale={locale} messages={messages.authNav} roleMessages={messages.roles} />
          <LanguageSwitcher locale={locale} messages={messages.languageSwitcher} />
        </div>
      </div>
    </header>
  );
}
