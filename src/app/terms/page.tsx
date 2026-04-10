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
      mapLabel={messages.home.heroPrimaryCta}
      title={page.title}
      intro={page.intro}
      links={[
        { href: "/privacy-policy", label: messages.footer.privacyPolicy },
        { href: "/cookies", label: messages.footer.cookies },
      ]}
    >
      <div className="space-y-8">
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-100">1. Postanowienia ogólne</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Niniejszy regulamin określa zasady korzystania z platformy internetowej ContainerBoard
              dostępnej pod adresem <strong>containerboard.pl</strong>.
            </li>
            <li>
              Operatorem platformy jest <strong>ContainerBoard Karol Tymi&#324;ski 5842785961</strong>,
              z siedzibą w <strong>Gda&#324;sku, Andrzeja Struga 4</strong>.
            </li>
            <li>
              Platforma ContainerBoard umożliwia użytkownikom:
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>przeglądanie profili firm z branży TSL,</li>
                <li>publikowanie oraz przeglądanie ofert współpracy i transportu,</li>
                <li>publikowanie oraz przeglądanie ogłoszeń o pracę,</li>
                <li>publikowanie zapytań ofertowych.</li>
              </ul>
            </li>
            <li>Korzystanie z platformy oznacza akceptację niniejszego regulaminu.</li>
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-100">2. Definicje</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              <strong>Platforma</strong> - serwis internetowy ContainerBoard.
            </li>
            <li>
              <strong>Użytkownik</strong> - każda osoba korzystająca z Platformy.
            </li>
            <li>
              <strong>Treści</strong> - wszelkie informacje publikowane przez Użytkownika (np.
              opisy, oferty, dane firm, ogłoszenia).
            </li>
            <li>
              <strong>Operator</strong> - właściciel i administrator Platformy.
            </li>
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-100">3. Zasady korzystania</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Użytkownik zobowiązuje się do korzystania z Platformy zgodnie z obowiązującym prawem
              oraz niniejszym regulaminem.
            </li>
            <li>
              Zabronione jest publikowanie Treści:
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>niezgodnych z prawem,</li>
                <li>naruszających prawa osób trzecich,</li>
                <li>wprowadzających w błąd,</li>
                <li>
                  zawierających spam lub treści reklamowe niezgodne z przeznaczeniem Platformy.
                </li>
              </ul>
            </li>
            <li>Użytkownik zobowiązuje się do podawania prawdziwych i aktualnych informacji.</li>
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-100">4. Publikowanie treści</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>Użytkownik ponosi pełną odpowiedzialność za Treści publikowane na Platformie.</li>
            <li>
              Publikując Treści, Użytkownik oświadcza, że:
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>posiada do nich odpowiednie prawa,</li>
                <li>są one zgodne z prawem,</li>
                <li>nie naruszają praw osób trzecich.</li>
              </ul>
            </li>
            <li>Operator nie jest zobowiązany do uprzedniej weryfikacji Treści.</li>
            <li>
              Operator zastrzega sobie prawo do:
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>usunięcia Treści naruszających regulamin lub prawo,</li>
                <li>edycji Treści w zakresie niezbędnym do ich poprawy technicznej,</li>
                <li>zablokowania lub usunięcia konta Użytkownika.</li>
              </ul>
            </li>
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-100">5. Charakter platformy</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>ContainerBoard jest platformą informacyjną i pośredniczącą.</li>
            <li>Operator nie jest stroną umów zawieranych pomiędzy Użytkownikami.</li>
            <li>
              Platforma nie gwarantuje:
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>skuteczności ofert,</li>
                <li>jakości usług,</li>
                <li>rzetelności Użytkowników.</li>
              </ul>
            </li>
            <li>
              Wszelkie relacje pomiędzy Użytkownikami odbywają się na ich własną odpowiedzialność.
            </li>
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-100">6. Odpowiedzialność</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Operator nie ponosi odpowiedzialności za:
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Treści publikowane przez Użytkowników,</li>
                <li>działania lub zaniechania Użytkowników,</li>
                <li>szkody wynikające z korzystania z Platformy.</li>
              </ul>
            </li>
            <li>
              Operator nie gwarantuje ciągłości działania Platformy ani braku błędów technicznych.
            </li>
            <li>
              Platforma może być czasowo niedostępna z przyczyn technicznych lub rozwojowych.
            </li>
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-100">
            7. Zmiany platformy i regulaminu
          </h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Operator zastrzega sobie prawo do:
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>zmiany funkcjonalności Platformy,</li>
                <li>wprowadzania nowych usług,</li>
                <li>modyfikacji regulaminu.</li>
              </ul>
            </li>
            <li>Zmiany regulaminu wchodzą w życie z chwilą ich opublikowania na Platformie.</li>
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-100">8. Rozwiązanie dostępu</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Operator może ograniczyć lub zablokować dostęp do Platformy w przypadku naruszenia
              regulaminu.
            </li>
            <li>Użytkownik może zaprzestać korzystania z Platformy w dowolnym momencie.</li>
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-100">9. Postanowienia końcowe</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>Regulamin podlega prawu polskiemu.</li>
            <li>Wszelkie spory będą rozstrzygane przez właściwy sąd.</li>
            <li>
              Kontakt z Operatorem: <strong>hello@containerboard.pl</strong>
            </li>
          </ol>
        </section>
      </div>
    </StaticPageFrame>
  );
}






