import Image from "next/image";
import type { AppMessages } from "@/lib/i18n";
import type { OfferCompany } from "@/components/new-offer-form/types";
import {
  getCompanyFallbackColor,
  getCompanyFallbackGradient,
  getCompanyInitial,
} from "@/lib/company-logo-fallback";

type OfferPreviewModalProps = {
  open: boolean;
  company: OfferCompany | null;
  title: string;
  offerTypeLabel: string;
  previewDescription: string;
  previewLocation: string;
  externalLinks: string[];
  messages: AppMessages["offerCreate"];
  onClose: () => void;
};

export function OfferPreviewModal({
  open,
  company,
  title,
  offerTypeLabel,
  previewDescription,
  previewLocation,
  externalLinks,
  messages,
  onClose,
}: OfferPreviewModalProps) {
  if (!open) {
    return null;
  }
  const fallbackSeed = company?.id ?? company?.name ?? "";
  const logoFallbackColor = getCompanyFallbackColor(fallbackSeed);
  const backgroundFallbackGradient = getCompanyFallbackGradient(logoFallbackColor);
  const logoFallbackInitial = getCompanyInitial(company?.name ?? "");

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto [&>div:not(.fixed)]:my-auto [&>div:not(.fixed)]:max-h-[calc(100dvh-2rem)] [&>div:not(.fixed)]:!overflow-y-auto p-4">
      <div
        className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-3xl overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
              {messages.previewTitle}
            </p>
            <h3 className="text-sm font-semibold text-slate-100">
              {messages.previewModalSubtitle}
            </h3>
          </div>
          <button
            type="button"
            className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500"
            onClick={onClose}
          >
            {messages.previewClose}
          </button>
        </div>
        <div className="max-h-[80vh] overflow-y-auto p-4">
          <article className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/70">
            <div className="relative h-44 w-full">
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
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/70 to-transparent" />
              <div className="absolute inset-x-4 bottom-4 flex items-end gap-3">
                <div className="relative h-12 w-12 overflow-hidden rounded-lg border border-slate-700 bg-slate-900 sm:h-12 sm:w-12 md:h-20 md:w-20 lg:h-24 lg:w-24">
                  {company?.logoUrl ? (
                    <Image
                      src={company.logoUrl}
                      alt={`${company.name} logo`}
                      fill
                      className="object-contain"
                      sizes="(max-width: 767px) 48px, (max-width: 1023px) 80px, 96px"
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
                <div className="min-w-0">
                  <p
                    className="truncate text-xl font-semibold text-slate-100 sm:text-2xl"
                    title={company?.name ?? "-"}
                  >
                    {company?.name ?? "-"}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 p-4 text-sm">
              <p>
                <span className="inline-flex rounded-md border border-cyan-500/60 bg-cyan-500/15 px-2 py-0.5 text-xs font-semibold text-cyan-200">
                  {offerTypeLabel}
                </span>
              </p>
              <h3 className="text-xl font-semibold text-slate-100 sm:text-2xl">
                {title.trim() || messages.previewFallbackTitle}
              </h3>
              <div className="text-sm text-slate-200 [&_h2]:mt-2 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mt-2 [&_h3]:text-sm [&_h3]:font-semibold [&_p+p]:mt-3 [&_p:empty]:block [&_p:empty]:h-4 [&_ul]:ml-4 [&_ul]:list-disc [&_ol]:ml-4 [&_ol]:list-decimal">
                {previewDescription ? (
                  <div dangerouslySetInnerHTML={{ __html: previewDescription }} />
                ) : (
                  <p className="text-slate-500">{messages.previewNoDescription}</p>
                )}
              </div>
              <p className="text-slate-300">
                <span className="text-slate-400">{messages.locationPreviewLabel}: </span>
                {previewLocation}
              </p>
              {externalLinks.length > 0 ? (
                <div className="grid gap-2">
                  <p className="text-xs font-medium text-slate-400">{messages.externalLinksTitle}</p>
                  <div className="flex flex-wrap gap-2">
                    {externalLinks.map((link) => (
                      <a
                        key={`preview-link-${link}`}
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="max-w-full truncate rounded-md border border-slate-700 px-2 py-1 text-xs text-sky-300 hover:border-sky-500"
                      >
                        {link}
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}


