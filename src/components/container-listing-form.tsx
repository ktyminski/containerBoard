"use client";

import NextImage from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Controller, useForm } from "react-hook-form";
import {
  ContactPublishModal,
  PublishSuccessModal,
} from "@/components/container-listing-form-dialogs";
import {
  type ContainerModuleMessages,
} from "@/components/container-modules-i18n";
import {
  getContainerConditionOptions,
  getContainerFeatureLabel,
  getContainerFeatureOptions,
  getContainerHeightOptions,
  getContainerTypeOptions,
  getListingKindLabel,
  type ContainerListingsMessages,
} from "@/components/container-listings-i18n";
import { MapLocationPicker } from "@/components/map-location-picker";
import { ImageCropModal } from "@/components/new-company-form/image-crop-modal";
import { cropImageFile } from "@/components/new-company-form/helpers";
import { ImageDropzone } from "@/components/new-company-form/image-dropzone";
import { ImageGrid } from "@/components/new-company-form/image-grid";
import type { ImageCropState } from "@/components/new-company-form/types";
import { SimpleRichTextEditor } from "@/components/simple-rich-text-editor";
import { useToast } from "@/components/toast-provider";
import { SelectWithChevron } from "@/components/ui/select-with-chevron";
import type { GeocodeAddressParts } from "@/lib/geocode-address";
import {
  MAX_CONTAINER_RAL_COLORS,
  parseContainerRalColors,
} from "@/lib/container-ral-colors";
import { getCountryFlagEmoji, getCountryFlagSvgUrl } from "@/lib/country-flags";
import { formatTemplate, getMessages, type AppLocale } from "@/lib/i18n";
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

