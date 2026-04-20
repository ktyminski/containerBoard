import { ObjectId } from "mongodb";
import type {
  Container,
  ContainerFeature,
  ListingPrice,
  ListingType,
} from "@/lib/container-listing-types";
import type {
  ContainerListingDocument,
  ContainerListingImageAsset,
} from "@/lib/container-listings";
import { getDefaultListingExpiration } from "@/lib/container-listings";
import type { ListingLocation } from "@/lib/listing-locations";
import type { ContainerRalColor } from "@/lib/container-ral-colors";

export function normalizeOptionalString(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function resolveAvailableFromDate(input: {
  availableNow?: boolean;
  availableFrom?: Date;
  now: Date;
}) {
  if (input.availableNow) {
    return input.now;
  }

  if (
    input.availableFrom instanceof Date &&
    Number.isFinite(input.availableFrom.getTime())
  ) {
    return input.availableFrom;
  }

  return input.now;
}

type ListingWritePersistenceInput = {
  type: ListingType;
  container: Container;
  parsedContainerColors?: ContainerRalColor[];
  photos?: ContainerListingImageAsset[];
  quantity: number;
  normalizedLocations: ListingLocation[];
  availableNow: boolean;
  availableFromApproximate: boolean;
  resolvedAvailableFrom: Date;
  normalizedPricing?: ListingPrice | null;
  normalizedPriceAmount?: number;
  normalizedPrice?: string;
  priceNegotiable?: boolean;
  logisticsTransportAvailable: boolean;
  logisticsTransportIncluded: boolean;
  normalizedLogisticsTransportFreeDistanceKm?: number;
  logisticsUnloadingAvailable: boolean;
  logisticsUnloadingIncluded: boolean;
  normalizedLogisticsComment?: string;
  hasCscPlate: boolean;
  hasCscCertification: boolean;
  hasBranding: boolean;
  hasWarranty: boolean;
  normalizedCscValidToMonth?: number;
  normalizedCscValidToYear?: number;
  productionYear?: number;
  normalizedDescription?: string;
  companyName: string;
  companySlug?: string;
  publishedAsCompany: boolean;
  contactEmail: string;
  contactPhone?: string;
};

function normalizeContainerFeatures(input: ContainerFeature[]) {
  return Array.from(new Set(input));
}

function buildListingResolvedOptionalValues(
  input: ListingWritePersistenceInput,
) {
  const primaryLocation = input.normalizedLocations[0];
  if (!primaryLocation) {
    throw new Error("At least one normalized location is required");
  }

  const resolvedPriceAmount =
    input.normalizedPriceAmount ??
    (typeof input.normalizedPricing?.original.amount === "number"
      ? input.normalizedPricing.original.amount
      : undefined);
  const resolvedPrice =
    input.normalizedPrice ??
    (resolvedPriceAmount !== undefined ? String(resolvedPriceAmount) : undefined);

  return {
    primaryLocation,
    resolvedPriceAmount,
    resolvedPrice,
    resolvedPriceNegotiable:
      input.normalizedPricing?.original.negotiable === true ||
      input.priceNegotiable === true,
  };
}

export function buildListingPersistenceFields(
  input: ListingWritePersistenceInput,
) {
  const {
    primaryLocation,
    resolvedPriceAmount,
    resolvedPrice,
    resolvedPriceNegotiable,
  } = buildListingResolvedOptionalValues(input);

  const setFields: Partial<ContainerListingDocument> = {
    type: input.type,
    container: {
      ...input.container,
      features: normalizeContainerFeatures(input.container.features),
    },
    quantity: input.quantity,
    locationCity: primaryLocation.locationCity,
    locationCountry: primaryLocation.locationCountry,
    locationCountryCode: primaryLocation.locationCountryCode,
    locationLat: primaryLocation.locationLat,
    locationLng: primaryLocation.locationLng,
    locations: input.normalizedLocations,
    availableNow: input.availableNow,
    availableFromApproximate: input.availableNow
      ? false
      : input.availableFromApproximate,
    availableFrom: input.resolvedAvailableFrom,
    priceNegotiable: resolvedPriceNegotiable,
    logisticsTransportAvailable: input.logisticsTransportAvailable,
    logisticsTransportIncluded:
      input.logisticsTransportAvailable && input.logisticsTransportIncluded,
    logisticsUnloadingAvailable: input.logisticsUnloadingAvailable,
    logisticsUnloadingIncluded:
      input.logisticsUnloadingAvailable && input.logisticsUnloadingIncluded,
    hasCscPlate: input.hasCscPlate,
    hasCscCertification: input.hasCscCertification,
    hasBranding: input.hasBranding,
    hasWarranty: input.hasWarranty,
    companyName: input.companyName,
    publishedAsCompany: input.publishedAsCompany,
    contactEmail: input.contactEmail,
  };
  const unsetFields: Record<string, 1> = {};

  if (primaryLocation.locationAddressLabel) {
    setFields.locationAddressLabel = primaryLocation.locationAddressLabel;
  } else {
    unsetFields.locationAddressLabel = 1;
  }

  if (!primaryLocation.locationCountryCode) {
    unsetFields.locationCountryCode = 1;
  }

  if (primaryLocation.locationAddressParts) {
    setFields.locationAddressParts = primaryLocation.locationAddressParts;
  } else {
    unsetFields.locationAddressParts = 1;
  }

  if (input.parsedContainerColors && input.parsedContainerColors.length > 0) {
    setFields.containerColors = input.parsedContainerColors;
  } else {
    unsetFields.containerColors = 1;
  }

  if (input.photos && input.photos.length > 0) {
    setFields.photos = input.photos;
  }

  if (input.normalizedPricing) {
    setFields.pricing = input.normalizedPricing;
  } else {
    unsetFields.pricing = 1;
  }

  if (resolvedPriceAmount !== undefined) {
    setFields.priceAmount = resolvedPriceAmount;
  } else {
    unsetFields.priceAmount = 1;
  }

  if (resolvedPrice) {
    setFields.price = resolvedPrice;
  } else {
    unsetFields.price = 1;
  }

  if (input.normalizedLogisticsTransportFreeDistanceKm !== undefined) {
    setFields.logisticsTransportFreeDistanceKm =
      input.normalizedLogisticsTransportFreeDistanceKm;
  } else {
    unsetFields.logisticsTransportFreeDistanceKm = 1;
  }

  if (input.normalizedLogisticsComment) {
    setFields.logisticsComment = input.normalizedLogisticsComment;
  } else {
    unsetFields.logisticsComment = 1;
  }

  if (
    input.normalizedCscValidToMonth !== undefined &&
    input.normalizedCscValidToYear !== undefined
  ) {
    setFields.cscValidToMonth = input.normalizedCscValidToMonth;
    setFields.cscValidToYear = input.normalizedCscValidToYear;
  } else {
    unsetFields.cscValidToMonth = 1;
    unsetFields.cscValidToYear = 1;
  }

  if (typeof input.productionYear === "number") {
    setFields.productionYear = input.productionYear;
  } else {
    unsetFields.productionYear = 1;
  }

  if (input.normalizedDescription) {
    setFields.description = input.normalizedDescription;
  } else {
    unsetFields.description = 1;
  }

  if (input.companySlug) {
    setFields.companySlug = input.companySlug;
  } else {
    unsetFields.companySlug = 1;
  }

  if (input.contactPhone) {
    setFields.contactPhone = input.contactPhone;
  } else {
    unsetFields.contactPhone = 1;
  }

  return {
    setFields,
    unsetFields,
  };
}

export function buildContainerListingDocument(
  input: ListingWritePersistenceInput & {
    listingId?: ObjectId;
    createdByUserId: ObjectId;
    status: ContainerListingDocument["status"];
    now: Date;
  },
): ContainerListingDocument {
  const { setFields } = buildListingPersistenceFields(input);
  const listingId = input.listingId ?? new ObjectId();

  return {
    _id: listingId,
    ...setFields,
    status: input.status,
    createdByUserId: input.createdByUserId,
    createdAt: input.now,
    updatedAt: input.now,
    expiresAt: getDefaultListingExpiration(input.now),
  } as ContainerListingDocument;
}
