import type { GeocodeAddressParts } from "@/lib/geocode-address";
import {
  MAX_CONTAINER_RAL_COLORS,
  parseContainerRalColors,
} from "@/lib/container-ral-colors";
import { getRichTextLength, hasRichTextContent } from "@/lib/listing-rich-text";
import { MAX_LISTING_LOCATIONS } from "@/lib/listing-locations";
import {
  CONTAINER_SIZE,
  CONTAINER_CONDITIONS,
  CONTAINER_FEATURES,
  CONTAINER_HEIGHTS,
  CONTAINER_SIZES,
  CONTAINER_TYPES,
  LISTING_TYPES,
  PRICE_CURRENCIES,
  PRICE_TAX_MODES,
  type ContainerCondition,
  type ContainerFeature,
  type ContainerHeight,
  type ContainerSize,
  type ContainerType,
  type Currency,
  type ListingType,
  type TaxMode,
} from "@/lib/container-listing-types";

export type ContainerListingFormValues = {
  type: ListingType;
  containerSize: ContainerSize;
  containerHeight: ContainerHeight;
  containerType: ContainerType;
  containerFeatures: ContainerFeature[];
  containerCondition: ContainerCondition;
  containerColorsRal: string;
  hasCscPlate: boolean;
  hasCscCertification: boolean;
  hasBranding: boolean;
  hasWarranty: boolean;
  cscValidToMonth: string;
  cscValidToYear: string;
  productionYear: string;
  quantity: number;
  locationLat: string;
  locationLng: string;
  locationAddressLabel: string;
  locationStreet: string;
  locationHouseNumber: string;
  locationPostalCode: string;
  locationAddressCity: string;
  locationAddressCountry: string;
  availableNow: boolean;
  availableFromApproximate: boolean;
  availableFrom: string;
  logisticsTransportAvailable: boolean;
  logisticsTransportIncluded: boolean;
  logisticsTransportFreeDistanceKm: string;
  logisticsUnloadingAvailable: boolean;
  logisticsUnloadingIncluded: boolean;
  logisticsComment: string;
  priceValueAmount: string;
  priceCurrency: Currency;
  priceTaxMode: TaxMode;
  priceVatRate: string;
  priceNegotiable: boolean;
  description: string;
  companyName: string;
  publishedAsCompany: boolean;
  contactEmail: string;
  contactPhone: string;
};

export const CREATE_FLOW_PRECHECK_FIELDS: Array<
  keyof ContainerListingFormValues
> = [
  "type",
  "containerSize",
  "containerHeight",
  "containerType",
  "containerFeatures",
  "containerCondition",
  "containerColorsRal",
  "hasCscPlate",
  "hasCscCertification",
  "hasBranding",
  "hasWarranty",
  "cscValidToMonth",
  "cscValidToYear",
  "productionYear",
  "quantity",
  "locationLat",
  "locationLng",
  "locationAddressLabel",
  "locationStreet",
  "locationHouseNumber",
  "locationPostalCode",
  "locationAddressCity",
  "locationAddressCountry",
  "availableNow",
  "availableFromApproximate",
  "availableFrom",
  "logisticsTransportAvailable",
  "logisticsTransportIncluded",
  "logisticsTransportFreeDistanceKm",
  "logisticsUnloadingAvailable",
  "logisticsUnloadingIncluded",
  "logisticsComment",
  "priceValueAmount",
  "priceCurrency",
  "priceTaxMode",
  "priceVatRate",
  "priceNegotiable",
  "description",
];

export type ListingIntent = ListingType;

export type ImageItem = {
  id: string;
  file: File;
  previewUrl: string;
};

export type AdditionalLocationInitialValue = {
  locationLat?: number | null;
  locationLng?: number | null;
  locationAddressLabel?: string;
  locationAddressParts?: GeocodeAddressParts | null;
};

export type CompanyLocationPrefillOption = {
  id: string;
  name: string;
  locationLat: number;
  locationLng: number;
  locationAddressLabel?: string;
  locationAddressParts?: GeocodeAddressParts | null;
};

