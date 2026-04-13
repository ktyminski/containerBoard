"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { COMPANY_OPERATING_AREAS } from "@/lib/company-operating-area";
import { useToast } from "@/components/toast-provider";
import { TurnstileWidget } from "@/components/turnstile-widget";
import type { AppLocale, AppMessages } from "@/lib/i18n";
import { formatTemplate, LOCALE_HEADER_NAME, withLang } from "@/lib/i18n";
import { BranchCard } from "@/components/new-company-form/branch-card";
import { CompanyMediaSection } from "@/components/new-company-form/company-media-section";
import { ImageDropzone } from "@/components/new-company-form/image-dropzone";
import { ImageGrid } from "@/components/new-company-form/image-grid";
import { ImageCropModal } from "@/components/new-company-form/image-crop-modal";
import { useCompanyMediaState } from "@/components/new-company-form/use-company-media-state";
import { FacebookIcon, InstagramIcon, LinkedInIcon } from "@/components/social-icons";
import {
  MAX_COMPANY_PHOTOS,
  PHONE_REGEX,
  createEmptyBranch,
  createImageItems,
  cropImageFile,
  getFieldMessage,
  hasValidCoordinate,
  isValidWebsite,
  removeImageItem,
  revokeImageItems,
} from "@/components/new-company-form/helpers";
import type {
  ImageCropState,
  ImageItem,
  NewCompanyFormValues,
} from "@/components/new-company-form/types";

type NewCompanyFormProps = {
  locale: AppLocale;
  messages: AppMessages["companyCreate"];
  companyCreationLimit?: {
    isLimited: boolean;
    limit: number;
    windowHours: number;
    createdInWindow: number;
    nextAllowedAt: string | null;
  } | null;
  initialValues?: NewCompanyFormValues;
  submitEndpoint?: string;
  httpMethod?: "POST" | "PATCH";
  turnstileSiteKey?: string | null;
  resetOnSuccess?: boolean;
  successMessage?: string;
  successRedirectTo?: string;
  initialLogoUrl?: string | null;
  initialBackgroundUrl?: string | null;
  initialPhotoUrls?: string[];
  initialLogoBytes?: number;
  initialBackgroundBytes?: number;
  initialPhotoBytes?: number[];
  initialBranchPhotosBytes?: number;
};

const DEFAULT_CREATION_LIMIT = 3;
const DEFAULT_CREATION_WINDOW_HOURS = 48;
const MAX_LOGO_BYTES = 3 * 1024 * 1024;
const MAX_BACKGROUND_BYTES = 6 * 1024 * 1024;
const MAX_PHOTO_BYTES = 6 * 1024 * 1024;
const MAX_TOTAL_IMAGES_BYTES = 14 * 1024 * 1024;
const MAX_LOGO_MB = 3;
const MAX_BACKGROUND_MB = 6;
const MAX_PHOTO_MB = 6;
const MAX_TOTAL_IMAGES_MB = 14;
const EMPTY_STRING_ARRAY: string[] = [];
const EMPTY_NUMBER_ARRAY: number[] = [];

function toIntlLocale(locale: AppLocale): string {
  if (locale === "en") {
    return "en-US";
  }
  if (locale === "de") {
    return "de-DE";
  }
  if (locale === "uk") {
    return "uk-UA";
  }
  return "pl-PL";
}

function buildCreationLimitNotice(input: {
  locale: AppLocale;
  messages: AppMessages["companyCreate"];
  limit: number;
  windowHours: number;
  createdInWindow?: number;
  nextAllowedAt: string | null;
}): string {
  const parts = [
    formatTemplate(input.messages.creationLimitText, {
      limit: input.limit,
      windowHours: input.windowHours,
    }),
  ];

  if (typeof input.createdInWindow === "number") {
    parts.push(
      formatTemplate(input.messages.creationLimitUsage, {
        count: input.createdInWindow,
        limit: input.limit,
      }),
    );
  }

  if (input.nextAllowedAt) {
    const formattedDate = new Date(input.nextAllowedAt).toLocaleString(
      toIntlLocale(input.locale),
    );
    parts.push(
      formatTemplate(input.messages.creationLimitUntil, {
        date: formattedDate,
      }),
    );
  }

  return parts.join("\n");
}

