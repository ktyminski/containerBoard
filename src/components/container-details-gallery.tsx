"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ContainerPhotoWithPlaceholder } from "@/components/container-photo-with-placeholder";
import type { ContainerModuleMessages } from "@/components/container-modules-i18n";
import { formatTemplate } from "@/lib/i18n";

type ContainerDetailsGalleryProps = {
  images: string[];
  title: string;
  showMainImage?: boolean;
  mainImagePriority?: boolean;
  showThumbnails?: boolean;
  className?: string;
  mainImageClassName?: string;
  thumbnailsGridClassName?: string;
  thumbnailButtonClassName?: string;
  previewImages?: string[];
  previewIndexOffset?: number;
  messages: ContainerModuleMessages["gallery"];
};

export function ContainerDetailsGallery({
  images,
  title,
  showMainImage = true,
  mainImagePriority = false,
  showThumbnails = true,
  className,
  mainImageClassName,
  thumbnailsGridClassName,
  thumbnailButtonClassName,
  previewImages,
  previewIndexOffset = 0,
  messages,
}: ContainerDetailsGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [zoomedIndex, setZoomedIndex] = useState<number | null>(null);
  const zoomImages = previewImages && previewImages.length > 0 ? previewImages : images;

  useEffect(() => {
    if (zoomedIndex === null) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setZoomedIndex(null);
        return;
      }
      if (event.key === "ArrowRight") {
        setZoomedIndex((current) => {
          if (current === null) {
            return current;
          }
          return (current + 1) % zoomImages.length;
        });
      }
      if (event.key === "ArrowLeft") {
        setZoomedIndex((current) => {
          if (current === null) {
            return current;
          }
          return (current - 1 + zoomImages.length) % zoomImages.length;
        });
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [zoomImages.length, zoomedIndex]);

  if (images.length === 0 || (!showMainImage && !showThumbnails)) {
    return null;
  }

  const selectedImage = images[Math.min(selectedIndex, images.length - 1)] ?? images[0];
  const zoomedImage = zoomedIndex === null ? null : zoomImages[zoomedIndex] ?? null;
  const zoomOverlay = zoomedImage ? (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-neutral-950/85 p-3 sm:p-4">
      <button
        type="button"
        aria-label={messages.closePreviewAria}
        className="absolute inset-0"
        onClick={() => {
          setZoomedIndex(null);
        }}
      />

      <div className="relative z-10 flex h-full w-full max-w-5xl flex-col gap-3 pt-[max(env(safe-area-inset-top),0px)]">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              setZoomedIndex(null);
            }}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100"
          >
            {messages.close}
          </button>
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden rounded-md border border-neutral-700 bg-neutral-900">
          <ContainerPhotoWithPlaceholder
            src={zoomedImage}
            alt={formatTemplate(messages.previewAlt, { title })}
            fill
            unoptimized
            className="object-contain p-2"
            sizes="100vw"
            priority
          />
        </div>

        {zoomImages.length > 1 ? (
          <div className="flex items-center justify-center gap-2 pb-[max(env(safe-area-inset-bottom),0px)]">
            <button
              type="button"
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100"
              onClick={() => {
                setZoomedIndex((current) => {
                  if (current === null) {
                    return current;
                  }
                  return (current - 1 + zoomImages.length) % zoomImages.length;
                });
              }}
            >
              {messages.previous}
            </button>
            <p className="min-w-12 text-center text-sm text-neutral-100">
              {(zoomedIndex ?? 0) + 1} / {zoomImages.length}
            </p>
            <button
              type="button"
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100"
              onClick={() => {
                setZoomedIndex((current) => {
                  if (current === null) {
                    return current;
                  }
                  return (current + 1) % zoomImages.length;
                });
              }}
            >
              {messages.next}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  ) : null;

  return (
    <>
      <div className={`grid gap-3 ${className ?? "mt-5"}`}>
        {showMainImage ? (
          <button
            type="button"
            onClick={() => {
              setZoomedIndex(Math.min(selectedIndex + previewIndexOffset, zoomImages.length - 1));
            }}
            className={mainImageClassName ?? "relative h-36 w-36 overflow-hidden rounded-md border border-neutral-200 bg-neutral-100 sm:h-44 sm:w-44"}
          >
            <ContainerPhotoWithPlaceholder
              src={selectedImage}
              alt={formatTemplate(messages.mainImageAlt, { title })}
              fill
              unoptimized
              className="object-contain p-1"
              sizes="176px"
              priority={mainImagePriority}
            />
          </button>
        ) : null}

        {showThumbnails ? (
          <div className={thumbnailsGridClassName ?? "grid grid-cols-3 gap-2 sm:grid-cols-5"}>
            {images.map((imageSrc, index) => {
              const isSelected = index === selectedIndex;
              return (
                <button
                  key={`${title}-gallery-${imageSrc}-${index + 1}`}
                  type="button"
                  onClick={() => {
                    setSelectedIndex(index);
                    setZoomedIndex(Math.min(index + previewIndexOffset, zoomImages.length - 1));
                  }}
                  className={
                    thumbnailButtonClassName ??
                    `relative aspect-square overflow-hidden rounded-md border bg-neutral-100 transition ${
                      isSelected ? "border-sky-400 ring-1 ring-sky-300" : "border-neutral-200"
                    }`
                  }
                >
                  <ContainerPhotoWithPlaceholder
                    src={imageSrc}
                    alt={formatTemplate(messages.thumbnailAlt, {
                      index: index + 1,
                      title,
                    })}
                    fill
                    unoptimized
                    className="object-contain p-1"
                    sizes="(max-width: 640px) 33vw, 120px"
                  />
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {typeof document !== "undefined" && zoomOverlay
        ? createPortal(zoomOverlay, document.body)
        : null}
    </>
  );
}
