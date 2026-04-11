"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { MAP_STYLE_URL } from "@/components/map-shared";
import { formatTemplate, type AppMessages } from "@/lib/i18n";
import {
  getCompanyFallbackColor,
  getCompanyFallbackGradient,
  getCompanyInitial,
} from "@/lib/company-logo-fallback";
import {
  type JobContractType,
  type JobEmploymentType,
  type JobWorkModel,
} from "@/lib/job-announcement";

const DEFAULT_CENTER: [number, number] = [21.0122, 52.2297];

function getWorkModelLabel(
  workModel: JobWorkModel,
  messages: AppMessages["announcementCreate"],
): string {
  return messages.workModels[workModel];
}

function getEmploymentTypeLabel(
  employmentType: JobEmploymentType,
  messages: AppMessages["announcementCreate"],
): string {
  return messages.employmentTypes[employmentType];
}

function getContractTypeLabel(
  contractType: JobContractType,
  messages: AppMessages["announcementCreate"],
): string {
  return messages.contractTypes[contractType];
}

type PreviewCompany = {
  name: string;
  logoUrl: string | null;
  backgroundUrl: string | null;
};

type PreviewContactPerson = {
  name: string;
  phone?: string;
  email?: string;
};

export function MapLocationPicker({
  lat,
  lng,
  labels,
  mapClassName,
  onChange,
}: {
  lat: number | null;
  lng: number | null;
  labels: {
    hint: string;
  };
  mapClassName?: string;
  onChange: (next: { lat: number; lng: number }) => void;
}) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE_URL,
      center: DEFAULT_CENTER,
      zoom: 10,
      minZoom: 3,
      maxZoom: 18,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.on("click", (event) => {
      const nextLng = event.lngLat.lng;
      const nextLat = event.lngLat.lat;

      if (!markerRef.current) {
        markerRef.current = new maplibregl.Marker({ draggable: true })
          .setLngLat([nextLng, nextLat])
          .addTo(map);
        markerRef.current.on("dragend", () => {
          const point = markerRef.current?.getLngLat();
          if (!point) {
            return;
          }
          onChangeRef.current({ lat: point.lat, lng: point.lng });
        });
      } else {
        markerRef.current.setLngLat([nextLng, nextLat]);
      }

      onChangeRef.current({ lat: nextLat, lng: nextLng });
    });

    mapRef.current = map;
    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }
    if (lat === null || lng === null) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }

    if (!markerRef.current) {
      markerRef.current = new maplibregl.Marker({ draggable: true })
        .setLngLat([lng, lat])
        .addTo(map);
      markerRef.current.on("dragend", () => {
        const point = markerRef.current?.getLngLat();
        if (!point) {
          return;
        }
        onChangeRef.current({ lat: point.lat, lng: point.lng });
      });
    } else {
      markerRef.current.setLngLat([lng, lat]);
    }

    map.easeTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 12) });
  }, [lat, lng]);

  return (
    <div className="grid gap-2">
      <div
        ref={mapContainerRef}
        className={`w-full overflow-hidden rounded-md border border-slate-700 ${mapClassName ?? "h-56"}`}
      />
      {labels.hint ? <p className="text-xs text-slate-300">{labels.hint}</p> : null}
    </div>
  );
}

