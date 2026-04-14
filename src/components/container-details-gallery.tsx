"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type ContainerDetailsGalleryProps = {
  images: string[];
  title: string;
  showMainImage?: boolean;
  mainImagePriority?: boolean;
  showThumbnails?: boolean;
  className?: string;
};

export function ContainerDetailsGallery({
  images,
  title,
  showMainImage = true,
  mainImagePriority = false,
  showThumbnails = true,
  className,
}: ContainerDetailsGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [zoomedIndex, setZoomedIndex] = useState<number | null>(null);

  useEffect(() => {
    setSelectedIndex(0);
    setZoomedIndex(null);
  }, [images]);

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
          return (current + 1) % images.length;
        });
      }
      if (event.key === "ArrowLeft") {
        setZoomedIndex((current) => {
          if (current === null) {
            return current;
          }
          return (current - 1 + images.length) % images.length;
        });
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [images.length, zoomedIndex]);

  if (images.length === 0 || (!showMainImage && !showThumbnails)) {
    return null;
  }

  const selectedImage = images[Math.min(selectedIndex, images.length - 1)] ?? images[0];
  const zoomedImage = zoomedIndex === null ? null : images[zoomedIndex] ?? null;

  return (
    <>
      <div className={`grid gap-3 ${className ?? "mt-5"}`}>
        {showMainImage ? (
          <button
            type="button"
            onClick={() => {
              setZoomedIndex(Math.min(selectedIndex, images.length - 1));
            }}
            className="relative h-36 w-36 overflow-hidden rounded-md border border-neutral-200 bg-neutral-100 sm:h-44 sm:w-44"
          >
            <Image
              src={selectedImage}
              alt={`Zdjecie glowne ogloszenia: ${title}`}
              fill
              unoptimized
              className="object-contain p-1"
              sizes="176px"
              priority={mainImagePriority}
            />
          </button>
        ) : null}

        {showThumbnails ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {images.map((imageSrc, index) => {
              const isSelected = index === selectedIndex;
              return (
                <button
                  key={`${title}-gallery-${imageSrc}-${index + 1}`}
                  type="button"
                  onClick={() => {
                    setSelectedIndex(index);
                    setZoomedIndex(index);
                  }}
                  className={`relative aspect-square overflow-hidden rounded-md border bg-neutral-100 transition ${
                    isSelected ? "border-sky-400 ring-1 ring-sky-300" : "border-neutral-200"
                  }`}
                >
                  <Image
                    src={imageSrc}
                    alt={`Zdjecie ${index + 1}: ${title}`}
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

      {zoomedImage ? (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-neutral-950/85 p-4">
          <button
            type="button"
            aria-label="Zamknij podglad zdjecia"
            className="absolute inset-0"
            onClick={() => {
              setZoomedIndex(null);
            }}
          />

          <div className="relative z-10 flex w-full max-w-5xl flex-col gap-3">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setZoomedIndex(null);
                }}
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100"
              >
                Zamknij
              </button>
            </div>

            <div className="relative h-[70vh] w-full overflow-hidden rounded-md border border-neutral-700 bg-neutral-900">
              <Image
                src={zoomedImage}
                alt={`Podglad zdjecia: ${title}`}
                fill
                unoptimized
                className="object-contain p-2"
                sizes="100vw"
                priority
              />
            </div>

            {images.length > 1 ? (
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100"
                  onClick={() => {
                    setZoomedIndex((current) => {
                      if (current === null) {
                        return current;
                      }
                      return (current - 1 + images.length) % images.length;
                    });
                  }}
                >
                  Poprzednie
                </button>
                <p className="text-sm text-neutral-100">
                  {(zoomedIndex ?? 0) + 1} / {images.length}
                </p>
                <button
                  type="button"
                  className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100"
                  onClick={() => {
                    setZoomedIndex((current) => {
                      if (current === null) {
                        return current;
                      }
                      return (current + 1) % images.length;
                    });
                  }}
                >
                  Nastepne
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