export type AdditionalLocationDraft = {
  id: string;
  search: string;
  isSearching: boolean;
  locationLat: number | null;
  locationLng: number | null;
  locationAddressLabel: string;
  locationAddressParts: GeocodeAddressParts | null;
};

export const MAX_CONTAINER_PHOTOS = 4;
export const MAX_CONTAINER_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_CONTAINER_PHOTO_MB = 5;
export const MAX_ADDITIONAL_LOCATIONS = MAX_LISTING_LOCATIONS - 1;
export const PRIMARY_LOCATION_MAP_ID = "primary-location";

const MAX_CLIENT_IMAGE_DIMENSION = 2200;
const IMAGE_OPTIMIZATION_QUALITY_STEPS = [0.9, 0.84, 0.78] as const;

export function mapListingIntentToType(intent: ListingIntent): ListingType {
  return intent;
}

export function getListingIntentFromType(type: ListingType): ListingIntent {
  if (type === "sell" || type === "rent" || type === "buy") {
    return type;
  }
  return "sell";
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

export function getContainerLogoPlaceholderSrc(size?: number): string {
  if (size === 20) {
    return "/placeholders/containers/container-20.svg";
  }
  if (size === 40) {
    return "/placeholders/containers/container-40.svg";
  }
  return "/placeholders/containers/container-unknown.svg";
}

function replaceFileExtension(filename: string, nextExtension: string): string {
  const trimmed = filename.trim();
  if (!trimmed) {
    return `image.${nextExtension}`;
  }
  const nextBase = trimmed.replace(/\.[^.]+$/, "");
  return `${nextBase || "image"}.${nextExtension}`;
}

async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = objectUrl;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Failed to load image"));
    });
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (!result) {
          reject(new Error("Failed to save image"));
          return;
        }
        resolve(result);
      },
      type,
      quality,
    );
  });
}

