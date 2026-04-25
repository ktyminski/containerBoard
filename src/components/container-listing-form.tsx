"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  ContactPublishModal,
  PublishSuccessModal,
} from "@/components/container-listing-form-dialogs";
import {
  CompanyLocationPrefillDropdown,
  ContainerFeaturesMultiSelect,
  FormSection,
  LocationFlag,
} from "@/components/container-listing-form-parts";
import {
  CREATE_FLOW_PRECHECK_FIELDS,
  MAX_ADDITIONAL_LOCATIONS,
  MAX_CONTAINER_PHOTO_MB,
  MAX_CONTAINER_PHOTOS,
  PRIMARY_LOCATION_MAP_ID,
  buildLocationDisplay,
  getContainerLogoPlaceholderSrc,
  getDefaultValues,
  getListingIntentFromType,
  getRalCodeDigitsLabel,
  getRalPreviewLabelStyle,
  hasInitialCertificationSectionContent,
  hasInitialDescriptionSectionContent,
  hasInitialTransportSectionContent,
  isCreateFormReadyToPublish,
  isStandardContainerSize,
  mapListingIntentToType,
  normalizeContainerFeatures,
  normalizeOptionalInteger,
  normalizeOptionalNumber,
  normalizeOptionalRichText,
  normalizeOptionalText,
  parseCoordinate,
  validateContainerRalColorsInput,
  type AdditionalLocationInitialValue,
  type CompanyLocationPrefillOption,
  type ContainerListingFormValues,
  type ListingIntent,
} from "@/components/container-listing-form-shared";
import { type ContainerModuleMessages } from "@/components/container-modules-i18n";
import {
  getContainerConditionOptions,
  getContainerHeightOptions,
  getContainerTypeOptions,
  getListingKindLabel,
  type ContainerListingsMessages,
} from "@/components/container-listings-i18n";
import { MapLocationPicker } from "@/components/map-location-picker";
import { ImageCropModal } from "@/components/new-company-form/image-crop-modal";
import { ImageDropzone } from "@/components/new-company-form/image-dropzone";
import { ImageGrid } from "@/components/new-company-form/image-grid";
import { SimpleRichTextEditor } from "@/components/simple-rich-text-editor";
import { useToast } from "@/components/toast-provider";
import { SelectWithChevron } from "@/components/ui/select-with-chevron";
import { useContainerListingFormPhotos } from "@/components/use-container-listing-form-photos";
import { useContainerListingFormLocations } from "@/components/use-container-listing-form-locations";
import {
  parseContainerRalColors,
} from "@/lib/container-ral-colors";
import { formatTemplate, getMessages, type AppLocale } from "@/lib/i18n";
import { getRichTextLength } from "@/lib/listing-rich-text";
import { MAX_LISTING_LOCATIONS } from "@/lib/listing-locations";
import {
  CONTAINER_SIZE,
  CONTAINER_SIZES,
  PRICE_CURRENCIES,
  PRICE_TAX_MODES,
} from "@/lib/container-listing-types";

