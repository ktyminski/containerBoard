"use client";

import Image, { type ImageProps } from "next/image";
import { useState, type SyntheticEvent } from "react";

type ContainerPhotoWithPlaceholderProps = ImageProps & {
  placeholderClassName?: string;
};

function getSourceKey(src: ImageProps["src"]): string {
  if (typeof src === "string") {
    return src;
  }
  if ("src" in src) {
    return src.src;
  }
  return src.default.src;
}

export function ContainerPhotoWithPlaceholder({
  src,
  alt,
  className,
  placeholderClassName,
  onLoad,
  onError,
  ...props
}: ContainerPhotoWithPlaceholderProps) {
  const [loadedSourceKey, setLoadedSourceKey] = useState<string | null>(null);
  const sourceKey = getSourceKey(src);
  const isLoaded = loadedSourceKey === sourceKey;

  const imageClassName = `${className ?? ""} transition-opacity duration-200 ${
    isLoaded ? "opacity-100" : "opacity-0"
  }`.trim();
  const resolvedPlaceholderClassName =
    placeholderClassName ??
    "pointer-events-none absolute inset-0 animate-pulse bg-gradient-to-br from-neutral-100 via-neutral-200 to-neutral-100";

  return (
    <>
      <span
        aria-hidden="true"
        className={`${resolvedPlaceholderClassName} transition-opacity duration-200 ${
          isLoaded ? "opacity-0" : "opacity-100"
        }`}
      />
      <Image
        {...props}
        src={src}
        alt={alt}
        className={imageClassName}
        onLoad={(event: SyntheticEvent<HTMLImageElement, Event>) => {
          setLoadedSourceKey(sourceKey);
          onLoad?.(event);
        }}
        onError={(event: SyntheticEvent<HTMLImageElement, Event>) => {
          setLoadedSourceKey(sourceKey);
          onError?.(event);
        }}
      />
    </>
  );
}