export async function optimizeListingImageForUpload(
  file: File,
  maxBytes: number,
): Promise<File> {
  if (!file.type.startsWith("image/")) {
    return file;
  }

  try {
    const image = await loadImageFromFile(file);
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    if (!sourceWidth || !sourceHeight) {
      return file;
    }

    const scale = Math.min(
      1,
      MAX_CLIENT_IMAGE_DIMENSION / Math.max(sourceWidth, sourceHeight),
    );
    const outputWidth = Math.max(1, Math.round(sourceWidth * scale));
    const outputHeight = Math.max(1, Math.round(sourceHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return file;
    }

    ctx.clearRect(0, 0, outputWidth, outputHeight);
    ctx.drawImage(image, 0, 0, outputWidth, outputHeight);

    let smallestBlob: Blob | null = null;
    for (const quality of IMAGE_OPTIMIZATION_QUALITY_STEPS) {
      const nextBlob = await canvasToBlob(canvas, "image/webp", quality);
      if (!smallestBlob || nextBlob.size < smallestBlob.size) {
        smallestBlob = nextBlob;
      }
      if (nextBlob.size <= maxBytes) {
        smallestBlob = nextBlob;
        break;
      }
    }

    if (!smallestBlob) {
      return file;
    }

    if (file.size <= maxBytes && smallestBlob.size >= file.size * 0.95) {
      return file;
    }
    if (smallestBlob.size >= file.size && file.size <= maxBytes) {
      return file;
    }

    return new File([smallestBlob], replaceFileExtension(file.name, "webp"), {
      type: "image/webp",
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}

export function validateContainerRalColorsInput(input: string): true | string {
  const parsed = parseContainerRalColors(input);
  if (parsed.tooMany) {
    return `Maximum ${MAX_CONTAINER_RAL_COLORS} RAL colors`;
  }
  return true;
}

export function getRalCodeDigitsLabel(ralCode: string): string {
  return ralCode.replace(/^RAL\s*/i, "").trim();
}

export function getRalPreviewLabelStyle(rgb: {
  r: number;
  g: number;
  b: number;
}): {
  color: string;
  textShadow: string;
} {
  const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  if (luminance >= 0.62) {
    return {
      color: "#111827",
      textShadow: "0 1px 1px rgba(255,255,255,0.35)",
    };
  }
  return {
    color: "#F9FAFB",
    textShadow: "0 1px 1px rgba(0,0,0,0.45)",
  };
}

export function toCoordinateText(value: number | undefined): string {
  return Number.isFinite(value) ? Number(value).toFixed(6) : "";
}

export function parseCoordinate(value: string): number | null {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeOptionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function buildLocationLabelFromAddressParts(
  parts?: GeocodeAddressParts | null,
): string {
  if (!parts) {
    return "";
  }

  const city = parts.city?.trim() ?? "";
  const country = parts.country?.trim() ?? "";
  const street = parts.street?.trim() ?? "";
  const houseNumber = parts.houseNumber?.trim() ?? "";
  const postalCode = parts.postalCode?.trim() ?? "";

  const streetLabel = [street, houseNumber].filter(Boolean).join(" ");
  const localityLabel = [postalCode, city].filter(Boolean).join(" ");

  return [streetLabel, localityLabel, country].filter(Boolean).join(", ");
}

export function buildLocationDisplay(input: {
  parts?: GeocodeAddressParts | null;
  fallbackLabel?: string;
}): { postalCode?: string; rest: string; country?: string } {
  const postalCode = input.parts?.postalCode?.trim() ?? "";
  const street = input.parts?.street?.trim() ?? "";
  const houseNumber = input.parts?.houseNumber?.trim() ?? "";
  const city = input.parts?.city?.trim() ?? "";
  const country = input.parts?.country?.trim() ?? "";

  const streetLabel = [street, houseNumber].filter(Boolean).join(" ");
  const rest = [streetLabel, city, country].filter(Boolean).join(" ").trim();
  const fallback = input.fallbackLabel?.trim() ?? "";

  return {
    postalCode: postalCode || undefined,
    rest: rest || fallback,
    country: country || undefined,
  };
}

export function createAdditionalLocationDraft(
  input?: AdditionalLocationInitialValue,
): AdditionalLocationDraft {
  const locationAddressLabel = input?.locationAddressLabel?.trim() ?? "";
  const parts = input?.locationAddressParts ?? null;
  const fallbackLabel = buildLocationLabelFromAddressParts(parts);
  const search = locationAddressLabel || fallbackLabel;
  const locationLat =
    typeof input?.locationLat === "number" && Number.isFinite(input.locationLat)
      ? input.locationLat
      : null;
  const locationLng =
    typeof input?.locationLng === "number" && Number.isFinite(input.locationLng)
      ? input.locationLng
      : null;

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    search,
    isSearching: false,
    locationLat,
    locationLng,
    locationAddressLabel,
    locationAddressParts: parts,
  };
}

export function normalizeOptionalRichText(value: string): string | undefined {
  const trimmed = value.trim();
  return hasRichTextContent(trimmed) ? trimmed : undefined;
}

export function normalizeOptionalNumber(value: string): number | undefined {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) {
    return undefined;
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return undefined;
  }
  return parsed;
}

export function normalizeOptionalInteger(value: string): number | undefined {
  const parsed = normalizeOptionalNumber(value);
  if (typeof parsed !== "number") {
    return undefined;
  }
  if (!Number.isInteger(parsed)) {
    return undefined;
  }
  return parsed;
}

export function normalizeContainerFeatures(
  values: ContainerFeature[],
): ContainerFeature[] {
  const selected = new Set(
    values.filter((feature) =>
      CONTAINER_FEATURES.includes(feature as ContainerFeature),
    ),
  );
  return CONTAINER_FEATURES.filter((feature) => selected.has(feature));
}

export function hasInitialTransportSectionContent(
  initialValues?: Partial<ContainerListingFormValues>,
): boolean {
  return (
    initialValues?.logisticsTransportAvailable === true ||
    initialValues?.logisticsTransportIncluded === true ||
    initialValues?.logisticsUnloadingAvailable === true ||
    initialValues?.logisticsUnloadingIncluded === true ||
    (initialValues?.logisticsComment?.trim().length ?? 0) > 0 ||
    (initialValues?.logisticsTransportFreeDistanceKm?.trim().length ?? 0) > 0
  );
}

export function hasInitialDescriptionSectionContent(
  initialValues?: Partial<ContainerListingFormValues>,
): boolean {
  return (
    (initialValues?.description?.trim().length ?? 0) > 0 ||
    (initialValues?.containerColorsRal?.trim().length ?? 0) > 0 ||
    initialValues?.hasBranding === true
  );
}

export function hasInitialCertificationSectionContent(
  initialValues?: Partial<ContainerListingFormValues>,
): boolean {
  return (
    initialValues?.hasCscPlate === true ||
    initialValues?.hasCscCertification === true ||
    initialValues?.hasWarranty === true ||
    (initialValues?.cscValidToMonth?.trim().length ?? 0) > 0 ||
    (initialValues?.cscValidToYear?.trim().length ?? 0) > 0
  );
}

export function isCreateFormReadyToPublish(
  values: ContainerListingFormValues,
): boolean {
  if (!LISTING_TYPES.includes(values.type)) {
    return false;
  }

  if (
    !(
      values.containerSize === CONTAINER_SIZE.CUSTOM ||
      isStandardContainerSize(Number(values.containerSize))
    )
  ) {
    return false;
  }

  if (!CONTAINER_HEIGHTS.includes(values.containerHeight)) {
    return false;
  }
  if (!CONTAINER_TYPES.includes(values.containerType)) {
    return false;
  }
  if (!CONTAINER_CONDITIONS.includes(values.containerCondition)) {
    return false;
  }

  if (
    !Number.isFinite(values.quantity) ||
    !Number.isInteger(values.quantity) ||
    values.quantity < 1
  ) {
    return false;
  }

  if (
    !values.availableNow &&
    (values.availableFrom ?? "").trim().length === 0
  ) {
    return false;
  }

  if (parseCoordinate(values.locationLat) === null) {
    return false;
  }
  if (parseCoordinate(values.locationLng) === null) {
    return false;
  }

  if ((values.priceValueAmount ?? "").trim().length > 0) {
    const parsedPriceAmount = normalizeOptionalInteger(values.priceValueAmount);
    if (typeof parsedPriceAmount !== "number") {
      return false;
    }
  }

  if (!PRICE_CURRENCIES.includes(values.priceCurrency)) {
    return false;
  }
  if (!PRICE_TAX_MODES.includes(values.priceTaxMode)) {
    return false;
  }

  const logisticsDistance = normalizeOptionalInteger(
    values.logisticsTransportFreeDistanceKm,
  );
  if (
    values.logisticsTransportIncluded &&
    !(
      typeof logisticsDistance === "number" &&
      logisticsDistance > 0 &&
      logisticsDistance <= 10_000
    )
  ) {
    return false;
  }

  if ((values.logisticsComment ?? "").length > 600) {
    return false;
  }

  if (getRichTextLength(values.description ?? "") > 1000) {
    return false;
  }

  if (
    validateContainerRalColorsInput(values.containerColorsRal ?? "") !== true
  ) {
    return false;
  }

  const monthDigits = (values.cscValidToMonth ?? "").replace(/\D+/g, "");
  if (monthDigits.length > 2) {
    return false;
  }
  const yearDigits = (values.cscValidToYear ?? "").replace(/\D+/g, "");
  if (yearDigits.length > 4) {
    return false;
  }
  const cscMonth = normalizeOptionalInteger(values.cscValidToMonth ?? "");
  const cscYear = normalizeOptionalInteger(values.cscValidToYear ?? "");
  if (!(cscMonth === undefined && cscYear === undefined)) {
    if (!(typeof cscMonth === "number" && cscMonth >= 1 && cscMonth <= 12)) {
      return false;
    }
    if (!(typeof cscYear === "number" && cscYear >= 1900 && cscYear <= 2100)) {
      return false;
    }
  }

  return true;
}

export function isStandardContainerSize(value: number): boolean {
  return CONTAINER_SIZES.includes(value as (typeof CONTAINER_SIZES)[number]);
}

export function getDefaultValues(
  initialValues?: Partial<ContainerListingFormValues>,
): ContainerListingFormValues {
  const today = new Date().toISOString().slice(0, 10);
  const initialContainerSize =
    typeof initialValues?.containerSize === "number" &&
    Number.isFinite(initialValues.containerSize) &&
    initialValues.containerSize >= 0
      ? Math.trunc(initialValues.containerSize)
      : 40;
  const hasCustomContainerSize = !isStandardContainerSize(initialContainerSize);
  const defaultContainerSize: ContainerSize = hasCustomContainerSize
    ? CONTAINER_SIZE.CUSTOM
    : (initialContainerSize as (typeof CONTAINER_SIZES)[number]);

  return {
    type: initialValues?.type ?? "sell",
    containerSize: defaultContainerSize,
    containerHeight: initialValues?.containerHeight ?? "standard",
    containerType: initialValues?.containerType ?? "dry",
    containerFeatures: initialValues?.containerFeatures ?? [],
    containerCondition: initialValues?.containerCondition ?? "cargo_worthy",
    containerColorsRal: initialValues?.containerColorsRal ?? "",
    hasCscPlate: initialValues?.hasCscPlate ?? false,
    hasCscCertification: initialValues?.hasCscCertification ?? false,
    hasBranding: initialValues?.hasBranding ?? false,
    hasWarranty: initialValues?.hasWarranty ?? false,
    cscValidToMonth: initialValues?.cscValidToMonth ?? "",
    cscValidToYear: initialValues?.cscValidToYear ?? "",
    productionYear: initialValues?.productionYear ?? "",
    quantity: initialValues?.quantity ?? 1,
    locationLat: initialValues?.locationLat ?? "",
    locationLng: initialValues?.locationLng ?? "",
    locationAddressLabel: initialValues?.locationAddressLabel ?? "",
    locationStreet: initialValues?.locationStreet ?? "",
    locationHouseNumber: initialValues?.locationHouseNumber ?? "",
    locationPostalCode: initialValues?.locationPostalCode ?? "",
    locationAddressCity: initialValues?.locationAddressCity ?? "",
    locationAddressCountry: initialValues?.locationAddressCountry ?? "",
    availableNow: initialValues?.availableNow ?? false,
    availableFromApproximate: initialValues?.availableFromApproximate ?? false,
    availableFrom: initialValues?.availableFrom ?? today,
    logisticsTransportAvailable:
      initialValues?.logisticsTransportAvailable ?? false,
    logisticsTransportIncluded:
      initialValues?.logisticsTransportIncluded ?? false,
    logisticsTransportFreeDistanceKm:
      initialValues?.logisticsTransportFreeDistanceKm ?? "",
    logisticsUnloadingAvailable:
      initialValues?.logisticsUnloadingAvailable ?? false,
    logisticsUnloadingIncluded:
      initialValues?.logisticsUnloadingIncluded ?? false,
    logisticsComment: initialValues?.logisticsComment ?? "",
    priceValueAmount: initialValues?.priceValueAmount ?? "",
    priceCurrency: initialValues?.priceCurrency ?? "PLN",
    priceTaxMode: initialValues?.priceTaxMode ?? "net",
    priceVatRate: initialValues?.priceVatRate ?? "",
    priceNegotiable: initialValues?.priceNegotiable ?? false,
    description: initialValues?.description ?? "",
    companyName: initialValues?.companyName ?? "",
    publishedAsCompany: initialValues?.publishedAsCompany ?? false,
    contactEmail: initialValues?.contactEmail ?? "",
    contactPhone: initialValues?.contactPhone ?? "",
  };
}
