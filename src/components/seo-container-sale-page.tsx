import Link from "next/link";
import { ContainerPhotoWithPlaceholder } from "@/components/container-photo-with-placeholder";
import type { ContainerListingItem } from "@/lib/container-listings";
import { type AppLocale } from "@/lib/i18n";
import {
  getContainerSaleSeoHubCopy,
  getContainerSeoIndexable,
  getContainerSeoListingSummary,
} from "@/lib/seo-containers";

type SeoContainerSalePageProps = {
  locale: AppLocale;
  heading: string;
  lead: string;
  browseHref: string;
  items: ContainerListingItem[];
  total: number;
};

function getCardImage(item: ContainerListingItem): string {
  const firstPhotoUrl = item.photoUrls?.find((value) => value?.trim());
  if (firstPhotoUrl) {
    return firstPhotoUrl;
  }
  if (item.container.size === 20) {
    return "/placeholders/containers/container-20.svg";
  }
  if (item.container.size === 40) {
    return "/placeholders/containers/container-40.svg";
  }
  if (item.container.size === 45) {
    return "/placeholders/containers/container-45.svg";
  }
  return "/placeholders/containers/container-unknown.svg";
}

export function SeoContainerSalePage({
  locale,
  heading,
  lead,
  browseHref,
  items,
  total,
}: SeoContainerSalePageProps) {
  const copy = getContainerSaleSeoHubCopy(locale);
  const isIndexable = getContainerSeoIndexable(total);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6">
      <section className="rounded-md border border-neutral-300 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-semibold text-neutral-900">{heading}</h1>
            <p className="mt-3 text-base leading-7 text-neutral-700">{lead}</p>
            <p className="mt-3 text-sm font-medium text-neutral-500">{copy.totalLabel(total)}</p>
            {!isIndexable ? (
              <p className="mt-2 text-sm text-neutral-500">{copy.noIndexReason}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={browseHref}
              className="inline-flex h-11 items-center justify-center rounded-md border border-[#1d5ea8] bg-[#103b74] px-4 text-sm font-semibold text-white transition hover:border-[#2f76c7] hover:bg-[#16498d]"
            >
              {copy.browseList}
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">{copy.latestHeading}</h2>
        </div>
        {items.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => {
              const summary = getContainerSeoListingSummary(item, locale);
              return (
                <Link
                  key={item.id}
                  href={`/containers/${item.id}`}
                  className="group overflow-hidden rounded-md border border-neutral-300 bg-white shadow-sm transition hover:border-neutral-400 hover:shadow-md"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-neutral-100">
                    <ContainerPhotoWithPlaceholder
                      src={getCardImage(item)}
                      alt={summary.title}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                      className="object-cover"
                    />
                  </div>
                  <div className="grid gap-3 p-4">
                    <div className="grid gap-1">
                      <p className="text-lg font-semibold text-neutral-900">{summary.title}</p>
                      <p className="text-sm text-neutral-600">
                        {[item.locationCity, item.locationCountry].filter(Boolean).join(", ")}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-neutral-600">
                      <span>
                        {copy.quantityLabel}: {item.quantity}
                      </span>
                      <span>
                        {copy.addedLabel}: {new Date(item.createdAt).toLocaleDateString(locale)}
                      </span>
                    </div>
                    <p className="text-base font-semibold text-neutral-900">
                      {summary.price ?? copy.askPrice}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-neutral-300 bg-white p-8 text-center">
            <p className="text-lg font-semibold text-neutral-900">{copy.emptyTitle}</p>
            <p className="mt-2 text-sm leading-6 text-neutral-600">{copy.emptyText}</p>
            <div className="mt-4">
              <Link
                href={browseHref}
                className="inline-flex h-11 items-center justify-center rounded-md border border-neutral-300 bg-neutral-100 px-4 text-sm font-medium text-neutral-800 transition hover:bg-neutral-200"
              >
                {copy.browseList}
              </Link>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
