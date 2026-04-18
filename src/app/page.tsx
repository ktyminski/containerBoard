import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/auth-session";
import {
  buildContainerListingsFilter,
  ensureContainerListingsIndexes,
  expireContainerListingsIfNeeded,
  getContainerListingsCollection,
  mapContainerListingToItem,
  type ContainerListingItem,
} from "@/lib/container-listings";
import { getContainerShortLabel } from "@/lib/container-listing-types";
import { logError } from "@/lib/server-logger";

export const metadata: Metadata = {
  title: "ContainerBoard - Landing",
  description:
    "ContainerBoard: jedna platforma do publikacji i wyszukiwania kontenerow na sprzedaz, wynajem oraz zakup.",
};

const LISTING_TYPE_LABEL: Record<ContainerListingItem["type"], string> = {
  sell: "Sprzedaz",
  rent: "Wynajem",
  buy: "Chce zakupic",
};

async function getLatestListings(limit = 6): Promise<ContainerListingItem[]> {
  try {
    await ensureContainerListingsIndexes();
    await expireContainerListingsIfNeeded();

    const now = new Date();
    const listings = await getContainerListingsCollection();
    const filter = buildContainerListingsFilter({
      includeOnlyPublic: true,
      now,
    });

    const rows = await listings
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    return rows.map(mapContainerListingToItem);
  } catch (error) {
    logError("Failed to load latest listings on landing page", { error });
    return [];
  }
}

