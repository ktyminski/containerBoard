"use client";

import type { ImageItem } from "./types";

type ImageGridProps = {
  items: ImageItem[];
  onRemove: (id: string) => void;
  removeLabel: string;
  previewAlt: string;
};

export function ImageGrid(props: ImageGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {props.items.map((item) => (
        <div
          key={item.id}
          className="group relative rounded-md border border-neutral-300 bg-white p-1"
        >
          <button
            type="button"
            className="flex h-28 w-full cursor-pointer items-center justify-center overflow-hidden rounded-sm"
            onClick={() => props.onRemove(item.id)}
            title={props.removeLabel}
          >
            <img
              src={item.previewUrl}
              alt={props.previewAlt}
              className="max-h-24 w-auto max-w-full object-contain transition-transform duration-300 ease-out group-hover:scale-105"
            />
          </button>
          <button
            type="button"
            className="absolute right-1 top-1 cursor-pointer rounded-full bg-black/70 px-2 py-0.5 text-xs text-white opacity-90"
            onClick={() => props.onRemove(item.id)}
            title={props.removeLabel}
            aria-label={props.removeLabel}
          >
            x
          </button>
        </div>
      ))}
    </div>
  );
}