export type { CompanyLocationPrefillOption, ListingIntent };

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
  adminCompanyId?: string;
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
  adminCompanyId,
}: ContainerListingFormProps) {
  const router = useRouter();
  const toast = useToast();
  const resolvedListingMessages =
    listingMessages ?? getMessages(locale).containerListings;
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
  const [showAdditionalPhotosSection, setShowAdditionalPhotosSection] =
    useState((initialPhotoUrls?.length ?? 0) > 0);
  const inlineSubmitContainerRef = useRef<HTMLDivElement | null>(null);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [isPublishSuccessModalOpen, setIsPublishSuccessModalOpen] =
    useState(false);
  const [isInlineSubmitVisible, setIsInlineSubmitVisible] = useState(true);
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
  const {
    additionalInitialPhotoIndexes,
    appendPhotosToFormData,
    coverPhotoCrop,
    coverPhotoInputRef,
    handleAdditionalPhotoFilesAdded,
    handleApplyCoverPhotoCrop,
    handleCancelCoverPhotoCrop,
    handleCoverPhotoFilesAdded,
    isProcessingImages,
    mainPhotoPreviewUrl,
    photoItems,
    removeInitialPhoto,
    removeMainPhoto,
    removeUploadedPhoto,
    resetPhotosAfterSuccessfulSave,
    setCoverPhotoCrop,
    stableInitialPhotoUrls,
    totalPhotoCount,
  } = useContainerListingFormPhotos({
    initialPhotoUrls,
    messages,
    onWarning: toast.warning,
  });

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
  const parsedRalColorsPreview = useMemo(
    () =>
      parseContainerRalColors(containerColorsRalValue ?? "", {
        ignoreIncompleteTrailingToken: true,
      }),
    [containerColorsRalValue],
  );
  const shouldShowRalColorsPreview =
    parsedRalColorsPreview.colors.length > 0 && !parsedRalColorsPreview.tooMany;
  const {
    activeMapLocationId,
    activeMapLocationLabel,
    additionalLocations,
    configuredLocationsCount,
    handleAddAdditionalLocation,
    handleApplyCompanyLocation,
    handleClearLocations,
    handleRemoveAdditionalLocation,
    handleRemovePrimaryLocation,
    handleSearchAdditionalLocation,
    handleSearchLocation,
    handleSharedMapPointChange,
    handleUpdateAdditionalLocationSearch,
    hasCompanyLocationPrefill,
    hiddenConfiguredLocationsCount,
    isLocationBusy,
    isLocationModalOpen,
    locationMapPoints,
    locationSearch,
    primaryLocationDisplay,
    resolvedCompanyLocationPrefillOptions,
    setActiveMapLocationId,
    setIsLocationModalOpen,
    setLocationSearch,
    visibleConfiguredLocationDisplays,
  } = useContainerListingFormLocations({
    clearErrors,
    companyLocationPrefillOptions,
    initialAdditionalLocations,
    initialValues,
    locale,
    locationAddressCityValue,
    locationAddressCountryValue,
    locationAddressLabelValue,
    locationHouseNumberValue,
    locationPostalCodeValue,
    locationStreetValue,
    lngValue,
    latValue,
    messages,
    onError: toast.error,
    onInfo: toast.info,
    onSuccess: toast.success,
    onWarning: toast.warning,
    setValue,
  });
  const ownedCompanyName = ownedCompanyProfile?.name?.trim() ?? "";
  const hasOwnedCompanyProfile = ownedCompanyName.length > 0;
  const containerLogoPlaceholderSrc = useMemo(
    () =>
      getContainerLogoPlaceholderSrc(
        typeof containerSizeValue === "number" ? containerSizeValue : undefined,
      ),
    [containerSizeValue],
  );
  const canProceedFromIntentStep =
    !isCreateMode || resolvedListingIntent !== null;

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
    if (
      canUploadPhotosForSubmission &&
      totalPhotoCount > MAX_CONTAINER_PHOTOS
    ) {
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
      ...(mode === "edit" && reactivateOnSave
        ? { reactivateOnSave: true }
        : {}),
      ...(adminCompanyId?.trim() ? { adminCompanyId: adminCompanyId.trim() } : {}),
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
      appendPhotosToFormData(formData, {
        mode,
        canUploadPhotos: canUploadPhotosForSubmission,
      });

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
      resetPhotosAfterSuccessfulSave();
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
            {...register("type", {
              required: messages.shared.selectListingType,
            })}
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
            {...register("type", {
              required: messages.shared.selectListingType,
            })}
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
                  ? "grid gap-4 sm:grid-cols-[220px_minmax(0,1fr)] sm:items-start"
                  : "grid gap-4"
              }
            >
              {canManageListingPhotos ? (
                <div className="grid gap-3 rounded-md bg-neutral-950/70">
                  <button
                    type="button"
                    className="relative aspect-square w-full cursor-pointer overflow-hidden rounded-md border border-neutral-200 bg-neutral-100 max-sm:mx-auto max-sm:max-w-[375px]"
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
                          removeMainPhoto();
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
                      {getContainerHeightOptions(resolvedListingMessages).map(
                        (height) => (
                          <option key={height.value} value={height.value}>
                            {height.label}
                          </option>
                        ),
                      )}
                    </SelectWithChevron>
                  </label>

                  <label className="flex min-w-[180px] flex-[1_1_220px] flex-col gap-1 text-sm">
                    <span className="text-neutral-700">
                      {messages.form.typeLabel}
                    </span>
                    <SelectWithChevron
                      tone="dark"
                      {...register("containerType", {
                        required: messages.form.selectType,
                      })}
                    >
                      {getContainerTypeOptions(resolvedListingMessages).map(
                        (type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ),
                      )}
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
                      {getContainerConditionOptions(
                        resolvedListingMessages,
                      ).map((condition) => (
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
                  {messages.form.availableFromLabel}{" "}
                  {availableNowValue ? "" : "*"}
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

          <FormSection title={messages.form.locationSectionTitle}>
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
                {messages.form.configuredLocationsLabel}:{" "}
                {configuredLocationsCount}/{MAX_LISTING_LOCATIONS}
              </p>
              {visibleConfiguredLocationDisplays.length > 0 ? (
                <div className="mt-1 grid gap-1 text-neutral-600">
                  {visibleConfiguredLocationDisplays.map((location, index) => (
                    <div key={location.key} className="flex items-center gap-1">
                      <LocationFlag
                        country={location.country}
                        className="shrink-0"
                      />
                      <span className="min-w-0 truncate">
                        {location.postalCode ? (
                          <strong className="font-semibold text-neutral-700">
                            {location.postalCode}
                          </strong>
                        ) : null}
                        {location.postalCode && location.rest ? " " : null}
                        {location.rest}
                        {index ===
                          visibleConfiguredLocationDisplays.length - 1 &&
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

          <FormSection title={messages.form.priceSectionTitle}>
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
                  {...register("priceCurrency", {
                    required: messages.form.selectCurrency,
                  })}
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
            <FormSection title={messages.form.descriptionSectionTitle}>
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
                  <label
                    htmlFor="containerColorsRal"
                    className="text-neutral-700"
                  >
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
            <FormSection title={messages.form.logisticsSectionTitle}>
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
            <FormSection title={messages.form.contactSectionTitle}>
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
            <FormSection title={messages.form.certificationSectionTitle}>
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex w-fit flex-col gap-1 text-sm">
                  <span
                    className="invisible text-neutral-700"
                    aria-hidden="true"
                  >
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
                  <span
                    className="min-h-4 text-xs text-transparent"
                    aria-hidden="true"
                  >
                    {"\u00A0"}
                  </span>
                </div>
                <div className="flex w-fit flex-col gap-1 text-sm">
                  <span
                    className="invisible text-neutral-700"
                    aria-hidden="true"
                  >
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
                  <span
                    className="min-h-4 text-xs text-transparent"
                    aria-hidden="true"
                  >
                    {"\u00A0"}
                  </span>
                </div>
                <label className="flex w-fit flex-col gap-1 text-sm">
                  <span className="text-neutral-700">
                    {messages.form.monthLabel}
                  </span>
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
                  <span className="text-neutral-700">
                    {messages.form.yearLabel}
                  </span>
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
                            removeInitialPhoto(index);
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
                            removeInitialPhoto(index);
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
                  onRemove={removeUploadedPhoto}
                  removeLabel={messages.form.removePhoto}
                  previewAlt={messages.form.photoPreviewAlt}
                />
              ) : null}
            </section>
          ) : null}

          {!showDescriptionSection ||
          !showTransportSection ||
          !showCertificationSection ||
          (canManageListingPhotos && !showAdditionalPhotosSection) ? (
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
                      <p>{messages.form.locationModalHint}</p>
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
                            {formatTemplate(
                              messages.shared.locationLabelTemplate,
                              { index: 1 },
                            )}
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
                            placeholder={
                              messages.form.locationSearchPlaceholder
                            }
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
                              {formatTemplate(
                                messages.shared.locationLabelTemplate,
                                {
                                  index: index + 2,
                                },
                              )}
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
                              placeholder={
                                messages.form.locationSearchPlaceholder
                              }
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
                        <span
                          aria-hidden="true"
                          className="text-sm leading-none"
                        >
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
