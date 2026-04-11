import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ContainerListingsBoard } from "@/components/container-listings-board";
import { SESSION_COOKIE_NAME } from "@/lib/auth-session";
import type { ListingType } from "@/lib/container-listing-types";

export const metadata: Metadata = {
  title: "Lista kontenerow | ContainerBoard",
  description:
    "Szybka tablica kontenerow: dostepne i poszukiwane kontenery, filtry oraz zapytania email.",
};

type ListPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function resolveKind(
  value: string | string[] | undefined,
): ListingType | "all" {
  const raw = typeof value === "string" ? value : value?.[0];
  return raw === "available" || raw === "wanted" ? raw : "all";
}

export default async function ListPage({ searchParams }: ListPageProps) {
  const params = await searchParams;
  const initialKind = resolveKind(params.kind);
  const cookieStore = await cookies();
  const isLoggedIn = Boolean(cookieStore.get(SESSION_COOKIE_NAME)?.value);

  return (
    <main className="w-full pb-6">
      <ContainerListingsBoard
        isLoggedIn={isLoggedIn}
        initialKind={initialKind}
      />
    </main>
  );
}
