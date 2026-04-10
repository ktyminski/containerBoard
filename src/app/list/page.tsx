import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ContainerListingsBoard } from "@/components/container-listings-board";
import { SESSION_COOKIE_NAME } from "@/lib/auth-session";

export const metadata: Metadata = {
  title: "Lista kontenerow | ContainerBoard",
  description: "Szybka tablica kontenerow: dostepne i poszukiwane kontenery, filtry oraz zapytania email.",
};

export default async function ListPage() {
  const cookieStore = await cookies();
  const isLoggedIn = Boolean(cookieStore.get(SESSION_COOKIE_NAME)?.value);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <ContainerListingsBoard isLoggedIn={isLoggedIn} />
    </main>
  );
}
