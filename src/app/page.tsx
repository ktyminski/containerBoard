import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/auth-session";

export const metadata: Metadata = {
  title: "ContainerBoard - Landing",
  description: "Szybka tablica kontenerow: publikuj i znajduj dostepne oraz poszukiwane kontenery.",
};

export default async function LandingPage() {
  const cookieStore = await cookies();
  const isLoggedIn = Boolean(cookieStore.get(SESSION_COOKIE_NAME)?.value);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70 p-8 sm:p-12">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute -left-12 top-0 h-56 w-56 rounded-full bg-cyan-500/15 blur-3xl" />
          <div className="absolute right-0 top-10 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
        </div>
        <div className="relative max-w-3xl">
          <p className="text-xs font-semibold tracking-[0.2em] text-cyan-300 uppercase">
            ContainerBoard
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-100 sm:text-5xl">
            Prosta tablica kontenerow dla rynku.
          </h1>
          <p className="mt-4 max-w-2xl text-sm text-slate-300 sm:text-base">
            Publikuj kontenery dostepne i poszukiwane, filtruj ogloszenia i wysylaj zapytania email
            bezposrednio do wlasciciela. Bez platnosci, bez czatu, bez rozbudowanych workflow.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href="/list"
              className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400"
            >
              Przegladaj liste kontenerow
            </Link>
            <Link
              href={isLoggedIn ? "/containers/new" : "/login?next=/containers/new"}
              className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"
            >
              Dodaj kontener
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
