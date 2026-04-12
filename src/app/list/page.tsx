import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ContainerListingsBoard } from "@/components/container-listings-board";
import { SESSION_COOKIE_NAME } from "@/lib/auth-session";
import type { ListingKind } from "@/components/container-listings-shared";

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
): ListingKind {
  const raw = typeof value === "string" ? value : value?.[0];
  return raw === "available" || raw === "wanted" || raw === "rent" ? raw : "all";
}

function resolveTab(value: string | string[] | undefined): "all" | "favorites" {
  const raw = typeof value === "string" ? value : value?.[0];
  return raw === "favorites" ? "favorites" : "all";
}

function resolveMine(value: string | string[] | undefined): boolean {
  const raw = typeof value === "string" ? value : value?.[0];
  return raw === "1" || raw === "true";
}

function toSearchParams(
  params: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const output = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const resolved = typeof value === "string" ? value : value?.[0];
    if (resolved) {
      output.set(key, resolved);
    }
  }
  return output;
}

export default async function ListPage({ searchParams }: ListPageProps) {
  const params = await searchParams;
  const initialKind = resolveKind(params.kind);
  const initialTab = resolveTab(params.tab);
  const initialMine = resolveMine(params.mine);
  const cookieStore = await cookies();
  const isLoggedIn = Boolean(cookieStore.get(SESSION_COOKIE_NAME)?.value);

  if (!isLoggedIn && initialMine) {
    const nextParams = toSearchParams(params);
    nextParams.set("mine", "1");
    redirect(`/login?next=${encodeURIComponent(`/list?${nextParams.toString()}`)}`);
  }

  return (
    <main className="w-full pb-6">
      <ContainerListingsBoard
        isLoggedIn={isLoggedIn}
        initialKind={initialKind}
        initialTab={initialTab}
        initialMine={initialMine}
      />
    </main>
  );
}
