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
      mapLabel={locale === "pl" ? "PrzejdÅº do ogÅ‚oszeÅ„" : messages.home.whatBrowseAnnouncementsCta}
      mapHref="/list"
      title={page.title}
      intro={page.intro}
      links={[
        { href: "/terms", label: messages.footer.terms },
        { href: "/cookies", label: messages.footer.cookies },
      ]}
    >
      <div className="space-y-8">
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-neutral-100">1. Informacje ogÃ³lne</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Niniejsza Polityka prywatnoÅ›ci okreÅ›la zasady przetwarzania danych osobowych
              uÅ¼ytkownikÃ³w platformy ContainerBoard dostÄ™pnej pod adresem <strong>containerboard.pl</strong>.
            </li>
            <li>
              Administratorem danych osobowych jest <strong>ContainerBoard Karol TymiÅ„ski 5842785961</strong>,
              z siedzibÄ… w <strong>GdaÅ„sku, Andrzeja Struga 4</strong>, e-mail: <strong>hello@containerboard.pl</strong>.
            </li>
            <li>Dbamy o ochronÄ™ prywatnoÅ›ci uÅ¼ytkownikÃ³w oraz bezpieczeÅ„stwo przetwarzanych danych.</li>
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-neutral-100">2. Zakres zbieranych danych</h2>
          <p>W zaleÅ¼noÅ›ci od sposobu korzystania z platformy moÅ¼emy przetwarzaÄ‡:</p>
          <div className="space-y-3">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-neutral-200">2.1 Dane podane dobrowolnie:</h3>
              <ul className="list-disc space-y-1 pl-5">
                <li>imiÄ™ i nazwisko,</li>
                <li>adres e-mail,</li>
                <li>numer telefonu,</li>
                <li>dane firmy (nazwa, adres, NIP),</li>
                <li>treÅ›ci publikowane na platformie (oferty, ogÅ‚oszenia, opisy).</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-neutral-200">2.2 Dane zbierane automatycznie:</h3>
              <ul className="list-disc space-y-1 pl-5">
                <li>adres IP,</li>
                <li>dane przeglÄ…darki i urzÄ…dzenia,</li>
                <li>informacje o aktywnoÅ›ci na stronie.</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-neutral-100">3. Cele przetwarzania danych</h2>
          <p>Dane przetwarzane sÄ… w celu:</p>
          <ol className="list-decimal space-y-2 pl-5">
            <li>Å›wiadczenia usÅ‚ug dostÄ™pnych na platformie,</li>
            <li>umoÅ¼liwienia publikowania i przeglÄ…dania treÅ›ci,</li>
            <li>umoÅ¼liwienia kontaktu miÄ™dzy uÅ¼ytkownikami,</li>
            <li>zapewnienia bezpieczeÅ„stwa i przeciwdziaÅ‚ania naduÅ¼yciom,</li>
            <li>analizy dziaÅ‚ania platformy i jej ulepszania.</li>
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-neutral-100">4. Podstawa prawna przetwarzania</h2>
          <p>Dane przetwarzane sÄ… na podstawie:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>art. 6 ust. 1 lit. b RODO - realizacja usÅ‚ug,</li>
            <li>art. 6 ust. 1 lit. f RODO - prawnie uzasadniony interes (bezpieczeÅ„stwo, rozwÃ³j platformy),</li>
            <li>art. 6 ust. 1 lit. a RODO - zgoda (jeÅ›li dotyczy).</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-neutral-100">5. UdostÄ™pnianie danych</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Dane mogÄ… byÄ‡ udostÄ™pniane:
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>innym uÅ¼ytkownikom (np. dane kontaktowe w ogÅ‚oszeniach),</li>
                <li>podmiotom Å›wiadczÄ…cym usÅ‚ugi techniczne (np. hosting, analityka).</li>
              </ul>
            </li>
            <li>Dane nie sÄ… sprzedawane podmiotom trzecim.</li>
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-neutral-100">6. Przechowywanie danych</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Dane przechowywane sÄ… przez okres:
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>korzystania z platformy,</li>
                <li>niezbÄ™dny do realizacji celÃ³w przetwarzania,</li>
                <li>wynikajÄ…cy z obowiÄ…zkÃ³w prawnych (jeÅ›li dotyczy).</li>
              </ul>
            </li>
            <li>Po tym czasie dane mogÄ… zostaÄ‡ usuniÄ™te lub zanonimizowane.</li>
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-neutral-100">7. Prawa uÅ¼ytkownika</h2>
          <p>UÅ¼ytkownik ma prawo do:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>dostÄ™pu do swoich danych,</li>
            <li>ich sprostowania,</li>
            <li>usuniÄ™cia,</li>
            <li>ograniczenia przetwarzania,</li>
            <li>wniesienia sprzeciwu,</li>
            <li>przeniesienia danych,</li>
            <li>wniesienia skargi do Prezesa UODO.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-neutral-100">8. BezpieczeÅ„stwo danych</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>Stosujemy Å›rodki techniczne i organizacyjne zapewniajÄ…ce ochronÄ™ danych.</li>
            <li>DostÄ™p do danych majÄ… wyÅ‚Ä…cznie upowaÅ¼nione osoby.</li>
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-neutral-100">9. Pliki cookies</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>Platforma wykorzystuje pliki cookies.</li>
            <li>SzczegÃ³Å‚owe informacje znajdujÄ… siÄ™ w Polityce cookies.</li>
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-neutral-100">10. Zmiany polityki prywatnoÅ›ci</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>Polityka prywatnoÅ›ci moÅ¼e byÄ‡ aktualizowana.</li>
            <li>Nowa wersja obowiÄ…zuje od momentu publikacji na stronie.</li>
          </ol>
        </section>
      </div>
    </StaticPageFrame>
  );
}
