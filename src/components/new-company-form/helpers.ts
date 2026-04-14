import type { BranchFormValue, ImageCropState, ImageItem } from "./types";

export const MAX_BRANCH_PHOTOS = 3;
export const PHONE_REGEX = /^[+()0-9\s-]{6,30}$/;
export type CropFitMode = "cover" | "contain";

export function createEmptyBranch(initialLabel = ""): BranchFormValue {
  return {
    label: initialLabel,
    addressText: "",
    addressParts: null,
    lat: "",
    lng: "",
    useCustomDetails: false,
    phone: "",
    email: "",
  };
}

export function createImageItems(files: File[]): ImageItem[] {
  return files.map((file) => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    file,
    previewUrl: URL.createObjectURL(file),
  }));
}

export function revokeImageItems(items: ImageItem[]): void {
  for (const item of items) {
    URL.revokeObjectURL(item.previewUrl);
  }
}

export function removeImageItem(items: ImageItem[], id: string): ImageItem[] {
  const target = items.find((item) => item.id === id);
  if (target) {
    URL.revokeObjectURL(target.previewUrl);
  }
  return items.filter((item) => item.id !== id);
}

export function hasValidCoordinate(value: string): boolean {
  if (value.trim().length === 0) {
    return false;
  }
  return Number.isFinite(Number(value));
}

export function isValidWebsite(value: string): boolean {
  if (!value.trim()) {
    return true;
  }

  try {
    const normalized = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    new URL(normalized);
    return true;
  } catch {
    return false;
  }
}

export function isValidNip(value: string): boolean {
  if (!value.trim()) {
    return true;
  }
  const digits = value.replace(/\D/g, "");
  if (!/^\d{10}$/.test(digits)) {
    return false;
  }
  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  const checksumBase = weights.reduce((sum, weight, index) => {
    return sum + Number(digits[index]) * weight;
  }, 0);
  const checksum = checksumBase % 11;
  if (checksum === 10) {
    return false;
  }
  return checksum === Number(digits[9]);
}

export function getFieldMessage(value: unknown): string | null {
  if (!value) {
    return null;
  }
  return typeof value === "string" ? value : null;
}

export function computeCropRegion(
  imageWidth: number,
  imageHeight: number,
  state: Pick<ImageCropState, "zoom" | "offsetX" | "offsetY">,
  outputWidth: number,
  outputHeight: number,
): { sx: number; sy: number; cropWidth: number; cropHeight: number } {
  const targetAspectRatio = outputWidth / outputHeight;
  const imageAspectRatio = imageWidth / imageHeight;
  const baseCropWidth =
    imageAspectRatio >= targetAspectRatio
      ? imageHeight * targetAspectRatio
      : imageWidth;
  const baseCropHeight =
    imageAspectRatio >= targetAspectRatio
      ? imageHeight
      : imageWidth / targetAspectRatio;

  const cropWidth = baseCropWidth / state.zoom;
  const cropHeight = baseCropHeight / state.zoom;
  const maxShiftX = Math.max(0, (imageWidth - cropWidth) / 2);
  const maxShiftY = Math.max(0, (imageHeight - cropHeight) / 2);

  const sx = Math.min(
    imageWidth - cropWidth,
    Math.max(0, (imageWidth - cropWidth) / 2 + (state.offsetX / 100) * maxShiftX),
  );
  const sy = Math.min(
    imageHeight - cropHeight,
    Math.max(0, (imageHeight - cropHeight) / 2 + (state.offsetY / 100) * maxShiftY),
  );

  return { sx, sy, cropWidth, cropHeight };
}

function computeContainDrawRegion(
  imageWidth: number,
  imageHeight: number,
  state: Pick<ImageCropState, "zoom" | "offsetX" | "offsetY">,
  outputWidth: number,
  outputHeight: number,
): { dx: number; dy: number; drawWidth: number; drawHeight: number } {
  const targetAspectRatio = outputWidth / outputHeight;
  const imageAspectRatio = imageWidth / imageHeight;

  const baseDrawWidth =
    imageAspectRatio >= targetAspectRatio
      ? outputWidth
      : outputHeight * imageAspectRatio;
  const baseDrawHeight =
    imageAspectRatio >= targetAspectRatio
      ? outputWidth / imageAspectRatio
      : outputHeight;

  const drawWidth = baseDrawWidth * state.zoom;
  const drawHeight = baseDrawHeight * state.zoom;
  const computeOffset = (drawSize: number, outputSize: number, offsetPercent: number): number => {
    const centered = (outputSize - drawSize) / 2;
    if (drawSize <= outputSize) {
      const maxShift = (outputSize - drawSize) / 2;
      const proposed = centered + (offsetPercent / 100) * maxShift;
      return Math.min(outputSize - drawSize, Math.max(0, proposed));
    }

    const maxShift = (drawSize - outputSize) / 2;
    const proposed = centered + (offsetPercent / 100) * maxShift;
    return Math.min(0, Math.max(outputSize - drawSize, proposed));
  };

  const dx = computeOffset(drawWidth, outputWidth, state.offsetX);
  const dy = computeOffset(drawHeight, outputHeight, state.offsetY);

  return { dx, dy, drawWidth, drawHeight };
}

export function drawImageToCanvas(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource & { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number },
  state: Pick<ImageCropState, "zoom" | "offsetX" | "offsetY">,
  outputWidth: number,
  outputHeight: number,
  fitMode: CropFitMode = "cover",
): void {
  const imageWidth = image.naturalWidth ?? image.width;
  const imageHeight = image.naturalHeight ?? image.height;
  if (!imageWidth || !imageHeight) {
    return;
  }

  if (fitMode === "contain") {
    const { dx, dy, drawWidth, drawHeight } = computeContainDrawRegion(
      imageWidth,
      imageHeight,
      state,
      outputWidth,
      outputHeight,
    );
    ctx.drawImage(image, dx, dy, drawWidth, drawHeight);
    return;
  }

  const { sx, sy, cropWidth, cropHeight } = computeCropRegion(
    imageWidth,
    imageHeight,
    state,
    outputWidth,
    outputHeight,
  );

  ctx.drawImage(
    image,
    sx,
    sy,
    cropWidth,
    cropHeight,
    0,
    0,
    outputWidth,
    outputHeight,
  );
}

export async function cropImageFile(
  state: ImageCropState,
  outputName: string,
  output:
    | number
    | {
        outputWidth: number;
        outputHeight: number;
        fitMode?: CropFitMode;
      } = 512,
): Promise<File> {
  const image = new Image();
  image.src = state.sourceUrl;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Failed to load image for crop"));
  });

  const canvas = document.createElement("canvas");
  const outputWidth = typeof output === "number" ? output : output.outputWidth;
  const outputHeight = typeof output === "number" ? output : output.outputHeight;
  const fitMode = typeof output === "number" ? "cover" : (output.fitMode ?? "cover");

  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas context unavailable");
  }
  ctx.clearRect(0, 0, outputWidth, outputHeight);
  drawImageToCanvas(ctx, image, state, outputWidth, outputHeight, fitMode);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (!result) {
        reject(new Error("Failed to create cropped image"));
        return;
      }
      resolve(result);
    }, "image/png");
  });

  return new File([blob], outputName, { type: "image/png" });
}