export default async function LandingPage() {
  const cookieStore = await cookies();
  const isLoggedIn = Boolean(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  const latestListings = await getLatestListings(6);
  const nextCreate = encodeURIComponent("/containers/new");
  const nextCreateBuy = encodeURIComponent("/containers/new?intent=buy");
  const PRIMARY_CTA_CLASS =
    "inline-flex items-center gap-2 rounded-md border border-rose-500 bg-gradient-to-r from-rose-500 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:from-rose-600 hover:to-fuchsia-600 active:translate-y-px";
  const SECONDARY_CTA_CLASS =
    "inline-flex items-center rounded-md border border-[#2f639a] bg-[linear-gradient(180deg,#082650_0%,#0c3466_100%)] px-5 py-2.5 text-sm font-semibold text-[#e2efff] transition hover:border-[#67c7ff] hover:text-white";

  return (
    <main className="w-full bg-neutral-200/90">
      <section className="relative overflow-hidden border-b border-neutral-300">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-35"
          style={{ backgroundImage: "url('/photos/background.webp')" }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 bg-[linear-gradient(180deg,rgba(245,249,255,0.92)_0%,rgba(237,245,255,0.9)_44%,rgba(231,240,251,0.95)_100%)]"
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_92%_22%,rgba(59,130,246,0.2),transparent_42%),radial-gradient(circle_at_14%_84%,rgba(14,165,233,0.16),transparent_48%)]"
          aria-hidden="true"
        />

        <div className="relative mx-auto flex min-h-[28rem] w-full max-w-6xl items-center px-4 py-14 sm:px-6 sm:py-18">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold tracking-[0.24em] text-sky-700 uppercase">
              ContainerBoard dla logistyki
            </p>
            <h1 className="mt-4 text-3xl font-semibold leading-tight text-[#0b1f42] sm:text-5xl">
              Ogarnij kontenery szybciej: publikuj, szukaj i domykaj tematy w jednym miejscu.
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-relaxed text-neutral-700 sm:text-base">
              Wyglad i flow jak w widoku listy: proste filtry, szybkie publikowanie i konkretne zapytania
              bez zbednych krokow.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/list"
                className={PRIMARY_CTA_CLASS}
              >
                Przegladaj tablice
              </Link>
              <Link
                href={isLoggedIn ? "/containers/new" : `/login?next=${nextCreate}`}
                className={SECONDARY_CTA_CLASS}
              >
                Dodaj ogloszenie
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <span className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700">
                Sprzedaz
              </span>
              <span className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700">
                Wynajem
              </span>
              <span className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700">
                Szukam kontenera
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-neutral-300 bg-neutral-100/95 py-14">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold tracking-[0.24em] text-sky-700 uppercase">
                Najnowsze ogloszenia
              </p>
              <h2 className="mt-2 text-3xl font-semibold text-[#0b1f42] sm:text-4xl">
                Ostatnio dodane kontenery
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-neutral-600 sm:text-base">
                Podglad swiezych wpisow z tablicy. Kliknij wybrane ogloszenie, aby zobaczyc szczegoly i kontakt.
              </p>
            </div>
            <Link
              href="/list"
              className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-50"
            >
              Zobacz cala liste
            </Link>
          </div>

          {latestListings.length > 0 ? (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {latestListings.map((item) => (
                <li
                  key={item.id}
                  className="rounded-md border border-neutral-300 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-md border border-sky-200 bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-700">
                      {LISTING_TYPE_LABEL[item.type]}
                    </span>
                    <span className="text-xs text-neutral-500">
                      {new Date(item.createdAt).toLocaleDateString("pl-PL")}
                    </span>
                  </div>
                  <h3 className="mt-3 text-lg font-semibold text-[#0b1f42]">
                    {getContainerShortLabel(item.container)} - {item.quantity} szt.
                  </h3>
                  <p className="mt-1 text-sm font-semibold text-amber-600">
                    {typeof item.priceAmount === "number" && Number.isFinite(item.priceAmount)
                      ? `${Math.round(item.priceAmount).toLocaleString("pl-PL")} PLN`
                      : "Cena na zapytanie"}
                  </p>
                  <p className="mt-1 text-sm text-neutral-600">
                    {item.locationCity}, {item.locationCountry}
                  </p>
                  <p className="mt-2 text-sm text-neutral-500">{item.companyName}</p>
                  <div className="mt-4">
                    <Link
                      href={`/containers/${item.id}`}
                      className="inline-flex items-center rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-50"
                    >
                      Szczegoly ogloszenia
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-md border border-neutral-300 bg-white p-6 text-center shadow-sm">
              <p className="text-sm text-neutral-600">
                Brak aktywnych ogloszen. Dodaj pierwszy wpis i zacznij budowac tablice.
              </p>
              <div className="mt-4">
                <Link
                  href={isLoggedIn ? "/containers/new" : `/login?next=${nextCreate}`}
                  className={PRIMARY_CTA_CLASS}
                >
                  Dodaj ogloszenie
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="border-b border-neutral-300 bg-white py-14">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="text-center">
            <p className="text-xs font-semibold tracking-[0.24em] text-sky-700 uppercase">
              To naprawde proste
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-[#0b1f42] sm:text-4xl">
              Dodasz ogloszenie w kilka minut
            </h2>
          </div>

          <div className="mt-9 grid gap-4 md:grid-cols-3">
            <article className="rounded-md border border-neutral-300 bg-neutral-50/95 p-5">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[#0c3466] text-sm font-bold text-white">
                1
              </span>
              <h3 className="mt-4 text-lg font-semibold text-[#0b1f42]">Dodaj wpis</h3>
              <p className="mt-2 text-sm text-neutral-600">
                Wybierasz typ ogloszenia i uzupelniasz kluczowe pola. Formularz prowadzi krok po kroku.
              </p>
            </article>
            <article className="rounded-md border border-neutral-300 bg-neutral-50/95 p-5">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[#0c3466] text-sm font-bold text-white">
                2
              </span>
              <h3 className="mt-4 text-lg font-semibold text-[#0b1f42]">Filtruj i porownuj</h3>
              <p className="mt-2 text-sm text-neutral-600">
                Na /list szybko zawezasz wyniki po typie, rozmiarze, lokalizacji i cenie.
              </p>
            </article>
            <article className="rounded-md border border-neutral-300 bg-neutral-50/95 p-5">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[#0c3466] text-sm font-bold text-white">
                3
              </span>
              <h3 className="mt-4 text-lg font-semibold text-[#0b1f42]">Domykasz temat szybciej</h3>
              <p className="mt-2 text-sm text-neutral-600">
                Kontaktujesz sie bezposrednio i od razu przechodzisz do konkretow.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="border-b border-neutral-300 bg-neutral-100/95 py-14">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="mb-7">
            <p className="text-xs font-semibold tracking-[0.24em] text-sky-700 uppercase">
              Wiele kontenerow na raz
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-[#0b1f42] sm:text-4xl">
              Nie musisz dodawac wszystkiego recznie
            </h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            <article className="rounded-md border border-neutral-300 bg-white p-5 shadow-sm">
              <p className="text-sm text-neutral-700">
                Masz wiekszy stock? Uzyj <strong>Multi Import</strong> i dodaj wiele pozycji naraz z
                przygotowanego pliku. Jesli wolisz, zlecasz temat do Concierge, a my robimy to za Ciebie.
              </p>
              <ul className="mt-4 grid gap-2 text-sm text-neutral-700">
                <li className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
                  1. Pobierasz gotowy szablon i uzupelniasz dane.
                </li>
                <li className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
                  2. Wrzucasz plik i od razu widzisz raport importu.
                </li>
                <li className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
                  3. Lub wysylasz dowolny plik, a Concierge publikuje oferty za Ciebie.
                </li>
              </ul>
            </article>
            <article className="rounded-md border border-neutral-300 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-[#0b1f42]">Dla zespolow handlowych i operacyjnych</h3>
              <p className="mt-2 text-sm text-neutral-700">
                Utrzymujesz porzadek w ofercie, szybciej odswiezasz wpisy i nie tracisz czasu na reczne klikanie.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href={isLoggedIn ? "/containers/mine" : `/login?next=${encodeURIComponent("/containers/mine")}`}
                  className={PRIMARY_CTA_CLASS}
                >
                  Otworz Multi Import
                </Link>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="border-b border-neutral-300 bg-white py-14">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="mb-7 text-center">
            <p className="text-xs font-semibold tracking-[0.24em] text-sky-700 uppercase">
              Wspolpraca
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-[#0b1f42] sm:text-4xl">
              Potrzebujesz wsparcia? Wejdziemy w temat razem z Toba.
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <article className="rounded-md border border-neutral-300 bg-neutral-50/95 p-5">
              <h3 className="text-xl font-semibold text-[#0b1f42]">Znajdziemy Ci kontener</h3>
              <p className="mt-2 text-sm text-neutral-700">
                Dodaj zapotrzebowanie i daj firmom sygnal, czego dokladnie szukasz. Reszte mozemy poprowadzic
                razem z Toba.
              </p>
              <div className="mt-4">
                <Link
                  href={isLoggedIn ? "/containers/new?intent=buy" : `/login?next=${nextCreateBuy}`}
                  className={PRIMARY_CTA_CLASS}
                >
                  Szukam kontenera
                </Link>
              </div>
            </article>
            <article className="rounded-md border border-neutral-300 bg-neutral-50/95 p-5">
              <h3 className="text-xl font-semibold text-[#0b1f42]">Mozemy odkupic Twoj stock</h3>
              <p className="mt-2 text-sm text-neutral-700">
                Masz kontenery do szybkiego uplynnienia? Napisz do nas i sprawdzmy, jak mozemy pomoc w odkupie
                lub znalezieniu odpowiedniego partnera.
              </p>
              <div className="mt-4">
                <Link href="/contact" className={SECONDARY_CTA_CLASS}>
                  Porozmawiajmy
                </Link>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="bg-neutral-100/95 py-14">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="rounded-md border border-neutral-300 bg-white px-6 py-7 text-center shadow-sm">
            <p className="text-xs font-semibold tracking-[0.2em] text-sky-700 uppercase">
              Gotowy do startu
            </p>
            <h3 className="mt-2 text-2xl font-semibold text-[#0b1f42] sm:text-3xl">
              Dodaj kontener i zacznij dzialac od razu.
            </h3>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href={isLoggedIn ? "/containers/new" : `/login?next=${nextCreate}`} className={PRIMARY_CTA_CLASS}>
                Dodaj ogloszenie
              </Link>
              <Link href="/list" className={SECONDARY_CTA_CLASS}>
                Przegladaj tablice
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

