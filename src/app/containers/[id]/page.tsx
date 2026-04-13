import type { Metadata } from "next";
import { ContainerDetailsContent } from "@/components/container-details-content";

type ContainerDetailsPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: ContainerDetailsPageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Kontener ${id} | ContainerBoard`,
  };
}

export default async function ContainerDetailsPage({ params }: ContainerDetailsPageProps) {
  const { id } = await params;

  return (
    <main className="mx-auto grid w-full max-w-5xl gap-4 px-4 py-6 sm:px-6">
      <ContainerDetailsContent listingId={id} />
    </main>
  );
}
