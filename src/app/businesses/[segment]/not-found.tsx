import { cookies } from "next/headers";
import { LandingNotFoundRedirect } from "@/components/landing-not-found-redirect";
import { LOCALE_COOKIE_NAME, resolveLocale, withLang } from "@/lib/i18n";

function getBusinessesNotFoundCopy(locale: "pl" | "en" | "de" | "uk") {
  if (locale === "en") {
    return {
      title: "No matching companies page",
      description:
        "We could not find enough current data for this companies landing page. You will be redirected to the companies map.",
      ctaLabel: "Open companies map",
    };
  }

  if (locale === "uk") {
    return {
      title: "Storinku kompanii ne znaideno",
      description:
        "Dlia tsoho SEO-landinhu zaraz nedostatno aktualnykh danykh. Zaraz perenapravymo vas na mapu kompanii.",
      ctaLabel: "Vidkryty mapu kompanii",
    };
  }

  if (locale === "de") {
    return {
      title: "Keine passende Unternehmensseite gefunden",
      description:
        "Für diese SEO-Landingpage gibt es aktuell nicht genug Daten. Du wirst gleich zur Unternehmenskarte weitergeleitet.",
      ctaLabel: "Unternehmenskarte öffnen",
    };
  }

  return {
    title: "Nie znaleźliśmy strony firm",
    description:
      "Dla tej strony SEO nie ma teraz wystarczającej liczby aktualnych danych. Za chwilę przekierujemy Cię na mapę firm.",
    ctaLabel: "Przejdź do mapy firm",
  };
}

export default async function CompaniesSegmentNotFound() {
  const cookieStore = await cookies();
  const locale = resolveLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
  const copy = getBusinessesNotFoundCopy(locale);

  return (
    <LandingNotFoundRedirect
      redirectHref={withLang("/maps/companies", locale)}
      title={copy.title}
      description={copy.description}
      ctaLabel={copy.ctaLabel}
    />
  );
}





