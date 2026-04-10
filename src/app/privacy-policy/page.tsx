import type { Metadata } from "next";
import { cookies } from "next/headers";
import { StaticPageFrame } from "@/components/static-page-frame";
import { getLocaleFromRequest, getMessages, LOCALE_COOKIE_NAME } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/seo";

type PrivacyPolicyPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  searchParams,
}: PrivacyPolicyPageProps): Promise<Metadata> {
  const params = await searchParams;
  const cookieStore = await cookies();
  const locale = getLocaleFromRequest({
    params,
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
  });
  const messages = getMessages(locale);
  const page = messages.legalPages.privacy;

  return buildPageMetadata({
    path: "/privacy-policy",
    locale,
    title: page.title,
    description: page.intro,
  });
}

export default async function PrivacyPolicyPage({ searchParams }: PrivacyPolicyPageProps) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const locale = getLocaleFromRequest({
    params,
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
  });
  const messages = getMessages(locale);
  const page = messages.legalPages.privacy;

  return (
    <StaticPageFrame
      locale={locale}
      backLabel={messages.companyDetails.back}
      mapLabel={messages.home.heroPrimaryCta}
      title={page.title}
      intro={page.intro}
      links={[
        { href: "/terms", label: messages.footer.terms },
        { href: "/cookies", label: messages.footer.cookies },
      ]}
    >
      <div className="space-y-8">
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-100">1. Informacje ogólne</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Niniejsza Polityka prywatności określa zasady przetwarzania danych osobowych
              użytkowników platformy ContainerBoard dostępnej pod adresem{" "}
              <strong>containerboard.pl</strong>.
            </li>
            <li>
              Administratorem danych osobowych jest{" "}
              <strong>ContainerBoard Karol Tymi&#324;ski 5842785961</strong>, z siedzibą w{" "}
              <strong>Gda&#324;sku, Andrzeja Struga 4</strong>, e-mail:{" "}
              <strong>hello@containerboard.pl</strong>.
            </li>
            <li>
              Dbamy o ochronę prywatności użytkowników oraz bezpieczeństwo przetwarzanych danych.
            </li>
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-100">2. Zakres zbieranych danych</h2>
          <p>W zależności od sposobu korzystania z platformy możemy przetwarzać:</p>
          <div className="space-y-3">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-200">2.1 Dane podane dobrowolnie:</h3>
              <ul className="list-disc space-y-1 pl-5">
                <li>imię i nazwisko,</li>
                <li>adres e-mail,</li>
                <li>numer telefonu,</li>
                <li>dane firmy (nazwa, adres, NIP),</li>
                <li>treści publikowane na platformie (oferty, ogłoszenia, opisy).</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-200">
                2.2 Dane zbierane automatycznie:
              </h3>
              <ul className="list-disc space-y-1 pl-5">
                <li>adres IP,</li>
                <li>dane przeglądarki i urządzenia,</li>
                <li>informacje o aktywności na stronie.</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-100">3. Cele przetwarzania danych</h2>
          <p>Dane przetwarzane są w celu:</p>
          <ol className="list-decimal space-y-2 pl-5">
            <li>świadczenia usług dostępnych na platformie,</li>
            <li>umożliwienia publikowania i przeglądania treści,</li>
            <li>umożliwienia kontaktu między użytkownikami,</li>
            <li>zapewnienia bezpieczeństwa i przeciwdziałania nadużyciom,</li>
            <li>analizy działania platformy i jej ulepszania.</li>
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-100">
            4. Podstawa prawna przetwarzania
          </h2>
          <p>Dane przetwarzane są na podstawie:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>art. 6 ust. 1 lit. b RODO - realizacja usług,</li>
            <li>
              art. 6 ust. 1 lit. f RODO - prawnie uzasadniony interes (bezpieczeństwo, rozwój
              platformy),
            </li>
            <li>art. 6 ust. 1 lit. a RODO - zgoda (jeśli dotyczy).</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-100">5. Udostępnianie danych</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Dane mogą być udostępniane:
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>innym użytkownikom (np. dane kontaktowe w ogłoszeniach),</li>
                <li>podmiotom świadczącym usługi techniczne (np. hosting, analityka).</li>
              </ul>
            </li>
            <li>Dane nie są sprzedawane podmiotom trzecim.</li>
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-100">6. Przechowywanie danych</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Dane przechowywane są przez okres:
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>korzystania z platformy,</li>
                <li>niezbędny do realizacji celów przetwarzania,</li>
                <li>wynikający z obowiązków prawnych (jeśli dotyczy).</li>
              </ul>
            </li>
            <li>Po tym czasie dane mogą zostać usunięte lub zanonimizowane.</li>
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-100">7. Prawa użytkownika</h2>
          <p>Użytkownik ma prawo do:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>dostępu do swoich danych,</li>
            <li>ich sprostowania,</li>
            <li>usunięcia,</li>
            <li>ograniczenia przetwarzania,</li>
            <li>wniesienia sprzeciwu,</li>
            <li>przeniesienia danych,</li>
            <li>wniesienia skargi do Prezesa UODO.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-100">8. Bezpieczeństwo danych</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Stosujemy środki techniczne i organizacyjne zapewniające ochronę danych.
            </li>
            <li>Dostęp do danych mają wyłącznie upoważnione osoby.</li>
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-100">9. Pliki cookies</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>Platforma wykorzystuje pliki cookies.</li>
            <li>Szczegółowe informacje znajdują się w Polityce cookies.</li>
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-100">
            10. Zmiany polityki prywatności
          </h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>Polityka prywatności może być aktualizowana.</li>
            <li>Nowa wersja obowiązuje od momentu publikacji na stronie.</li>
          </ol>
        </section>
      </div>
    </StaticPageFrame>
  );
}






