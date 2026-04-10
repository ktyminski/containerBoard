"use client";

import { useMemo, useState } from "react";
import type { AppMessages } from "@/lib/i18n";
import { formatTemplate } from "@/lib/i18n";
import { getCompanyFallbackColor, getCompanyFallbackGradient } from "@/lib/company-logo-fallback";
import { ImageDropzone } from "./image-dropzone";
import type { ImageItem } from "./types";

type MediaModalTarget = "logo" | "background" | null;
const LOGO_MAX_MB = 3;
const BACKGROUND_MAX_MB = 6;

type CompanyMediaSectionProps = {
  messages: AppMessages["companyCreate"];
  companyName: string;
  logo: ImageItem | null;
  background: ImageItem | null;
  initialLogoUrl?: string | null;
  initialBackgroundUrl?: string | null;
  isInitialLogoRemoved?: boolean;
  isInitialBackgroundRemoved?: boolean;
  onLogoFilesAdded: (files: File[]) => void;
  onBackgroundFilesAdded: (files: File[]) => void;
  onRemoveLogo: () => void;
  onRemoveBackground: () => void;
};

function getCompanyInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return "LOGO";
  }
  return trimmed[0].toUpperCase();
}

function getRandomPlaceholderColor(): string {
  const hue = Math.floor(Math.random() * 360);
  return `hsl(${hue} 65% 42%)`;
}

export function CompanyMediaSection({
  messages,
  companyName,
  logo,
  background,
  initialLogoUrl = null,
  initialBackgroundUrl = null,
  isInitialLogoRemoved = false,
  isInitialBackgroundRemoved = false,
  onLogoFilesAdded,
  onBackgroundFilesAdded,
  onRemoveLogo,
  onRemoveBackground,
}: CompanyMediaSectionProps) {
  const [mediaModalTarget, setMediaModalTarget] = useState<MediaModalTarget>(null);

  const companyNameText = companyName.trim();
  const companyInitial = useMemo(() => getCompanyInitial(companyName), [companyName]);
  const [logoPlaceholderStyle] = useState(() => ({
    backgroundColor: getRandomPlaceholderColor(),
  }));
  const [backgroundPlaceholderStyle] = useState(() => {
    const randomSeed = `${Date.now()}-${Math.random()}`;
    const color = getCompanyFallbackColor(randomSeed);
    return {
      backgroundImage: getCompanyFallbackGradient(color),
    };
  });
  const isLogoModalOpen = mediaModalTarget === "logo";
  const hasLogoImage = Boolean(logo || (initialLogoUrl && !isInitialLogoRemoved));
  const hasBackgroundImage = Boolean(background || (initialBackgroundUrl && !isInitialBackgroundRemoved));
  const activeHasImage = isLogoModalOpen ? hasLogoImage : hasBackgroundImage;
  const activeTitle = isLogoModalOpen ? messages.logoFile : messages.backgroundFile;
  const activeHint = formatTemplate(messages.imageDropzoneHintWithLimit, {
    maxMb: isLogoModalOpen ? LOGO_MAX_MB : BACKGROUND_MAX_MB,
  });
  const logoPreviewUrl = logo?.previewUrl ?? (isInitialLogoRemoved ? null : initialLogoUrl);
  const backgroundPreviewUrl =
    background?.previewUrl ?? (isInitialBackgroundRemoved ? null : initialBackgroundUrl);

  return (
    <>
      <section className="overflow-hidden border-b border-slate-800 bg-slate-950/40">
        <div className="relative overflow-hidden bg-slate-950">
          <button
            type="button"
            className="group relative block aspect-[4/1] w-full cursor-pointer overflow-hidden text-left"
            onClick={() => setMediaModalTarget("background")}
            aria-label={messages.backgroundFile}
          >
            {backgroundPreviewUrl ? (
              <img
                src={backgroundPreviewUrl}
                alt={messages.backgroundAlt}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full" style={backgroundPlaceholderStyle} />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10" />
          </button>

          <button
            type="button"
            className="absolute right-3 top-3 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-slate-400/60 bg-slate-950/75 text-lg text-slate-100 hover:border-slate-300"
            onClick={() => setMediaModalTarget("background")}
            aria-label={messages.backgroundFile}
          >
            +
          </button>

          <div className="absolute bottom-4 left-4 z-10 flex max-w-[calc(100%-2rem)] items-end gap-3">
            <button
              type="button"
              className="relative h-12 w-12 shrink-0 cursor-pointer overflow-hidden rounded-lg border-2 border-slate-700 bg-slate-950 text-xl font-semibold text-white shadow-lg sm:h-12 sm:w-12 md:h-24 md:w-24 lg:h-32 lg:w-32"
              onClick={() => setMediaModalTarget("logo")}
              aria-label={messages.logoFile}
            >
              {logoPreviewUrl ? (
                <img
                  src={logoPreviewUrl}
                  alt={messages.logoAlt}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span
                  className="flex h-full w-full items-center justify-center"
                  style={logoPlaceholderStyle}
                >
                  {companyInitial}
                </span>
              )}
              <span className="absolute bottom-1 right-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-400/60 bg-slate-950/80 text-sm text-slate-100">
                +
              </span>
            </button>

            {companyNameText ? (
              <p className="max-w-[400px] min-w-0 truncate pb-1 text-base font-semibold text-white/95 sm:text-lg">
                {companyNameText}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {mediaModalTarget ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto [&>div:not(.fixed)]:my-auto [&>div:not(.fixed)]:max-h-[calc(100dvh-2rem)] [&>div:not(.fixed)]:!overflow-y-auto bg-slate-950/80 p-4">
          <div className="w-full max-w-xl rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-100">{activeTitle}</h3>
                <p className="mt-1 text-xs text-slate-400">{activeHint}</p>
              </div>
              <button
                type="button"
                className="cursor-pointer rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500"
                onClick={() => setMediaModalTarget(null)}
              >
                {messages.cropCancel}
              </button>
            </div>

            <div className="mt-4">
              <ImageDropzone
                title={activeTitle}
                hintText={activeHint}
                multiple={false}
                onFilesAdded={(files) => {
                  if (isLogoModalOpen) {
                    onLogoFilesAdded(files);
                  } else {
                    onBackgroundFilesAdded(files);
                  }
                  setMediaModalTarget(null);
                }}
              />
            </div>

            {activeHasImage ? (
              <div className="mt-4">
                <button
                  type="button"
                  className="cursor-pointer rounded-md border border-rose-700/70 bg-rose-900/20 px-3 py-2 text-xs text-rose-200 hover:border-rose-500"
                  onClick={isLogoModalOpen ? onRemoveLogo : onRemoveBackground}
                >
                  {messages.imageRemove}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

    </>
  );
}


