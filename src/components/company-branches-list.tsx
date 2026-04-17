"use client";

import { useState } from "react";
import Image from "next/image";
import { getCountryFlagEmoji, getCountryFlagSvgUrl } from "@/lib/country-flags";

type BranchPhoto = {
  id: string;
  url: string;
  alt: string;
};

type BranchLocation = {
  label: string;
  addressText: string;
  postalCode?: string;
  country?: string;
  phone?: string;
  email?: string;
  photos: BranchPhoto[];
};

type CompanyBranchesListProps = {
  locations: BranchLocation[];
  phoneLabel: string;
  emailLabel: string;
  showMoreLabel: string;
  onLocationClick?: (index: number) => void;
};

const INITIAL_VISIBLE_BRANCHES = 3;

function LocationFlag({ country }: { country?: string }) {
  const flagUrl = getCountryFlagSvgUrl(country);
  if (flagUrl) {
    return (
      <Image
        src={flagUrl}
        alt=""
        aria-hidden="true"
        width={16}
        height={12}
        unoptimized
        className="inline-block h-3 w-4 shrink-0 rounded-[2px] border border-neutral-400/60 object-cover"
      />
    );
  }

  const emoji = getCountryFlagEmoji(country);
  if (emoji === "??") {
    return null;
  }

  return (
    <span aria-hidden="true" className="shrink-0 text-xs leading-none">
      {emoji}
    </span>
  );
}

export function CompanyBranchesList({
  locations,
  phoneLabel,
  emailLabel,
  showMoreLabel,
  onLocationClick,
}: CompanyBranchesListProps) {
  const [showAll, setShowAll] = useState(false);
  const visibleLocations = showAll ? locations : locations.slice(0, INITIAL_VISIBLE_BRANCHES);
  const hiddenCount = Math.max(0, locations.length - INITIAL_VISIBLE_BRANCHES);

  return (
    <div className="grid gap-3">
      {visibleLocations.map((location, index) => {
        const content = (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-neutral-100">{location.label}</p>
                <p className="mt-1 flex min-w-0 items-start gap-2 text-sm text-neutral-300">
                  <LocationFlag country={location.country} />
                  <span className="min-w-0 break-words">
                    {location.postalCode ? (
                      <span className="font-semibold text-neutral-100">{location.postalCode}</span>
                    ) : null}
                    {location.postalCode ? " " : null}
                    {location.addressText}
                  </span>
                </p>
              </div>
              {(location.phone || location.email) ? (
                <div className="grid gap-2 text-left sm:min-w-[220px] sm:justify-items-end sm:text-right">
                  {location.phone ? (
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-neutral-300">{phoneLabel}</p>
                      <a
                        href={`tel:${location.phone.replace(/\s+/g, "")}`}
                        className="text-sm font-semibold text-neutral-100 transition-colors hover:text-sky-300"
                      >
                        {location.phone}
                      </a>
                    </div>
                  ) : null}
                  {location.email ? (
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-neutral-300">{emailLabel}</p>
                      <a
                        href={`mailto:${location.email}`}
                        className="break-all text-sm font-semibold text-neutral-100 transition-colors hover:text-sky-300"
                      >
                        {location.email}
                      </a>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            {location.photos.length > 0 ? (
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {location.photos.map((photo) => (
                  <div
                    key={photo.id}
                    className="group relative h-28 overflow-hidden rounded-md border border-neutral-800"
                  >
                    <Image
                      src={photo.url}
                      alt={photo.alt}
                      fill
                      className="object-cover transition-transform duration-300 ease-out group-hover:scale-105"
                      sizes="(max-width: 768px) 50vw, 220px"
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </>
        );

        if (onLocationClick) {
          return (
            <button
              key={`${location.label}-${location.addressText}-${index}`}
              type="button"
              onClick={() => onLocationClick(index)}
              className="cursor-pointer rounded-lg border border-neutral-800 bg-neutral-950/80 p-4 text-left transition-colors hover:border-sky-400/60"
            >
              {content}
            </button>
          );
        }

        return (
          <article
            key={`${location.label}-${location.addressText}-${index}`}
            className="rounded-lg border border-neutral-800 bg-neutral-950/80 p-4"
          >
            {content}
          </article>
        );
      })}
      {!showAll && hiddenCount > 0 ? (
        <button
          type="button"
          className="inline-flex w-fit cursor-pointer rounded-md border border-neutral-700 px-3 py-2 text-sm font-medium text-neutral-200 transition-colors hover:border-neutral-500"
          onClick={() => setShowAll(true)}
        >
          {showMoreLabel} ({hiddenCount})
        </button>
      ) : null}
    </div>
  );
}

