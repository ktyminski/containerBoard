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
          <h2 className="text-base font-semibold text-slate-100">1. Informacje ogólne</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Niniejsza Polityka cookies określa zasady wykorzystywania plików cookies na
              platformie ContainerBoard dostępnej pod adresem <strong>containerboard.pl</strong>.
            </li>
            <li>
              Administratorem danych jest <strong>ContainerBoard Karol Tymi&#324;ski 5842785961</strong>,
              e-mail: <strong>hello@containerboard.pl</strong>.
            </li>
            <li>
              Platforma wykorzystuje wyłącznie niezbędne pliki cookies, wymagane do jej
              prawidłowego działania.
            </li>
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-100">2. Czym są pliki cookies</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>Pliki cookies to niewielkie pliki tekstowe zapisywane na urządzeniu użytkownika.</li>
            <li>
              Umożliwiają one prawidłowe działanie strony oraz zapamiętywanie podstawowych
              informacji o użytkowniku.
            </li>
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-100">3. Jakie cookies wykorzystujemy</h2>
          <p>
            Platforma ContainerBoard wykorzystuje wyłącznie cookies niezbędne (techniczne), w
            szczególności do:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>utrzymania sesji użytkownika,</li>
            <li>zapewnienia poprawnego działania formularzy,</li>
            <li>zapewnienia bezpieczeństwa (np. ochrona przed nadużyciami),</li>
            <li>zapamiętywania podstawowych ustawień technicznych.</li>
          </ul>
          <p>Cookies te nie służą do śledzenia użytkownika ani do celów marketingowych.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-100">4. Cookies podmiotów trzecich</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Platforma nie wykorzystuje cookies marketingowych ani analitycznych podmiotów
              trzecich.
            </li>
            <li>
              W przypadku wprowadzenia takich narzędzi w przyszłości, polityka cookies zostanie
              odpowiednio zaktualizowana.
            </li>
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-100">5. Zarządzanie cookies</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Użytkownik może zarządzać plikami cookies za pomocą ustawień swojej przeglądarki.
            </li>
            <li>
              Ograniczenie stosowania cookies może wpłynąć na niektóre funkcjonalności platformy.
            </li>
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-100">6. Zmiany polityki cookies</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>Polityka cookies może być aktualizowana.</li>
            <li>Nowa wersja obowiązuje od momentu jej opublikowania na stronie.</li>
          </ol>
        </section>
      </div>
    </StaticPageFrame>
  );
}