type ContainerListingFormValues = {
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

const CREATE_FLOW_PRECHECK_FIELDS: Array<keyof ContainerListingFormValues> = [
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

type ImageItem = {
  id: string;
  file: File;
  previewUrl: string;
};

type ContainerListingFormProps = {
  mode?: "create" | "edit";
  reactivateOnSave?: boolean;
  submitEndpoint: string;
  submitMethod: "POST" | "PATCH";
  submitLabel: string;
  successMessage: string;
  backHref: string;
  backLabel: string;
  locale: AppLocale;
  messages: ContainerModuleMessages;
  listingMessages?: ContainerListingsMessages;
  initialValues?: Partial<ContainerListingFormValues>;
  initialAdditionalLocations?: AdditionalLocationInitialValue[];
  initialPhotoUrls?: string[];
  initialListingIntent?: ListingIntent;
  selectedListingIntent?: ListingIntent | null;
  onSelectedListingIntentChange?: (nextValue: ListingIntent | null) => void;
  showListingIntentSelector?: boolean;
  companyLocationPrefillOptions?: CompanyLocationPrefillOption[];
  ownedCompanyProfile?: {
    name: string;
    slug?: string;
  } | null;
};

type AdditionalLocationInitialValue = {
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

type AdditionalLocationDraft = {
  id: string;
  search: string;
  isSearching: boolean;
  locationLat: number | null;
  locationLng: number | null;
  locationAddressLabel: string;
  locationAddressParts: GeocodeAddressParts | null;
};

type GeocodeSearchResponse = {
  item?: {
    lat: number;
    lng: number;
    label: string;
    shortLabel?: string;
    addressParts?: GeocodeAddressParts | null;
  } | null;
  error?: string;
};

type ReverseGeocodeResponse = {
  item?: {
    label: string;
    shortLabel?: string;
    addressParts?: GeocodeAddressParts | null;
  } | null;
  error?: string;
};

const LISTING_INTENT_BUTTON_THEME: Record<
  ListingIntent,
  { inactive: string; active: string }
> = {
  sell: {
    inactive:
      "border-[#365f8f] bg-[#102745] text-[#d9e8ff] hover:border-[#4b79ad] hover:bg-[#14345d]",
    active:
      "border-[#5f8fc6] bg-[#173d6d] text-[#eef5ff] shadow-[0_0_0_1px_rgba(95,143,198,0.45)]",
  },
  rent: {
    inactive:
      "border-[#2f7a74] bg-[#103632] text-[#d7fff8] hover:border-[#3f948d] hover:bg-[#144540]",
    active:
      "border-[#53a8a1] bg-[#1a5b55] text-[#ecfffc] shadow-[0_0_0_1px_rgba(83,168,161,0.4)]",
  },
  buy: {
    inactive:
      "border-[#8c6a32] bg-[#3a2a12] text-[#f8e8cb] hover:border-[#aa8242] hover:bg-[#4a3518]",
    active:
      "border-[#c39a57] bg-[#5b421c] text-[#fff3dc] shadow-[0_0_0_1px_rgba(195,154,87,0.42)]",
  },
};
const MAX_CONTAINER_PHOTOS = 4;
const MAX_CONTAINER_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_CONTAINER_PHOTO_MB = 5;
const MAX_ADDITIONAL_LOCATIONS = MAX_LISTING_LOCATIONS - 1;
const PRIMARY_LOCATION_MAP_ID = "primary-location";
const MAX_CLIENT_IMAGE_DIMENSION = 2200;
const IMAGE_OPTIMIZATION_QUALITY_STEPS = [0.9, 0.84, 0.78] as const;

function mapListingIntentToType(intent: ListingIntent): ListingType {
  return intent;
}

function getListingIntentFromType(type: ListingType): ListingIntent {
  if (type === "sell" || type === "rent" || type === "buy") {
    return type;
  }
  return "sell";
}

function createImageItems(files: File[]): ImageItem[] {
  return files.map((file) => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    file,
    previewUrl: URL.createObjectURL(file),
  }));
}

function revokeImageItems(items: ImageItem[]): void {
  for (const item of items) {
    URL.revokeObjectURL(item.previewUrl);
  }
}

function removeImageItem(items: ImageItem[], id: string): ImageItem[] {
  const target = items.find((item) => item.id === id);
  if (target) {
    URL.revokeObjectURL(target.previewUrl);
  }
  return items.filter((item) => item.id !== id);
}

function getContainerLogoPlaceholderSrc(size?: number): string {
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

async function optimizeListingImageForUpload(
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

function validateContainerRalColorsInput(input: string): true | string {
  const parsed = parseContainerRalColors(input);
  if (parsed.tooMany) {
    return `Maximum ${MAX_CONTAINER_RAL_COLORS} RAL colors`;
  }
  return true;
}

function getRalCodeDigitsLabel(ralCode: string): string {
  return ralCode.replace(/^RAL\s*/i, "").trim();
}

function getRalPreviewLabelStyle(rgb: { r: number; g: number; b: number }): {
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

function toCoordinateText(value: number | undefined): string {
  return Number.isFinite(value) ? Number(value).toFixed(6) : "";
}

function parseCoordinate(value: string): number | null {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeOptionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function buildLocationLabelFromAddressParts(
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

function buildLocationDisplay(input: {
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

function LocationFlag({
  country,
  className,
}: {
  country?: string;
  className?: string;
}) {
  const flagUrl = getCountryFlagSvgUrl(country);
  if (flagUrl) {
    return (
      <NextImage
        src={flagUrl}
        alt=""
        aria-hidden="true"
        width={16}
        height={12}
        unoptimized
        className={`inline-block h-3 w-4 rounded-[2px] border border-neutral-400/60 object-cover ${className ?? ""}`}
      />
    );
  }

  const emoji = getCountryFlagEmoji(country);
  if (emoji === "??") {
    return null;
  }

  return (
    <span aria-hidden="true" className={className}>
      {emoji}
    </span>
  );
}

function createAdditionalLocationDraft(
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

function normalizeOptionalRichText(value: string): string | undefined {
  const trimmed = value.trim();
  return hasRichTextContent(trimmed) ? trimmed : undefined;
}

function normalizeOptionalNumber(value: string): number | undefined {
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

function normalizeOptionalInteger(value: string): number | undefined {
  const parsed = normalizeOptionalNumber(value);
  if (typeof parsed !== "number") {
    return undefined;
  }
  if (!Number.isInteger(parsed)) {
    return undefined;
  }
  return parsed;
}

function normalizeContainerFeatures(
  values: ContainerFeature[],
): ContainerFeature[] {
  const selected = new Set(
    values.filter((feature) =>
      CONTAINER_FEATURES.includes(feature as ContainerFeature),
    ),
  );
  return CONTAINER_FEATURES.filter((feature) => selected.has(feature));
}

function hasInitialTransportSectionContent(
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

function hasInitialDescriptionSectionContent(
  initialValues?: Partial<ContainerListingFormValues>,
): boolean {
  return (
    (initialValues?.description?.trim().length ?? 0) > 0 ||
    (initialValues?.containerColorsRal?.trim().length ?? 0) > 0 ||
    initialValues?.hasBranding === true
  );
}

function hasInitialCertificationSectionContent(
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

function isCreateFormReadyToPublish(values: ContainerListingFormValues): boolean {
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

  if (validateContainerRalColorsInput(values.containerColorsRal ?? "") !== true) {
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

type ContainerFeaturesMultiSelectProps = {
  values: ContainerFeature[];
  onChange: (next: ContainerFeature[]) => void;
  onBlur: () => void;
  messages: ContainerModuleMessages["shared"];
  listingMessages: ContainerListingsMessages;
};

type FormSectionProps = {
  id?: string;
  title: string;
  description?: ReactNode;
  optional?: boolean;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
};

function FormSection({
  id,
  title,
  description,
  optional = false,
  className,
  contentClassName,
  children,
}: FormSectionProps) {
  return (
    <section
      id={id}
      className={`rounded-md border border-neutral-300 bg-neutral-50/95 p-3 ${className ?? ""}`}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-neutral-900">{title}</p>
        {optional ? (
          <span className="rounded-md border border-neutral-300 bg-white px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-neutral-600">
            opcjonalnie
          </span>
        ) : null}
      </div>
      {description ? (
        <div className="mb-3 text-xs text-neutral-500">{description}</div>
      ) : null}
      <div className={contentClassName ?? "grid gap-3"}>{children}</div>
    </section>
  );
}

type CompanyLocationPrefillDropdownProps = {
  options: CompanyLocationPrefillOption[];
  onApply: (selectedOptions: CompanyLocationPrefillOption[]) => void;
  onClear: () => void;
  variant?: "light" | "dark";
  messages: ContainerModuleMessages["shared"];
};

function CompanyLocationPrefillDropdown({
  options,
  onApply,
  onClear,
  variant = "dark",
  messages,
}: CompanyLocationPrefillDropdownProps) {
  const detailsRef = useRef<HTMLDetailsElement | null>(null);
  const isLight = variant === "light";
  const [checkedIds, setCheckedIds] = useState<string[]>(() =>
    options.length > 0 ? [options[0].id] : [],
  );
  const resolvedCheckedIds = useMemo(() => {
    const validCheckedIds = checkedIds.filter((id) =>
      options.some((option) => option.id === id),
    );
    if (validCheckedIds.length > 0 || checkedIds.length === 0) {
      return validCheckedIds;
    }
    return options.length > 0 ? [options[0].id] : [];
  }, [checkedIds, options]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const detailsElement = detailsRef.current;
      if (!detailsElement || !detailsElement.open) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (detailsElement.contains(target)) {
        return;
      }

      detailsElement.removeAttribute("open");
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      const detailsElement = detailsRef.current;
      if (!detailsElement?.open) {
        return;
      }
      detailsElement.removeAttribute("open");
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  if (options.length === 0) {
    return null;
  }

  if (options.length === 1) {
    return (
      <button
        type="button"
        onClick={() => {
          onApply([options[0]]);
        }}
        className={
          isLight
            ? "inline-flex h-9 items-center rounded-md border border-neutral-300 bg-white px-3 text-sm font-normal text-neutral-700 transition hover:bg-neutral-100"
            : "inline-flex h-9 items-center rounded-md border border-neutral-600 px-3 text-sm font-normal text-neutral-200 transition hover:border-neutral-500 hover:bg-neutral-800 hover:text-white"
        }
      >
        {messages.setFromCompany}
      </button>
    );
  }

  return (
    <details ref={detailsRef} className="relative">
      <summary
        className={`relative flex h-9 cursor-pointer list-none items-center rounded-md px-3 pr-8 text-sm font-normal transition [&::-webkit-details-marker]:hidden ${
          isLight
            ? "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100"
            : "border border-neutral-600 text-neutral-200 hover:border-neutral-500 hover:bg-neutral-800 hover:text-white"
        }`}
      >
        {messages.setFromCompany}
        <svg
          viewBox="0 0 20 20"
          aria-hidden="true"
          className={`pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 ${
            isLight ? "text-neutral-500" : "text-neutral-400"
          }`}
          fill="none"
        >
          <path
            d="M5 7.5L10 12.5L15 7.5"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </summary>
      <div
        className={`absolute right-0 top-full z-50 mt-1 min-w-[240px] rounded-md shadow-lg ${
          isLight
            ? "border border-neutral-300 bg-white"
            : "border border-neutral-700 bg-neutral-900"
        }`}
      >
        <div className="max-h-64 overflow-y-auto p-1">
          {options.map((option) => {
            const isChecked = resolvedCheckedIds.includes(option.id);
            return (
              <label
                key={option.id}
                className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs ${
                  isLight
                    ? "text-neutral-700 hover:bg-neutral-100"
                    : "text-neutral-200 hover:bg-neutral-800"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(event) => {
                    const isNextChecked = event.target.checked;
                    setCheckedIds((current) => {
                      if (isNextChecked) {
                        if (current.includes(option.id)) {
                          return current;
                        }
                        return [...current, option.id];
                      }
                      return current.filter((id) => id !== option.id);
                    });
                  }}
                  className={`h-4 w-4 rounded ${
                    isLight
                      ? "border-neutral-400 bg-white text-[#2f639a] focus:ring-[#4e86c3]"
                      : "border-neutral-500 bg-neutral-900 text-[#2f639a] focus:ring-[#4e86c3]"
                  }`}
                />
                <span className="min-w-0 truncate">{option.name}</span>
              </label>
            );
          })}
        </div>
        <div
          className={`flex items-center justify-end gap-2 border-t px-2 py-2 ${
            isLight ? "border-neutral-200" : "border-neutral-700"
          }`}
        >
          <button
            type="button"
            onClick={() => {
              setCheckedIds([]);
              onClear();
              detailsRef.current?.removeAttribute("open");
            }}
            className={`rounded-md px-2 py-1 text-[11px] ${
              isLight
                ? "text-neutral-600 hover:bg-neutral-100"
                : "text-neutral-300 hover:bg-neutral-800"
            }`}
          >
            {messages.clear}
          </button>
          <button
            type="button"
            disabled={resolvedCheckedIds.length === 0}
            onClick={() => {
              const selectedOptions = options.filter((option) =>
                resolvedCheckedIds.includes(option.id),
              );
              if (selectedOptions.length === 0) {
                return;
              }
              onApply(selectedOptions);
              detailsRef.current?.removeAttribute("open");
            }}
            className={`rounded-md px-2 py-1 text-[11px] ${
              isLight
                ? "border border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400 hover:bg-neutral-100"
                : "border border-neutral-600 text-neutral-200 hover:border-neutral-500 hover:bg-neutral-800 hover:text-white"
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {messages.apply}
          </button>
        </div>
      </div>
    </details>
  );
}

function ContainerFeaturesMultiSelect({
  values,
  onChange,
  onBlur,
  messages,
  listingMessages,
}: ContainerFeaturesMultiSelectProps) {
  const detailsRef = useRef<HTMLDetailsElement | null>(null);
  const selectedCount = values.length;
  const selectedSummaryLabel =
    selectedCount === 0
      ? messages.any
      : selectedCount === 1
        ? (values[0]
            ? getContainerFeatureLabel(listingMessages, values[0])
            : messages.oneSelected)
        : formatTemplate(messages.selectedCount, { count: selectedCount });

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const detailsElement = detailsRef.current;
      if (!detailsElement || !detailsElement.open) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (detailsElement.contains(target)) {
        return;
      }

      detailsElement.removeAttribute("open");
      onBlur();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      const detailsElement = detailsRef.current;
      if (!detailsElement?.open) {
        return;
      }
      detailsElement.removeAttribute("open");
      onBlur();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onBlur]);

  const toggleFeature = (feature: ContainerFeature) => {
    const isSelected = values.includes(feature);
    const nextValues = isSelected
      ? values.filter((value) => value !== feature)
      : [...values, feature];
    onChange(normalizeContainerFeatures(nextValues));
  };

  return (
    <div className="grid gap-2">
      <details
        ref={detailsRef}
        className="relative"
        onToggle={(event) => {
          if (!event.currentTarget.open) {
            onBlur();
          }
        }}
      >
        <summary className="multi-checkbox-summary relative flex h-10 w-full cursor-pointer list-none items-center rounded-md border border-neutral-700 bg-neutral-950 px-3 pr-11 text-sm text-neutral-100 [&::-webkit-details-marker]:hidden">
          <span
            className={`block min-w-0 truncate ${
              selectedCount > 0
                ? "text-neutral-100"
                : "text-neutral-500"
            }`}
            title={selectedSummaryLabel}
          >
            {selectedSummaryLabel}
          </span>
          <svg
            viewBox="0 0 20 20"
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
            fill="none"
          >
            <path
              d="M5 7.5L10 12.5L15 7.5"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </summary>
        <div className="absolute left-0 top-full z-40 mt-1 w-full rounded-md border border-neutral-700 bg-neutral-900 p-2 shadow-lg">
          <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
            {getContainerFeatureOptions(listingMessages).map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-neutral-200 hover:bg-neutral-800"
              >
                <input
                  type="checkbox"
                  checked={values.includes(option.value)}
                  onChange={() => {
                    toggleFeature(option.value);
                  }}
                  className="h-4 w-4 rounded border-neutral-500 bg-neutral-900 text-[#2f639a] focus:ring-[#4e86c3]"
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              onChange([]);
            }}
            className="mt-2 w-full rounded-md border border-neutral-600 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:border-neutral-500 hover:bg-neutral-800"
          >
            {messages.clear}
          </button>
        </div>
      </details>

      {values.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {values.map((feature) => (
            <span
              key={feature}
              className="inline-flex items-center gap-1 rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs font-medium text-neutral-200"
            >
              <span>{getContainerFeatureLabel(listingMessages, feature)}</span>
              <button
                type="button"
                onClick={() => {
                  toggleFeature(feature);
                }}
                className="rounded px-1 text-neutral-200 hover:bg-neutral-800"
                aria-label={formatTemplate(messages.removeFeature, {
                  label: getContainerFeatureLabel(listingMessages, feature),
                })}
              >
                x
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function isStandardContainerSize(value: number): boolean {
  return CONTAINER_SIZES.includes(value as (typeof CONTAINER_SIZES)[number]);
}

function getDefaultValues(
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

export function ContainerListingForm({
  mode = "create",
  reactivateOnSave = false,
  submitEndpoint,
  submitMethod,
  submitLabel,
  successMessage,
  backHref,
  backLabel,
  locale,
  messages,
  listingMessages,
  initialValues,
  initialAdditionalLocations,
  initialPhotoUrls,
  initialListingIntent,
  selectedListingIntent,
  onSelectedListingIntentChange,
  showListingIntentSelector = true,
  companyLocationPrefillOptions,
  ownedCompanyProfile,
}: ContainerListingFormProps) {
  const router = useRouter();
  const toast = useToast();
  const resolvedListingMessages = listingMessages ?? getMessages(locale).containerListings;
  const companyNameValidation = useMemo(
    () => ({
      required: messages.form.companyNameRequired,
      minLength: {
        value: 2,
        message: messages.form.companyNameMinLength,
      },
    }),
    [messages.form.companyNameMinLength, messages.form.companyNameRequired],
  );
  const contactEmailValidation = useMemo(
    () => ({
      required: messages.form.contactEmailRequired,
    }),
    [messages.form.contactEmailRequired],
  );
  const isCreateMode = mode === "create";
  const [showTransportSection, setShowTransportSection] = useState(
    hasInitialTransportSectionContent(initialValues),
  );
  const [showDescriptionSection, setShowDescriptionSection] = useState(
    hasInitialDescriptionSectionContent(initialValues),
  );
  const [showCertificationSection, setShowCertificationSection] = useState(
    hasInitialCertificationSectionContent(initialValues),
  );
  const [showAdditionalPhotosSection, setShowAdditionalPhotosSection] = useState(
    (initialPhotoUrls?.length ?? 0) > 0,
  );
  const reverseLookupRequestRef = useRef(0);
  const additionalReverseLookupRequestRef = useRef<Record<string, number>>({});
  const inlineSubmitContainerRef = useRef<HTMLDivElement | null>(null);
  const stableInitialPhotoUrls = useMemo(
    () => initialPhotoUrls ?? [],
    [initialPhotoUrls],
  );
  const [locationSearch, setLocationSearch] = useState(
    [
      initialValues?.locationAddressLabel,
      initialValues?.locationPostalCode,
      initialValues?.locationAddressCity,
      initialValues?.locationAddressCountry,
    ]
      .map((value) => value?.trim())
      .filter(Boolean)
      .join(", "),
  );
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [isReverseLookupPending, setIsReverseLookupPending] = useState(false);
  const [additionalLocations, setAdditionalLocations] = useState<
    AdditionalLocationDraft[]
  >(() =>
    (initialAdditionalLocations ?? [])
      .slice(0, MAX_ADDITIONAL_LOCATIONS)
      .map((location) => createAdditionalLocationDraft(location)),
  );
  const [coverPhotoItem, setCoverPhotoItem] = useState<ImageItem | null>(null);
  const [coverPhotoCrop, setCoverPhotoCrop] = useState<ImageCropState | null>(
    null,
  );
  const coverPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const coverPhotoCropSourceUrlRef = useRef<string | null>(null);
  const [isProcessingImages, setIsProcessingImages] = useState(false);
  const [activeMapLocationId, setActiveMapLocationId] = useState<string>(
    PRIMARY_LOCATION_MAP_ID,
  );
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [isPublishSuccessModalOpen, setIsPublishSuccessModalOpen] =
    useState(false);
  const [isInlineSubmitVisible, setIsInlineSubmitVisible] = useState(true);
  const [photoItems, setPhotoItems] = useState<ImageItem[]>([]);
  const [internalListingIntent, setInternalListingIntent] =
    useState<ListingIntent | null>(() => {
      if (initialListingIntent) {
        return initialListingIntent;
      }
      if (initialValues?.type) {
        return getListingIntentFromType(initialValues.type);
      }
      return isCreateMode ? null : "sell";
    });
  const resolvedListingIntent =
    selectedListingIntent !== undefined
      ? selectedListingIntent
      : internalListingIntent;
  const handleListingIntentChange = useCallback(
    (nextValue: ListingIntent | null) => {
      if (selectedListingIntent === undefined) {
        setInternalListingIntent(nextValue);
      }
      onSelectedListingIntentChange?.(nextValue);
    },
    [onSelectedListingIntentChange, selectedListingIntent],
  );
  const [keptInitialPhotoIndexes, setKeptInitialPhotoIndexes] = useState<
    number[]
  >(() => stableInitialPhotoUrls.map((_, index) => index));
  const photoItemsRef = useRef<ImageItem[]>([]);
  const coverPhotoItemRef = useRef<ImageItem | null>(null);

  const {
    control,
    register,
    handleSubmit,
    getValues,
    trigger,
    watch,
    setValue,
    clearErrors,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ContainerListingFormValues>({
    defaultValues: getDefaultValues(initialValues),
  });

  const latValue = watch("locationLat");
  const lngValue = watch("locationLng");
  const listingTypeValue = watch("type");
  const containerSizeValue = watch("containerSize");
  const containerColorsRalValue = watch("containerColorsRal");
  const locationAddressLabelValue = watch("locationAddressLabel");
  const locationStreetValue = watch("locationStreet");
  const locationHouseNumberValue = watch("locationHouseNumber");
  const locationPostalCodeValue = watch("locationPostalCode");
  const locationAddressCityValue = watch("locationAddressCity");
  const locationAddressCountryValue = watch("locationAddressCountry");
  const quantityValue = watch("quantity");
  const availableNowValue = watch("availableNow");
  const logisticsTransportIncludedValue = watch("logisticsTransportIncluded");
  const companyNameValue = watch("companyName");
  const publishedAsCompanyValue = watch("publishedAsCompany");
  const contactEmailValue = watch("contactEmail");
  const createPrecheckValuesWatch = watch(CREATE_FLOW_PRECHECK_FIELDS);
  const todayDateValue = useMemo(
    () => new Date().toISOString().slice(0, 10),
    [],
  );
  const latNumber = parseCoordinate(latValue);
  const lngNumber = parseCoordinate(lngValue);
  const primaryLocationLabel = (locationAddressLabelValue ?? "").trim();
  const parsedRalColorsPreview = useMemo(
    () =>
      parseContainerRalColors(containerColorsRalValue ?? "", {
        ignoreIncompleteTrailingToken: true,
      }),
    [containerColorsRalValue],
  );
  const shouldShowRalColorsPreview =
    parsedRalColorsPreview.colors.length > 0 && !parsedRalColorsPreview.tooMany;
  const isLocationBusy = isSearchingLocation || isReverseLookupPending;
  const resolvedCompanyLocationPrefillOptions = useMemo(
    () =>
      (companyLocationPrefillOptions ?? []).filter(
        (option) =>
          Number.isFinite(option.locationLat) &&
          Number.isFinite(option.locationLng),
      ),
    [companyLocationPrefillOptions],
  );
  const hasCompanyLocationPrefill =
    resolvedCompanyLocationPrefillOptions.length > 0;
  const ownedCompanyName = ownedCompanyProfile?.name?.trim() ?? "";
  const hasOwnedCompanyProfile = ownedCompanyName.length > 0;
  const primaryLocationDisplay = useMemo(
    () =>
      buildLocationDisplay({
        parts: {
          street: locationStreetValue,
          houseNumber: locationHouseNumberValue,
          postalCode: locationPostalCodeValue,
          city: locationAddressCityValue,
          country: locationAddressCountryValue,
        },
        fallbackLabel: primaryLocationLabel,
      }),
    [
      locationAddressCityValue,
      locationAddressCountryValue,
      locationHouseNumberValue,
      locationPostalCodeValue,
      locationStreetValue,
      primaryLocationLabel,
    ],
  );
  const configuredAdditionalLocationsCount = additionalLocations.filter(
    (location) =>
      location.locationLat !== null && location.locationLng !== null,
  ).length;
  const configuredLocationsCount =
    (latNumber !== null && lngNumber !== null ? 1 : 0) +
    configuredAdditionalLocationsCount;
  const configuredLocationDisplays = useMemo(() => {
    const result: Array<{
      key: string;
      postalCode?: string;
      rest: string;
      country?: string;
    }> = [];

    if (latNumber !== null && lngNumber !== null) {
      result.push({
        key: PRIMARY_LOCATION_MAP_ID,
        postalCode: primaryLocationDisplay.postalCode,
        rest: primaryLocationDisplay.rest,
        country: primaryLocationDisplay.country,
      });
    }

    for (const location of additionalLocations) {
      if (location.locationLat === null || location.locationLng === null) {
        continue;
      }
      const display = buildLocationDisplay({
        parts: location.locationAddressParts,
        fallbackLabel: location.locationAddressLabel || location.search,
      });
      result.push({
        key: location.id,
        postalCode: display.postalCode,
        rest: display.rest,
        country: display.country,
      });
    }

    return result;
  }, [additionalLocations, latNumber, lngNumber, primaryLocationDisplay]);
  const visibleConfiguredLocationDisplays = configuredLocationDisplays.slice(0, 3);
  const hiddenConfiguredLocationsCount = Math.max(
    0,
    configuredLocationDisplays.length - visibleConfiguredLocationDisplays.length,
  );
  const visibleInitialPhotoCount = keptInitialPhotoIndexes.length;
  const totalPhotoCount =
    visibleInitialPhotoCount + photoItems.length + (coverPhotoItem ? 1 : 0);
  const mainPhotoPreviewUrl =
    coverPhotoItem?.previewUrl ??
    (keptInitialPhotoIndexes.length > 0
      ? (stableInitialPhotoUrls[keptInitialPhotoIndexes[0]] ?? null)
      : null);
  const additionalInitialPhotoIndexes = keptInitialPhotoIndexes.slice(1);
  const containerLogoPlaceholderSrc = useMemo(
    () =>
      getContainerLogoPlaceholderSrc(
        typeof containerSizeValue === "number" ? containerSizeValue : undefined,
      ),
    [containerSizeValue],
  );
  const canProceedFromIntentStep =
    !isCreateMode || resolvedListingIntent !== null;
  const locationMapPoints = useMemo(
    () => [
      {
        id: PRIMARY_LOCATION_MAP_ID,
        lat: latNumber,
        lng: lngNumber,
        isPrimary: true,
      },
      ...additionalLocations.map((location) => ({
        id: location.id,
        lat: location.locationLat,
        lng: location.locationLng,
        isPrimary: false,
      })),
    ],
    [additionalLocations, latNumber, lngNumber],
  );
  const activeMapLocationLabel = useMemo(() => {
    if (activeMapLocationId === PRIMARY_LOCATION_MAP_ID) {
      return formatTemplate(messages.shared.locationLabelTemplate, { index: 1 });
    }
    const additionalLocationIndex = additionalLocations.findIndex(
      (location) => location.id === activeMapLocationId,
    );
    if (additionalLocationIndex >= 0) {
      return formatTemplate(messages.shared.locationLabelTemplate, {
        index: additionalLocationIndex + 2,
      });
    }
    return formatTemplate(messages.shared.locationLabelTemplate, { index: 1 });
  }, [activeMapLocationId, additionalLocations, messages.shared.locationLabelTemplate]);

  useEffect(() => {
    setKeptInitialPhotoIndexes(stableInitialPhotoUrls.map((_, index) => index));
  }, [stableInitialPhotoUrls]);

  useEffect(() => {
    photoItemsRef.current = photoItems;
  }, [photoItems]);

  useEffect(() => {
    coverPhotoItemRef.current = coverPhotoItem;
  }, [coverPhotoItem]);

  useEffect(() => {
    coverPhotoCropSourceUrlRef.current = coverPhotoCrop?.sourceUrl ?? null;
  }, [coverPhotoCrop?.sourceUrl]);

  useEffect(() => {
    return () => {
      if (coverPhotoCropSourceUrlRef.current) {
        URL.revokeObjectURL(coverPhotoCropSourceUrlRef.current);
      }
      revokeImageItems(photoItemsRef.current);
      if (coverPhotoItemRef.current) {
        URL.revokeObjectURL(coverPhotoItemRef.current.previewUrl);
      }
    };
  }, []);

  useEffect(() => {
    if (!isCreateMode || !resolvedListingIntent) {
      return;
    }
    setValue("type", mapListingIntentToType(resolvedListingIntent), {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: true,
    });
    clearErrors("type");
  }, [clearErrors, isCreateMode, resolvedListingIntent, setValue]);

  useEffect(() => {
    if (!publishedAsCompanyValue || !hasOwnedCompanyProfile) {
      return;
    }
    setValue("companyName", ownedCompanyName, {
      shouldDirty: true,
      shouldTouch: false,
      shouldValidate: true,
    });
    clearErrors("companyName");
  }, [
    clearErrors,
    hasOwnedCompanyProfile,
    ownedCompanyName,
    publishedAsCompanyValue,
    setValue,
  ]);

  useEffect(() => {
    if (activeMapLocationId === PRIMARY_LOCATION_MAP_ID) {
      return;
    }
    const exists = additionalLocations.some(
      (location) => location.id === activeMapLocationId,
    );
    if (!exists) {
      setActiveMapLocationId(PRIMARY_LOCATION_MAP_ID);
    }
  }, [activeMapLocationId, additionalLocations]);
  const canManageListingPhotos = listingTypeValue !== "buy";
  const isCreatePublishReady = useMemo(() => {
    if (!isCreateMode || !canProceedFromIntentStep) {
      return false;
    }
    const currentValues = getValues();
    return isCreateFormReadyToPublish(currentValues);
  }, [
    canProceedFromIntentStep,
    createPrecheckValuesWatch,
    getValues,
    isCreateMode,
  ]);
  const isEditSaveReady = useMemo(() => {
    if (isCreateMode || !canProceedFromIntentStep) {
      return false;
    }
    const currentValues = getValues();
    if (!isCreateFormReadyToPublish(currentValues)) {
      return false;
    }
    if ((currentValues.companyName ?? "").trim().length < 2) {
      return false;
    }
    if ((currentValues.contactEmail ?? "").trim().length === 0) {
      return false;
    }
    return true;
  }, [
    canProceedFromIntentStep,
    companyNameValue,
    contactEmailValue,
    createPrecheckValuesWatch,
    getValues,
    isCreateMode,
  ]);
  const isSubmitReady = isCreateMode ? isCreatePublishReady : isEditSaveReady;

  useEffect(() => {
    if (!canProceedFromIntentStep) {
      setIsContactModalOpen(false);
    }
  }, [canProceedFromIntentStep]);

  useEffect(() => {
    if (showTransportSection) {
      return;
    }
    if (
      errors.logisticsTransportAvailable?.message ||
      errors.logisticsTransportIncluded?.message ||
      errors.logisticsTransportFreeDistanceKm?.message ||
      errors.logisticsUnloadingAvailable?.message ||
      errors.logisticsUnloadingIncluded?.message ||
      errors.logisticsComment?.message
    ) {
      setShowTransportSection(true);
    }
  }, [
    errors.logisticsComment?.message,
    errors.logisticsTransportAvailable?.message,
    errors.logisticsTransportFreeDistanceKm?.message,
    errors.logisticsTransportIncluded?.message,
    errors.logisticsUnloadingAvailable?.message,
    errors.logisticsUnloadingIncluded?.message,
    showTransportSection,
  ]);

  useEffect(() => {
    if (showDescriptionSection) {
      return;
    }
    if (errors.description?.message || errors.containerColorsRal?.message) {
      setShowDescriptionSection(true);
    }
  }, [
    errors.containerColorsRal?.message,
    errors.description?.message,
    showDescriptionSection,
  ]);

  useEffect(() => {
    if (showCertificationSection) {
      return;
    }
    if (errors.cscValidToMonth?.message || errors.cscValidToYear?.message) {
      setShowCertificationSection(true);
    }
  }, [
    errors.cscValidToMonth?.message,
    errors.cscValidToYear?.message,
    showCertificationSection,
  ]);

  useEffect(() => {
    if (!canProceedFromIntentStep) {
      return;
    }
    const target = inlineSubmitContainerRef.current;
    if (!target) {
      return;
    }
    if (typeof IntersectionObserver === "undefined") {
      setIsInlineSubmitVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        setIsInlineSubmitVisible(entry?.isIntersecting ?? false);
      },
      { threshold: 0.15 },
    );
    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [canProceedFromIntentStep]);

  const shouldShowStickySubmit =
    canProceedFromIntentStep &&
    !isInlineSubmitVisible &&
    !isContactModalOpen &&
    !isPublishSuccessModalOpen &&
    isSubmitReady;
  const createSubmitButtonClass =
    "rounded-md bg-gradient-to-r from-rose-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60";
  const createSubmitInactiveButtonClass =
    "rounded-md border border-neutral-300 bg-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-600 transition hover:bg-neutral-300";

  const applyCoordinates = useCallback(
    (nextLat: number, nextLng: number) => {
      setValue("locationLat", toCoordinateText(nextLat), {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
      setValue("locationLng", toCoordinateText(nextLng), {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
      clearErrors(["locationLat", "locationLng"]);
    },
    [clearErrors, setValue],
  );

  const applyAddressParts = useCallback(
    (parts?: GeocodeAddressParts | null) => {
      const city = parts?.city?.trim();
      const country = parts?.country?.trim();
      const street = parts?.street?.trim() ?? "";
      const houseNumber = parts?.houseNumber?.trim() ?? "";
      const postalCode = parts?.postalCode?.trim() ?? "";

      setValue("locationStreet", street, {
        shouldDirty: true,
        shouldTouch: true,
      });
      setValue("locationHouseNumber", houseNumber, {
        shouldDirty: true,
        shouldTouch: true,
      });
      setValue("locationPostalCode", postalCode, {
        shouldDirty: true,
        shouldTouch: true,
      });

      if (city) {
        setValue("locationAddressCity", city, {
          shouldDirty: true,
          shouldTouch: true,
        });
      }

      if (country) {
        setValue("locationAddressCountry", country, {
          shouldDirty: true,
          shouldTouch: true,
        });
      }
    },
    [setValue],
  );

  const handleMapChange = useCallback(
    async (next: { lat: number; lng: number }) => {
      applyCoordinates(next.lat, next.lng);

      const currentRequestId = reverseLookupRequestRef.current + 1;
      reverseLookupRequestRef.current = currentRequestId;
      setIsReverseLookupPending(true);

      try {
        const response = await fetch(
          `/api/geocode/reverse?lat=${encodeURIComponent(next.lat.toFixed(6))}&lng=${encodeURIComponent(next.lng.toFixed(6))}&lang=${locale}`,
        );
        const data = (await response.json()) as ReverseGeocodeResponse;

        if (reverseLookupRequestRef.current !== currentRequestId) {
          return;
        }

        if (!response.ok || data.error || !data.item) {
          return;
        }

        applyAddressParts(data.item.addressParts);
        if (data.item.shortLabel || data.item.label) {
          const locationLabel = data.item.shortLabel ?? data.item.label;
          setLocationSearch(locationLabel);
          setValue("locationAddressLabel", locationLabel, {
            shouldDirty: true,
            shouldTouch: true,
          });
        }
      } catch {
        // keep coordinates and silently ignore reverse geocode failures
      } finally {
        if (reverseLookupRequestRef.current === currentRequestId) {
          setIsReverseLookupPending(false);
        }
      }
    },
    [applyAddressParts, applyCoordinates, setValue],
  );

  const fetchSingleGeocodeLocation = useCallback(
    async (
      query: string,
    ): Promise<NonNullable<GeocodeSearchResponse["item"]>> => {
      const response = await fetch(
        `/api/geocode?q=${encodeURIComponent(query)}&lang=${locale}&limit=1`,
      );
      const data = (await response.json()) as GeocodeSearchResponse;

      if (!response.ok || data.error) {
        throw new Error(data.error ?? messages.form.locationFetchError);
      }

      if (!data.item) {
        throw new Error(messages.form.locationNoResults);
      }

      return data.item;
    },
    [locale, messages.form.locationFetchError, messages.form.locationNoResults],
  );

  const handleSearchLocation = useCallback(async () => {
    const query = locationSearch.trim();
    if (query.length < 3) {
      toast.error(messages.form.locationMinChars);
      return;
    }

    setActiveMapLocationId(PRIMARY_LOCATION_MAP_ID);
    setIsSearchingLocation(true);

    try {
      const geocodeItem = await fetchSingleGeocodeLocation(query);
      applyCoordinates(geocodeItem.lat, geocodeItem.lng);
      applyAddressParts(geocodeItem.addressParts);
      const locationLabel = geocodeItem.shortLabel ?? geocodeItem.label;
      setLocationSearch(locationLabel);
      setValue("locationAddressLabel", locationLabel, {
        shouldDirty: true,
        shouldTouch: true,
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : messages.form.locationSearchError,
      );
    } finally {
      setIsSearchingLocation(false);
    }
  }, [
    applyAddressParts,
    applyCoordinates,
    fetchSingleGeocodeLocation,
    locationSearch,
    setValue,
    toast,
  ]);

  const handleAddAdditionalLocation = useCallback(() => {
    if (additionalLocations.length >= MAX_ADDITIONAL_LOCATIONS) {
      toast.warning(
        formatTemplate(messages.form.maxLocations, {
          count: MAX_LISTING_LOCATIONS,
        }),
      );
      return;
    }

    const nextLocation = createAdditionalLocationDraft();
    setAdditionalLocations((current) => [...current, nextLocation]);
    setActiveMapLocationId(nextLocation.id);
  }, [additionalLocations.length, toast]);

  const handleRemoveAdditionalLocation = useCallback(
    (id: string) => {
      delete additionalReverseLookupRequestRef.current[id];
      if (activeMapLocationId === id) {
        setActiveMapLocationId(PRIMARY_LOCATION_MAP_ID);
      }
      setAdditionalLocations((current) =>
        current.filter((location) => location.id !== id),
      );
    },
    [activeMapLocationId],
  );

  const applyPrimaryLocationFromDraft = useCallback(
    (draft: AdditionalLocationDraft) => {
      const nextLat = draft.locationLat;
      const nextLng = draft.locationLng;
      const nextAddressParts = draft.locationAddressParts;
      const nextAddressLabel =
        draft.locationAddressLabel.trim() ||
        buildLocationLabelFromAddressParts(nextAddressParts) ||
        draft.search.trim();

      setValue("locationLat", toCoordinateText(nextLat ?? undefined), {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
      setValue("locationLng", toCoordinateText(nextLng ?? undefined), {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
      setValue("locationAddressLabel", nextAddressLabel, {
        shouldDirty: true,
        shouldTouch: true,
      });
      setValue("locationStreet", nextAddressParts?.street?.trim() ?? "", {
        shouldDirty: true,
        shouldTouch: true,
      });
      setValue(
        "locationHouseNumber",
        nextAddressParts?.houseNumber?.trim() ?? "",
        {
          shouldDirty: true,
          shouldTouch: true,
        },
      );
      setValue("locationPostalCode", nextAddressParts?.postalCode?.trim() ?? "", {
        shouldDirty: true,
        shouldTouch: true,
      });
      setValue("locationAddressCity", nextAddressParts?.city?.trim() ?? "", {
        shouldDirty: true,
        shouldTouch: true,
      });
      setValue("locationAddressCountry", nextAddressParts?.country?.trim() ?? "", {
        shouldDirty: true,
        shouldTouch: true,
      });
      setLocationSearch(nextAddressLabel);

      if (nextLat !== null && nextLng !== null) {
        clearErrors(["locationLat", "locationLng"]);
      }
    },
    [clearErrors, setValue],
  );

  const handleRemovePrimaryLocation = useCallback(() => {
    if (additionalLocations.length === 0) {
      setActiveMapLocationId(PRIMARY_LOCATION_MAP_ID);
      setLocationSearch("");
      setValue("locationLat", "", {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
      setValue("locationLng", "", {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
      setValue("locationAddressLabel", "", {
        shouldDirty: true,
        shouldTouch: true,
      });
      setValue("locationStreet", "", {
        shouldDirty: true,
        shouldTouch: true,
      });
      setValue("locationHouseNumber", "", {
        shouldDirty: true,
        shouldTouch: true,
      });
      setValue("locationPostalCode", "", {
        shouldDirty: true,
        shouldTouch: true,
      });
      setValue("locationAddressCity", "", {
        shouldDirty: true,
        shouldTouch: true,
      });
      setValue("locationAddressCountry", "", {
        shouldDirty: true,
        shouldTouch: true,
      });
      clearErrors(["locationLat", "locationLng"]);
      toast.info(
        formatTemplate(messages.form.locationRemoved, { index: 1 }),
      );
      return;
    }

    const promotedIndex = additionalLocations.findIndex(
      (location) =>
        location.locationLat !== null && location.locationLng !== null,
    );
    const nextPrimaryIndex = promotedIndex >= 0 ? promotedIndex : 0;
    const nextPrimary = additionalLocations[nextPrimaryIndex];
    if (!nextPrimary) {
      return;
    }

    const remainingAdditionalLocations = additionalLocations.filter(
      (_, index) => index !== nextPrimaryIndex,
    );
    applyPrimaryLocationFromDraft(nextPrimary);
    setAdditionalLocations(remainingAdditionalLocations);
    setActiveMapLocationId(PRIMARY_LOCATION_MAP_ID);

    const nextReverseLookupMap: Record<string, number> = {};
    for (const location of remainingAdditionalLocations) {
      const requestId = additionalReverseLookupRequestRef.current[location.id];
      if (typeof requestId === "number") {
        nextReverseLookupMap[location.id] = requestId;
      }
    }
    additionalReverseLookupRequestRef.current = nextReverseLookupMap;

    toast.info(messages.form.locationPromoted);
  }, [
    additionalLocations,
    applyPrimaryLocationFromDraft,
    clearErrors,
    setLocationSearch,
    setValue,
    toast,
  ]);

  const handleUpdateAdditionalLocationSearch = useCallback(
    (id: string, value: string) => {
      setAdditionalLocations((current) =>
        current.map((location) =>
          location.id === id
            ? {
                ...location,
                search: value,
              }
            : location,
        ),
      );
    },
    [],
  );

  const handleSearchAdditionalLocation = useCallback(
    async (id: string) => {
      const target = additionalLocations.find((location) => location.id === id);
      if (!target) {
        return;
      }

    setActiveMapLocationId(id);
    const query = target.search.trim();
    if (query.length < 3) {
      toast.error(messages.form.locationMinChars);
      return;
    }

      setAdditionalLocations((current) =>
        current.map((location) =>
          location.id === id
            ? {
                ...location,
                isSearching: true,
              }
            : location,
        ),
      );

      try {
        const geocodeItem = await fetchSingleGeocodeLocation(query);
        const locationLabel = geocodeItem.shortLabel ?? geocodeItem.label;

        setAdditionalLocations((current) =>
          current.map((location) =>
            location.id === id
              ? {
                  ...location,
                  search: locationLabel,
                  isSearching: false,
                  locationLat: geocodeItem.lat,
                  locationLng: geocodeItem.lng,
                  locationAddressLabel: locationLabel,
                  locationAddressParts: geocodeItem.addressParts ?? null,
                }
              : location,
          ),
        );
      } catch (error) {
        setAdditionalLocations((current) =>
          current.map((location) =>
            location.id === id
              ? {
                  ...location,
                  isSearching: false,
                }
              : location,
          ),
        );
        toast.error(
          error instanceof Error
            ? error.message
            : messages.form.locationSearchError,
        );
      }
    },
    [additionalLocations, fetchSingleGeocodeLocation, toast],
  );

  const handleAdditionalLocationMapChange = useCallback(
    async (id: string, next: { lat: number; lng: number }) => {
      const currentRequestId =
        (additionalReverseLookupRequestRef.current[id] ?? 0) + 1;
      additionalReverseLookupRequestRef.current[id] = currentRequestId;

      setAdditionalLocations((current) =>
        current.map((location) =>
          location.id === id
            ? {
                ...location,
                locationLat: next.lat,
                locationLng: next.lng,
                isSearching: true,
              }
            : location,
        ),
      );

      try {
        const response = await fetch(
          `/api/geocode/reverse?lat=${encodeURIComponent(next.lat.toFixed(6))}&lng=${encodeURIComponent(next.lng.toFixed(6))}&lang=${locale}`,
        );
        const data = (await response.json()) as ReverseGeocodeResponse;

        if (
          additionalReverseLookupRequestRef.current[id] !== currentRequestId
        ) {
          return;
        }

        if (!response.ok || data.error || !data.item) {
          setAdditionalLocations((current) =>
            current.map((location) =>
              location.id === id
                ? {
                    ...location,
                    isSearching: false,
                  }
                : location,
            ),
          );
          return;
        }

        const locationLabel = data.item.shortLabel ?? data.item.label;
        setAdditionalLocations((current) =>
          current.map((location) =>
            location.id === id
              ? {
                  ...location,
                  search: locationLabel,
                  isSearching: false,
                  locationAddressLabel: locationLabel,
                  locationAddressParts: data.item?.addressParts ?? null,
                }
              : location,
          ),
        );
      } catch {
        if (
          additionalReverseLookupRequestRef.current[id] !== currentRequestId
        ) {
          return;
        }
        setAdditionalLocations((current) =>
          current.map((location) =>
            location.id === id
              ? {
                  ...location,
                  isSearching: false,
                }
              : location,
          ),
        );
      }
    },
    [],
  );

  const handleSharedMapPointChange = useCallback(
    async (id: string, next: { lat: number; lng: number }) => {
      if (id === PRIMARY_LOCATION_MAP_ID) {
        await handleMapChange(next);
        return;
      }
      await handleAdditionalLocationMapChange(id, next);
    },
    [handleAdditionalLocationMapChange, handleMapChange],
  );

  const handleApplyCompanyLocation = useCallback(
    (selectedOptions?: CompanyLocationPrefillOption[]) => {
      const requestedOptions =
        selectedOptions && selectedOptions.length > 0
          ? selectedOptions
          : resolvedCompanyLocationPrefillOptions.slice(0, 1);
      if (requestedOptions.length === 0) {
        return;
      }

      const normalizedOptions = requestedOptions.filter(
        (option) =>
          Number.isFinite(option.locationLat) && Number.isFinite(option.locationLng),
      );
      if (normalizedOptions.length === 0) {
        return;
      }

      const dedupedOptions: CompanyLocationPrefillOption[] = [];
      const seenKeys = new Set<string>();
      for (const option of normalizedOptions) {
        const key = `${option.locationLat.toFixed(6)}:${option.locationLng.toFixed(6)}`;
        if (seenKeys.has(key)) {
          continue;
        }
        seenKeys.add(key);
        dedupedOptions.push(option);
      }

      if (dedupedOptions.length > MAX_LISTING_LOCATIONS) {
        toast.warning(
          formatTemplate(messages.form.maxLocations, {
            count: MAX_LISTING_LOCATIONS,
          }),
        );
      }
      const limitedOptions = dedupedOptions.slice(0, MAX_LISTING_LOCATIONS);
      const [primaryOption, ...restOptions] = limitedOptions;
      if (!primaryOption) {
        return;
      }

      const {
        name,
        locationLat,
        locationLng,
        locationAddressLabel,
        locationAddressParts,
      } = primaryOption;
      if (!Number.isFinite(locationLat) || !Number.isFinite(locationLng)) {
        return;
      }

      setActiveMapLocationId(PRIMARY_LOCATION_MAP_ID);
      applyCoordinates(locationLat, locationLng);
      applyAddressParts(locationAddressParts ?? null);
      if (!locationAddressParts?.city?.trim()) {
        setValue("locationAddressCity", "", {
          shouldDirty: true,
          shouldTouch: true,
        });
      }
      if (!locationAddressParts?.country?.trim()) {
        setValue("locationAddressCountry", "", {
          shouldDirty: true,
          shouldTouch: true,
        });
      }

      const fallbackLabel = buildLocationLabelFromAddressParts(
        locationAddressParts,
      );
      const resolvedLabel = locationAddressLabel?.trim() || fallbackLabel;
      setLocationSearch(resolvedLabel);
      setValue("locationAddressLabel", resolvedLabel, {
        shouldDirty: true,
        shouldTouch: true,
      });
      additionalReverseLookupRequestRef.current = {};
      setAdditionalLocations(
        restOptions
          .slice(0, MAX_ADDITIONAL_LOCATIONS)
          .map((option) =>
            createAdditionalLocationDraft({
              locationLat: option.locationLat,
              locationLng: option.locationLng,
              locationAddressLabel: option.locationAddressLabel,
              locationAddressParts: option.locationAddressParts ?? null,
            }),
          ),
      );

      clearErrors(["locationLat", "locationLng"]);
    },
    [
      additionalReverseLookupRequestRef,
      applyAddressParts,
      applyCoordinates,
      clearErrors,
      resolvedCompanyLocationPrefillOptions,
      setValue,
    ],
  );

  const handleClearLocations = useCallback(() => {
    setActiveMapLocationId(PRIMARY_LOCATION_MAP_ID);
    setLocationSearch("");
    additionalReverseLookupRequestRef.current = {};
    setAdditionalLocations([]);

    setValue("locationLat", "", {
      shouldDirty: true,
      shouldTouch: true,
    });
    setValue("locationLng", "", {
      shouldDirty: true,
      shouldTouch: true,
    });
    setValue("locationAddressLabel", "", {
      shouldDirty: true,
      shouldTouch: true,
    });
    setValue("locationStreet", "", {
      shouldDirty: true,
      shouldTouch: true,
    });
    setValue("locationHouseNumber", "", {
      shouldDirty: true,
      shouldTouch: true,
    });
    setValue("locationPostalCode", "", {
      shouldDirty: true,
      shouldTouch: true,
    });
    setValue("locationAddressCity", "", {
      shouldDirty: true,
      shouldTouch: true,
    });
    setValue("locationAddressCountry", "", {
      shouldDirty: true,
      shouldTouch: true,
    });

    clearErrors(["locationLat", "locationLng"]);
    toast.success(messages.form.locationsCleared);
  }, [clearErrors, setValue, toast]);

  const handleCoverPhotoFilesAdded = useCallback(
    (files: File[]) => {
      const firstImage = files.find((file) => file.type.startsWith("image/"));
      if (!firstImage) {
        toast.warning(messages.form.addGraphicFile);
        return;
      }
      if (!coverPhotoItem && totalPhotoCount >= MAX_CONTAINER_PHOTOS) {
        toast.warning(
          formatTemplate(messages.form.removePhotoForCover, {
            count: MAX_CONTAINER_PHOTOS,
          }),
        );
        return;
      }

      if (coverPhotoCrop?.sourceUrl) {
        URL.revokeObjectURL(coverPhotoCrop.sourceUrl);
      }
      const sourceUrl = URL.createObjectURL(firstImage);
      setCoverPhotoCrop({
        sourceUrl,
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
      });
    },
    [coverPhotoCrop, coverPhotoItem, toast, totalPhotoCount],
  );

  const handleApplyCoverPhotoCrop = useCallback(async () => {
    if (!coverPhotoCrop) {
      return;
    }

    setIsProcessingImages(true);
    try {
      const croppedFile = await cropImageFile(
        coverPhotoCrop,
        "listing-cover-cropped.png",
        {
          outputWidth: 1200,
          outputHeight: 1200,
          fitMode: "cover",
        },
      );
      const optimized = await optimizeListingImageForUpload(
        croppedFile,
        MAX_CONTAINER_PHOTO_BYTES,
      );

      if (optimized.size > MAX_CONTAINER_PHOTO_BYTES) {
        toast.warning(
          `Zdjecie glowne moze miec maksymalnie ${MAX_CONTAINER_PHOTO_MB} MB.`,
        );
        return;
      }

      const nextCover = createImageItems([optimized])[0];
      setCoverPhotoItem((previous) => {
        if (previous) {
          URL.revokeObjectURL(previous.previewUrl);
        }
        return nextCover;
      });

      URL.revokeObjectURL(coverPhotoCrop.sourceUrl);
      setCoverPhotoCrop(null);
    } finally {
      setIsProcessingImages(false);
    }
  }, [coverPhotoCrop, toast]);

  const handleCancelCoverPhotoCrop = useCallback(() => {
    if (coverPhotoCrop?.sourceUrl) {
      URL.revokeObjectURL(coverPhotoCrop.sourceUrl);
    }
    setCoverPhotoCrop(null);
  }, [coverPhotoCrop]);

  const handleAdditionalPhotoFilesAdded = useCallback(
    async (files: File[]) => {
      const imageFiles = files.filter((file) => file.type.startsWith("image/"));
      if (imageFiles.length !== files.length) {
        toast.warning(messages.form.imagesOnly);
      }
      if (imageFiles.length === 0) {
        return;
      }

      const remainingSlots = Math.max(
        0,
        MAX_CONTAINER_PHOTOS - totalPhotoCount,
      );
      if (remainingSlots === 0) {
        toast.warning(
          formatTemplate(messages.form.maxPhotosTotal, {
            count: MAX_CONTAINER_PHOTOS,
          }),
        );
        return;
      }

      let candidateFiles = imageFiles;
      if (candidateFiles.length > remainingSlots) {
        candidateFiles = candidateFiles.slice(0, remainingSlots);
        toast.warning(
          formatTemplate(messages.form.remainingPhotos, {
            count: remainingSlots,
          }),
        );
      }

      setIsProcessingImages(true);
      try {
        const optimizedFiles = await Promise.all(
          candidateFiles.map((file) =>
            optimizeListingImageForUpload(file, MAX_CONTAINER_PHOTO_BYTES),
          ),
        );

        const acceptedFiles = optimizedFiles.filter(
          (file) => file.size <= MAX_CONTAINER_PHOTO_BYTES,
        );
        if (acceptedFiles.length !== optimizedFiles.length) {
          toast.warning(
            formatTemplate(messages.form.photoLimitPerFile, {
              count: MAX_CONTAINER_PHOTO_MB,
            }),
          );
        }

        if (acceptedFiles.length === 0) {
          return;
        }

        const accepted = createImageItems(acceptedFiles);
        setPhotoItems((prev) => [...prev, ...accepted]);
      } finally {
        setIsProcessingImages(false);
      }
    },
    [messages.form.imagesOnly, messages.form.maxPhotosTotal, messages.form.remainingPhotos, toast, totalPhotoCount],
  );

  const onSubmit = async (values: ContainerListingFormValues) => {
    if (isCreateMode && !resolvedListingIntent) {
      setError("type", {
        type: "validate",
        message: messages.shared.selectListingType,
      });
      toast.error(messages.form.selectListingTypeFirst);
      return;
    }

    const locationLat = parseCoordinate(values.locationLat);
    const locationLng = parseCoordinate(values.locationLng);

    if (locationLat === null || locationLng === null) {
      setError("locationLat", {
        type: "validate",
        message: messages.form.chooseLocationOnMap,
      });
      setError("locationLng", {
        type: "validate",
        message: messages.form.chooseLocationOnMap,
      });
      toast.error(messages.form.geolocationRequired);
      return;
    }

    const locationAddressParts = {
      street: normalizeOptionalText(values.locationStreet),
      houseNumber: normalizeOptionalText(values.locationHouseNumber),
      postalCode: normalizeOptionalText(values.locationPostalCode),
      city: normalizeOptionalText(values.locationAddressCity),
      country: normalizeOptionalText(values.locationAddressCountry),
    };
    const hasAddressParts = Object.values(locationAddressParts).some((value) =>
      Boolean(value),
    );
    const additionalLocationsPayload: Array<{
      locationLat: number;
      locationLng: number;
      locationAddressLabel?: string;
      locationAddressParts?: {
        street?: string;
        houseNumber?: string;
        postalCode?: string;
        city?: string;
        country?: string;
      };
      isPrimary: false;
    }> = [];

    for (const location of additionalLocations) {
      const trimmedSearch = location.search.trim();
      const hasAnyValue =
        trimmedSearch.length > 0 ||
        location.locationLat !== null ||
        location.locationLng !== null;

      if (!hasAnyValue) {
        continue;
      }

      if (location.locationLat === null || location.locationLng === null) {
        toast.error(messages.form.additionalLocationNeedsCoordinates);
        return;
      }

      const additionalLocationAddressParts = {
        street: normalizeOptionalText(
          location.locationAddressParts?.street ?? "",
        ),
        houseNumber: normalizeOptionalText(
          location.locationAddressParts?.houseNumber ?? "",
        ),
        postalCode: normalizeOptionalText(
          location.locationAddressParts?.postalCode ?? "",
        ),
        city: normalizeOptionalText(location.locationAddressParts?.city ?? ""),
        country: normalizeOptionalText(
          location.locationAddressParts?.country ?? "",
        ),
      };
      const hasAdditionalLocationAddressParts = Object.values(
        additionalLocationAddressParts,
      ).some((value) => Boolean(value));

      additionalLocationsPayload.push({
        locationLat: location.locationLat,
        locationLng: location.locationLng,
        locationAddressLabel:
          normalizeOptionalText(location.locationAddressLabel) ||
          normalizeOptionalText(trimmedSearch),
        locationAddressParts: hasAdditionalLocationAddressParts
          ? additionalLocationAddressParts
          : undefined,
        isPrimary: false,
      });
    }

    const locationsPayload = [
      {
        locationLat,
        locationLng,
        locationAddressLabel: normalizeOptionalText(
          values.locationAddressLabel,
        ),
        locationAddressParts: hasAddressParts
          ? locationAddressParts
          : undefined,
        isPrimary: true as const,
      },
      ...additionalLocationsPayload,
    ];
    const normalizedPriceAmount = normalizeOptionalInteger(
      values.priceValueAmount,
    );
    const normalizedVatRate = normalizeOptionalNumber(values.priceVatRate);
    const normalizedProductionYear = normalizeOptionalNumber(
      values.productionYear,
    );
    const resolvedContainerSize = values.containerSize;
    const normalizedCscValidToMonth = normalizeOptionalInteger(
      values.cscValidToMonth,
    );
    const normalizedCscValidToYear = normalizeOptionalInteger(
      values.cscValidToYear,
    );
    const normalizedLogisticsTransportFreeDistanceKm = normalizeOptionalInteger(
      values.logisticsTransportFreeDistanceKm,
    );
    const trimmedAvailableFrom = values.availableFrom.trim();
    const descriptionLength = getRichTextLength(values.description);

    if (!values.availableNow && trimmedAvailableFrom.length === 0) {
      setError("availableFrom", {
        type: "validate",
        message: messages.form.provideDateOrNow,
      });
      toast.error(messages.form.provideDateOrNow);
      return;
    }

    if (descriptionLength > 1000) {
      setError("description", {
        type: "validate",
        message: messages.form.descriptionMaxLength,
      });
      toast.error(messages.form.descriptionMaxLength);
      return;
    }

    const hasCscValidToMonth = typeof normalizedCscValidToMonth === "number";
    const hasCscValidToYear = typeof normalizedCscValidToYear === "number";
    if (hasCscValidToMonth !== hasCscValidToYear) {
      setError("cscValidToMonth", {
        type: "validate",
        message: messages.form.provideCscMonthYear,
      });
      setError("cscValidToYear", {
        type: "validate",
        message: messages.form.provideCscMonthYear,
      });
      toast.error(messages.form.provideCscMonthYear);
      return;
    }

    if (
      values.logisticsTransportIncluded &&
      typeof normalizedLogisticsTransportFreeDistanceKm !== "number"
    ) {
      setError("logisticsTransportFreeDistanceKm", {
        type: "validate",
        message: messages.form.provideTransportKm,
      });
      toast.error(messages.form.provideTransportKm);
      return;
    }

    if (
      typeof resolvedContainerSize !== "number" ||
      !Number.isInteger(resolvedContainerSize) ||
      !(
        resolvedContainerSize === CONTAINER_SIZE.CUSTOM ||
        isStandardContainerSize(resolvedContainerSize)
      )
    ) {
      setError("containerSize", {
        type: "validate",
        message: messages.form.selectContainerSize,
      });
      toast.error(messages.form.invalidContainerSize);
      return;
    }
    const canUploadPhotosForSubmission = values.type !== "buy";
    if (canUploadPhotosForSubmission && totalPhotoCount > MAX_CONTAINER_PHOTOS) {
      toast.error(
        formatTemplate(messages.form.maxPhotosTotal, {
          count: MAX_CONTAINER_PHOTOS,
        }),
      );
      return;
    }

    const pricing = {
      original: {
        amount: normalizedPriceAmount ?? null,
        currency:
          normalizedPriceAmount === undefined ? null : values.priceCurrency,
        taxMode:
          normalizedPriceAmount === undefined ? null : values.priceTaxMode,
        vatRate:
          normalizedPriceAmount === undefined
            ? null
            : (normalizedVatRate ?? null),
        negotiable: values.priceNegotiable,
      },
    };

    const payload = {
      ...(mode === "edit" ? { action: "update" } : {}),
      ...(mode === "edit" && reactivateOnSave ? { reactivateOnSave: true } : {}),
      type: values.type,
      container: {
        size: resolvedContainerSize,
        height: values.containerHeight,
        type: values.containerType,
        features: Array.from(new Set(values.containerFeatures)),
        condition: values.containerCondition,
      },
      containerColorsRal: values.containerColorsRal.trim()
        ? values.containerColorsRal.trim()
        : undefined,
      quantity: Number(values.quantity),
      locationLat,
      locationLng,
      locationAddressLabel: normalizeOptionalText(values.locationAddressLabel),
      locationAddressParts: hasAddressParts ? locationAddressParts : undefined,
      locations: locationsPayload,
      availableNow: values.availableNow,
      availableFromApproximate: values.availableNow
        ? false
        : values.availableFromApproximate,
      availableFrom: values.availableNow ? undefined : values.availableFrom,
      logisticsTransportAvailable:
        values.logisticsTransportAvailable || values.logisticsTransportIncluded,
      logisticsTransportIncluded:
        values.logisticsTransportAvailable && values.logisticsTransportIncluded,
      logisticsTransportFreeDistanceKm:
        values.logisticsTransportIncluded &&
        typeof normalizedLogisticsTransportFreeDistanceKm === "number"
          ? normalizedLogisticsTransportFreeDistanceKm
          : undefined,
      logisticsUnloadingAvailable:
        values.logisticsUnloadingAvailable || values.logisticsUnloadingIncluded,
      logisticsUnloadingIncluded:
        values.logisticsUnloadingAvailable && values.logisticsUnloadingIncluded,
      logisticsComment: normalizeOptionalText(values.logisticsComment),
      pricing,
      priceAmount: normalizedPriceAmount,
      priceNegotiable: values.priceNegotiable,
      hasCscPlate: values.hasCscPlate,
      hasCscCertification: values.hasCscCertification,
      hasBranding: values.hasBranding,
      hasWarranty: values.hasWarranty,
      ...(hasCscValidToMonth && hasCscValidToYear
        ? {
            cscValidToMonth: normalizedCscValidToMonth,
            cscValidToYear: normalizedCscValidToYear,
          }
        : {}),
      productionYear:
        typeof normalizedProductionYear === "number"
          ? Math.trunc(normalizedProductionYear)
          : undefined,
      description: normalizeOptionalRichText(values.description),
      companyName: values.companyName,
      publishedAsCompany: values.publishedAsCompany,
      contactEmail: values.contactEmail,
      contactPhone: values.contactPhone.trim()
        ? values.contactPhone.trim()
        : undefined,
    };

    try {
      const formData = new FormData();
      formData.set("payload", JSON.stringify(payload));
      if (mode === "edit") {
        formData.set(
          "keepPhotoIndexes",
          JSON.stringify(keptInitialPhotoIndexes),
        );
        if (
          canUploadPhotosForSubmission &&
          coverPhotoItem &&
          keptInitialPhotoIndexes.length > 0
        ) {
          formData.set("prependUploadedPhotos", "1");
        }
      }
      if (canUploadPhotosForSubmission) {
        if (coverPhotoItem) {
          formData.append("photos", coverPhotoItem.file);
        }
        for (const item of photoItems) {
          formData.append("photos", item.file);
        }
      }

      const response = await fetch(submitEndpoint, {
        method: submitMethod,
        body: formData,
      });

      const data = (await response.json().catch(() => null)) as {
        error?: string;
        issues?: string[];
      } | null;

      if (!response.ok) {
        const details = Array.isArray(data?.issues)
          ? ` (${data?.issues.join(", ")})`
          : "";
        throw new Error(
          (data?.error ?? messages.form.saveContainerError) + details,
        );
      }

      setIsContactModalOpen(false);
      if (isCreateMode) {
        setIsPublishSuccessModalOpen(true);
        return;
      }
      toast.success(successMessage);

      if (coverPhotoItem) {
        URL.revokeObjectURL(coverPhotoItem.previewUrl);
      }
      revokeImageItems(photoItems);
      setCoverPhotoItem(null);
      setPhotoItems([]);
      router.push(backHref);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : messages.form.saveUnknownError,
      );
    }
  };

  if (isCreateMode && !showListingIntentSelector && !canProceedFromIntentStep) {
    return null;
  }

  return (
    <form
      onSubmit={(event) => {
        setIsLocationModalOpen(false);
        if (isCreateMode) {
          event.preventDefault();
          if (!canProceedFromIntentStep) {
            return;
          }
          void trigger(CREATE_FLOW_PRECHECK_FIELDS).then((isValid) => {
            if (isValid) {
              setIsContactModalOpen(true);
              return;
            }
            setIsContactModalOpen(false);
            toast.error(messages.form.fixErrorsBeforePublish);
          });
          return;
        }
        event.preventDefault();
        void handleSubmit(onSubmit, () => {
          toast.error(messages.form.fixErrorsBeforeSave);
        })();
      }}
      className="grid gap-4 rounded-xl border border-neutral-800 bg-neutral-900/60 p-5 pb-6"
    >
      {isCreateMode ? (
        <>
          <input
            type="hidden"
            {...register("type", { required: messages.shared.selectListingType })}
          />
          {showListingIntentSelector ? (
            resolvedListingIntent === null ? (
              <section className="grid gap-3 rounded-lg border border-neutral-700 bg-neutral-950/35 p-4">
                <div className="text-center">
                  <h2 className="text-base font-semibold text-neutral-100">
                    {messages.form.intentSectionTitle}
                  </h2>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {(["sell", "rent", "buy"] as const).map((option) => {
                    const isActive = resolvedListingIntent === option;
                    const theme = LISTING_INTENT_BUTTON_THEME[option];
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => {
                          handleListingIntentChange(option);
                        }}
                        className={`h-12 rounded-md border px-3 text-center text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7ba7d7]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900 ${
                          isActive ? theme.active : theme.inactive
                        }`}
                      >
                        {getListingKindLabel(resolvedListingMessages, option)}
                      </button>
                    );
                  })}
                </div>
                {errors.type?.message ? (
                  <span className="text-xs text-red-700">
                    {errors.type.message}
                  </span>
                ) : null}
              </section>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-700 bg-neutral-950/35 px-3 py-2">
                <p className="text-sm font-medium text-neutral-100">
                  {formatTemplate(messages.form.addContainerTitle, {
                    type: getListingKindLabel(
                      resolvedListingMessages,
                      resolvedListingIntent,
                    ),
                  })}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    handleListingIntentChange(null);
                  }}
                  className="rounded-md border border-neutral-500 bg-neutral-900 px-2 py-1 text-xs font-medium text-neutral-200 transition hover:border-neutral-400 hover:bg-neutral-800 hover:text-white"
                >
                  {messages.form.change}
                </button>
              </div>
            )
          ) : null}
        </>
      ) : (
        <>
          <input
            type="hidden"
            {...register("type", { required: messages.shared.selectListingType })}
          />
          <input
            type="checkbox"
            className="hidden"
            {...register("publishedAsCompany")}
          />
        </>
      )}

      {canProceedFromIntentStep ? (
        <>
          <FormSection
            title={messages.form.containerSectionTitle}
            contentClassName="grid gap-4"
          >
            <div
              className={
                canManageListingPhotos
                  ? "grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start"
                  : "grid gap-4"
              }
            >
              {canManageListingPhotos ? (
                <div className="grid gap-3 rounded-md bg-neutral-950/70">
                  <button
                    type="button"
                    className="relative aspect-square w-full cursor-pointer overflow-hidden rounded-md border border-neutral-200 bg-neutral-100"
                    onClick={() => {
                      coverPhotoInputRef.current?.click();
                    }}
                    aria-label={messages.form.chooseCoverAria}
                    disabled={isSubmitting || isProcessingImages}
                  >
                    {mainPhotoPreviewUrl ? (
                      <img
                        src={mainPhotoPreviewUrl}
                        alt={messages.form.coverPreviewAlt}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <img
                        src={containerLogoPlaceholderSrc}
                        alt={messages.form.coverPlaceholderAlt}
                        className="h-full w-full object-contain p-1"
                      />
                    )}
                  </button>

                  {mainPhotoPreviewUrl ? (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          coverPhotoInputRef.current?.click();
                        }}
                        disabled={isSubmitting || isProcessingImages}
                        className="inline-flex h-9 items-center justify-center rounded-md border border-[#2f639a] bg-[linear-gradient(180deg,#082650_0%,#0c3466_100%)] px-3 text-sm font-medium text-[#e2efff] transition hover:bg-[#0f3f75] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {messages.form.change}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (coverPhotoItem) {
                            setCoverPhotoItem((previous) => {
                              if (previous) {
                                URL.revokeObjectURL(previous.previewUrl);
                              }
                              return null;
                            });
                            return;
                          }
                          setKeptInitialPhotoIndexes((previous) =>
                            previous.slice(1),
                          );
                        }}
                        disabled={isSubmitting || isProcessingImages}
                        className="inline-flex h-9 items-center justify-center rounded-md border border-neutral-600 px-3 text-sm font-medium text-neutral-300 transition hover:border-neutral-500 hover:bg-neutral-800 hover:text-white"
                      >
                        {messages.shared.remove}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        coverPhotoInputRef.current?.click();
                      }}
                      disabled={isSubmitting || isProcessingImages}
                      className="inline-flex h-9 w-full items-center justify-center rounded-md border border-[#2f639a] bg-[linear-gradient(180deg,#082650_0%,#0c3466_100%)] px-3 text-sm font-medium text-[#e2efff] transition hover:bg-[#0f3f75] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {mainPhotoPreviewUrl
                        ? messages.form.change
                        : messages.form.addThumbnail}
                    </button>
                  )}
                  <input
                    ref={coverPhotoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const files = event.currentTarget.files
                        ? Array.from(event.currentTarget.files)
                        : [];
                      if (files.length > 0) {
                        void handleCoverPhotoFilesAdded(files);
                      }
                      event.currentTarget.value = "";
                    }}
                  />
                </div>
              ) : null}

              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-start gap-3">
                  <label className="flex min-w-[180px] flex-[1_1_220px] flex-col gap-1 text-sm">
                    <span className="text-neutral-700">
                      {messages.form.sizeLabel}
                    </span>
                    <SelectWithChevron
                      tone="dark"
                      {...register("containerSize", {
                        required: messages.form.selectSize,
                        valueAsNumber: true,
                        validate: (value) =>
                          value === CONTAINER_SIZE.CUSTOM ||
                          isStandardContainerSize(value) ||
                          messages.form.selectContainerSize,
                      })}
                    >
                      {CONTAINER_SIZES.map((size) => (
                        <option key={size} value={size}>
                          {size} ft
                        </option>
                      ))}
                      <option value={CONTAINER_SIZE.CUSTOM}>
                        {resolvedListingMessages.shared.customContainerSize}
                      </option>
                    </SelectWithChevron>
                    {errors.containerSize?.message ? (
                      <span className="text-xs text-red-700">
                        {errors.containerSize.message}
                      </span>
                    ) : null}
                  </label>

                  <label className="flex min-w-[180px] flex-[1_1_220px] flex-col gap-1 text-sm">
                    <span className="text-neutral-700">
                      {messages.form.heightLabel}
                    </span>
                    <SelectWithChevron
                      tone="dark"
                      {...register("containerHeight", {
                        required: messages.form.selectHeight,
                      })}
                    >
                      {getContainerHeightOptions(resolvedListingMessages).map((height) => (
                        <option key={height.value} value={height.value}>
                          {height.label}
                        </option>
                      ))}
                    </SelectWithChevron>
                  </label>

                  <label className="flex min-w-[180px] flex-[1_1_220px] flex-col gap-1 text-sm">
                    <span className="text-neutral-700">{messages.form.typeLabel}</span>
                    <SelectWithChevron
                      tone="dark"
                      {...register("containerType", {
                        required: messages.form.selectType,
                      })}
                    >
                      {getContainerTypeOptions(resolvedListingMessages).map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </SelectWithChevron>
                  </label>

                  <label className="flex min-w-[180px] flex-[1_1_220px] flex-col gap-1 text-sm">
                    <span className="text-neutral-700">
                      {messages.form.conditionLabel}
                    </span>
                    <SelectWithChevron
                      tone="dark"
                      {...register("containerCondition", {
                        required: messages.form.selectCondition,
                      })}
                    >
                      {getContainerConditionOptions(resolvedListingMessages).map((condition) => (
                        <option key={condition.value} value={condition.value}>
                          {condition.label}
                        </option>
                      ))}
                    </SelectWithChevron>
                    {errors.containerCondition?.message ? (
                      <span className="text-xs text-red-700">
                        {errors.containerCondition.message}
                      </span>
                    ) : null}
                  </label>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:flex-nowrap sm:items-start">
                  <div className="grid w-full gap-1 text-sm sm:min-w-0 sm:flex-1 sm:basis-0">
                    <span className="text-neutral-700">
                      {messages.form.featuresLabel}
                    </span>
                    <Controller
                      control={control}
                      name="containerFeatures"
                      render={({ field }) => (
                        <ContainerFeaturesMultiSelect
                          values={field.value ?? []}
                          onBlur={field.onBlur}
                          messages={messages.shared}
                          listingMessages={resolvedListingMessages}
                          onChange={(nextValues) => {
                            field.onChange(
                              normalizeContainerFeatures(nextValues),
                            );
                          }}
                        />
                      )}
                    />
                  </div>

                  <label className="grid w-full gap-1 text-sm sm:min-w-0 sm:flex-1 sm:basis-0">
                    <span className="text-neutral-700">
                      {messages.form.productionYearLabel}
                    </span>
                    <input
                      type="number"
                      min={1900}
                      max={2100}
                      step={1}
                      {...register("productionYear")}
                      className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100"
                      placeholder={messages.form.productionYearPlaceholder}
                    />
                  </label>
                </div>
              </div>
            </div>
          </FormSection>

          <FormSection
            title={messages.form.availabilitySectionTitle}
            contentClassName="flex flex-col gap-3"
          >
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex min-w-[120px] flex-[0_0_120px] flex-col gap-1 text-sm">
                <span className="text-neutral-700">
                  {messages.form.quantityLabel} *
                </span>
                <input
                  type="number"
                  min={1}
                  {...register("quantity", {
                    required: messages.form.quantityRequired,
                    valueAsNumber: true,
                    min: { value: 1, message: messages.form.quantityPositive },
                  })}
                  className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100"
                />
                {errors.quantity?.message ? (
                  <span className="text-xs text-red-700">
                    {errors.quantity.message}
                  </span>
                ) : null}
              </label>

              <label className="flex min-w-[220px] flex-[1_1_220px] flex-col gap-1 text-sm">
                <span className="text-neutral-700">
                  {messages.form.availableFromLabel} {availableNowValue ? "" : "*"}
                </span>
                <input
                  type="date"
                  {...register("availableFrom", {
                    onChange: (event) => {
                      const nextDate = event.target.value.trim();
                      if (
                        availableNowValue &&
                        nextDate.length > 0 &&
                        nextDate !== todayDateValue
                      ) {
                        setValue("availableNow", false, {
                          shouldDirty: true,
                          shouldTouch: true,
                          shouldValidate: true,
                        });
                      }
                    },
                    validate: (value) =>
                      availableNowValue ||
                      value.trim().length > 0 ||
                      messages.form.provideDateOrNow,
                  })}
                  className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100"
                />
                {errors.availableFrom?.message ? (
                  <span className="text-xs text-red-700">
                    {errors.availableFrom.message}
                  </span>
                ) : null}
              </label>

              <label className="inline-flex min-w-[250px] flex-[1_1_250px] items-center gap-2 rounded-md border border-neutral-700 bg-neutral-900/70 px-3 py-2 text-sm text-neutral-200">
                <input
                  type="checkbox"
                  {...register("availableNow", {
                    onChange: (event) => {
                      const isChecked = event.target.checked === true;
                      if (isChecked) {
                        setValue("availableFromApproximate", false, {
                          shouldDirty: true,
                          shouldTouch: true,
                        });
                        setValue("availableFrom", todayDateValue, {
                          shouldDirty: true,
                          shouldTouch: true,
                          shouldValidate: true,
                        });
                        clearErrors("availableFrom");
                      }
                    },
                  })}
                  className="h-4 w-4 rounded border-neutral-600 bg-neutral-950 text-[#2f639a] focus:ring-[#4e86c3]"
                />
                <span>{messages.form.availableNowLabel}</span>
              </label>

              <label className="inline-flex min-w-[250px] flex-[1_1_250px] items-center gap-2 rounded-md border border-neutral-700 bg-neutral-900/70 px-3 py-2 text-sm text-neutral-200">
                <input
                  type="checkbox"
                  disabled={availableNowValue}
                  {...register("availableFromApproximate")}
                  className="h-4 w-4 rounded border-neutral-600 bg-neutral-950 text-[#2f639a] focus:ring-[#4e86c3] disabled:cursor-not-allowed disabled:opacity-60"
                />
                <span>{messages.form.approximateDateLabel}</span>
              </label>
            </div>
          </FormSection>

          <FormSection
            title={messages.form.locationSectionTitle}
          >
            <div className="flex flex-wrap items-center gap-2">
              {hasCompanyLocationPrefill ? (
                <CompanyLocationPrefillDropdown
                  options={resolvedCompanyLocationPrefillOptions}
                  onApply={handleApplyCompanyLocation}
                  onClear={handleClearLocations}
                  variant="light"
                  messages={messages.shared}
                />
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setIsLocationModalOpen(true);
                }}
                className="ml-auto inline-flex h-9 items-center rounded-md border border-[#2f639a] bg-[linear-gradient(180deg,#082650_0%,#0c3466_100%)] px-3 text-sm font-medium text-[#e2efff] transition hover:bg-[#0f3f75] hover:text-white"
              >
                {messages.form.chooseLocationButton}
              </button>
            </div>

            <div className="rounded-md border border-neutral-300 bg-white p-2 text-xs text-neutral-600">
              <p className="font-medium text-neutral-700">
                {messages.form.configuredLocationsLabel}: {configuredLocationsCount}/
                {MAX_LISTING_LOCATIONS}
              </p>
              {visibleConfiguredLocationDisplays.length > 0 ? (
                <div className="mt-1 grid gap-1 text-neutral-600">
                  {visibleConfiguredLocationDisplays.map((location, index) => (
                    <div key={location.key} className="flex items-center gap-1">
                      <LocationFlag country={location.country} className="shrink-0" />
                      <span className="min-w-0 truncate">
                        {location.postalCode ? (
                          <strong className="font-semibold text-neutral-700">
                            {location.postalCode}
                          </strong>
                        ) : null}
                        {location.postalCode && location.rest ? " " : null}
                        {location.rest}
                        {index === visibleConfiguredLocationDisplays.length - 1 &&
                        hiddenConfiguredLocationsCount > 0 ? (
                          <strong className="font-semibold text-neutral-700">
                            {" "}
                            + {hiddenConfiguredLocationsCount}
                          </strong>
                        ) : null}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-neutral-500">
                  {messages.form.noPrimaryLocation}
                </p>
              )}
            </div>

            <input
              type="hidden"
              {...register("locationLat", {
                validate: (value) =>
                  parseCoordinate(value) !== null ||
                  messages.form.chooseLocationOnMap,
              })}
            />
            <input
              type="hidden"
              {...register("locationLng", {
                validate: (value) =>
                  parseCoordinate(value) !== null ||
                  messages.form.chooseLocationOnMap,
              })}
            />
            <input type="hidden" {...register("locationAddressLabel")} />
            <input type="hidden" {...register("locationStreet")} />
            <input type="hidden" {...register("locationHouseNumber")} />
            <input type="hidden" {...register("locationPostalCode")} />
            <input type="hidden" {...register("locationAddressCity")} />
            <input type="hidden" {...register("locationAddressCountry")} />

            {errors.locationLat?.message ? (
              <span className="text-xs text-red-700">
                {errors.locationLat.message}
              </span>
            ) : null}
          </FormSection>

          <FormSection
            title={messages.form.priceSectionTitle}
          >
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex min-w-[220px] flex-[1.6_1_320px] flex-col gap-1 text-sm">
                <span className="text-neutral-700">
                  {quantityValue > 1
                    ? messages.form.amountPerContainerLabel
                    : messages.form.amountLabel}
                </span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  {...register("priceValueAmount", {
                    validate: (value) => {
                      if (value.trim().length === 0) {
                        return true;
                      }
                      return (
                        normalizeOptionalInteger(value) !== undefined ||
                        messages.form.fullNumberPrice
                      );
                    },
                  })}
                  className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100"
                  placeholder={messages.form.amountPlaceholder}
                />
                {errors.priceValueAmount?.message ? (
                  <span className="text-xs text-red-700">
                    {errors.priceValueAmount.message}
                  </span>
                ) : null}
              </label>
              <label className="flex min-w-[150px] flex-[1_1_180px] flex-col gap-1 text-sm">
                <span className="text-neutral-700">
                  {messages.form.vatRateLabel}
                </span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  {...register("priceVatRate")}
                  className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100"
                  placeholder={messages.form.vatRatePlaceholder}
                />
              </label>
              <label className="flex min-w-[130px] flex-[0.7_1_150px] flex-col gap-1 text-sm">
                <span className="text-neutral-700">
                  {messages.form.currencyLabel}
                </span>
                <SelectWithChevron
                  tone="dark"
                  {...register("priceCurrency", { required: messages.form.selectCurrency })}
                >
                  {PRICE_CURRENCIES.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </SelectWithChevron>
              </label>
              <label className="flex min-w-[150px] flex-[0.9_1_180px] flex-col gap-1 text-sm">
                <span className="text-neutral-700">
                  {messages.form.taxModeLabel}
                </span>
                <SelectWithChevron
                  tone="dark"
                  {...register("priceTaxMode", {
                    required: messages.form.selectTaxMode,
                  })}
                >
                  {PRICE_TAX_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode}
                    </option>
                  ))}
                </SelectWithChevron>
              </label>
            </div>

            <p className="text-xs text-neutral-400">
              {messages.form.emptyAmountHint}
            </p>

            <label className="inline-flex w-fit items-center gap-2 self-start rounded-md border border-neutral-700 bg-neutral-900/70 px-3 py-2 text-sm text-neutral-200">
              <input
                type="checkbox"
                {...register("priceNegotiable")}
                className="h-4 w-4 rounded border-neutral-600 bg-neutral-950 text-[#2f639a] focus:ring-[#4e86c3]"
              />
              <span>{messages.form.negotiablePriceLabel}</span>
            </label>
          </FormSection>

          {showDescriptionSection ? (
            <FormSection
              title={messages.form.descriptionSectionTitle}
            >
            <div className="grid gap-1 text-sm">
              <span className="text-neutral-700">
                {messages.form.descriptionLabel} ({messages.shared.optional})
              </span>
              <Controller
                name="description"
                control={control}
                rules={{
                  validate: (value) =>
                    getRichTextLength(value) <= 1000 ||
                    messages.form.descriptionMaxLength,
                }}
                render={({ field }) => (
                  <SimpleRichTextEditor
                    value={field.value}
                    onChange={field.onChange}
                    maxCharacters={1000}
                    placeholder={messages.form.descriptionPlaceholder}
                    disabled={isSubmitting}
                  />
                )}
              />
              {errors.description?.message ? (
                <span className="text-xs text-red-700">
                  {errors.description.message}
                </span>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 sm:items-center">
              <div className="grid gap-2 text-sm">
                <label htmlFor="containerColorsRal" className="text-neutral-700">
                  {messages.form.ralColorsLabel}
                </label>
                <input
                  id="containerColorsRal"
                  {...register("containerColorsRal", {
                    validate: validateContainerRalColorsInput,
                    maxLength: {
                      value: 320,
                      message: messages.form.ralListMaxLength,
                    },
                  })}
                  className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100"
                  placeholder={messages.form.ralPlaceholder}
                />
                <span className="text-xs text-neutral-400">
                  {messages.form.ralHint}
                </span>
                {errors.containerColorsRal?.message ? (
                  <span className="text-xs text-red-700">
                    {errors.containerColorsRal.message}
                  </span>
                ) : null}
                <label className="mt-1 inline-flex h-9 w-fit items-center gap-2 rounded-md border border-neutral-700 bg-neutral-900/70 px-3 text-sm text-neutral-200">
                  <input
                    type="checkbox"
                    {...register("hasBranding")}
                    className="h-4 w-4 rounded border-neutral-600 bg-neutral-950 text-[#2f639a] focus:ring-[#4e86c3]"
                  />
                  <span>{messages.form.brandingLabel}</span>
                </label>
              </div>
              <div className="flex w-full flex-wrap items-start justify-end gap-2">
                {shouldShowRalColorsPreview
                  ? parsedRalColorsPreview.colors.map((color) => {
                      const labelStyle = getRalPreviewLabelStyle(color.rgb);
                      return (
                        <span
                          key={color.ral}
                          title={`${color.ral} (${color.hex})`}
                          aria-label={`${color.ral} ${color.hex}`}
                          className="relative h-16 w-16 overflow-hidden rounded-md border border-neutral-600 shadow-inner"
                          style={{ backgroundColor: color.hex }}
                        >
                          <span
                            className="pointer-events-none absolute bottom-1 right-1 flex flex-col items-end leading-none"
                            style={labelStyle}
                          >
                            <span className="text-[9px] font-semibold tracking-[0.08em]">
                              RAL
                            </span>
                            <span className="text-[11px] font-bold">
                              {getRalCodeDigitsLabel(color.ral)}
                            </span>
                          </span>
                        </span>
                      );
                    })
                  : null}
              </div>
            </div>

            </FormSection>
          ) : null}

          {showTransportSection ? (
            <FormSection
              title={messages.form.logisticsSectionTitle}
            >
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex w-full min-w-0 items-center gap-2 rounded-md border border-neutral-700 bg-neutral-900/70 px-3 py-2 text-sm text-neutral-200">
                <input
                  type="checkbox"
                  {...register("logisticsTransportAvailable", {
                    onChange: (event) => {
                      if (event.target.checked !== true) {
                        setValue("logisticsTransportIncluded", false, {
                          shouldDirty: true,
                          shouldTouch: true,
                        });
                        setValue("logisticsTransportFreeDistanceKm", "", {
                          shouldDirty: true,
                          shouldTouch: true,
                        });
                      }
                    },
                  })}
                  className="h-4 w-4 rounded border-neutral-600 bg-neutral-950 text-[#2f639a] focus:ring-[#4e86c3]"
                />
                <span className="min-w-0 leading-snug">
                  {messages.form.transportAvailableLabel}
                </span>
              </label>
              <label className="flex w-full min-w-0 items-center gap-2 rounded-md border border-neutral-700 bg-neutral-900/70 px-3 py-2 text-sm text-neutral-200">
                <input
                  type="checkbox"
                  {...register("logisticsTransportIncluded", {
                    onChange: (event) => {
                      if (event.target.checked === true) {
                        setValue("logisticsTransportAvailable", true, {
                          shouldDirty: true,
                          shouldTouch: true,
                        });
                      }
                      if (event.target.checked !== true) {
                        setValue("logisticsTransportFreeDistanceKm", "", {
                          shouldDirty: true,
                          shouldTouch: true,
                        });
                      }
                    },
                  })}
                  className="h-4 w-4 rounded border-neutral-600 bg-neutral-950 text-[#2f639a] focus:ring-[#4e86c3]"
                />
                <span className="min-w-0 leading-snug">
                  {messages.form.transportIncludedLabel}
                </span>
              </label>
              <label className="flex w-full min-w-0 items-center gap-2 rounded-md border border-neutral-700 bg-neutral-900/70 px-3 py-2 text-sm text-neutral-200">
                <input
                  type="checkbox"
                  {...register("logisticsUnloadingAvailable", {
                    onChange: (event) => {
                      if (event.target.checked !== true) {
                        setValue("logisticsUnloadingIncluded", false, {
                          shouldDirty: true,
                          shouldTouch: true,
                        });
                      }
                    },
                  })}
                  className="h-4 w-4 rounded border-neutral-600 bg-neutral-950 text-[#2f639a] focus:ring-[#4e86c3]"
                />
                <span className="min-w-0 leading-snug">
                  {messages.form.unloadingAvailableLabel}
                </span>
              </label>
              <label className="flex w-full min-w-0 items-center gap-2 rounded-md border border-neutral-700 bg-neutral-900/70 px-3 py-2 text-sm text-neutral-200">
                <input
                  type="checkbox"
                  {...register("logisticsUnloadingIncluded", {
                    onChange: (event) => {
                      if (event.target.checked === true) {
                        setValue("logisticsUnloadingAvailable", true, {
                          shouldDirty: true,
                          shouldTouch: true,
                        });
                      }
                    },
                  })}
                  className="h-4 w-4 rounded border-neutral-600 bg-neutral-950 text-[#2f639a] focus:ring-[#4e86c3]"
                />
                <span className="min-w-0 leading-snug">
                  {messages.form.unloadingIncludedLabel}
                </span>
              </label>
            </div>

            <label className="grid gap-1 text-sm sm:max-w-xs">
              <span className="text-neutral-700">
                {messages.form.freeTransportDistanceLabel}
              </span>
              <input
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                disabled={!logisticsTransportIncludedValue}
                {...register("logisticsTransportFreeDistanceKm", {
                  validate: (value) => {
                    if (!logisticsTransportIncludedValue) {
                      return true;
                    }
                    const parsed = normalizeOptionalInteger(value);
                    return (
                      (typeof parsed === "number" &&
                        parsed > 0 &&
                        parsed <= 10_000) ||
                      messages.form.transportDistanceRange
                    );
                  },
                })}
                className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
                placeholder={messages.form.transportDistancePlaceholder}
              />
              {errors.logisticsTransportFreeDistanceKm?.message ? (
                <span className="text-xs text-red-700">
                  {errors.logisticsTransportFreeDistanceKm.message}
                </span>
              ) : null}
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-neutral-700">
                {messages.form.logisticsCommentLabel}
              </span>
              <textarea
                rows={3}
                {...register("logisticsComment", {
                  maxLength: {
                    value: 600,
                    message: messages.form.logisticsCommentMaxLength,
                  },
                })}
                className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100"
                placeholder={messages.form.logisticsCommentPlaceholder}
              />
              {errors.logisticsComment?.message ? (
                <span className="text-xs text-red-700">
                  {errors.logisticsComment.message}
                </span>
              ) : null}
            </label>
            </FormSection>
          ) : null}

          {!isCreateMode ? (
            <FormSection
              title={messages.form.contactSectionTitle}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1 text-sm">
                  <span className="text-neutral-700">
                    {messages.form.companyNameLabel} *
                  </span>
                  <input
                    {...register("companyName", companyNameValidation)}
                    disabled={publishedAsCompanyValue}
                    className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 font-medium text-neutral-950 placeholder:text-neutral-400 disabled:cursor-not-allowed disabled:border-neutral-300 disabled:bg-neutral-100 disabled:text-neutral-700"
                  />
                  {errors.companyName?.message ? (
                    <span className="text-xs text-red-700">
                      {errors.companyName.message}
                    </span>
                  ) : null}
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="text-neutral-700">
                    {messages.form.contactEmailLabel} *
                  </span>
                  <input
                    type="email"
                    {...register("contactEmail", contactEmailValidation)}
                    className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 font-medium text-neutral-950 placeholder:text-neutral-400"
                  />
                  {errors.contactEmail?.message ? (
                    <span className="text-xs text-red-700">
                      {errors.contactEmail.message}
                    </span>
                  ) : null}
                </label>
              </div>

              <label className="grid gap-1 text-sm">
                <span className="text-neutral-700">
                  {messages.form.contactPhoneLabel}
                </span>
                <input
                  {...register("contactPhone")}
                  className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 font-medium text-neutral-950 placeholder:text-neutral-400"
                  placeholder={messages.form.contactPhonePlaceholder}
                />
              </label>
            </FormSection>
          ) : null}

          {showCertificationSection ? (
            <FormSection
              title={messages.form.certificationSectionTitle}
            >
            <div className="flex flex-wrap items-start gap-3">
              <div className="flex w-fit flex-col gap-1 text-sm">
                <span className="invisible text-neutral-700" aria-hidden="true">
                  {messages.form.monthLabel}
                </span>
                <label className="inline-flex h-9 w-fit items-center gap-2 rounded-md border border-neutral-700 bg-neutral-900/70 px-3 text-sm text-neutral-200">
                  <input
                    type="checkbox"
                    {...register("hasCscPlate")}
                    className="h-4 w-4 rounded border-neutral-600 bg-neutral-950 text-[#2f639a] focus:ring-[#4e86c3]"
                  />
                  <span>{messages.form.cscPlateLabel}</span>
                </label>
                <span className="min-h-4 text-xs text-transparent" aria-hidden="true">
                  {"\u00A0"}
                </span>
              </div>
              <div className="flex w-fit flex-col gap-1 text-sm">
                <span className="invisible text-neutral-700" aria-hidden="true">
                  {messages.form.monthLabel}
                </span>
                <label className="inline-flex h-9 w-fit items-center gap-2 rounded-md border border-neutral-700 bg-neutral-900/70 px-3 text-sm text-neutral-200">
                  <input
                    type="checkbox"
                    {...register("hasCscCertification")}
                    className="h-4 w-4 rounded border-neutral-600 bg-neutral-950 text-[#2f639a] focus:ring-[#4e86c3]"
                  />
                  <span>{messages.form.cscCertificationLabel}</span>
                </label>
                <span className="min-h-4 text-xs text-transparent" aria-hidden="true">
                  {"\u00A0"}
                </span>
              </div>
              <label className="flex w-fit flex-col gap-1 text-sm">
                <span className="text-neutral-700">{messages.form.monthLabel}</span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  pattern="[0-9]*"
                  {...register("cscValidToMonth", {
                    validate: (value) => {
                      const monthDigits = value.replace(/\D+/g, "");
                      if (monthDigits.length > 2) {
                        return messages.form.monthFormat;
                      }
                      const month = normalizeOptionalInteger(value);
                      const year = normalizeOptionalInteger(
                        watch("cscValidToYear"),
                      );
                      if (month === undefined && year === undefined) {
                        return true;
                      }
                      return (
                        (typeof month === "number" &&
                          month >= 1 &&
                          month <= 12) ||
                        messages.form.monthRange
                      );
                    },
                  })}
                  onInput={(event) => {
                    const target = event.currentTarget;
                    const digitsOnly = target.value.replace(/\D+/g, "");
                    const nextValue = digitsOnly.slice(0, 2);
                    if (target.value !== nextValue) {
                      target.value = nextValue;
                    }
                  }}
                  className="w-[90px] rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100"
                  placeholder="MM"
                />
                <span
                  className={`min-h-4 text-xs ${
                    errors.cscValidToMonth?.message
                      ? "text-red-700"
                      : "text-transparent"
                  }`}
                  aria-live="polite"
                >
                  {errors.cscValidToMonth?.message ?? "\u00A0"}
                </span>
              </label>
              <label className="flex w-fit flex-col gap-1 text-sm">
                <span className="text-neutral-700">{messages.form.yearLabel}</span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  pattern="[0-9]*"
                  {...register("cscValidToYear", {
                    validate: (value) => {
                      const yearDigits = value.replace(/\D+/g, "");
                      if (yearDigits.length > 4) {
                        return messages.form.yearFormat;
                      }
                      const year = normalizeOptionalInteger(value);
                      const month = normalizeOptionalInteger(
                        watch("cscValidToMonth"),
                      );
                      if (month === undefined && year === undefined) {
                        return true;
                      }
                      return (
                        (typeof year === "number" &&
                          year >= 1900 &&
                          year <= 2100) ||
                        messages.form.yearValid
                      );
                    },
                  })}
                  onInput={(event) => {
                    const target = event.currentTarget;
                    const digitsOnly = target.value.replace(/\D+/g, "");
                    const nextValue = digitsOnly.slice(0, 4);
                    if (target.value !== nextValue) {
                      target.value = nextValue;
                    }
                  }}
                  className="w-[110px] rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100"
                  placeholder="RRRR"
                />
                <span
                  className={`min-h-4 text-xs ${
                    errors.cscValidToYear?.message
                      ? "text-red-700"
                      : "text-transparent"
                  }`}
                  aria-live="polite"
                >
                  {errors.cscValidToYear?.message ?? "\u00A0"}
                </span>
              </label>
            </div>
            <label className="inline-flex h-9 w-fit items-center gap-2 rounded-md border border-neutral-700 bg-neutral-900/70 px-3 text-sm text-neutral-200">
              <input
                type="checkbox"
                {...register("hasWarranty")}
                className="h-4 w-4 rounded border-neutral-600 bg-neutral-950 text-[#2f639a] focus:ring-[#4e86c3]"
              />
              <span>{messages.form.warrantyLabel}</span>
            </label>
            </FormSection>
          ) : null}

          {canManageListingPhotos && showAdditionalPhotosSection ? (
            <section className="grid gap-4 rounded-lg border border-neutral-300 bg-neutral-50/95 p-3">
            <div className="grid gap-2">
              <ImageDropzone
                title={formatTemplate(messages.form.additionalPhotosTitle, {
                  count: MAX_CONTAINER_PHOTOS,
                })}
                hintText={formatTemplate(messages.form.photoHint, {
                  count: MAX_CONTAINER_PHOTO_MB,
                })}
                variant="light"
                onFilesAdded={(files) => {
                  void handleAdditionalPhotoFilesAdded(files);
                }}
              />
              {isProcessingImages ? (
                <p className="text-xs text-neutral-600">
                  {messages.form.processingPhotos}
                </p>
              ) : null}
            </div>

            {additionalInitialPhotoIndexes.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {additionalInitialPhotoIndexes.map((index) => {
                  const url = stableInitialPhotoUrls[index];
                  if (!url) {
                    return null;
                  }

                  return (
                    <div
                      key={`initial-container-photo-${index + 1}`}
                      className="group relative rounded-md border border-neutral-700 bg-neutral-900 p-1"
                    >
                      <button
                        type="button"
                        className="flex h-28 w-full cursor-pointer items-center justify-center overflow-hidden rounded-sm"
                        onClick={() => {
                          setKeptInitialPhotoIndexes((prev) =>
                            prev.filter((value) => value !== index),
                          );
                        }}
                        title={messages.form.removePhoto}
                      >
                        <img
                          src={url}
                          alt={messages.form.photoPreviewAlt}
                          className="max-h-24 w-auto max-w-full object-contain transition-transform duration-300 ease-out group-hover:scale-105"
                        />
                      </button>
                      <button
                        type="button"
                        className="absolute right-1 top-1 cursor-pointer rounded-full bg-black/70 px-2 py-0.5 text-xs text-white opacity-90"
                        onClick={() => {
                          setKeptInitialPhotoIndexes((prev) =>
                            prev.filter((value) => value !== index),
                          );
                        }}
                        title={messages.form.removePhoto}
                        aria-label={messages.form.removePhoto}
                      >
                        x
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {photoItems.length > 0 ? (
              <ImageGrid
                items={photoItems}
                onRemove={(id) => {
                  setPhotoItems((prev) => removeImageItem(prev, id));
                }}
                removeLabel={messages.form.removePhoto}
                previewAlt={messages.form.photoPreviewAlt}
              />
            ) : null}
            </section>
          ) : null}

          {(!showDescriptionSection ||
            !showTransportSection ||
            !showCertificationSection ||
            (canManageListingPhotos && !showAdditionalPhotosSection)) ? (
            <section className="mx-auto grid w-full max-w-3xl gap-2 sm:grid-cols-2">
              {!showDescriptionSection ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowDescriptionSection(true);
                  }}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-sky-400 bg-sky-100/70 px-4 text-sm font-semibold text-sky-900 shadow-[0_0_0_1px_rgba(56,189,248,0.15)] transition hover:-translate-y-0.5 hover:border-sky-500 hover:bg-sky-100"
                >
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-bold text-sky-700">
                    +
                  </span>
                  <span>{messages.form.addDescriptionSection}</span>
                </button>
              ) : null}
              {!showTransportSection ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowTransportSection(true);
                  }}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-sky-400 bg-sky-100/70 px-4 text-sm font-semibold text-sky-900 shadow-[0_0_0_1px_rgba(56,189,248,0.15)] transition hover:-translate-y-0.5 hover:border-sky-500 hover:bg-sky-100"
                >
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-bold text-sky-700">
                    +
                  </span>
                  <span>{messages.form.addTransportSection}</span>
                </button>
              ) : null}
              {!showCertificationSection ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowCertificationSection(true);
                  }}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-sky-400 bg-sky-100/70 px-4 text-sm font-semibold text-sky-900 shadow-[0_0_0_1px_rgba(56,189,248,0.15)] transition hover:-translate-y-0.5 hover:border-sky-500 hover:bg-sky-100"
                >
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-bold text-sky-700">
                    +
                  </span>
                  <span>{messages.form.addCertificationSection}</span>
                </button>
              ) : null}
              {canManageListingPhotos && !showAdditionalPhotosSection ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowAdditionalPhotosSection(true);
                  }}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-sky-400 bg-sky-100/70 px-4 text-sm font-semibold text-sky-900 shadow-[0_0_0_1px_rgba(56,189,248,0.15)] transition hover:-translate-y-0.5 hover:border-sky-500 hover:bg-sky-100"
                >
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-bold text-sky-700">
                    +
                  </span>
                  <span>{messages.form.addPhotosSection}</span>
                </button>
              ) : null}
            </section>
          ) : null}

          {canManageListingPhotos && coverPhotoCrop ? (
            <ImageCropModal
              title={messages.form.cropTitle}
              previewAlt={messages.form.cropPreviewAlt}
              previewFrameClassName="mx-auto aspect-square w-full max-w-sm p-0"
              previewClassName="h-full w-full object-cover"
              labels={{
                hint: messages.form.cropHint,
                zoom: messages.form.cropZoom,
                offsetX: messages.form.cropOffsetX,
                offsetY: messages.form.cropOffsetY,
                apply: messages.shared.apply,
                cancel: messages.shared.cancel,
              }}
              state={coverPhotoCrop}
              setState={setCoverPhotoCrop}
              onApply={handleApplyCoverPhotoCrop}
              onCancel={handleCancelCoverPhotoCrop}
            />
          ) : null}

          {isLocationModalOpen ? (
            <div
              className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-[rgba(2,6,23,0.55)] p-4 backdrop-blur-[2px]"
              role="dialog"
              aria-modal="true"
              aria-label={messages.form.locationModalAria}
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  setIsLocationModalOpen(false);
                }
              }}
            >
              <div className="w-full max-w-5xl rounded-xl border border-neutral-700 bg-neutral-900 p-4 shadow-2xl">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-base font-semibold text-neutral-100">
                    {messages.form.locationModalTitle}
                  </h3>
                  <button
                    type="button"
                    className="rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-300 transition hover:border-neutral-500"
                    onClick={() => {
                      setIsLocationModalOpen(false);
                    }}
                  >
                    {messages.shared.close}
                  </button>
                </div>

                <div className="grid max-h-[calc(100dvh-11rem)] gap-3 overflow-y-auto pr-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs text-neutral-400">
                      <p>
                        {messages.form.locationModalHint}
                      </p>
                      <p className="mt-1 text-neutral-500">
                        {formatTemplate(messages.form.maxLocations, {
                          count: MAX_LISTING_LOCATIONS,
                        })}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {hasCompanyLocationPrefill ? (
                        <CompanyLocationPrefillDropdown
                          options={resolvedCompanyLocationPrefillOptions}
                          onApply={handleApplyCompanyLocation}
                          onClear={handleClearLocations}
                          variant="light"
                          messages={messages.shared}
                        />
                      ) : null}
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <div className="rounded-md border border-neutral-700 bg-neutral-900/60 p-2">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-medium text-neutral-300">
                            {formatTemplate(messages.shared.locationLabelTemplate, { index: 1 })}
                          </p>
                          {activeMapLocationId === PRIMARY_LOCATION_MAP_ID ? (
                            <span className="inline-flex items-center rounded border border-neutral-300 bg-white px-2 py-0.5 text-xs text-neutral-700">
                              {messages.form.currentlyEditing}
                            </span>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMapLocationId(PRIMARY_LOCATION_MAP_ID);
                            }}
                            className="rounded border border-neutral-600 px-2 py-0.5 text-xs text-neutral-300 transition hover:border-neutral-500 hover:bg-neutral-800 hover:text-white"
                          >
                            {messages.form.editOnMap}
                          </button>
                          <button
                            type="button"
                            onClick={handleRemovePrimaryLocation}
                            className="rounded border border-neutral-600 px-2 py-0.5 text-xs text-neutral-300 transition hover:border-neutral-500 hover:bg-neutral-800 hover:text-white"
                          >
                            {messages.shared.remove}
                          </button>
                        </div>
                      </div>
                      <div className="flex overflow-hidden rounded-md border border-neutral-700 bg-neutral-950">
                        <div className="relative flex-1">
                          <input
                            type="text"
                            value={locationSearch}
                            onChange={(event) =>
                              setLocationSearch(event.target.value)
                            }
                            onFocus={() => {
                              setActiveMapLocationId(PRIMARY_LOCATION_MAP_ID);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                void handleSearchLocation();
                              }
                            }}
                            className="w-full border-0 bg-transparent px-3 py-2 pr-9 text-sm text-neutral-100"
                            placeholder={messages.form.locationSearchPlaceholder}
                          />
                          {isLocationBusy ? (
                            <span
                              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2"
                              aria-hidden="true"
                            >
                              <span className="block h-4 w-4 animate-spin rounded-full border-2 border-neutral-500 border-t-[#4e86c3]" />
                            </span>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            void handleSearchLocation();
                          }}
                          disabled={isLocationBusy || isSubmitting}
                          className="border-l border-[#2f639a] bg-[linear-gradient(180deg,#082650_0%,#0c3466_100%)] px-4 py-2 text-sm font-medium text-[#e2efff] transition hover:bg-[#0f3f75] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {messages.form.searchLocation}
                        </button>
                      </div>
                      {primaryLocationDisplay.postalCode ||
                      primaryLocationDisplay.rest ? (
                        <div className="mt-2 flex items-center gap-1 text-xs text-neutral-500">
                          <LocationFlag
                            country={primaryLocationDisplay.country}
                            className="shrink-0"
                          />
                          <span className="min-w-0">
                            {primaryLocationDisplay.postalCode ? (
                              <strong className="font-semibold text-neutral-300">
                                {primaryLocationDisplay.postalCode}
                              </strong>
                            ) : null}
                            {primaryLocationDisplay.postalCode &&
                            primaryLocationDisplay.rest
                              ? " "
                              : null}
                            {primaryLocationDisplay.rest}
                          </span>
                        </div>
                      ) : null}
                    </div>

                    {additionalLocations.map((location, index) => (
                      <div
                        key={location.id}
                        className="rounded-md border border-neutral-700 bg-neutral-900/60 p-2"
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-medium text-neutral-300">
                              {formatTemplate(messages.shared.locationLabelTemplate, {
                                index: index + 2,
                              })}
                            </p>
                            {activeMapLocationId === location.id ? (
                              <span className="inline-flex items-center rounded border border-neutral-300 bg-white px-2 py-0.5 text-xs text-neutral-700">
                                {messages.form.currentlyEditing}
                              </span>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMapLocationId(location.id);
                              }}
                              className="rounded border border-neutral-600 px-2 py-0.5 text-xs text-neutral-300 transition hover:border-neutral-500 hover:bg-neutral-800 hover:text-white"
                            >
                              {messages.form.editOnMap}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                handleRemoveAdditionalLocation(location.id);
                              }}
                              className="rounded border border-neutral-600 px-2 py-0.5 text-xs text-neutral-300 transition hover:border-neutral-500 hover:bg-neutral-800 hover:text-white"
                            >
                              {messages.shared.remove}
                            </button>
                          </div>
                        </div>
                        <div className="flex overflow-hidden rounded-md border border-neutral-700 bg-neutral-950">
                          <div className="relative flex-1">
                            <input
                              type="text"
                              value={location.search}
                              onChange={(event) => {
                                handleUpdateAdditionalLocationSearch(
                                  location.id,
                                  event.target.value,
                                );
                              }}
                              onFocus={() => {
                                setActiveMapLocationId(location.id);
                              }}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  void handleSearchAdditionalLocation(
                                    location.id,
                                  );
                                }
                              }}
                              className="w-full border-0 bg-transparent px-3 py-2 pr-9 text-sm text-neutral-100"
                              placeholder={messages.form.locationSearchPlaceholder}
                            />
                            {location.isSearching ? (
                              <span
                                className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2"
                                aria-hidden="true"
                              >
                                <span className="block h-4 w-4 animate-spin rounded-full border-2 border-neutral-500 border-t-[#4e86c3]" />
                              </span>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              void handleSearchAdditionalLocation(location.id);
                            }}
                            disabled={location.isSearching || isSubmitting}
                            className="border-l border-[#2f639a] bg-[linear-gradient(180deg,#082650_0%,#0c3466_100%)] px-4 py-2 text-sm font-medium text-[#e2efff] transition hover:bg-[#0f3f75] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {messages.form.searchLocation}
                          </button>
                        </div>
                        {(() => {
                          const locationDisplay = buildLocationDisplay({
                            parts: location.locationAddressParts,
                            fallbackLabel:
                              location.locationAddressLabel || location.search,
                          });
                          if (
                            !locationDisplay.postalCode &&
                            !locationDisplay.rest
                          ) {
                            return null;
                          }
                          return (
                            <div className="mt-2 flex items-center gap-1 text-xs text-neutral-500">
                              <LocationFlag
                                country={locationDisplay.country}
                                className="shrink-0"
                              />
                              <span className="min-w-0">
                                {locationDisplay.postalCode ? (
                                  <strong className="font-semibold text-neutral-300">
                                    {locationDisplay.postalCode}
                                  </strong>
                                ) : null}
                                {locationDisplay.postalCode &&
                                locationDisplay.rest
                                  ? " "
                                  : null}
                                {locationDisplay.rest}
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                    ))}

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleAddAdditionalLocation}
                        disabled={
                          additionalLocations.length >=
                            MAX_ADDITIONAL_LOCATIONS || isSubmitting
                        }
                        className="inline-flex h-9 items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <span>{messages.form.addNextLocation}</span>
                        <span aria-hidden="true" className="text-sm leading-none">
                          +
                        </span>
                      </button>
                    </div>
                  </div>

                  <MapLocationPicker
                    points={locationMapPoints}
                    activePointId={activeMapLocationId}
                    labels={{
                      hint: formatTemplate(messages.form.mapHint, {
                        label: activeMapLocationLabel,
                      }),
                    }}
                    mapClassName="h-72"
                    onActivePointChange={(id) => {
                      setActiveMapLocationId(id);
                    }}
                    onPointChange={(id, next) => {
                      void handleSharedMapPointChange(id, next);
                    }}
                  />
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    className="rounded-md bg-gradient-to-r from-rose-500 to-fuchsia-500 px-3 py-2 text-sm font-semibold text-white transition hover:brightness-110"
                    onClick={() => {
                      setIsLocationModalOpen(false);
                    }}
                  >
                    {messages.form.saveAndClose}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <div
            ref={inlineSubmitContainerRef}
            className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-800 pt-4"
          >
            <Link
              href={backHref}
              className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-200 hover:border-neutral-500"
            >
              {backLabel}
            </Link>
            <button
              type="submit"
              disabled={isSubmitting || isProcessingImages}
              className={
                isSubmitReady
                  ? createSubmitButtonClass
                  : createSubmitInactiveButtonClass
              }
              aria-disabled={!isSubmitReady ? true : undefined}
            >
              {isSubmitting || isProcessingImages
                ? messages.shared.saving
                : submitLabel}
            </button>
          </div>

          <ContactPublishModal
            isOpen={isCreateMode && isContactModalOpen}
            hasOwnedCompanyProfile={hasOwnedCompanyProfile}
            onClose={() => {
              setIsContactModalOpen(false);
            }}
            submitLabel={submitLabel}
            isSubmitting={isSubmitting}
            isProcessingImages={isProcessingImages}
            isCreatePublishReady={isCreatePublishReady}
            createSubmitButtonClass={createSubmitButtonClass}
            createSubmitInactiveButtonClass={createSubmitInactiveButtonClass}
            onConfirm={() => {
              void handleSubmit(onSubmit, (invalidFields) => {
                const hasContactErrors = Boolean(
                  invalidFields.companyName ||
                    invalidFields.contactEmail ||
                    invalidFields.contactPhone,
                );
                if (!hasContactErrors) {
                  setIsContactModalOpen(false);
                }
              })();
            }}
            publishAsCompanyToggle={
              <label className="inline-flex h-9 w-fit items-center gap-2 rounded-md border border-neutral-700 bg-neutral-900/70 px-3 text-sm text-neutral-200">
                <input
                  type="checkbox"
                  {...register("publishedAsCompany")}
                  className="h-4 w-4 rounded border-neutral-600 bg-neutral-950 text-[#2f639a] focus:ring-[#4e86c3]"
                />
                <span>{messages.form.publishAsCompany}</span>
              </label>
            }
            companyNameField={
              <label className="grid gap-1 text-sm">
                <span className="text-neutral-300">
                  {messages.form.companyNameLabel} *
                </span>
                <input
                  autoComplete="organization"
                  {...register("companyName", companyNameValidation)}
                  disabled={publishedAsCompanyValue}
                  className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 font-medium text-neutral-950 placeholder:text-neutral-400 disabled:cursor-not-allowed disabled:border-neutral-300 disabled:bg-neutral-100 disabled:text-neutral-700"
                />
                {errors.companyName?.message ? (
                  <span className="text-xs text-red-700">
                    {errors.companyName.message}
                  </span>
                ) : null}
              </label>
            }
            contactEmailField={
              <label className="grid gap-1 text-sm">
                <span className="text-neutral-300">
                  {messages.form.contactEmailLabel} *
                </span>
                <input
                  type="email"
                  autoComplete="email"
                  {...register("contactEmail", contactEmailValidation)}
                  className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 font-medium text-neutral-950 placeholder:text-neutral-400"
                />
                {errors.contactEmail?.message ? (
                  <span className="text-xs text-red-700">
                    {errors.contactEmail.message}
                  </span>
                ) : null}
              </label>
            }
            contactPhoneField={
              <label className="grid gap-1 text-sm">
                <span className="text-neutral-300">
                  {messages.form.contactPhoneLabel}
                </span>
                <input
                  type="tel"
                  autoComplete="tel"
                  {...register("contactPhone")}
                  className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 font-medium text-neutral-950 placeholder:text-neutral-400"
                  placeholder={messages.form.contactPhonePlaceholder}
                />
              </label>
            }
            messages={messages.dialogs}
          />

          <PublishSuccessModal
            isOpen={isCreateMode && isPublishSuccessModalOpen}
            onClose={() => {
              setIsPublishSuccessModalOpen(false);
            }}
            onGoToMine={() => {
              setIsPublishSuccessModalOpen(false);
              router.push("/containers/mine");
              router.refresh();
            }}
            messages={messages.dialogs}
          />

          {shouldShowStickySubmit ? (
            <div className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-800 bg-neutral-950/92 backdrop-blur">
              <div className="mx-auto flex w-full max-w-5xl items-center justify-end px-4 py-3 sm:px-6">
                <button
                  type="submit"
                  disabled={isSubmitting || isProcessingImages}
                  className={
                    isSubmitReady
                      ? createSubmitButtonClass
                      : createSubmitInactiveButtonClass
                  }
                  aria-disabled={!isSubmitReady ? true : undefined}
                >
                  {isSubmitting || isProcessingImages
                    ? messages.shared.saving
                    : submitLabel}
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </form>
  );
}




