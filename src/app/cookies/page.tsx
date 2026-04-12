import type { Metadata } from "next";
import { cookies } from "next/headers";
import { StaticPageFrame } from "@/components/static-page-frame";
import { getLocaleFromRequest, getMessages, LOCALE_COOKIE_NAME } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/seo";

type CookiesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  searchParams,
}: CookiesPageProps): Promise<Metadata> {
  const params = await searchParams;
  const cookieStore = await cookies();
  const locale = getLocaleFromRequest({
    params,
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
  });
  const messages = getMessages(locale);
  const page = messages.legalPages.cookies;

  return buildPageMetadata({
    path: "/cookies",
    locale,
    title: page.title,
    description: page.intro,
  });
}

export default async function CookiesPage({ searchParams }: CookiesPageProps) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const locale = getLocaleFromRequest({
    params,
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
  });
  const messages = getMessages(locale);
  const page = messages.legalPages.cookies;

  return (
    <StaticPageFrame
      locale={locale}
      backLabel={messages.companyDetails.back}
      mapLabel={messages.home.heroPrimaryCta}
      title={page.title}
      intro={page.intro}
      links={[
        { href: "/privacy-policy", label: messages.footer.privacyPolicy },
        { href: "/terms", label: messages.footer.terms },
      ]}
    >
      <div className="space-y-8">
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-neutral-100">1. Informacje ogÃ³lne</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Niniejsza Polityka cookies okreÅ›la zasady wykorzystywania plikÃ³w cookies na
              platformie ContainerBoard dostÄ™pnej pod adresem <strong>containerboard.pl</strong>.
            </li>
            <li>
              Administratorem danych jest <strong>ContainerBoard Karol Tymi&#324;ski 5842785961</strong>,
              e-mail: <strong>hello@containerboard.pl</strong>.
            </li>
            <li>
              Platforma wykorzystuje wyÅ‚Ä…cznie niezbÄ™dne pliki cookies, wymagane do jej
              prawidÅ‚owego dziaÅ‚ania.
            </li>
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-neutral-100">2. Czym sÄ… pliki cookies</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>Pliki cookies to niewielkie pliki tekstowe zapisywane na urzÄ…dzeniu uÅ¼ytkownika.</li>
            <li>
              UmoÅ¼liwiajÄ… one prawidÅ‚owe dziaÅ‚anie strony oraz zapamiÄ™tywanie podstawowych
              informacji o uÅ¼ytkowniku.
            </li>
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-neutral-100">3. Jakie cookies wykorzystujemy</h2>
          <p>
            Platforma ContainerBoard wykorzystuje wyÅ‚Ä…cznie cookies niezbÄ™dne (techniczne), w
            szczegÃ³lnoÅ›ci do:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>utrzymania sesji uÅ¼ytkownika,</li>
            <li>zapewnienia poprawnego dziaÅ‚ania formularzy,</li>
            <li>zapewnienia bezpieczeÅ„stwa (np. ochrona przed naduÅ¼yciami),</li>
            <li>zapamiÄ™tywania podstawowych ustawieÅ„ technicznych.</li>
          </ul>
          <p>Cookies te nie sÅ‚uÅ¼Ä… do Å›ledzenia uÅ¼ytkownika ani do celÃ³w marketingowych.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-neutral-100">4. Cookies podmiotÃ³w trzecich</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Platforma nie wykorzystuje cookies marketingowych ani analitycznych podmiotÃ³w
              trzecich.
            </li>
            <li>
              W przypadku wprowadzenia takich narzÄ™dzi w przyszÅ‚oÅ›ci, polityka cookies zostanie
              odpowiednio zaktualizowana.
            </li>
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-neutral-100">5. ZarzÄ…dzanie cookies</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              UÅ¼ytkownik moÅ¼e zarzÄ…dzaÄ‡ plikami cookies za pomocÄ… ustawieÅ„ swojej przeglÄ…darki.
            </li>
            <li>
              Ograniczenie stosowania cookies moÅ¼e wpÅ‚ynÄ…Ä‡ na niektÃ³re funkcjonalnoÅ›ci platformy.
            </li>
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-neutral-100">6. Zmiany polityki cookies</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>Polityka cookies moÅ¼e byÄ‡ aktualizowana.</li>
            <li>Nowa wersja obowiÄ…zuje od momentu jej opublikowania na stronie.</li>
          </ol>
        </section>
      </div>
    </StaticPageFrame>
  );
}







