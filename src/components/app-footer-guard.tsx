"use client";

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
  return <AppFooter locale={locale} messages={messages} />;
}