export function NewCompanyForm({
  locale,
  messages,
  companyCreationLimit,
  initialValues,
  submitEndpoint = "/api/companies",
  httpMethod = "POST",
  turnstileSiteKey,
  resetOnSuccess = true,
  successMessage,
  successRedirectTo,
  initialLogoUrl = null,
  initialBackgroundUrl = null,
  initialPhotoUrls,
  initialLogoBytes = 0,
  initialBackgroundBytes = 0,
  initialPhotoBytes,
  initialBranchPhotosBytes = 0,
}: NewCompanyFormProps) {
  const router = useRouter();
  const toast = useToast();
  const {
    logo,
    setLogo,
    background,
    setBackground,
    logoCrop,
    setLogoCrop,
    backgroundCrop,
    setBackgroundCrop,
    photoItems,
    setPhotoItems,
    isInitialLogoRemoved,
    setIsInitialLogoRemoved,
    isInitialBackgroundRemoved,
    setIsInitialBackgroundRemoved,
    keptInitialPhotoIndexes,
    setKeptInitialPhotoIndexes,
  } = useCompanyMediaState();
  const stableInitialPhotoUrls = initialPhotoUrls ?? EMPTY_STRING_ARRAY;
  const stableInitialPhotoBytes = initialPhotoBytes ?? EMPTY_NUMBER_ARRAY;
  const [isPostCreateModalOpen, setIsPostCreateModalOpen] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileRefreshKey, setTurnstileRefreshKey] = useState(0);
  const mediaCleanupRef = useRef<{
    logo: ImageItem | null;
    background: ImageItem | null;
    logoCrop: ImageCropState | null;
    backgroundCrop: ImageCropState | null;
    photoItems: ImageItem[];
  }>({
    logo: null,
    background: null,
    logoCrop: null,
    backgroundCrop: null,
    photoItems: [],
  });

  const defaultValues = useMemo<NewCompanyFormValues>(() => {
    if (initialValues) {
      return initialValues;
    }

    return {
      name: "",
      description: "",
      operatingArea: "local",
      operatingAreaDetails: "",
      nip: "",
      phone: "",
      email: "",
      website: "",
      facebookUrl: "",
      instagramUrl: "",
      linkedinUrl: "",
      branches: [createEmptyBranch(messages.mainBranchTitle)],
    };
  }, [initialValues, messages.mainBranchTitle]);

  const {
    control,
    getValues,
    handleSubmit,
    register,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting, touchedFields, isSubmitted },
  } = useForm<NewCompanyFormValues>({
    defaultValues,
    mode: "onChange",
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "branches",
  });

  const operatingAreaOptions = useMemo(
    () =>
      COMPANY_OPERATING_AREAS.map((value) => ({
        value,
        label: messages.operatingAreas[value],
      })),
    [messages.operatingAreas],
  );

  const watchedBranches = watch("branches");
  const watchedCompanyName = watch("name");
  const creationLimitNotice = useMemo(() => {
    if (!companyCreationLimit?.isLimited) {
      return null;
    }
    return buildCreationLimitNotice({
      locale,
      messages,
      limit: companyCreationLimit.limit,
      windowHours: companyCreationLimit.windowHours,
      createdInWindow: companyCreationLimit.createdInWindow,
      nextAllowedAt: companyCreationLimit.nextAllowedAt,
    });
  }, [companyCreationLimit, locale, messages]);
  const visibleInitialPhotoCount = keptInitialPhotoIndexes.length;
  const normalizedInitialLogoBytes =
    Number.isFinite(initialLogoBytes) && initialLogoBytes > 0 ? initialLogoBytes : 0;
  const normalizedInitialBackgroundBytes =
    Number.isFinite(initialBackgroundBytes) && initialBackgroundBytes > 0 ? initialBackgroundBytes : 0;
  const normalizedInitialBranchPhotosBytes =
    Number.isFinite(initialBranchPhotosBytes) && initialBranchPhotosBytes > 0
      ? initialBranchPhotosBytes
      : 0;
  const normalizedInitialPhotoBytes = useMemo(
    () =>
      stableInitialPhotoBytes.map((value) =>
        Number.isFinite(value) && value > 0 ? value : 0
      ),
    [stableInitialPhotoBytes],
  );

  const getEstimatedPersistedImagesBytes = (overrides?: {
    nextLogoBytes?: number;
    nextBackgroundBytes?: number;
    additionalPhotoBytes?: number;
  }): number => {
    const logoBytes =
      typeof overrides?.nextLogoBytes === "number"
        ? overrides.nextLogoBytes
        : logo?.file.size ??
          (
            initialLogoUrl && !isInitialLogoRemoved
              ? normalizedInitialLogoBytes
              : 0
          );
    const backgroundBytes =
      typeof overrides?.nextBackgroundBytes === "number"
        ? overrides.nextBackgroundBytes
        : background?.file.size ??
          (
            initialBackgroundUrl && !isInitialBackgroundRemoved
              ? normalizedInitialBackgroundBytes
              : 0
          );
    const keptInitialCompanyPhotosBytes = keptInitialPhotoIndexes.reduce((sum, index) => {
      return sum + (normalizedInitialPhotoBytes[index] ?? 0);
    }, 0);
    const newCompanyPhotosBytes = photoItems.reduce((sum, item) => sum + item.file.size, 0);
    const additionalPhotoBytes = overrides?.additionalPhotoBytes ?? 0;

    return (
      logoBytes +
      backgroundBytes +
      keptInitialCompanyPhotosBytes +
      newCompanyPhotosBytes +
      normalizedInitialBranchPhotosBytes +
      additionalPhotoBytes
    );
  };

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  useEffect(() => {
    setIsInitialLogoRemoved(false);
    setIsInitialBackgroundRemoved(false);
    setKeptInitialPhotoIndexes(stableInitialPhotoUrls.map((_, index) => index));
  }, [
    initialBackgroundUrl,
    initialLogoUrl,
    setIsInitialBackgroundRemoved,
    setIsInitialLogoRemoved,
    setKeptInitialPhotoIndexes,
    stableInitialPhotoUrls,
  ]);

  useEffect(() => {
    mediaCleanupRef.current = {
      logo,
      background,
      logoCrop,
      backgroundCrop,
      photoItems,
    };
  }, [background, backgroundCrop, logo, logoCrop, photoItems]);

  useEffect(() => {
    return () => {
      const current = mediaCleanupRef.current;
      if (current.logo) {
        URL.revokeObjectURL(current.logo.previewUrl);
      }
      if (current.background) {
        URL.revokeObjectURL(current.background.previewUrl);
      }
      if (current.logoCrop) {
        URL.revokeObjectURL(current.logoCrop.sourceUrl);
      }
      if (current.backgroundCrop) {
        URL.revokeObjectURL(current.backgroundCrop.sourceUrl);
      }
      revokeImageItems(current.photoItems);
    };
  }, []);

  const addBranch = () => {
    append(createEmptyBranch());
  };

  const removeBranch = (index: number) => {
    remove(index);
  };

  const closePostCreateModal = () => {
    setIsPostCreateModalOpen(false);
    router.push(withLang("/companies/panel", locale));
  };

  const onSubmit = async (values: NewCompanyFormValues) => {
    if (companyCreationLimit?.isLimited) {
      toast.warning(creationLimitNotice ?? messages.creationLimitText);
      return;
    }
    if (httpMethod === "POST" && turnstileSiteKey && !turnstileToken) {
      toast.warning(messages.turnstileRequired);
      return;
    }

    const missingLocation = values.branches.find(
      (branch) =>
        !hasValidCoordinate(branch.lat) || !hasValidCoordinate(branch.lng),
    );
    if (missingLocation) {
      toast.warning(messages.branchLocationRequiredError);
      return;
    }

    const estimatedPersistedBytes = getEstimatedPersistedImagesBytes();
    if (estimatedPersistedBytes > MAX_TOTAL_IMAGES_BYTES) {
      toast.warning(
        formatTemplate(messages.totalImagesSizeLimitError, {
          maxMb: MAX_TOTAL_IMAGES_MB,
        }),
      );
      return;
    }

    try {
      const formData = new FormData();
      formData.set("name", values.name);
      formData.set("description", values.description);
      formData.set("category", "other");
      formData.set("operatingArea", values.operatingArea);
      formData.set("operatingAreaDetails", values.operatingAreaDetails);
      formData.set("nip", values.nip);
      formData.set("phone", values.phone);
      formData.set("email", values.email);
      formData.set("website", values.website);
      formData.set("facebookUrl", values.facebookUrl);
      formData.set("instagramUrl", values.instagramUrl);
      formData.set("linkedinUrl", values.linkedinUrl);
      formData.set("branches", JSON.stringify(values.branches));
      if (httpMethod === "POST") {
        formData.set("turnstileToken", turnstileToken);
      } else {
        formData.set(
          "removeLogo",
          String(Boolean(initialLogoUrl) && isInitialLogoRemoved && !logo),
        );
        formData.set(
          "removeBackground",
          String(
            Boolean(initialBackgroundUrl) &&
            isInitialBackgroundRemoved &&
            !background
          ),
        );
        formData.set("keepPhotoIndexes", JSON.stringify(keptInitialPhotoIndexes));
      }

      if (logo) {
        formData.set("logo", logo.file);
      }
      if (background) {
        formData.set("background", background.file);
      }

      for (const item of photoItems) {
        formData.append("photos", item.file);
      }

      const response = await fetch(submitEndpoint, {
        method: httpMethod,
        headers: {
          [LOCALE_HEADER_NAME]: locale,
        },
        body: formData,
      });

      const data = (await response.json()) as {
        error?: string;
        issues?: string[];
        limit?: number;
        windowHours?: number;
        createdInWindow?: number;
        nextAllowedAt?: string | null;
      };
      if (response.status === 429) {
        const limit = data.limit ?? companyCreationLimit?.limit ?? DEFAULT_CREATION_LIMIT;
        const windowHours =
          data.windowHours ??
          companyCreationLimit?.windowHours ??
          DEFAULT_CREATION_WINDOW_HOURS;
        const nextAllowedAt =
          data.nextAllowedAt ?? companyCreationLimit?.nextAllowedAt ?? null;
        toast.warning(
          buildCreationLimitNotice({
            locale,
            messages,
            limit,
            windowHours,
            createdInWindow: data.createdInWindow,
            nextAllowedAt,
          }),
        );
        return;
      }
      if (!response.ok) {
        if (data.error === "TURNSTILE_REQUIRED" || data.error === "TURNSTILE_FAILED") {
          throw new Error(messages.turnstileRequired);
        }
        const issueText =
          data.issues && data.issues.length > 0
            ? `\n${data.issues.join("\n")}`
            : "";
        throw new Error((data.error ?? messages.validationError) + issueText);
      }

      toast.success(successMessage ?? messages.success);
      if (resetOnSuccess) {
        if (logo) {
          URL.revokeObjectURL(logo.previewUrl);
        }
        setLogo(null);
        if (background) {
          URL.revokeObjectURL(background.previewUrl);
        }
        setBackground(null);
        revokeImageItems(photoItems);
        setPhotoItems([]);
        setIsInitialLogoRemoved(false);
        setIsInitialBackgroundRemoved(false);
        setKeptInitialPhotoIndexes(stableInitialPhotoUrls.map((_, index) => index));
        reset(defaultValues);
      }

      if (httpMethod === "POST") {
        setIsPostCreateModalOpen(true);
        return;
      }

      if (successRedirectTo) {
        router.push(successRedirectTo);
        return;
      }
      router.refresh();
    } catch (submitError) {
      toast.error(
        submitError instanceof Error
          ? submitError.message
          : messages.validationError,
      );
    } finally {
      if (httpMethod === "POST" && turnstileSiteKey) {
        setTurnstileToken("");
        setTurnstileRefreshKey((current) => current + 1);
      }
    }
  };

  return (
    <section className="grid gap-3 sm:gap-4">
      <section className="overflow-hidden rounded-lg border border-neutral-300 bg-neutral-100/95 shadow-sm">
      {creationLimitNotice ? (
        <section className="m-5 rounded-lg border border-neutral-300 bg-neutral-100 p-4">
          <h2 className="text-sm font-semibold text-neutral-800">
            {messages.creationLimitTitle}
          </h2>
          <p className="mt-2 text-sm whitespace-pre-line text-neutral-700">
            {creationLimitNotice}
          </p>
        </section>
      ) : null}

      <CompanyMediaSection
        messages={messages}
        companyName={watchedCompanyName ?? ""}
        logo={logo}
        background={background}
        initialLogoUrl={initialLogoUrl}
        initialBackgroundUrl={initialBackgroundUrl}
        isInitialLogoRemoved={isInitialLogoRemoved}
        isInitialBackgroundRemoved={isInitialBackgroundRemoved}
        onLogoFilesAdded={(files) => {
          const file = files[0];
          if (!file) {
            return;
          }
          if (!file.type.startsWith("image/")) {
            toast.warning(messages.imageFileTypeError);
            return;
          }
          if (file.size > MAX_LOGO_BYTES) {
            toast.warning(
              formatTemplate(messages.logoSizeLimitError, {
                maxMb: MAX_LOGO_MB,
              }),
            );
            return;
          }
          if (logoCrop) {
            URL.revokeObjectURL(logoCrop.sourceUrl);
          }
          const sourceUrl = URL.createObjectURL(file);
          setLogoCrop({
            sourceUrl,
            zoom: 1,
            offsetX: 0,
            offsetY: 0,
          });
        }}
        onBackgroundFilesAdded={(files) => {
          const file = files[0];
          if (!file) {
            return;
          }
          if (!file.type.startsWith("image/")) {
            toast.warning(messages.imageFileTypeError);
            return;
          }
          if (file.size > MAX_BACKGROUND_BYTES) {
            toast.warning(
              formatTemplate(messages.backgroundSizeLimitError, {
                maxMb: MAX_BACKGROUND_MB,
              }),
            );
            return;
          }
          if (backgroundCrop) {
            URL.revokeObjectURL(backgroundCrop.sourceUrl);
          }
          const sourceUrl = URL.createObjectURL(file);
          setBackgroundCrop({
            sourceUrl,
            zoom: 1,
            offsetX: 0,
            offsetY: 0,
          });
        }}
        onRemoveLogo={() => {
          if (logo) {
            URL.revokeObjectURL(logo.previewUrl);
            setLogo(null);
            return;
          }
          if (initialLogoUrl && !isInitialLogoRemoved) {
            setIsInitialLogoRemoved(true);
          }
        }}
        onRemoveBackground={() => {
          if (background) {
            URL.revokeObjectURL(background.previewUrl);
            setBackground(null);
            return;
          }
          if (initialBackgroundUrl && !isInitialBackgroundRemoved) {
            setIsInitialBackgroundRemoved(true);
          }
        }}
      />

      <div className="grid gap-4 p-4">
        <section className="grid gap-4">
          <h2 className="text-sm font-semibold text-neutral-800">{messages.stepMainInfo}</h2>

          <label className="mx-auto grid w-full gap-1 text-sm md:w-[70%]">
            <span className="text-neutral-700">{messages.name}*</span>
            <input
              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-800 placeholder:text-neutral-400"
              {...register("name", {
                required: messages.requiredField,
                minLength: { value: 2, message: messages.requiredField },
                maxLength: { value: 120, message: messages.validationError },
              })}
            />
            {getFieldMessage(errors.name?.message) &&
            (touchedFields.name || isSubmitted) ? (
              <p className="text-xs text-red-300">
                {getFieldMessage(errors.name?.message)}
              </p>
            ) : null}
          </label>

          <label className="mx-auto grid w-full gap-1 text-sm md:w-[70%]">
            <span className="text-neutral-700">{messages.nip}</span>
            <input
              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-800 placeholder:text-neutral-400"
              placeholder={messages.nipPlaceholder}
              {...register("nip")}
            />
            {getFieldMessage(errors.nip?.message) ? (
              <p className="text-xs text-red-300">
                {getFieldMessage(errors.nip?.message)}
              </p>
            ) : (
              <p className="text-xs text-neutral-400">{messages.nipHint}</p>
            )}
          </label>

          <label className="mx-auto grid w-full gap-1 text-sm md:w-[70%]">
            <span className="text-neutral-700">{messages.description}*</span>
            <textarea
              className="min-h-28 rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-800 placeholder:text-neutral-400"
              placeholder={messages.descriptionPlaceholder}
              {...register("description", {
                required: messages.requiredField,
                minLength: { value: 10, message: messages.descriptionLengthError },
                maxLength: { value: 5000, message: messages.descriptionLengthError },
              })}
            />
            {getFieldMessage(errors.description?.message) &&
            (touchedFields.description || isSubmitted) ? (
              <p className="text-xs text-red-300">
                {getFieldMessage(errors.description?.message)}
              </p>
            ) : (
              <p className="text-xs text-neutral-400">{messages.descriptionHint}</p>
            )}
          </label>

          <div className="mb-2 mt-4 border-t border-neutral-300" />
          <div className="grid gap-4">
            <label className="mx-auto grid w-full gap-1 text-sm md:w-[70%]">
              <span className="text-neutral-700">{messages.operatingAreaLabel}*</span>
              <select
                className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-800 placeholder:text-neutral-400"
                {...register("operatingArea", {
                  required: messages.requiredField,
                })}
              >
                {operatingAreaOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              {getFieldMessage(errors.operatingArea?.message) ? (
                <p className="text-xs text-red-300">
                  {getFieldMessage(errors.operatingArea?.message)}
                </p>
              ) : null}
            </label>

            <label className="mx-auto grid w-full gap-1 text-sm md:w-[70%]">
              <span className="text-neutral-700">{messages.operatingAreaDetailsLabel}</span>
              <textarea
                className="min-h-24 rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-800 placeholder:text-neutral-400"
                placeholder={messages.operatingAreaDetailsPlaceholder}
                {...register("operatingAreaDetails", {
                  maxLength: { value: 200, message: messages.operatingAreaDetailsTooLong },
                })}
              />
              {getFieldMessage(errors.operatingAreaDetails?.message) ? (
                <p className="text-xs text-red-300">
                  {getFieldMessage(errors.operatingAreaDetails?.message)}
                </p>
              ) : (
                <p className="text-xs text-neutral-400">{messages.operatingAreaDetailsHint}</p>
              )}
            </label>
          </div>
        </section>

      <section className="grid gap-3 rounded-lg border border-neutral-300 bg-neutral-50 p-3">
        <div>
          <h2 className="text-sm font-semibold text-neutral-800">{messages.photosTitle}</h2>
          <p className="text-xs text-neutral-400">
            {formatTemplate(messages.imageDropzoneHintWithLimit, {
              maxMb: MAX_PHOTO_MB,
            })}
          </p>
        </div>
        <ImageDropzone
          title={`${messages.photosTitle} (max ${MAX_COMPANY_PHOTOS})`}
          hintText={formatTemplate(messages.imageDropzoneHintWithLimit, {
            maxMb: MAX_PHOTO_MB,
          })}
          variant="light"
          onFilesAdded={(files) => {
            const imageFiles = files.filter((file) => file.type.startsWith("image/"));
            if (imageFiles.length !== files.length) {
              toast.warning(messages.imageFileTypeError);
            }

            const sizeAccepted = imageFiles.filter((file) => file.size <= MAX_PHOTO_BYTES);
            if (sizeAccepted.length !== imageFiles.length) {
              toast.warning(
                formatTemplate(messages.photoSizeLimitError, {
                  maxMb: MAX_PHOTO_MB,
                }),
              );
            }

            const currentPhotoCount = visibleInitialPhotoCount + photoItems.length;
            const remaining = Math.max(0, MAX_COMPANY_PHOTOS - currentPhotoCount);
            if (remaining === 0) {
              toast.warning(
                formatTemplate(messages.photosLimitReached, {
                  max: MAX_COMPANY_PHOTOS,
                  selected: currentPhotoCount + sizeAccepted.length,
                }),
              );
              return;
            }

            let acceptedFiles = sizeAccepted;
            if (sizeAccepted.length > remaining) {
              toast.warning(
                formatTemplate(messages.photosLimitAllowed, {
                  remaining,
                  max: MAX_COMPANY_PHOTOS,
                }),
              );
              acceptedFiles = sizeAccepted.slice(0, remaining);
            }

            const baseTotalBytes = getEstimatedPersistedImagesBytes();
            const totalAccepted: File[] = [];
            let totalBytes = baseTotalBytes;
            for (const file of acceptedFiles) {
              if (totalBytes + file.size > MAX_TOTAL_IMAGES_BYTES) {
                break;
              }
              totalAccepted.push(file);
              totalBytes += file.size;
            }
            if (totalAccepted.length !== acceptedFiles.length) {
              toast.warning(
                formatTemplate(messages.totalImagesSizeLimitError, {
                  maxMb: MAX_TOTAL_IMAGES_MB,
                }),
              );
            }
            if (totalAccepted.length === 0) {
              return;
            }

            const accepted = createImageItems(totalAccepted);
            setPhotoItems((prev) => [...prev, ...accepted]);
          }}
        />
        {keptInitialPhotoIndexes.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {keptInitialPhotoIndexes.map((index) => {
              const url = stableInitialPhotoUrls[index];
              if (!url) {
                return null;
              }
              return (
              <div
                key={`initial-photo-${index + 1}`}
                className="group relative rounded-md border border-neutral-300 bg-white p-1"
              >
                <button
                  type="button"
                  className="flex h-28 w-full cursor-pointer items-center justify-center overflow-hidden rounded-sm"
                  onClick={() => {
                    setKeptInitialPhotoIndexes((prev) => prev.filter((value) => value !== index));
                  }}
                  title={messages.imageRemove}
                >
                  <img
                    src={url}
                    alt={messages.imagePreviewAlt}
                    className="max-h-24 w-auto max-w-full object-contain transition-transform duration-300 ease-out group-hover:scale-105"
                  />
                </button>
                <button
                  type="button"
                  className="absolute right-1 top-1 cursor-pointer rounded-full bg-black/70 px-2 py-0.5 text-xs text-white opacity-90"
                  onClick={() => {
                    setKeptInitialPhotoIndexes((prev) => prev.filter((value) => value !== index));
                  }}
                  title={messages.imageRemove}
                  aria-label={messages.imageRemove}
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
            removeLabel={messages.imageRemove}
            previewAlt={messages.imagePreviewAlt}
          />
        ) : null}
      </section>

      <section className="grid gap-4 border-t border-neutral-300 pt-4">
      <h2 className="text-sm font-semibold text-neutral-800">{messages.stepContact}</h2>

      <label className="mx-auto grid w-full gap-1 text-sm md:w-[70%]">
        <span className="text-neutral-700">{messages.phone}</span>
        <input
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-800 placeholder:text-neutral-400"
          {...register("phone", {
            validate: {
              format: (value) =>
                !value.trim() || PHONE_REGEX.test(value) || messages.invalidPhone,
            },
          })}
        />
        {getFieldMessage(errors.phone?.message) &&
        (touchedFields.phone || isSubmitted) ? (
          <p className="text-xs text-red-300">
            {getFieldMessage(errors.phone?.message)}
          </p>
        ) : null}
      </label>

      <label className="mx-auto grid w-full gap-1 text-sm md:w-[70%]">
        <span className="text-neutral-700">{messages.email}*</span>
        <input
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-800 placeholder:text-neutral-400"
          {...register("email", {
            validate: {
              required: (value) => value.trim().length > 0 || messages.requiredField,
              format: (value) =>
                /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || messages.invalidEmail,
            },
          })}
        />
        {getFieldMessage(errors.email?.message) &&
        (touchedFields.email || isSubmitted) ? (
          <p className="text-xs text-red-300">
            {getFieldMessage(errors.email?.message)}
          </p>
        ) : null}
      </label>

      <label className="mx-auto grid w-full gap-1 text-sm md:w-[70%]">
        <span className="text-neutral-700">{messages.website}</span>
        <input
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-800 placeholder:text-neutral-400"
          {...register("website")}
        />
        {getFieldMessage(errors.website?.message) ? (
          <p className="text-xs text-red-300">
            {getFieldMessage(errors.website?.message)}
          </p>
        ) : null}
      </label>

      <div className="mb-2 mt-4 border-t border-neutral-300" />
      <div className="grid gap-4">
        <label className="mx-auto grid w-full gap-1 text-sm md:w-[70%]">
          <span className="flex items-center gap-2 text-neutral-700">
            <FacebookIcon className="h-4 w-4 text-neutral-400" />
            {messages.facebookUrl}
          </span>
          <input
            className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-800 placeholder:text-neutral-400"
            {...register("facebookUrl", {
              validate: (value) =>
                isValidWebsite(value) || messages.invalidWebsite,
            })}
            placeholder={messages.facebookPlaceholder}
          />
          {getFieldMessage(errors.facebookUrl?.message) ? (
            <p className="text-xs text-red-300">
              {getFieldMessage(errors.facebookUrl?.message)}
            </p>
          ) : null}
        </label>

        <label className="mx-auto grid w-full gap-1 text-sm md:w-[70%]">
          <span className="flex items-center gap-2 text-neutral-700">
            <InstagramIcon className="h-4 w-4 text-neutral-400" />
            {messages.instagramUrl}
          </span>
          <input
            className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-800 placeholder:text-neutral-400"
            placeholder={messages.instagramPlaceholder}
            {...register("instagramUrl", {
              validate: (value) =>
                isValidWebsite(value) || messages.invalidWebsite,
            })}
          />
          {getFieldMessage(errors.instagramUrl?.message) ? (
            <p className="text-xs text-red-300">
              {getFieldMessage(errors.instagramUrl?.message)}
            </p>
          ) : null}
        </label>

        <label className="mx-auto grid w-full gap-1 text-sm md:w-[70%]">
          <span className="flex items-center gap-2 text-neutral-700">
            <LinkedInIcon className="h-4 w-4 text-neutral-400" />
            {messages.linkedinUrl}
          </span>
          <input
            className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-800 placeholder:text-neutral-400"
            placeholder={messages.linkedinPlaceholder}
            {...register("linkedinUrl", {
              validate: (value) =>
                isValidWebsite(value) || messages.invalidWebsite,
            })}
          />
          {getFieldMessage(errors.linkedinUrl?.message) ? (
            <p className="text-xs text-red-300">
              {getFieldMessage(errors.linkedinUrl?.message)}
            </p>
          ) : null}
        </label>
      </div>

      <div className="grid gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-100">
            {messages.branchesTitle}
          </h2>
        </div>

        {fields.map((field, index) => {
          const branch = watchedBranches[index];
          const branchError = errors.branches?.[index];

          return (
            <div key={field.id} className="grid gap-2">
              <BranchCard
                locale={locale}
                messages={messages}
                index={index}
                branchesCount={fields.length}
                branch={branch}
                register={register}
                getValues={getValues}
                setValue={setValue}
                branchLabelError={getFieldMessage(branchError?.label?.message)}
                branchAddressError={getFieldMessage(
                  branchError?.addressText?.message,
                )}
                branchLatError={getFieldMessage(branchError?.lat?.message)}
                branchPhoneError={getFieldMessage(branchError?.phone?.message)}
                branchEmailError={getFieldMessage(branchError?.email?.message)}
                branchPhoneTouched={Boolean(touchedFields.branches?.[index]?.phone)}
                branchEmailTouched={Boolean(touchedFields.branches?.[index]?.email)}
                isSubmitted={isSubmitted}
                isVisible
                onRemoveBranch={removeBranch}
              />
            </div>
          );
        })}
        <button
          type="button"
          className="inline-flex w-fit cursor-pointer items-center gap-1 pl-2 text-sm text-neutral-700 hover:text-neutral-900"
          onClick={addBranch}
        >
          {messages.addBranch}
          <span aria-hidden="true">+</span>
        </button>
      </div>
      </section>

      {httpMethod === "POST" && turnstileSiteKey ? (
        <TurnstileWidget
          siteKey={turnstileSiteKey}
          onTokenChange={setTurnstileToken}
          refreshKey={turnstileRefreshKey}
        />
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          className="cursor-pointer rounded-md bg-[#111827] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1f2937] disabled:opacity-60"
          disabled={isSubmitting || companyCreationLimit?.isLimited}
          onClick={() => {
            void handleSubmit(onSubmit)();
          }}
        >
          {isSubmitting
            ? messages.submitting
            : companyCreationLimit?.isLimited
              ? messages.creationLimitButton
              : messages.submit}
        </button>
      </div>
      </div>
      </section>

      {logoCrop ? (
        <ImageCropModal
          title={messages.cropLogoTitle}
          previewAlt={messages.cropLogoAlt}
          previewFrameClassName="mx-auto aspect-square w-full max-w-sm p-0"
          previewClassName="h-full w-full object-cover"
          fitMode="contain"
          labels={{
            hint: messages.cropHint,
            zoom: messages.cropZoom,
            offsetX: messages.cropOffsetX,
            offsetY: messages.cropOffsetY,
            apply: messages.cropApply,
            cancel: messages.cropCancel,
          }}
          state={logoCrop}
          setState={setLogoCrop}
          onApply={async () => {
            const croppedFile = await cropImageFile(
              logoCrop,
              "logo-cropped.png",
              {
                outputWidth: 512,
                outputHeight: 512,
                fitMode: "contain",
              },
            );
            const nextTotalBytes = getEstimatedPersistedImagesBytes({
              nextLogoBytes: croppedFile.size,
            });
            if (nextTotalBytes > MAX_TOTAL_IMAGES_BYTES) {
              toast.warning(
                formatTemplate(messages.totalImagesSizeLimitError, {
                  maxMb: MAX_TOTAL_IMAGES_MB,
                }),
              );
              return;
            }
            const nextItem = createImageItems([croppedFile])[0];
            if (logo) {
              URL.revokeObjectURL(logo.previewUrl);
            }
            setLogo(nextItem);
            URL.revokeObjectURL(logoCrop.sourceUrl);
            setLogoCrop(null);
          }}
          onCancel={() => {
            URL.revokeObjectURL(logoCrop.sourceUrl);
            setLogoCrop(null);
          }}
        />
      ) : null}
      {backgroundCrop ? (
        <ImageCropModal
          title={messages.cropBackgroundTitle}
          previewAlt={messages.cropBackgroundAlt}
          previewFrameClassName="aspect-[4/1] w-full p-0"
          previewClassName="h-full w-full object-cover"
          labels={{
            hint: messages.cropHint,
            zoom: messages.cropZoom,
            offsetX: messages.cropOffsetX,
            offsetY: messages.cropOffsetY,
            apply: messages.cropApply,
            cancel: messages.cropCancel,
          }}
          state={backgroundCrop}
          setState={setBackgroundCrop}
          onApply={async () => {
            const croppedFile = await cropImageFile(
              backgroundCrop,
              "background-cropped.png",
              {
                outputWidth: 1600,
                outputHeight: 400,
              },
            );
            const nextTotalBytes = getEstimatedPersistedImagesBytes({
              nextBackgroundBytes: croppedFile.size,
            });
            if (nextTotalBytes > MAX_TOTAL_IMAGES_BYTES) {
              toast.warning(
                formatTemplate(messages.totalImagesSizeLimitError, {
                  maxMb: MAX_TOTAL_IMAGES_MB,
                }),
              );
              return;
            }
            const nextItem = createImageItems([croppedFile])[0];
            if (background) {
              URL.revokeObjectURL(background.previewUrl);
            }
            setBackground(nextItem);
            URL.revokeObjectURL(backgroundCrop.sourceUrl);
            setBackgroundCrop(null);
          }}
          onCancel={() => {
            URL.revokeObjectURL(backgroundCrop.sourceUrl);
            setBackgroundCrop(null);
          }}
        />
      ) : null}
      {isPostCreateModalOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-neutral-950/85 backdrop-blur-sm"
            onClick={closePostCreateModal}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-neutral-600/50 bg-neutral-950 p-6 shadow-[0_30px_90px_-40px_rgba(15,23,42,0.55)] sm:p-7">
            <h3 className="text-2xl font-semibold text-neutral-100 sm:text-3xl">
              {messages.postCreateModalTitle}
            </h3>
            <div className="mt-4 space-y-3 text-sm leading-6 text-neutral-300 sm:text-base">
              <p>
                {messages.postCreateModalIntro}
              </p>
              <p>
                {messages.postCreateModalCollabIntro}
              </p>
              <ul className="list-disc space-y-1 pl-5 marker:text-neutral-400">
                <li>{messages.postCreateModalBulletSupport}</li>
                <li>{messages.postCreateModalBulletCoCreate}</li>
                <li>{messages.postCreateModalBulletPartner}</li>
              </ul>
              <p>
                {messages.postCreateModalOutro}
              </p>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-200 hover:border-neutral-500"
                onClick={closePostCreateModal}
              >
                {messages.postCreateModalClose}
              </button>
              <button
                type="button"
                className="rounded-md bg-neutral-200 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-100"
                onClick={() => {
                  setIsPostCreateModalOpen(false);
                  router.push(withLang("/contact", locale));
                }}
              >
                {messages.postCreateModalContact}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}