export function JobAnnouncementPreviewCard({
  selectedCompany,
  companyBenefits,
  companyBenefitsTitle,
  title,
  workModel,
  employmentType,
  contractTypes,
  previewLocationCity,
  previewLocation,
  previewDescription,
  salaryText,
  tags,
  requirements,
  externalLinks,
  contactPersons,
  messages,
}: {
  selectedCompany: PreviewCompany;
  companyBenefits: string[];
  companyBenefitsTitle: string;
  title: string;
  workModel: JobWorkModel;
  employmentType: JobEmploymentType;
  contractTypes: JobContractType[];
  previewLocationCity: string | null;
  previewLocation: string;
  previewDescription: string;
  salaryText: string | null;
  tags: string[];
  requirements: string[];
  externalLinks: string[];
  contactPersons: PreviewContactPerson[];
  messages: AppMessages["announcementCreate"];
}) {
  const previewTitle = title.trim() || messages.previewFallbackTitle;
  const hasDescription = previewDescription.trim().length > 0;
  const hasLocation =
    previewLocation.trim().length > 0 && previewLocation !== messages.locationPreviewNoBranch;
  const contractTypeLabels = contractTypes.map((contractType) =>
    getContractTypeLabel(contractType, messages),
  );
  const contractTypeSummary =
    contractTypeLabels.length === 0
      ? null
      : contractTypeLabels.length === 1
        ? contractTypeLabels[0]
        : `${contractTypeLabels[0]} ${messages.contractSummaryAndOthers}`;
  const contractTypeFull = contractTypeLabels.length > 0 ? contractTypeLabels.join(", ") : null;
  const normalizedPreviewLocationCity = previewLocationCity?.trim() || null;
  const logoFallbackColor = getCompanyFallbackColor(selectedCompany.name);
  const backgroundFallbackGradient = getCompanyFallbackGradient(logoFallbackColor);
  const logoFallbackInitial = getCompanyInitial(selectedCompany.name);

  return (
    <article className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/70">
      <div className="relative h-44 w-full">
        {selectedCompany.backgroundUrl ? (
          <Image
            src={selectedCompany.backgroundUrl}
            alt={formatTemplate(messages.previewBackgroundAlt, {
              company: selectedCompany.name,
            })}
            fill
            className="object-cover"
            sizes="(max-width: 1280px) 100vw, 900px"
          />
        ) : (
          <div className="h-full w-full" style={{ backgroundImage: backgroundFallbackGradient }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/70 to-transparent" />
        <div className="absolute inset-x-4 bottom-4 flex items-end gap-3">
          <div className="relative h-12 w-12 overflow-hidden rounded-lg border border-slate-700 bg-slate-900 sm:h-12 sm:w-12 md:h-20 md:w-20 lg:h-24 lg:w-24">
            {selectedCompany.logoUrl ? (
              <Image
                src={selectedCompany.logoUrl}
                alt={formatTemplate(messages.previewLogoAlt, {
                  company: selectedCompany.name,
                })}
                fill
                className="object-contain"
                sizes="(max-width: 767px) 48px, (max-width: 1023px) 80px, 96px"
              />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center text-lg font-semibold text-white md:text-2xl"
                style={{ backgroundColor: logoFallbackColor }}
                aria-label={formatTemplate(messages.previewLogoAlt, {
                  company: selectedCompany.name,
                })}
              >
                {logoFallbackInitial}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-3 p-4 text-sm">
        <div className="flex flex-wrap items-stretch justify-center gap-2">
          <div className="rounded-md bg-slate-800/80 px-3 py-2 text-center">
            <p className="text-[10px] uppercase tracking-[0.08em] text-slate-400">
              {messages.employmentTypeTitle}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-slate-100">
              {getEmploymentTypeLabel(employmentType, messages)}
            </p>
          </div>
          <div className="rounded-md bg-slate-800/80 px-3 py-2 text-center">
            <p className="text-[10px] uppercase tracking-[0.08em] text-slate-400">
              {messages.workModelTitle}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-slate-100">
              {getWorkModelLabel(workModel, messages)}
            </p>
          </div>
          {contractTypeSummary ? (
            <div className="rounded-md bg-slate-800/80 px-3 py-2 text-center">
              <p className="text-[10px] uppercase tracking-[0.08em] text-slate-400">
                {messages.contractTypeTitle}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-slate-100">{contractTypeSummary}</p>
            </div>
          ) : null}
          {normalizedPreviewLocationCity ? (
            <div className="rounded-md border border-amber-600/70 bg-amber-500/15 px-3 py-2 text-center">
              <p className="text-[10px] uppercase tracking-[0.08em] text-amber-300/90">
                {messages.previewLocationLabel}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-amber-200">
                {normalizedPreviewLocationCity}
              </p>
            </div>
          ) : null}
          {salaryText ? (
            <div className="rounded-md border border-emerald-700/70 bg-emerald-950/35 px-3 py-2 text-center">
              <p className="text-[10px] uppercase tracking-[0.08em] text-emerald-300/90">
                {messages.salaryTitle}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-emerald-200">{salaryText}</p>
            </div>
          ) : null}
        </div>
        <h3 className="text-xl font-semibold text-slate-100 sm:text-2xl">{previewTitle}</h3>

        {hasDescription ? (
          <div className="grid gap-2 text-sm text-slate-200 [&_h2]:mt-3 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mt-2 [&_h3]:text-sm [&_h3]:font-semibold [&_p+p]:mt-3 [&_ul]:ml-4 [&_ul]:list-disc [&_ol]:ml-4 [&_ol]:list-decimal">
            <div dangerouslySetInnerHTML={{ __html: previewDescription }} />
          </div>
        ) : null}

        {hasLocation ? (
          <div className="grid gap-2">
            <div className="grid gap-1">
              <p className="text-[11px] uppercase tracking-[0.1em] text-slate-500">
                {messages.previewLocationLabel}
              </p>
              <p className="text-xs text-slate-300">{previewLocation}</p>
            </div>
            {contractTypeSummary ? (
              <div className="grid gap-1">
                <p className="text-[11px] uppercase tracking-[0.1em] text-slate-500">
                  {messages.contractTypeTitle}
                </p>
                <p className="text-xs text-slate-300">{contractTypeFull}</p>
              </div>
            ) : null}
          </div>
        ) : null}

        {tags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={`preview-${tag}`}
                className="rounded-full border border-slate-700 px-2 py-1 text-[11px] text-slate-300"
              >
                #{tag}
              </span>
            ))}
          </div>
        ) : null}

        {requirements.length > 0 ? (
          <div className="grid gap-2">
            <p className="text-[11px] uppercase tracking-[0.1em] text-slate-500">
              {messages.requirementsTitle}
            </p>
            <ul className="flex flex-wrap gap-2">
              {requirements.map((requirement) => (
                <li
                  key={requirement}
                  className="inline-flex items-center rounded-md border border-sky-400/35 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-100"
                >
                  {requirement}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {companyBenefits.length > 0 ? (
          <div className="grid gap-2">
            <p className="text-[11px] uppercase tracking-[0.1em] text-slate-500">
              {companyBenefitsTitle}
            </p>
            <ul className="flex flex-wrap gap-2">
              {companyBenefits.map((benefit) => (
                <li
                  key={benefit}
                  className="inline-flex items-center rounded-md border border-emerald-400/35 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-100"
                >
                  {benefit}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {externalLinks.length > 0 ? (
          <div className="grid gap-2">
            <p className="text-[11px] uppercase tracking-[0.1em] text-slate-500">
              {messages.externalLinksTitle}
            </p>
            <div className="flex flex-wrap gap-2">
              {externalLinks.map((link) => (
                <a
                  key={link}
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="rounded-md border border-slate-700 px-2 py-1 text-[11px] text-sky-300 hover:border-sky-500"
                >
                  {messages.openExternalLink}
                </a>
              ))}
            </div>
          </div>
        ) : null}

        {contactPersons.length > 0 ? (
          <div className="grid gap-2">
            <p className="text-[11px] uppercase tracking-[0.1em] text-slate-500">
              {messages.contactPeopleTitle}
            </p>
            <div className="grid gap-2">
              {contactPersons.map((person, index) => (
                <div
                  key={`${person.email ?? person.phone ?? person.name}-${index}`}
                  className="rounded-md border border-slate-800 bg-slate-900/70 p-2 text-xs text-slate-300"
                >
                  <p className="font-semibold text-slate-100">{person.name}</p>
                  {person.email ? <p>{person.email}</p> : null}
                  {person.phone ? <p>{person.phone}</p> : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}
