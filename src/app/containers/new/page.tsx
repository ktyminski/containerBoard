import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ContainerListingForm } from "@/components/container-listing-form";
import { SESSION_COOKIE_NAME } from "@/lib/auth-session";
import { getCurrentUserFromToken } from "@/lib/auth-user";

export const metadata: Metadata = {
  title: "Dodaj kontener | ContainerBoard",
  description: "Dodaj nowe ogloszenie kontenera w mniej niz minute.",
};

type NewContainerPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function resolveKind(value: string | string[] | undefined): "available" | "wanted" | undefined {
  const raw = typeof value === "string" ? value : value?.[0];
  return raw === "available" || raw === "wanted" ? raw : undefined;
}

export default async function NewContainerPage({ searchParams }: NewContainerPageProps) {
  const params = await searchParams;
  const kind = resolveKind(params.kind);
  const nextPath = kind ? `/containers/new?kind=${kind}` : "/containers/new";

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  const user = await getCurrentUserFromToken(token);
  if (!user?._id) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold text-slate-100">Dodaj kontener</h1>
        <p className="mt-1 text-sm text-slate-300">Prosty formularz publikacji kontenera (wygasa po 14 dniach).</p>
      </header>

      <ContainerListingForm
        mode="create"
        submitEndpoint="/api/containers"
        submitMethod="POST"
        submitLabel="Publikuj kontener"
        successMessage="Kontener opublikowany"
        backHref="/containers/mine"
        backLabel="Powrot do moich kontenerow"
        initialValues={kind ? { type: kind } : undefined}
      />
    </main>
  );
}

