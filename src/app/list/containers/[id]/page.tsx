import type { Metadata } from "next";
import { ContainerDetailsContent } from "@/components/container-details-content";

export const metadata: Metadata = {
  title: "Podglad ogloszenia | ContainerBoard",
  robots: {
    index: false,
    follow: false,
  },
};

type ListContainerDetailsPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

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

export default async function ListContainerDetailsPage({
  params,
  searchParams,
}: ListContainerDetailsPageProps) {
  const [{ id }, queryParams] = await Promise.all([params, searchParams]);
  const listParams = toSearchParams(queryParams);
  const listHref = listParams.toString() ? `/list?${listParams.toString()}` : "/list";

  return (
    <main className="mx-auto grid w-full max-w-5xl gap-4 px-4 py-6 sm:px-6">
      <ContainerDetailsContent listingId={id} listHref={listHref} />
    </main>
  );
}
