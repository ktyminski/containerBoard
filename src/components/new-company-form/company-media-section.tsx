"use client";

import { useEffect, useMemo, useState } from "react";
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

const DEFAULT_LOGO_PLACEHOLDER_COLOR = "#05244f";

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

  const closeMediaModal = () => {
    setMediaModalTarget(null);
  };

  useEffect(() => {
    if (!mediaModalTarget) {
      return;
    }

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMediaModal();
      }
    };

    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("keydown", onEscape);
    };
  }, [mediaModalTarget]);

  const companyNameText = companyName.trim();
  const companyInitial = useMemo(() => getCompanyInitial(companyName), [companyName]);
  const logoPlaceholderStyle = {
    backgroundColor: DEFAULT_LOGO_PLACEHOLDER_COLOR,
  };
  const backgroundPlaceholderStyle = {
    backgroundImage: "linear-gradient(180deg,#d4d4d8_0%,#a1a1aa_100%)",
  };
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
  const backgroundOverlayClass = backgroundPreviewUrl
    ? "absolute inset-0 bg-gradient-to-t from-neutral-950/78 via-neutral-900/45 to-transparent"
    : "";
  const companyNameClass = backgroundPreviewUrl
    ? "max-w-[400px] min-w-0 truncate pb-1 text-base font-semibold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)] sm:text-lg"
    : "max-w-[400px] min-w-0 truncate pb-1 text-base font-semibold text-neutral-900 sm:text-lg";

  return (
    <>
      <section className="overflow-hidden border-b border-neutral-300 bg-neutral-200">
        <div className="relative overflow-hidden">
          <button
            type="button"
            className="group relative block aspect-[4/1] w-full cursor-pointer overflow-hidden bg-neutral-300 text-left"
            onClick={() => {
              setMediaModalTarget("background");
            }}
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
            onClick={() => {
              setMediaModalTarget("background");
            }}
            aria-label={messages.backgroundFile}
          >
            +
          </button>

          <div className="absolute bottom-4 left-4 z-10 flex max-w-[calc(100%-2rem)] items-end gap-3">
            <button
              type="button"
              className="relative h-12 w-12 shrink-0 cursor-pointer overflow-hidden rounded-lg border-2 border-neutral-300 bg-neutral-700 text-xl font-semibold text-white shadow-lg sm:h-12 sm:w-12 md:h-24 md:w-24 lg:h-32 lg:w-32"
              onClick={() => {
                setMediaModalTarget("logo");
              }}
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
              <span className="absolute bottom-1 right-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-neutral-300/80 bg-neutral-900/70 text-sm text-neutral-100">
                +
              </span>
            </button>

            {companyNameText ? (
              <p className={companyNameClass}>
                {companyNameText}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {mediaModalTarget ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-[rgba(2,6,23,0.45)] p-4 backdrop-blur-[2px] [&>div:not(.fixed)]:my-auto [&>div:not(.fixed)]:max-h-[calc(100dvh-2rem)] [&>div:not(.fixed)]:!overflow-y-auto"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeMediaModal();
            }
          }}
        >
          <div className="w-full max-w-xl rounded-lg border border-neutral-300 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-neutral-800">
                  {activeTitle}
                </h3>
                <p className="mt-1 text-xs text-neutral-600">
                  {activeHint}
                </p>
              </div>
              <button
                type="button"
                className="cursor-pointer rounded-md border border-neutral-300 px-3 py-1.5 text-xs text-neutral-600 transition hover:border-neutral-400"
                onClick={closeMediaModal}
              >
                {messages.cropCancel}
              </button>
            </div>

            <div className="mt-4">
              <ImageDropzone
                title={activeTitle}
                hintText={activeHint}
                variant="light"
                multiple={false}
                onFilesAdded={(files) => {
                  if (isLogoModalOpen) {
                    onLogoFilesAdded(files);
                  } else {
                    onBackgroundFilesAdded(files);
                  }
                  closeMediaModal();
                }}
              />
            </div>

            {activeHasImage ? (
              <div className="mt-4">
                <button
                  type="button"
                  className="cursor-pointer rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700 hover:border-rose-400"
                  onClick={() => {
                    (isLogoModalOpen ? onRemoveLogo : onRemoveBackground)();
                    closeMediaModal();
                  }}
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




