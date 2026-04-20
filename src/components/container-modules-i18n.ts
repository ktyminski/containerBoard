import type { AppLocale, AppMessages } from "@/lib/i18n";

export type ContainerModuleMessages = AppMessages["containerModules"];

export function toIntlLocale(locale: AppLocale): string {
  if (locale === "en") {
    return "en-US";
  }
  if (locale === "de") {
    return "de-DE";
  }
  if (locale === "uk") {
    return "uk-UA";
  }
  return "pl-PL";
}
