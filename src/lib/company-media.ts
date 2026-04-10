import { Binary } from "mongodb";
import type { CompanyImageAsset } from "@/lib/companies";

const LOGO_CARD_SIZE = 256;
const LOGO_THUMB_SIZE = 96;
const BACKGROUND_WIDTH = 1600;
const BACKGROUND_HEIGHT = 400;
const PHOTO_MAX_WIDTH = 1600;
const PHOTO_MAX_HEIGHT = 1600;
const WEBP_EFFORT = 4;

type SharpLike = typeof import("sharp");

async function getSharp(): Promise<SharpLike> {
  const sharpModule = await import("sharp");
  return (sharpModule.default ?? sharpModule) as unknown as SharpLike;
}

function sanitizeFilename(filename: string): string {
  return filename.slice(0, 180);
}

async function ensureImageCanBeProcessed(
  processor: import("sharp").Sharp,
  field: string,
): Promise<void> {
  const metadata = await processor.metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error(`${field} could not be processed`);
  }
}

async function toWebpAsset(
  processor: import("sharp").Sharp,
  filename: string,
  quality: number,
): Promise<CompanyImageAsset> {
  const { data, info } = await processor
    .webp({
      quality,
      alphaQuality: 90,
      effort: WEBP_EFFORT,
    })
    .toBuffer({ resolveWithObject: true });

  return {
    filename: sanitizeFilename(filename.replace(/\.[^.]+$/, "") || filename),
    contentType: "image/webp",
    size: data.byteLength,
    width: info.width,
    height: info.height,
    data: new Binary(data),
  };
}

async function createSharpProcessor(file: File, field: string): Promise<import("sharp").Sharp> {
  const sharp = await getSharp();
  const input = Buffer.from(await file.arrayBuffer());
  const processor = sharp(input, { failOn: "none" }).rotate();
  await ensureImageCanBeProcessed(processor, field);
  return processor;
}

export async function processLogoUpload(file: File): Promise<{
  logo: CompanyImageAsset;
  logoThumb: CompanyImageAsset;
}> {
  const processor = await createSharpProcessor(file, "logo");
  const [logo, logoThumb] = await Promise.all([
    toWebpAsset(
      processor.clone().resize({
        width: LOGO_CARD_SIZE,
        height: LOGO_CARD_SIZE,
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      }),
      file.name,
      82,
    ),
    toWebpAsset(
      processor.clone().resize({
        width: LOGO_THUMB_SIZE,
        height: LOGO_THUMB_SIZE,
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      }),
      file.name,
      80,
    ),
  ]);

  return { logo, logoThumb };
}

export async function processBackgroundUpload(file: File): Promise<CompanyImageAsset> {
  const processor = await createSharpProcessor(file, "background");
  return toWebpAsset(
    processor.resize({
      width: BACKGROUND_WIDTH,
      height: BACKGROUND_HEIGHT,
      fit: "cover",
      position: "attention",
    }),
    file.name,
    80,
  );
}

export async function processGalleryUpload(
  file: File,
  field = "photo",
): Promise<CompanyImageAsset> {
  const processor = await createSharpProcessor(file, field);
  return toWebpAsset(
    processor.resize({
      width: PHOTO_MAX_WIDTH,
      height: PHOTO_MAX_HEIGHT,
      fit: "inside",
      withoutEnlargement: true,
    }),
    file.name,
    78,
  );
}

export function getMediaCacheControl(hasVersionParam: boolean): string {
  return hasVersionParam
    ? "public, max-age=31536000, immutable"
    : "public, max-age=3600, stale-while-revalidate=86400";
}
