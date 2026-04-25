import { z } from "zod";
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
} from "@/lib/container-listing-types";

export const locationAddressPartsSchema = z.object({
  street: z.string().trim().min(1).max(120).optional(),
  houseNumber: z.string().trim().min(1).max(40).optional(),
  postalCode: z.string().trim().min(1).max(40).optional(),
  city: z.string().trim().min(1).max(120).optional(),
  country: z.string().trim().min(1).max(120).optional(),
});

export const listingLocationSchema = z.object({
  locationLat: z.coerce.number().finite().min(-90).max(90),
  locationLng: z.coerce.number().finite().min(-180).max(180),
  locationCity: z.string().trim().max(120).optional(),
  locationCountry: z.string().trim().max(120).optional(),
  locationCountryCode: z.string().trim().length(2).optional(),
  locationAddressLabel: z.string().trim().max(250).optional(),
  locationAddressParts: locationAddressPartsSchema.optional(),
  isPrimary: z.coerce.boolean().optional(),
});

const pricingOriginalSchema = z.object({
  amount: z.coerce.number().int().nonnegative().max(100_000_000).nullable(),
  currency: z.enum(PRICE_CURRENCIES).nullable(),
  taxMode: z.enum(PRICE_TAX_MODES).nullable(),
  vatRate: z.coerce.number().finite().min(0).max(100).nullable(),
  negotiable: z.coerce.boolean(),
});

export const pricingPayloadSchema = z
  .object({
    original: pricingOriginalSchema,
  })
  .superRefine((value, context) => {
    if (value.original.amount === null) {
      if (value.original.currency !== null) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["original", "currency"],
          message: "Currency must be empty when amount is not set",
        });
      }
      if (value.original.taxMode !== null) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["original", "taxMode"],
          message: "Tax mode must be empty when amount is not set",
        });
      }
      if (value.original.vatRate !== null) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["original", "vatRate"],
          message: "VAT rate must be empty when amount is not set",
        });
      }
      return;
    }

    if (value.original.currency === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["original", "currency"],
        message: "Currency is required when amount is set",
      });
    }
    if (value.original.taxMode === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["original", "taxMode"],
        message: "Tax mode is required when amount is set",
      });
    }
  });

export const listingTypeInputSchema = z.enum(LISTING_TYPES);

const listingWriteBaseObjectSchema = z.object({
  type: listingTypeInputSchema,
  container: z.object({
    size: z.coerce.number().int().refine((value) => {
      return (
        value === CONTAINER_SIZE.CUSTOM ||
        CONTAINER_SIZES.includes(value as (typeof CONTAINER_SIZES)[number])
      );
    }),
    height: z.enum(CONTAINER_HEIGHTS),
    type: z.enum(CONTAINER_TYPES),
    features: z.array(z.enum(CONTAINER_FEATURES)).default([]),
    condition: z.enum(CONTAINER_CONDITIONS),
  }),
  quantity: z.coerce.number().int().min(1).max(100_000),
  locationLat: z.coerce.number().finite().min(-90).max(90).optional(),
  locationLng: z.coerce.number().finite().min(-180).max(180).optional(),
  locationAddressLabel: z.string().trim().max(250).optional(),
  locationAddressParts: locationAddressPartsSchema.optional(),
  locations: z
    .array(listingLocationSchema)
    .min(1)
    .max(MAX_LISTING_LOCATIONS)
    .optional(),
  availableNow: z.coerce.boolean().optional(),
  availableFromApproximate: z.coerce.boolean().optional(),
  availableFrom: z.coerce.date().optional(),
  pricing: pricingPayloadSchema.optional(),
  priceAmount: z.coerce.number().int().nonnegative().max(100_000_000).optional(),
  priceNegotiable: z.coerce.boolean().optional(),
  logisticsTransportAvailable: z.coerce.boolean().optional(),
  logisticsTransportIncluded: z.coerce.boolean().optional(),
  logisticsTransportFreeDistanceKm: z.coerce.number().int().min(1).max(10_000).optional(),
  logisticsUnloadingAvailable: z.coerce.boolean().optional(),
  logisticsUnloadingIncluded: z.coerce.boolean().optional(),
  logisticsComment: z.string().trim().max(600).optional(),
  hasCscPlate: z.coerce.boolean().optional(),
  hasCscCertification: z.coerce.boolean().optional(),
  hasBranding: z.coerce.boolean().optional(),
  hasWarranty: z.coerce.boolean().optional(),
  cscValidToMonth: z.coerce.number().int().min(1).max(12).optional(),
  cscValidToYear: z.coerce.number().int().min(1900).max(2100).optional(),
  productionYear: z.coerce.number().int().min(1900).max(2100).optional(),
  containerColorsRal: z.string().trim().max(320).optional(),
  price: z.string().trim().max(100).optional(),
  description: z.string().trim().max(16_000).optional(),
  companyName: z.string().trim().min(2).max(160),
  publishedAsCompany: z.coerce.boolean().optional(),
  adminCompanyId: z.string().trim().regex(/^[a-f0-9]{24}$/i).optional(),
  contactEmail: z.email().trim().max(160),
  contactPhone: z.string().trim().max(40).optional(),
});

function withListingWriteRefinements<T extends z.ZodTypeAny>(schema: T) {
  return schema.superRefine((value, context) => {
    const candidate = value as {
      locationLat?: number;
      locationLng?: number;
      locations?: unknown[];
      availableNow?: boolean;
      availableFrom?: Date;
      logisticsTransportIncluded?: boolean;
      logisticsTransportFreeDistanceKm?: number;
      cscValidToMonth?: number;
      cscValidToYear?: number;
    };

    const hasLegacyLocation =
      typeof candidate.locationLat === "number" &&
      Number.isFinite(candidate.locationLat) &&
      typeof candidate.locationLng === "number" &&
      Number.isFinite(candidate.locationLng);
    const hasLocations =
      Array.isArray(candidate.locations) && candidate.locations.length > 0;

    if (!hasLegacyLocation && !hasLocations) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["locations"],
        message: "At least one location is required",
      });
    }

    if (candidate.availableNow !== true && !candidate.availableFrom) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["availableFrom"],
        message: "availableFrom is required when availableNow is false",
      });
    }

    if (
      candidate.logisticsTransportIncluded === true &&
      typeof candidate.logisticsTransportFreeDistanceKm !== "number"
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["logisticsTransportFreeDistanceKm"],
        message: "logisticsTransportFreeDistanceKm is required when transport is included",
      });
    }

    const hasCscValidityMonth =
      typeof candidate.cscValidToMonth === "number";
    const hasCscValidityYear =
      typeof candidate.cscValidToYear === "number";
    if (hasCscValidityMonth !== hasCscValidityYear) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cscValidToMonth"],
        message: "cscValidToMonth and cscValidToYear must be provided together",
      });
    }
  });
}

export const createListingSchema = withListingWriteRefinements(
  listingWriteBaseObjectSchema,
);

export const updateListingSchema = withListingWriteRefinements(
  listingWriteBaseObjectSchema.extend({
    action: z.literal("update"),
    reactivateOnSave: z.coerce.boolean().optional(),
  }),
);
