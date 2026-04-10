"use client";

import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { drawImageToCanvas, type CropFitMode } from "./helpers";
import type { ImageCropState } from "./types";

type ImageCropModalProps = {
  title: string;
  previewAlt: string;
  previewClassName: string;
  previewFrameClassName?: string;
  fitMode?: CropFitMode;
  labels: {
    hint: string;
    zoom: string;
    offsetX: string;
    offsetY: string;
    apply: string;
    cancel: string;
  };
  state: ImageCropState;
  setState: Dispatch<SetStateAction<ImageCropState | null>>;
  onApply: () => Promise<void>;
  onCancel: () => void;
};

export function ImageCropModal({
  title,
  previewAlt,
  previewClassName,
  previewFrameClassName,
  fitMode = "cover",
  labels,
  state,
  setState,
  onApply,
  onCancel,
}: ImageCropModalProps) {
  const previewFrameRef = useRef<HTMLDivElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewImageRef = useRef<HTMLImageElement | null>(null);
  const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 });
  const [loadedImageVersion, setLoadedImageVersion] = useState(0);

  useEffect(() => {
    const image = new Image();
    let isCanceled = false;
    image.src = state.sourceUrl;
    image.onload = () => {
      if (isCanceled) {
        return;
      }
      previewImageRef.current = image;
      setLoadedImageVersion((current) => current + 1);
    };
    image.onerror = () => {
      if (isCanceled) {
        return;
      }
      previewImageRef.current = null;
      setLoadedImageVersion((current) => current + 1);
    };

    return () => {
      isCanceled = true;
      previewImageRef.current = null;
    };
  }, [state.sourceUrl]);

  useEffect(() => {
    const frame = previewFrameRef.current;
    if (!frame) {
      return;
    }

    const measure = () => {
      const rect = frame.getBoundingClientRect();
      const nextWidth = Math.max(0, Math.round(rect.width));
      const nextHeight = Math.max(0, Math.round(rect.height));
      setPreviewSize((current) =>
        current.width === nextWidth && current.height === nextHeight
          ? current
          : { width: nextWidth, height: nextHeight },
      );
    };

    measure();
    const resizeObserver = new ResizeObserver(() => {
      measure();
    });
    resizeObserver.observe(frame);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    const canvas = previewCanvasRef.current;
    const image = previewImageRef.current;
    const outputWidth = previewSize.width;
    const outputHeight = previewSize.height;
    if (!canvas || !image || outputWidth < 1 || outputHeight < 1) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(outputWidth * dpr));
    canvas.height = Math.max(1, Math.round(outputHeight * dpr));

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, outputWidth, outputHeight);

    drawImageToCanvas(
      ctx,
      image,
      state,
      outputWidth,
      outputHeight,
      fitMode,
    );
  }, [fitMode, loadedImageVersion, previewSize.height, previewSize.width, state]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto [&>div:not(.fixed)]:my-auto [&>div:not(.fixed)]:max-h-[calc(100dvh-2rem)] [&>div:not(.fixed)]:!overflow-y-auto bg-black/70 p-4">
      <div className="w-full max-w-xl rounded-xl border border-slate-700 bg-slate-900 p-4">
        <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
        <p className="mt-1 text-xs text-slate-400">{labels.hint}</p>

        <div
          ref={previewFrameRef}
          className={`mt-3 overflow-hidden rounded-md border border-slate-700 bg-slate-950 p-2 ${
            previewFrameClassName ?? ""
          }`}
        >
          <canvas
            ref={previewCanvasRef}
            role="img"
            aria-label={previewAlt}
            className={previewClassName}
          />
        </div>

        <div className="mt-3 grid gap-3">
          <label className="grid gap-1 text-sm text-slate-300">
            {labels.zoom}
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={state.zoom}
              onChange={(event) =>
                setState((prev) =>
                  prev ? { ...prev, zoom: Number(event.target.value) } : prev,
                )
              }
            />
          </label>

          <label className="grid gap-1 text-sm text-slate-300">
            {labels.offsetX}
            <input
              type="range"
              min={-100}
              max={100}
              step={1}
              value={state.offsetX}
              onChange={(event) =>
                setState((prev) =>
                  prev ? { ...prev, offsetX: Number(event.target.value) } : prev,
                )
              }
            />
          </label>

          <label className="grid gap-1 text-sm text-slate-300">
            {labels.offsetY}
            <input
              type="range"
              min={-100}
              max={100}
              step={1}
              value={state.offsetY}
              onChange={(event) =>
                setState((prev) =>
                  prev ? { ...prev, offsetY: Number(event.target.value) } : prev,
                )
              }
            />
          </label>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            className="cursor-pointer rounded-md bg-sky-500 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-sky-400"
            onClick={() => {
              void onApply();
            }}
          >
            {labels.apply}
          </button>
          <button
            type="button"
            className="cursor-pointer rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-500"
            onClick={onCancel}
          >
            {labels.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}


