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
    "ContainerBoard: jedna platforma do publikacji i wyszukiwania dostepnych oraz poszukiwanych kontenerow.",
};

const LISTING_TYPE_LABEL: Record<ContainerListingItem["type"], string> = {
  available: "Dostepny",
  wanted: "Poszukiwany",
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

  return (
    <main className="w-full">
      <section className="relative overflow-hidden border-b border-[#0f2f57]">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/photos/background.webp')" }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,10,30,0.85)_0%,rgba(3,15,43,0.92)_36%,rgba(4,15,41,0.96)_100%)]"
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_92%_24%,rgba(14,165,233,0.26),transparent_42%),radial-gradient(circle_at_14%_84%,rgba(56,189,248,0.2),transparent_48%)]"
          aria-hidden="true"
        />

        <div className="relative mx-auto flex min-h-[28rem] w-full max-w-6xl items-center px-4 py-14 sm:px-6 sm:py-20">
          <div className="ml-auto max-w-2xl text-right">
            <p className="text-xs font-semibold tracking-[0.24em] text-[#7dd3fc] uppercase">
              ContainerBoard dla logistyki
            </p>
            <h1 className="mt-4 text-3xl font-semibold leading-tight text-white sm:text-5xl">
              Kontenery na jednej tablicy: szybkie publikowanie i kontakt bez zbednych krokow.
            </h1>
            <p className="mt-5 text-sm leading-relaxed text-sky-100 sm:text-base">
              Sprawdz aktualne ogloszenia, filtruj po typie i lokalizacji, a potem od razu wyslij zapytanie
              do wlasciciela wpisu.
            </p>
            <div className="mt-8 flex flex-wrap justify-end gap-3">
              <Link
                href="/list"
                className="inline-flex items-center rounded-md bg-sky-500 px-5 py-2.5 text-sm font-semibold text-[#031233] transition hover:bg-sky-400"
              >
                Przegladaj tablice
              </Link>
              <Link
                href={isLoggedIn ? "/containers/new" : `/login?next=${nextCreate}`}
                className="inline-flex items-center rounded-md border border-sky-300/70 bg-sky-100/10 px-5 py-2.5 text-sm font-semibold text-sky-100 transition hover:border-sky-200 hover:bg-sky-100/15"
              >
                Dodaj ogloszenie
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[#dbeafe] bg-[linear-gradient(180deg,#f8fbff_0%,#edf5ff_100%)] py-14">
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
              className="rounded-md border border-sky-300 bg-white px-4 py-2 text-sm font-semibold text-sky-700 transition hover:border-sky-500 hover:text-sky-800"
            >
              Zobacz cala liste
            </Link>
          </div>

          {latestListings.length > 0 ? (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {latestListings.map((item) => (
                <li
                  key={item.id}
                  className="rounded-2xl border border-sky-200 bg-white p-4 shadow-[0_20px_40px_-32px_rgba(59,130,246,0.55)]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-700">
                      {LISTING_TYPE_LABEL[item.type]}
                    </span>
                    <span className="text-xs text-neutral-500">
                      {new Date(item.createdAt).toLocaleDateString("pl-PL")}
                    </span>
                  </div>
                  <h3 className="mt-3 text-lg font-semibold text-[#0b1f42]">
                    {getContainerShortLabel(item.container)} - {item.quantity} szt.
                  </h3>
                  <p className="mt-1 text-sm text-neutral-600">
                    {item.locationCity}, {item.locationCountry}
                  </p>
                  <p className="mt-2 text-sm text-neutral-500">{item.companyName}</p>
                  <div className="mt-4">
                    <Link
                      href={`/containers/${item.id}`}
                      className="inline-flex items-center rounded-md border border-sky-300 px-3 py-2 text-sm font-semibold text-sky-700 transition hover:border-sky-500"
                    >
                      Szczegoly ogloszenia
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-2xl border border-sky-200 bg-white p-6 text-center">
              <p className="text-sm text-neutral-600">
                Brak aktywnych ogloszen. Dodaj pierwszy wpis i zacznij budowac tablice.
              </p>
              <div className="mt-4">
                <Link
                  href={isLoggedIn ? "/containers/new" : `/login?next=${nextCreate}`}
                  className="inline-flex items-center rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-600"
                >
                  Dodaj ogloszenie
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="border-b border-[#dbeafe] bg-white py-14">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="text-center">
            <p className="text-xs font-semibold tracking-[0.24em] text-sky-700 uppercase">
              Jak to dziala
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-[#0b1f42] sm:text-4xl">
              Zaczniesz w kilka minut
            </h2>
          </div>

          <div className="mt-9 grid gap-4 md:grid-cols-3">
            <article className="rounded-2xl border border-sky-200 bg-[linear-gradient(180deg,#f8fbff_0%,#eef6ff_100%)] p-5">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-sky-600 text-sm font-bold text-white">
                1
              </span>
              <h3 className="mt-4 text-lg font-semibold text-[#0b1f42]">Dodaj wpis</h3>
              <p className="mt-2 text-sm text-neutral-600">
                Publikujesz kontener dostepny albo poszukiwany. Formularz jest prosty i prowadzi krok po kroku.
              </p>
            </article>
            <article className="rounded-2xl border border-sky-200 bg-[linear-gradient(180deg,#f8fbff_0%,#eef6ff_100%)] p-5">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-sky-600 text-sm font-bold text-white">
                2
              </span>
              <h3 className="mt-4 text-lg font-semibold text-[#0b1f42]">Filtruj i porownuj</h3>
              <p className="mt-2 text-sm text-neutral-600">
                Wyszukujesz po typie, kontenerze i lokalizacji. Od razu widzisz kluczowe dane i termin waznosci.
              </p>
            </article>
            <article className="rounded-2xl border border-sky-200 bg-[linear-gradient(180deg,#f8fbff_0%,#eef6ff_100%)] p-5">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-sky-600 text-sm font-bold text-white">
                3
              </span>
              <h3 className="mt-4 text-lg font-semibold text-[#0b1f42]">Kontaktuj sie bezposrednio</h3>
              <p className="mt-2 text-sm text-neutral-600">
                Wchodzisz w szczegoly wpisu i wysylasz zapytanie do osoby kontaktowej, bez dodatkowych systemow.
              </p>
            </article>
          </div>

          <div className="mt-10 rounded-2xl border border-sky-200 bg-[linear-gradient(90deg,#0a2347_0%,#0b3b74_65%,#0d4f93_100%)] px-6 py-7 text-center shadow-[0_20px_40px_-32px_rgba(2,44,107,0.9)]">
            <p className="text-xs font-semibold tracking-[0.2em] text-sky-200 uppercase">
              Gotowy do startu
            </p>
            <h3 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
              Dodaj kontener i testuj tablice w realnym ruchu.
            </h3>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href={isLoggedIn ? "/containers/new" : `/login?next=${nextCreate}`}
                className="rounded-md bg-sky-400 px-5 py-2.5 text-sm font-semibold text-[#042040] transition hover:bg-sky-300"
              >
                Dodaj ogloszenie
              </Link>
              <Link
                href="/list"
                className="rounded-md border border-sky-300/80 bg-white/10 px-5 py-2.5 text-sm font-semibold text-sky-100 transition hover:border-sky-200 hover:bg-white/15"
              >
                Przegladaj tablice
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

