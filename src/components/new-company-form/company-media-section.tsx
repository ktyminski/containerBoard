"use client";

import { useMemo, useState } from "react";
import type { AppMessages } from "@/lib/i18n";
import { formatTemplate } from "@/lib/i18n";
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
  const backgroundPlaceholderStyle = {
    backgroundImage:
      "linear-gradient(180deg,#031a3c_0%,#05244f_100%)",
  };
  const isLogoModalOpen = mediaModalTarget === "logo";
  const isBackgroundModalOpen = mediaModalTarget === "background";
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
  const backgroundOverlayClass = backgroundPreviewUrl
    ? "absolute inset-0 bg-gradient-to-t from-neutral-950/34 via-neutral-950/10 to-transparent"
    : "";

  return (
    <>
      <section className="overflow-hidden border-b border-[#1f4f86] bg-[linear-gradient(180deg,#031a3c_0%,#05244f_100%)]">
        <div className="relative overflow-hidden">
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
            {backgroundOverlayClass ? <div className={backgroundOverlayClass} /> : null}
          </button>

          <button
            type="button"
            className="absolute right-3 top-3 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-neutral-300 bg-white/92 text-lg text-neutral-700 shadow-sm transition hover:border-neutral-400"
            onClick={() => setMediaModalTarget("background")}
            aria-label={messages.backgroundFile}
          >
            +
          </button>

          <div className="absolute bottom-4 left-4 z-10 flex max-w-[calc(100%-2rem)] items-end gap-3">
            <button
              type="button"
              className="relative h-12 w-12 shrink-0 cursor-pointer overflow-hidden rounded-lg border-2 border-[#d1d5db] bg-[#0b1730] text-xl font-semibold text-white shadow-lg sm:h-12 sm:w-12 md:h-24 md:w-24 lg:h-32 lg:w-32"
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
              <span className="absolute bottom-1 right-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-neutral-400/60 bg-[rgba(11,23,48,0.86)] text-sm text-[#e2efff]">
                +
              </span>
            </button>

            {companyNameText ? (
              <p className="max-w-[400px] min-w-0 truncate pb-1 text-base font-semibold text-white/95 [text-shadow:0_2px_8px_rgba(2,6,23,0.85)] sm:text-lg">
                {companyNameText}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {mediaModalTarget ? (
        <div
          className={`fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto [&>div:not(.fixed)]:my-auto [&>div:not(.fixed)]:max-h-[calc(100dvh-2rem)] [&>div:not(.fixed)]:!overflow-y-auto p-4 ${
            isBackgroundModalOpen ? "bg-neutral-100/85" : "bg-[rgba(2,6,23,0.82)]"
          }`}
        >
          <div
            className={`w-full max-w-xl rounded-xl border p-5 shadow-2xl ${
              isBackgroundModalOpen ? "border-neutral-300 bg-white" : "border-[#334155] bg-[#0b1730]"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className={`text-lg font-semibold ${isBackgroundModalOpen ? "text-neutral-800" : "text-[#e2efff]"}`}>
                  {activeTitle}
                </h3>
                <p className={`mt-1 text-xs ${isBackgroundModalOpen ? "text-neutral-600" : "text-[#9fb8d8]"}`}>
                  {activeHint}
                </p>
              </div>
              <button
                type="button"
                className={`cursor-pointer rounded-md border px-3 py-1.5 text-xs transition ${
                  isBackgroundModalOpen
                    ? "border-neutral-300 text-neutral-600 hover:border-neutral-400"
                    : "border-[#334155] text-[#cbd5e1] hover:border-[#475569]"
                }`}
                onClick={() => setMediaModalTarget(null)}
              >
                {messages.cropCancel}
              </button>
            </div>

            <div className="mt-4">
              <ImageDropzone
                title={activeTitle}
                hintText={activeHint}
                variant={isBackgroundModalOpen ? "light" : "dark"}
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




