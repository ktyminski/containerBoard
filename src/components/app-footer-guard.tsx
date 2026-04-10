"use client";

import { usePathname } from "next/navigation";
import { AppFooter } from "@/components/app-footer";
import type { AppLocale, AppMessages } from "@/lib/i18n";

type AppFooterGuardProps = {
  locale: AppLocale;
  messages: AppMessages["footer"];
};

export function AppFooterGuard({
  locale,
  messages,
}: AppFooterGuardProps) {
  const pathname = usePathname();

  if (pathname === "/maps" || pathname.startsWith("/maps/")) {
    return null;
  }

  return <AppFooter locale={locale} messages={messages} />;
}
