import Image from "next/image";
import type { OfferCompany } from "@/components/new-offer-form/types";
import {
  getCompanyFallbackColor,
  getCompanyFallbackGradient,
  getCompanyInitial,
} from "@/lib/company-logo-fallback";

export function OfferCompanyHero({ company }: { company: OfferCompany | null }) {
  const fallbackSeed = company?.id ?? company?.name ?? "";
  const logoFallbackColor = getCompanyFallbackColor(fallbackSeed);
  const backgroundFallbackGradient = getCompanyFallbackGradient(logoFallbackColor);
  const logoFallbackInitial = getCompanyInitial(company?.name ?? "");

  return (
    <div className="relative overflow-hidden border-b border-slate-800 bg-slate-950">
      <div className="relative aspect-[4/1] w-full">
        {company?.backgroundUrl ? (
          <Image
            src={company.backgroundUrl}
            alt={`${company.name} background`}
            fill
            className="object-cover"
            sizes="(max-width: 1280px) 100vw, 900px"
          />
        ) : (
          <div className="h-full w-full" style={{ backgroundImage: backgroundFallbackGradient }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10" />
        <div className="absolute bottom-4 left-4 z-10 flex max-w-[calc(100%-2rem)] items-end gap-3">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border-2 border-slate-700 bg-slate-900 sm:h-12 sm:w-12 md:h-24 md:w-24 lg:h-32 lg:w-32">
            {company?.logoUrl ? (
              <Image
                src={company.logoUrl}
                alt={`${company.name} logo`}
                fill
                className="object-cover"
                sizes="(max-width: 767px) 48px, (max-width: 1023px) 96px, 128px"
                quality={100}
              />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center text-lg font-semibold text-white md:text-2xl"
                style={{ backgroundColor: logoFallbackColor }}
                aria-label={`${company?.name ?? "Company"} logo`}
              >
                {logoFallbackInitial}
              </div>
            )}
          </div>
          <p className="max-w-[400px] min-w-0 truncate pb-1 text-base font-semibold text-white/95 sm:text-lg">
            {company?.name ?? "-"}
          </p>
        </div>
      </div>
    </div>
  );
}
