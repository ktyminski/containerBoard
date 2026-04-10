"use client";

import { useMemo, useState } from "react";
import { CompanyBranchesList } from "@/components/company-branches-list";
import { CompanyLocationsMap } from "@/components/company-locations-map";

type CompanyLocationWithMedia = {
  label: string;
  addressText: string;
  note?: string;
  phone?: string;
  email?: string;
  point: {
    coordinates: [number, number];
  };
  isMain: boolean;
  photos: Array<{
    id: string;
    url: string;
    alt: string;
  }>;
};

type CompanyLocationsAndBranchesProps = {
  locations: CompanyLocationWithMedia[];
  labels: {
    locationsTitle: string;
    branchesTitle: string;
    mainLocationBadge: string;
    phoneLabel: string;
    emailLabel: string;
    showMoreBranches: string;
  };
};

export function CompanyLocationsAndBranches({
  locations,
  labels,
}: CompanyLocationsAndBranchesProps) {
  const [focusedLocationIndex, setFocusedLocationIndex] = useState<number | null>(null);
  const [focusRequestId, setFocusRequestId] = useState(0);
  const mapLocations = useMemo(
    () =>
      locations.map((location) => ({
        label: location.label,
        addressText: location.addressText,
        point: location.point.coordinates,
        isMain: location.isMain,
      })),
    [locations],
  );

  return (
    <>
      <section className="grid gap-3 border-t border-slate-800 pt-5">
        <CompanyLocationsMap
          locations={mapLocations}
          labels={{
            mainLocationBadge: labels.mainLocationBadge,
          }}
          focusedLocationIndex={focusedLocationIndex}
          focusRequestId={focusRequestId}
        />
      </section>

      <section className="grid gap-3 border-t border-slate-800 pt-5">
        <CompanyBranchesList
          locations={locations}
          phoneLabel={labels.phoneLabel}
          emailLabel={labels.emailLabel}
          showMoreLabel={labels.showMoreBranches}
          onLocationClick={(index) => {
            setFocusedLocationIndex(index);
            setFocusRequestId((current) => current + 1);
          }}
        />
      </section>
    </>
  );
}
