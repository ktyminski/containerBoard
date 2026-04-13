import type { Metadata } from "next";
import { cookies } from "next/headers";
import { StaticPageFrame } from "@/components/static-page-frame";
import { getLocaleFromRequest, getMessages, LOCALE_COOKIE_NAME } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/seo";

type TermsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  searchParams,
}: TermsPageProps): Promise<Metadata> {
  const params = await searchParams;
  const cookieStore = await cookies();
  const locale = getLocaleFromRequest({
    params,
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
  });
  const messages = getMessages(locale);
  const page = messages.legalPages.terms;

  return buildPageMetadata({
    path: "/terms",
    locale,
    title: page.title,
    description: page.intro,
  });
}

export default async function TermsPage({ searchParams }: TermsPageProps) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const locale = getLocaleFromRequest({
    params,
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
  });
  const messages = getMessages(locale);
  const page = messages.legalPages.terms;

  return (
    <StaticPageFrame
      locale={locale}
      backLabel={messages.companyDetails.back}
      mapLabel={locale === "pl" ? "PrzejdÅº do ogÅ‚oszeÅ„" : messages.home.whatBrowseAnnouncementsCta}
      mapHref="/list"
      title={page.title}
      intro={page.intro}
      links={[
        { href: "/privacy-policy", label: messages.footer.privacyPolicy },
        { href: "/cookies", label: messages.footer.cookies },
      ]}
    >
      <div className="space-y-8">
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-neutral-100">1. Postanowienia ogÃ³lne</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Niniejszy regulamin okreÅ›la zasady korzystania z platformy internetowej ContainerBoard
              dostÄ™pnej pod adresem <strong>containerboard.pl</strong>.
            </li>
            <li>
              Operatorem platformy jest <strong>ContainerBoard Karol TymiÅ„ski 5842785961</strong>,
              z siedzibÄ… w <strong>GdaÅ„sku, Andrzeja Struga 4</strong>.
            </li>
            <li>
              Platforma ContainerBoard umoÅ¼liwia uÅ¼ytkownikom:
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>przeglÄ…danie profili firm z branÅ¼y TSL,</li>
                <li>publikowanie oraz przeglÄ…danie ofert wspÃ³Å‚pracy i transportu,</li>
                <li>publikowanie oraz przeglÄ…danie ogÅ‚oszeÅ„ o pracÄ™,</li>
                <li>publikowanie zapytaÅ„ ofertowych.</li>
              </ul>
            </li>
            <li>Korzystanie z platformy oznacza akceptacjÄ™ niniejszego regulaminu.</li>
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-neutral-100">2. Definicje</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              <strong>Platforma</strong> - serwis internetowy ContainerBoard.
            </li>
            <li>
              <strong>UÅ¼ytkownik</strong> - kaÅ¼da osoba korzystajÄ…ca z Platformy.
            </li>
            <li>
              <strong>TreÅ›ci</strong> - wszelkie informacje publikowane przez UÅ¼ytkownika (np. opisy,
              oferty, dane firm, ogÅ‚oszenia).
            </li>
            <li>
              <strong>Operator</strong> - wÅ‚aÅ›ciciel i administrator Platformy.
            </li>
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-neutral-100">3. Zasady korzystania</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              UÅ¼ytkownik zobowiÄ…zuje siÄ™ do korzystania z Platformy zgodnie z obowiÄ…zujÄ…cym prawem
              oraz niniejszym regulaminem.
            </li>
            <li>
              Zabronione jest publikowanie TreÅ›ci:
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>niezgodnych z prawem,</li>
                <li>naruszajÄ…cych prawa osÃ³b trzecich,</li>
                <li>wprowadzajÄ…cych w bÅ‚Ä…d,</li>
                <li>zawierajÄ…cych spam lub treÅ›ci reklamowe niezgodne z przeznaczeniem Platformy.</li>
              </ul>
            </li>
            <li>UÅ¼ytkownik zobowiÄ…zuje siÄ™ do podawania prawdziwych i aktualnych informacji.</li>
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-neutral-100">4. Publikowanie treÅ›ci</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>UÅ¼ytkownik ponosi peÅ‚nÄ… odpowiedzialnoÅ›Ä‡ za TreÅ›ci publikowane na Platformie.</li>
            <li>
              PublikujÄ…c TreÅ›ci, UÅ¼ytkownik oÅ›wiadcza, Å¼e:
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>posiada do nich odpowiednie prawa,</li>
                <li>sÄ… one zgodne z prawem,</li>
                <li>nie naruszajÄ… praw osÃ³b trzecich.</li>
              </ul>
            </li>
            <li>Operator nie jest zobowiÄ…zany do uprzedniej weryfikacji TreÅ›ci.</li>
            <li>
              Operator zastrzega sobie prawo do:
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>usuniÄ™cia TreÅ›ci naruszajÄ…cych regulamin lub prawo,</li>
                <li>edycji TreÅ›ci w zakresie niezbÄ™dnym do ich poprawy technicznej,</li>
                <li>zablokowania lub usuniÄ™cia konta UÅ¼ytkownika.</li>
              </ul>
            </li>
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-neutral-100">5. Charakter platformy</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>ContainerBoard jest platformÄ… informacyjnÄ… i poÅ›redniczÄ…cÄ….</li>
            <li>Operator nie jest stronÄ… umÃ³w zawieranych pomiÄ™dzy UÅ¼ytkownikami.</li>
            <li>
              Platforma nie gwarantuje:
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>skutecznoÅ›ci ofert,</li>
                <li>jakoÅ›ci usÅ‚ug,</li>
                <li>rzetelnoÅ›ci UÅ¼ytkownikÃ³w.</li>
              </ul>
            </li>
            <li>Wszelkie relacje pomiÄ™dzy UÅ¼ytkownikami odbywajÄ… siÄ™ na ich wÅ‚asnÄ… odpowiedzialnoÅ›Ä‡.</li>
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-neutral-100">6. OdpowiedzialnoÅ›Ä‡</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Operator nie ponosi odpowiedzialnoÅ›ci za:
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>TreÅ›ci publikowane przez UÅ¼ytkownikÃ³w,</li>
                <li>dziaÅ‚ania lub zaniechania UÅ¼ytkownikÃ³w,</li>
                <li>szkody wynikajÄ…ce z korzystania z Platformy.</li>
              </ul>
            </li>
            <li>Operator nie gwarantuje ciÄ…gÅ‚oÅ›ci dziaÅ‚ania Platformy ani braku bÅ‚Ä™dÃ³w technicznych.</li>
            <li>Platforma moÅ¼e byÄ‡ czasowo niedostÄ™pna z przyczyn technicznych lub rozwojowych.</li>
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-neutral-100">7. Zmiany platformy i regulaminu</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Operator zastrzega sobie prawo do:
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>zmiany funkcjonalnoÅ›ci Platformy,</li>
                <li>wprowadzania nowych usÅ‚ug,</li>
                <li>modyfikacji regulaminu.</li>
              </ul>
            </li>
            <li>Zmiany regulaminu wchodzÄ… w Å¼ycie z chwilÄ… ich opublikowania na Platformie.</li>
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-neutral-100">8. RozwiÄ…zanie dostÄ™pu</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Operator moÅ¼e ograniczyÄ‡ lub zablokowaÄ‡ dostÄ™p do Platformy w przypadku naruszenia
              regulaminu.
            </li>
            <li>UÅ¼ytkownik moÅ¼e zaprzestaÄ‡ korzystania z Platformy w dowolnym momencie.</li>
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-neutral-100">9. Postanowienia koÅ„cowe</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>Regulamin podlega prawu polskiemu.</li>
            <li>Wszelkie spory bÄ™dÄ… rozstrzygane przez wÅ‚aÅ›ciwy sÄ…d.</li>
            <li>
              Kontakt z Operatorem: <strong>hello@containerboard.pl</strong>
            </li>
          </ol>
        </section>
      </div>
    </StaticPageFrame>
  );
}
