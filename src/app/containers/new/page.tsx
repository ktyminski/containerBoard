import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ContainerListingForm } from "@/components/container-listing-form";
import { SESSION_COOKIE_NAME } from "@/lib/auth-session";
import { getCurrentUserFromToken } from "@/lib/auth-user";

export const metadata: Metadata = {
  title: "Dodaj kontener | ContainerBoard",
  description: "Dodaj nowe ogloszenie kontenera w mniej niz minute.",
};

export default async function NewContainerPage() {
  const nextPath = "/containers/new";

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
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-100">Dodaj kontener</h1>
          <p className="mt-1 text-sm text-neutral-300">Prosty formularz publikacji kontenera (wygasa po 14 dniach).</p>
        </div>
        <Link
          href="/list"
          className="inline-flex min-h-10 items-center rounded-md border border-[#2f639a] bg-[#082650]/80 px-4 text-sm font-medium text-[#e2efff] transition hover:border-[#4e86c3] hover:bg-[#0c3466] hover:text-white"
        >
          Wroc
        </Link>
      </header>

      <ContainerListingForm
        mode="create"
        submitEndpoint="/api/containers"
        submitMethod="POST"
        submitLabel="Publikuj kontener"
        successMessage="Kontener opublikowany"
        backHref="/list"
        backLabel="Powrot do listy kontenerow"
      />
    </main>
  );
}


