import { cookies } from "next/headers";
import { permanentRedirect } from "next/navigation";
import { LOCALE_COOKIE_NAME, resolveLocale, withLocalePrefix } from "@/lib/i18n";

export default async function TransportCompaniesRedirectPage() {
  const cookieStore = await cookies();
  const locale = resolveLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
  permanentRedirect(withLocalePrefix("/transport-companies", locale));
}
