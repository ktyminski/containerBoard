"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import {
  MapLocationPicker,
} from "@/components/job-announcement-form-parts";
import { JobDescriptionEditor, sanitizeJobDescriptionHtml } from "@/components/job-description-editor";
import { ContactPersonsModal } from "@/components/new-job-announcement-form/modals/contact-persons-modal";
import { ExternalLinksModal } from "@/components/new-job-announcement-form/modals/external-links-modal";
import { JobAnnouncementPreviewModal } from "@/components/new-job-announcement-form/modals/preview-modal";
import { RequirementsModal } from "@/components/new-job-announcement-form/modals/requirements-modal";
import {
  type JobAnnouncementCompany,
  type JobAnnouncementContactDraft,
  type JobAnnouncementFormValues,
} from "@/components/new-job-announcement-form/types";
import { useAnnouncementPreviewModel } from "@/components/new-job-announcement-form/use-announcement-preview-model";
import {
  formatButtonClass,
  getBranchAddressLabel,
  validatePublishFields,
  isValidContactPerson,
} from "@/components/new-job-announcement-form/utils";
import { useToast } from "@/components/toast-provider";
import { normalizeExternalLink } from "@/lib/external-links";
import type { AppLocale, AppMessages } from "@/lib/i18n";
import { formatTemplate, LOCALE_HEADER_NAME, withLang } from "@/lib/i18n";
import {
  getCompanyFallbackColor,
  getCompanyFallbackGradient,
  getCompanyInitial,
} from "@/lib/company-logo-fallback";
import {
  JOB_ANNOUNCEMENT_REQUIREMENTS,
  JOB_ANNOUNCEMENT_PLAN_TIER,
  JOB_CONTRACT_TYPE,
  JOB_EMPLOYMENT_TYPE,
  JOB_RATE_PERIOD,
  JOB_WORK_LOCATION_MODE,
  JOB_WORK_MODEL,
  type JobContractType,
} from "@/lib/job-announcement";
import { stripHtmlToPlainText } from "@/lib/rich-text";

type GeocodeSearchResponse = {
  item: {
    lat: number;
    lng: number;
    label: string;
    shortLabel?: string;
  } | null;
  error?: string;
};

type ReverseGeocodeResponse = {
  item: {
    label: string;
    shortLabel?: string;
  } | null;
  error?: string;
};

type JobAnnouncementFormMode = "create" | "edit";

type NewJobAnnouncementFormProps = {
  locale: AppLocale;
  messages: AppMessages["announcementCreate"];
  companyBenefitLabels: AppMessages["companyCreate"]["benefitsOptions"];
  companyBenefitsTitle: string;
  companies: JobAnnouncementCompany[];
  mode?: JobAnnouncementFormMode;
  initialValues?: Partial<JobAnnouncementFormValues>;
  submitEndpoint?: string;
  submitMethod?: "POST" | "PATCH";
  announcementId?: string;
  submitLabel?: string;
  successMessage?: string;
  submitErrorMessage?: string;
};

export type { JobAnnouncementCompany, JobAnnouncementFormValues };

const MAX_ADDITIONAL_CONTACTS = 3;

export function NewJobAnnouncementForm({
  locale,
  messages,
  companyBenefitLabels,
  companyBenefitsTitle,
  companies,
  mode = "create",
  initialValues,
  submitEndpoint = "/api/announcements",
  submitMethod = "POST",
  announcementId,
  submitLabel,
  successMessage,
  submitErrorMessage,
}: NewJobAnnouncementFormProps) {
  const toast = useToast();
  const [externalLinkDraft, setExternalLinkDraft] = useState("https://");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isExternalLinksModalOpen, setIsExternalLinksModalOpen] = useState(false);
  const [isRequirementsModalOpen, setIsRequirementsModalOpen] = useState(false);
  const [isContactPersonsModalOpen, setIsContactPersonsModalOpen] = useState(false);
  const [contactPersonDraft, setContactPersonDraft] = useState<JobAnnouncementContactDraft>({
    name: "",
    phone: "",
    email: "",
  });
  const [isLocatingManual, setIsLocatingManual] = useState(false);
  const router = useRouter();

  const defaultCompany = companies[0] ?? null;
  const isCreateMode = mode === "create";

  const defaultValues = useMemo<JobAnnouncementFormValues>(() => {
    const baseCompanyId = initialValues?.companyId?.trim() || defaultCompany?.id || "";
    const baseCompany =
      companies.find((company) => company.id === baseCompanyId) ?? defaultCompany;
    const fallbackBranchId = baseCompany?.branches[0]?.id ?? "";

    const requestedBranchId = initialValues?.branchId?.trim() || "";
    const hasRequestedBranch = Boolean(
      requestedBranchId &&
        baseCompany?.branches.some((branch) => branch.id === requestedBranchId),
    );
    const initialApplicationEmail = initialValues?.applicationEmail?.trim() || "";

    return {
      contactPersons: initialValues?.contactPersons ?? [],
      companyId: baseCompany?.id ?? "",
      workLocationMode:
        initialValues?.workLocationMode ?? JOB_WORK_LOCATION_MODE.BRANCH,
      branchId: hasRequestedBranch ? requestedBranchId : fallbackBranchId,
      manualLocationText: initialValues?.manualLocationText ?? "",
      mapLat: initialValues?.mapLat ?? null,
      mapLng: initialValues?.mapLng ?? null,
      title: initialValues?.title ?? "",
      description: initialValues?.description ?? "",
      workModel: initialValues?.workModel ?? JOB_WORK_MODEL.ON_SITE,
      employmentType:
        initialValues?.employmentType ?? JOB_EMPLOYMENT_TYPE.FULL_TIME,
      contractTypes:
        initialValues?.contractTypes?.length
          ? initialValues.contractTypes
          : [JOB_CONTRACT_TYPE.EMPLOYMENT],
      salaryRatePeriod:
        initialValues?.salaryRatePeriod ?? JOB_RATE_PERIOD.MONTHLY,
      salaryFrom: initialValues?.salaryFrom ?? "",
      salaryTo: initialValues?.salaryTo ?? "",
      tags: initialValues?.tags ?? [],
      requirements: initialValues?.requirements ?? [],
      externalLinks: initialValues?.externalLinks ?? [],
      useCompanyOrBranchEmail: initialApplicationEmail.length === 0,
      applicationEmail: initialApplicationEmail,
    };
  }, [companies, defaultCompany, initialValues]);

  const {
    control,
    register,
    setValue,
    getValues,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    formState: { isSubmitting, errors, submitCount },
  } = useForm<JobAnnouncementFormValues>({
    defaultValues,
    mode: "onSubmit",
    reValidateMode: "onChange",
  });
  const {
    fields: contactPersonFields,
    append: appendContactPerson,
    remove: removeContactPerson,
  } = useFieldArray({
    control,
    name: "contactPersons",
  });

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const companyId = useWatch({ control, name: "companyId" });
  const workLocationMode = useWatch({ control, name: "workLocationMode" });
  const branchId = useWatch({ control, name: "branchId" });
  const manualLocationText = useWatch({ control, name: "manualLocationText" });
  const mapLat = useWatch({ control, name: "mapLat" });
  const mapLng = useWatch({ control, name: "mapLng" });
  const workModel = useWatch({ control, name: "workModel" });
  const employmentType = useWatch({ control, name: "employmentType" });
  const contractTypes = useWatch({ control, name: "contractTypes" });
  const salaryRatePeriod = useWatch({ control, name: "salaryRatePeriod" });
  const salaryFrom = useWatch({ control, name: "salaryFrom" });
  const salaryTo = useWatch({ control, name: "salaryTo" });
  const title = useWatch({ control, name: "title" });
  const description = useWatch({ control, name: "description" });
  const tags = useWatch({ control, name: "tags" });
  const requirements = useWatch({ control, name: "requirements" });
  const externalLinks = useWatch({ control, name: "externalLinks" });
  const contactPersons = useWatch({ control, name: "contactPersons" });
  const useCompanyOrBranchEmail = useWatch({
    control,
    name: "useCompanyOrBranchEmail",
  });

  const previewModel = useAnnouncementPreviewModel({
    companies,
    companyId,
    branchId,
    workLocationMode,
    manualLocationText,
    mapLat,
    mapLng,
    workModel,
    employmentType,
    contractTypes,
    salaryRatePeriod,
    salaryFrom,
    salaryTo,
    title,
    description: description ?? "",
    messages,
  });
  const selectedCompany = previewModel.selectedCompany;
  const selectedBranch = previewModel.selectedBranch;
  const selectedRecipientEmail = previewModel.selectedRecipientEmail;
  const logoFallbackColor = getCompanyFallbackColor(selectedCompany?.id ?? selectedCompany?.name ?? "");
  const backgroundFallbackGradient = getCompanyFallbackGradient(logoFallbackColor);
  const logoFallbackInitial = getCompanyInitial(selectedCompany?.name ?? "");

  useEffect(() => {
    if (!selectedRecipientEmail && useCompanyOrBranchEmail) {
      setValue("useCompanyOrBranchEmail", false, { shouldDirty: false });
    }
  }, [selectedRecipientEmail, setValue, useCompanyOrBranchEmail]);

  const previewDescription = previewModel.previewDescription;
  const previewLocation = previewModel.previewLocation;
  const previewLocationCity = previewModel.previewLocationCity;
  const mapPickerLat = previewModel.mapPickerLat;
  const mapPickerLng = previewModel.mapPickerLng;
  const salaryPreviewText = previewModel.salaryPreviewText;

  const salaryRangeInvalid = useMemo(() => {
    const from = Number(salaryFrom);
    const to = Number(salaryTo);
    if (!salaryFrom.trim() || !salaryTo.trim()) {
      return false;
    }
    if (!Number.isFinite(from) || !Number.isFinite(to)) {
      return true;
    }
    return from > to;
  }, [salaryFrom, salaryTo]);
  const showFieldErrors = submitCount > 0;
  const requirementOptions = useMemo(
    () =>
      JOB_ANNOUNCEMENT_REQUIREMENTS.map((value) => ({
        value,
        label: messages.requirementsOptions[value],
      })),
    [messages.requirementsOptions],
  );
  const selectedRequirementOptions = useMemo(() => {
    const selectedSet = new Set(requirements ?? []);
    return requirementOptions.filter((option) => selectedSet.has(option.value));
  }, [requirementOptions, requirements]);
  const selectedCompanyBenefitLabels = useMemo(
    () =>
      (selectedCompany?.benefits ?? [])
        .map((benefit) => companyBenefitLabels[benefit])
        .filter((label): label is string => Boolean(label)),
    [companyBenefitLabels, selectedCompany],
  );

  const inputClass = (hasError: boolean): string =>
    `rounded-md border bg-slate-950 px-3 py-2 text-slate-100 ${
      hasError ? "border-rose-500" : "border-slate-700"
    }`;

  const applyValidationErrors = (values: JobAnnouncementFormValues): boolean => {
    clearErrors([
      "branchId",
      "mapLat",
      "contractTypes",
      "requirements",
      "externalLinks",
      "contactPersons",
      "applicationEmail",
    ]);

    const { fieldErrors, contactPersonError } = validatePublishFields({
      values,
      selectedCompany,
      selectedBranch,
      selectedRecipientEmail,
      messages,
    });
    for (const [fieldName, message] of Object.entries(fieldErrors)) {
      if (!message) {
        continue;
      }

      setError(fieldName as keyof JobAnnouncementFormValues, {
        type: "manual",
        message,
      });
    }

    if (contactPersonError) {
      setError("contactPersons", {
        type: "manual",
        message: contactPersonError,
      });
      toast.warning(contactPersonError);
    }

    return Object.keys(fieldErrors).length === 0 && !contactPersonError;
  };

  const addExternalLink = (value: string): boolean => {
    const normalized = normalizeExternalLink(value);
    if (!normalized) {
      setError("externalLinks", {
        type: "manual",
        message: messages.externalLinksInvalid,
      });
      return false;
    }

    const current = getValues("externalLinks");
    if (current.includes(normalized)) {
      clearErrors("externalLinks");
      return true;
    }

    if (current.length >= 10) {
      setError("externalLinks", {
        type: "manual",
        message: messages.externalLinksInvalid,
      });
      return false;
    }

    clearErrors("externalLinks");
    setValue("externalLinks", [...current, normalized], { shouldDirty: true });
    return true;
  };

  const removeExternalLink = (value: string) => {
    const current = getValues("externalLinks");
    setValue(
      "externalLinks",
      current.filter((item) => item !== value),
      { shouldDirty: true },
    );
    clearErrors("externalLinks");
  };

  const addContactPersonFromDraft = (): boolean => {
    const name = contactPersonDraft.name.trim();
    const phone = contactPersonDraft.phone.trim();
    const email = contactPersonDraft.email.trim();

    if (!isValidContactPerson({ name, phone, email })) {
      setError("contactPersons", {
        type: "manual",
        message: messages.validationError,
      });
      return false;
    }

    const current = getValues("contactPersons");
    if (current.length >= MAX_ADDITIONAL_CONTACTS) {
      setError("contactPersons", {
        type: "manual",
        message: messages.validationError,
      });
      return false;
    }

    appendContactPerson({ name, phone, email });
    setContactPersonDraft({ name: "", phone: "", email: "" });
    clearErrors("contactPersons");
    return true;
  };

  const submitContactPersonDraft = (): void => {
    const wasAdded = addContactPersonFromDraft();
    if (!wasAdded) {
      return;
    }
    setIsContactPersonsModalOpen(false);
  };

  const resolveManualLocationFromPoint = async (lat: number, lng: number) => {
    try {
      const response = await fetch(
        `/api/geocode/reverse?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}&lang=${encodeURIComponent(locale)}`,
      );
      const data = (await response.json()) as ReverseGeocodeResponse;
      if (!response.ok || data.error || !data.item?.label) {
        return;
      }
      setValue("manualLocationText", data.item.shortLabel || data.item.label, {
        shouldDirty: true,
        shouldValidate: true,
      });
      clearErrors("manualLocationText");
    } catch {
      // ignore reverse geocode errors, coordinates are already set
    }
  };

  const locateManualLocation = async () => {
    const query = getValues("manualLocationText").trim();
    if (query.length < 3) {
      setError("manualLocationText", {
        type: "manual",
        message: messages.requiredField,
      });
      return;
    }

    setIsLocatingManual(true);
    try {
      const response = await fetch(
        `/api/geocode?q=${encodeURIComponent(query)}&lang=${encodeURIComponent(locale)}&limit=1`,
      );
      const data = (await response.json()) as GeocodeSearchResponse;
      if (!response.ok || data.error || !data.item) {
        setError("manualLocationText", {
          type: "manual",
          message: messages.validationError,
        });
        return;
      }

      setValue("manualLocationText", data.item.shortLabel || data.item.label, {
        shouldDirty: true,
        shouldValidate: true,
      });
      setValue("mapLat", data.item.lat, { shouldDirty: true, shouldValidate: true });
      setValue("mapLng", data.item.lng, { shouldDirty: true, shouldValidate: false });
      clearErrors("manualLocationText");
      clearErrors("mapLat");
    } catch {
      setError("manualLocationText", {
        type: "manual",
        message: messages.validationError,
      });
    } finally {
      setIsLocatingManual(false);
    }
  };

  const toggleContractType = (value: JobContractType) => {
    const current = getValues("contractTypes");
    if (current.includes(value)) {
      setValue(
        "contractTypes",
        current.filter((item) => item !== value),
        { shouldDirty: true },
      );
      return;
    }
    setValue("contractTypes", [...current, value], { shouldDirty: true });
  };

  const onSubmit = async (values: JobAnnouncementFormValues) => {
    const isValid = applyValidationErrors(values);
    if (!isValid) {
      return;
    }

    try {
      const normalizedValues: JobAnnouncementFormValues = {
        ...values,
        applicationEmail: values.useCompanyOrBranchEmail
          ? ""
          : values.applicationEmail.trim(),
      };
      const requestBody = isCreateMode
        ? {
            ...normalizedValues,
            planTier: JOB_ANNOUNCEMENT_PLAN_TIER.BASIC,
          }
        : normalizedValues;

      const response = await fetch(submitEndpoint, {
        method: submitMethod,
        headers: {
          "Content-Type": "application/json",
          [LOCALE_HEADER_NAME]: locale,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as
          | { error?: string; issues?: string[] }
          | null;
        const apiError = data?.error ?? "";
        const apiIssues = Array.isArray(data?.issues) ? data.issues : [];

        if (apiError === "Selected plan is not available yet") {
          throw new Error(messages.planNotAvailableYet);
        }
        if (apiError === "Invalid externalLinks value") {
          throw new Error(messages.externalLinksInvalid);
        }
        if (
          apiError === "Validation failed" ||
          apiError === "Invalid payload" ||
          apiError === "Manual location coordinates are required" ||
          apiError === "Manual location label is required" ||
          apiIssues.length > 0
        ) {
          throw new Error(messages.validationError);
        }
        if (apiError === "salaryFrom cannot be greater than salaryTo") {
          throw new Error(messages.salaryRangeInvalid);
        }

        throw new Error(submitErrorMessage ?? messages.submitError);
      }

      const data = (await response.json().catch(() => null)) as { id?: string } | null;

      clearErrors([
        "companyId",
        "title",
        "description",
        "branchId",
        "manualLocationText",
        "mapLat",
        "contractTypes",
        "requirements",
        "externalLinks",
        "contactPersons",
        "applicationEmail",
      ]);
      const persistedId =
        announcementId ?? (data?.id && data.id.trim() ? data.id : null);
      toast.success(successMessage ?? messages.submitSuccess);
      if (persistedId) {
        router.push(withLang(`/announcements/${persistedId}`, locale));
      }
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : (submitErrorMessage ?? messages.submitError),
      );
    }
  };

  useEffect(() => {
    if (
      !isPreviewOpen &&
      !isRequirementsModalOpen &&
      !isExternalLinksModalOpen &&
      !isContactPersonsModalOpen
    ) {
      return;
    }

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsPreviewOpen(false);
        setIsExternalLinksModalOpen(false);
        setIsRequirementsModalOpen(false);
        setIsContactPersonsModalOpen(false);
      }
    };

    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("keydown", onEscape);
    };
  }, [
    isExternalLinksModalOpen,
    isContactPersonsModalOpen,
    isPreviewOpen,
    isRequirementsModalOpen,
  ]);

  if (!selectedCompany) {
    return null;
  }

  return (
    <>
      <section className="grid gap-5">
        <input
          type="hidden"
          {...register("companyId", {
            required: messages.requiredField,
          })}
        />
        {companies.length !== 1 ? (
          <div className="grid gap-1 text-sm sm:max-w-xl">
            <span className="text-slate-300">
              {messages.companySelect}
              <span className="ml-1 text-current">*</span>
            </span>
            <select
              className={inputClass(Boolean(showFieldErrors && errors.companyId))}
              value={companyId}
              onChange={(event) => {
                const nextCompanyId = event.target.value;
                const nextCompany = companies.find((company) => company.id === nextCompanyId);
                clearErrors("companyId");
                clearErrors("branchId");
                setValue("companyId", nextCompanyId, { shouldDirty: true });
                setValue("branchId", nextCompany?.branches[0]?.id ?? "", { shouldDirty: true });
              }}
            >
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
            {showFieldErrors && errors.companyId?.message ? (
              <p className="text-xs text-rose-300">{errors.companyId.message}</p>
            ) : null}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
          <div className="relative overflow-hidden border-b border-slate-800 bg-slate-950">
            <div className="relative aspect-[4/1] w-full">
              {selectedCompany.backgroundUrl ? (
                <Image
                  src={selectedCompany.backgroundUrl}
                  alt={formatTemplate(messages.previewBackgroundAlt, {
                    company: selectedCompany.name,
                  })}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1280px) 100vw, 900px"
                />
              ) : (
                <div className="h-full w-full" style={{ backgroundImage: backgroundFallbackGradient }} />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10" />
              <div className="absolute bottom-4 left-4 z-10 flex max-w-[calc(100%-2rem)] items-end gap-3">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border-2 border-slate-700 bg-slate-900 sm:h-12 sm:w-12 md:h-24 md:w-24 lg:h-32 lg:w-32">
                  {selectedCompany.logoUrl ? (
                    <Image
                      src={selectedCompany.logoUrl}
                      alt={formatTemplate(messages.previewLogoAlt, {
                        company: selectedCompany.name,
                      })}
                      fill
                      className="object-cover"
                      sizes="(max-width: 767px) 48px, (max-width: 1023px) 96px, 128px"
                      quality={100}
                    />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center text-lg font-semibold text-white md:text-2xl"
                      style={{ backgroundColor: logoFallbackColor }}
                      aria-label={formatTemplate(messages.previewLogoAlt, {
                        company: selectedCompany.name,
                      })}
                    >
                      {logoFallbackInitial}
                    </div>
                  )}
                </div>
                <p className="max-w-[400px] min-w-0 truncate pb-1 text-base font-semibold text-white/95 sm:text-lg">
                  {selectedCompany.name}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-4 sm:p-5">
            <label className="grid gap-1 text-sm">
              <span className="text-slate-300">
                {messages.formTitle}
                <span className="ml-1 text-current">*</span>
              </span>
              <input
                className={inputClass(Boolean(showFieldErrors && errors.title))}
                placeholder={messages.formTitle}
                {...register("title", {
                  required: messages.requiredField,
                  validate: (value) => {
                    const trimmed = value.trim();
                    if (trimmed.length < 3 || trimmed.length > 180) {
                      return messages.titleLengthError;
                    }
                    return true;
                  },
                  onChange: () => {
                    clearErrors("title");
                  },
                })}
              />
              {showFieldErrors && errors.title?.message ? (
                <p className="text-xs text-rose-300">{errors.title.message}</p>
              ) : null}
            </label>

            <div className="grid gap-1 text-sm">
              <span className="text-slate-300">
                {messages.formDescription}
                <span className="ml-1 text-current">*</span>
              </span>
              <Controller
                control={control}
                name="description"
                rules={{
                  required: messages.requiredField,
                  validate: (value) => {
                    const sanitized = sanitizeJobDescriptionHtml(value ?? "").trim();
                    const plainDescription = stripHtmlToPlainText(sanitized);
                    if (plainDescription.length < 20 || plainDescription.length > 5000) {
                      return messages.descriptionLengthError;
                    }
                    return true;
                  },
                }}
                render={({ field }) => (
                  <JobDescriptionEditor
                    value={field.value}
                    onChange={(nextValue) => {
                      clearErrors("description");
                      field.onChange(nextValue);
                    }}
                    labels={messages.descriptionEditor}
                    disabled={isSubmitting}
                  />
                )}
              />
              {showFieldErrors && errors.description?.message ? (
                <p className="text-xs text-rose-300">{errors.description.message}</p>
              ) : null}
              <p className="text-xs text-slate-500">{messages.descriptionFieldHint}</p>
            </div>
          </div>

          <div className="grid gap-4 px-4 pt-4 sm:px-5">
            <div className="grid gap-2">
              <p className="text-sm font-semibold text-slate-200">
                Miejsce pracy
                <span className="ml-1 text-current">*</span>
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={formatButtonClass(workLocationMode === JOB_WORK_LOCATION_MODE.BRANCH)}
                  onClick={() => {
                    clearErrors("branchId");
                    clearErrors("manualLocationText");
                    clearErrors("mapLat");
                    setValue("workLocationMode", JOB_WORK_LOCATION_MODE.BRANCH, { shouldDirty: true });
                  }}
                >
                  Oddzial firmy
                </button>
                <button
                  type="button"
                  className={formatButtonClass(workLocationMode === JOB_WORK_LOCATION_MODE.ANYWHERE)}
                  onClick={() => {
                    clearErrors("branchId");
                    clearErrors("manualLocationText");
                    clearErrors("mapLat");
                    setValue("workLocationMode", JOB_WORK_LOCATION_MODE.ANYWHERE, { shouldDirty: true });
                  }}
                >
                  Dowolne
                </button>
                <button
                  type="button"
                  className={formatButtonClass(
                    workLocationMode === JOB_WORK_LOCATION_MODE.MANUAL ||
                      workLocationMode === JOB_WORK_LOCATION_MODE.MAP,
                  )}
                  onClick={() => {
                    clearErrors("branchId");
                    clearErrors("mapLat");
                    setValue("workLocationMode", JOB_WORK_LOCATION_MODE.MANUAL, { shouldDirty: true });
                  }}
                >
                  Wybierz
                </button>
              </div>
            </div>

            {workLocationMode === JOB_WORK_LOCATION_MODE.BRANCH ? (
              selectedCompany.branches.length === 0 ? (
                <p className="text-xs text-amber-200">
                  Ta firma nie ma oddzialow. Wybierz inny sposob wskazania miejsca pracy.
                </p>
              ) : selectedCompany.branches.length === 1 ? (
                null
              ) : (
                <label className="grid gap-1 text-sm">
                  <span className="text-slate-300">
                    {messages.branchSelect}
                    <span className="ml-1 text-current">*</span>
                  </span>
                  <select
                    className={inputClass(Boolean(showFieldErrors && errors.branchId))}
                    value={branchId}
                    onChange={(event) => {
                      clearErrors("branchId");
                      setValue("branchId", event.target.value, { shouldDirty: true });
                    }}
                  >
                    {selectedCompany.branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.label} - {getBranchAddressLabel(branch)}
                      </option>
                    ))}
                  </select>
                  {showFieldErrors && errors.branchId?.message ? (
                    <p className="text-xs text-rose-300">{errors.branchId.message}</p>
                  ) : null}
                </label>
              )
            ) : null}

            {workLocationMode === JOB_WORK_LOCATION_MODE.MANUAL ||
            workLocationMode === JOB_WORK_LOCATION_MODE.MAP ? (
              <label className="grid gap-1 text-sm">
                <span className="text-slate-300">
                  {messages.manualLocationLabel}
                  <span className="ml-1 text-current">*</span>
                </span>
                <div className="flex overflow-hidden rounded-md border border-slate-700 bg-slate-950">
                  <input
                    className="w-full bg-transparent px-3 py-2 text-slate-100 outline-none"
                    placeholder={messages.manualLocationPlaceholder}
                    {...register("manualLocationText", {
                      validate: (value) => {
                        if (workLocationMode !== JOB_WORK_LOCATION_MODE.MANUAL) {
                          return true;
                        }
                        return value.trim().length > 0 || messages.requiredField;
                      },
                      onChange: () => {
                        clearErrors("manualLocationText");
                        clearErrors("mapLat");
                        setValue("mapLat", null, { shouldDirty: true, shouldValidate: false });
                        setValue("mapLng", null, { shouldDirty: true, shouldValidate: false });
                      },
                    })}
                  />
                  <button
                    type="button"
                    className="cursor-pointer border-l border-slate-700 px-3 text-xs text-slate-200 hover:bg-slate-800/80 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isLocatingManual}
                    onClick={() => {
                      void locateManualLocation();
                    }}
                  >
                    {isLocatingManual
                      ? messages.manualLocationLookupSearching
                      : messages.manualLocationLookupAction}
                  </button>
                </div>
                {showFieldErrors && errors.manualLocationText?.message ? (
                  <p className="text-xs text-rose-300">
                    {errors.manualLocationText.message}
                  </p>
                ) : null}
              </label>
            ) : null}

            <div className="grid gap-1">
              <div
                className={
                  showFieldErrors &&
                  (workLocationMode === JOB_WORK_LOCATION_MODE.MAP ||
                    workLocationMode === JOB_WORK_LOCATION_MODE.MANUAL) &&
                  errors.mapLat
                    ? "rounded-md ring-1 ring-rose-500 p-1"
                    : ""
                }
              >
                <MapLocationPicker
                  lat={mapPickerLat}
                  lng={mapPickerLng}
                  labels={{
                    hint:
                      workLocationMode === JOB_WORK_LOCATION_MODE.MANUAL ||
                      workLocationMode === JOB_WORK_LOCATION_MODE.MAP
                        ? messages.mapPickerHint
                        : "",
                  }}
                  onChange={(next) => {
                    clearErrors("mapLat");
                    setValue("mapLat", next.lat, { shouldDirty: true });
                    setValue("mapLng", next.lng, { shouldDirty: true });
                    if (
                      workLocationMode === JOB_WORK_LOCATION_MODE.MANUAL ||
                      workLocationMode === JOB_WORK_LOCATION_MODE.MAP
                    ) {
                      void resolveManualLocationFromPoint(next.lat, next.lng);
                    }
                  }}
                />
              </div>
              {showFieldErrors &&
              (workLocationMode === JOB_WORK_LOCATION_MODE.MAP ||
                workLocationMode === JOB_WORK_LOCATION_MODE.MANUAL) &&
              errors.mapLat?.message ? (
                <p className="text-xs text-rose-300">{errors.mapLat.message}</p>
              ) : null}
              {workLocationMode === JOB_WORK_LOCATION_MODE.ANYWHERE ? (
                <p className="text-xs text-slate-300">{messages.locationAnywhereHint}</p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 px-4 pt-4 sm:px-5">
            <div className="grid gap-2">
              <p className="text-sm font-semibold text-slate-200">{messages.workModelTitle}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={formatButtonClass(workModel === JOB_WORK_MODEL.ON_SITE)}
                  onClick={() => {
                    setValue("workModel", JOB_WORK_MODEL.ON_SITE, { shouldDirty: true });
                  }}
                >
                  {messages.workModels.on_site}
                </button>
                <button
                  type="button"
                  className={formatButtonClass(workModel === JOB_WORK_MODEL.HYBRID)}
                  onClick={() => {
                    setValue("workModel", JOB_WORK_MODEL.HYBRID, { shouldDirty: true });
                  }}
                >
                  {messages.workModels.hybrid}
                </button>
                <button
                  type="button"
                  className={formatButtonClass(workModel === JOB_WORK_MODEL.REMOTE)}
                  onClick={() => {
                    setValue("workModel", JOB_WORK_MODEL.REMOTE, { shouldDirty: true });
                  }}
                >
                  {messages.workModels.remote}
                </button>
              </div>
            </div>

            <div className="grid gap-2">
              <p className="text-sm font-semibold text-slate-200">{messages.employmentTypeTitle}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={formatButtonClass(employmentType === JOB_EMPLOYMENT_TYPE.FULL_TIME)}
                  onClick={() => {
                    setValue("employmentType", JOB_EMPLOYMENT_TYPE.FULL_TIME, { shouldDirty: true });
                  }}
                >
                  {messages.employmentTypes.full_time}
                </button>
                <button
                  type="button"
                  className={formatButtonClass(employmentType === JOB_EMPLOYMENT_TYPE.PART_TIME)}
                  onClick={() => {
                    setValue("employmentType", JOB_EMPLOYMENT_TYPE.PART_TIME, { shouldDirty: true });
                  }}
                >
                  {messages.employmentTypes.part_time}
                </button>
              </div>
            </div>

            <div className="grid gap-2">
              <p className="text-sm font-semibold text-slate-200">
                {messages.contractTypeTitle}
                <span className="ml-1 text-current">*</span>
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={formatButtonClass(contractTypes.includes(JOB_CONTRACT_TYPE.B2B))}
                  onClick={() => {
                    clearErrors("contractTypes");
                    toggleContractType(JOB_CONTRACT_TYPE.B2B);
                  }}
                >
                  {messages.contractTypes.b2b}
                </button>
                <button
                  type="button"
                  className={formatButtonClass(contractTypes.includes(JOB_CONTRACT_TYPE.EMPLOYMENT))}
                  onClick={() => {
                    clearErrors("contractTypes");
                    toggleContractType(JOB_CONTRACT_TYPE.EMPLOYMENT);
                  }}
                >
                  {messages.contractTypes.employment}
                </button>
                <button
                  type="button"
                  className={formatButtonClass(contractTypes.includes(JOB_CONTRACT_TYPE.MANDATE))}
                  onClick={() => {
                    clearErrors("contractTypes");
                    toggleContractType(JOB_CONTRACT_TYPE.MANDATE);
                  }}
                >
                  {messages.contractTypes.mandate}
                </button>
                <button
                  type="button"
                  className={formatButtonClass(contractTypes.includes(JOB_CONTRACT_TYPE.SPECIFIC_WORK))}
                  onClick={() => {
                    clearErrors("contractTypes");
                    toggleContractType(JOB_CONTRACT_TYPE.SPECIFIC_WORK);
                  }}
                >
                  {messages.contractTypes.specific_work}
                </button>
                <button
                  type="button"
                  className={formatButtonClass(contractTypes.includes(JOB_CONTRACT_TYPE.INTERNSHIP))}
                  onClick={() => {
                    clearErrors("contractTypes");
                    toggleContractType(JOB_CONTRACT_TYPE.INTERNSHIP);
                  }}
                >
                  {messages.contractTypes.internship}
                </button>
              </div>
              {showFieldErrors && errors.contractTypes?.message ? (
                <p className="text-xs text-rose-300">{errors.contractTypes.message}</p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <p className="text-sm font-semibold text-slate-200">{messages.salaryTitle}</p>
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(220px,260px)] sm:items-end">
                <label className="grid gap-1 text-sm">
                  <span className="text-slate-300">{messages.salaryFromLabel}</span>
                  <input
                    type="number"
                    min={0}
                    step={salaryRatePeriod === JOB_RATE_PERIOD.MONTHLY ? 100 : 1}
                    className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                    placeholder={
                      salaryRatePeriod === JOB_RATE_PERIOD.MONTHLY
                        ? messages.salaryFromPlaceholderMonthly
                        : messages.salaryFromPlaceholderHourly
                    }
                    {...register("salaryFrom")}
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="text-slate-300">{messages.salaryToLabel}</span>
                  <input
                    type="number"
                    min={0}
                    step={salaryRatePeriod === JOB_RATE_PERIOD.MONTHLY ? 100 : 1}
                    className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                    placeholder={
                      salaryRatePeriod === JOB_RATE_PERIOD.MONTHLY
                        ? messages.salaryToPlaceholderMonthly
                        : messages.salaryToPlaceholderHourly
                    }
                    {...register("salaryTo")}
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className={`${formatButtonClass(
                      salaryRatePeriod === JOB_RATE_PERIOD.MONTHLY,
                    )} inline-flex h-10 w-full items-center justify-center px-3 text-sm`}
                    onClick={() => {
                      setValue("salaryRatePeriod", JOB_RATE_PERIOD.MONTHLY, { shouldDirty: true });
                    }}
                  >
                    {messages.salaryRateMonthly}
                  </button>
                  <button
                    type="button"
                    className={`${formatButtonClass(
                      salaryRatePeriod === JOB_RATE_PERIOD.HOURLY,
                    )} inline-flex h-10 w-full items-center justify-center px-3 text-sm`}
                    onClick={() => {
                      setValue("salaryRatePeriod", JOB_RATE_PERIOD.HOURLY, { shouldDirty: true });
                    }}
                  >
                    {messages.salaryRateHourly}
                  </button>
                </div>
              </div>
              {salaryRangeInvalid ? (
                <p className="text-xs text-amber-200">{messages.salaryRangeInvalid}</p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 px-4 pt-4 sm:px-5">
            <div>
              <p className="text-sm font-semibold text-slate-200">{messages.requirementsTitle}</p>
            </div>
            {selectedRequirementOptions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {selectedRequirementOptions.map((requirement) => (
                  <div
                    key={requirement.value}
                    className="inline-flex items-center rounded-md border border-sky-400/35 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-100"
                  >
                    {requirement.label}
                  </div>
                ))}
              </div>
            ) : null}
            <div>
              <button
                type="button"
                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 hover:border-slate-500"
                onClick={() => {
                  setIsRequirementsModalOpen(true);
                }}
              >
                {messages.requirementsOpenModal}
              </button>
            </div>
          </div>

          <div className="grid gap-2 px-4 pt-4 sm:px-5">
            <p className="text-sm font-semibold text-slate-200">{messages.externalLinksTitle}</p>
            <p className="text-xs text-slate-400">{messages.externalLinksHint}</p>
            <button
              type="button"
              className="w-fit rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-500"
              onClick={() => {
                setExternalLinkDraft("https://");
                setIsExternalLinksModalOpen(true);
              }}
            >
              + {messages.externalLinksAdd}
            </button>
            {errors.externalLinks?.message ? (
              <p className="text-xs text-rose-300">{errors.externalLinks.message}</p>
            ) : null}
            {externalLinks.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {externalLinks.map((link) => (
                  <span
                    key={link}
                    className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-200"
                  >
                    {link}
                    <button
                      type="button"
                      className="rounded border border-rose-700 px-1 text-[10px] text-rose-200 hover:border-rose-500"
                      onClick={() => {
                        removeExternalLink(link);
                      }}
                      aria-label={formatTemplate(messages.externalLinkRemoveAria, { link })}
                    >
                      x
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">{messages.externalLinksEmpty}</p>
            )}
          </div>

          <div className="grid gap-3 px-4 pt-4 sm:px-5">
            <div>
              <div>
                <p className="text-sm font-semibold text-slate-200">
                  {messages.contactPeopleTitle}
                </p>
                <p className="text-xs text-slate-400">{messages.contactPeopleHint}</p>
              </div>
            </div>
            <div className="rounded-md border border-slate-800 bg-slate-950/60 p-3">
              <p className="text-sm font-semibold text-slate-200">
                {messages.applicationEmailSectionTitle}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {messages.applicationEmailSectionHint}
              </p>
              <Controller
                name="useCompanyOrBranchEmail"
                control={control}
                render={({ field }) => (
                  <label className="mt-2 inline-flex items-center gap-2 text-sm text-slate-200">
                    <input
                      type="checkbox"
                      checked={Boolean(field.value)}
                      disabled={!selectedRecipientEmail}
                      onChange={(event) => {
                        clearErrors("applicationEmail");
                        field.onChange(event.target.checked);
                        if (event.target.checked) {
                          setValue("applicationEmail", "", { shouldDirty: true });
                        }
                      }}
                      className="h-4 w-4 rounded border-slate-500 bg-slate-800 text-sky-400 accent-sky-400 focus:ring-sky-500 [color-scheme:dark] disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    <span>
                      {selectedRecipientEmail
                        ? formatTemplate(messages.applicationEmailUseCompanyBranch, {
                            email: selectedRecipientEmail,
                          })
                        : messages.applicationEmailMissingCompany}
                    </span>
                  </label>
                )}
              />
              {!useCompanyOrBranchEmail ? (
                <label className="mt-2 grid gap-1">
                  <span className="text-xs text-slate-300">
                    {messages.applicationEmailCustomLabel}
                  </span>
                  <input
                    {...register("applicationEmail")}
                    type="email"
                    maxLength={220}
                    placeholder={messages.contactPersonEmail}
                    className={inputClass(Boolean(showFieldErrors && errors.applicationEmail))}
                  />
                </label>
              ) : null}
              {showFieldErrors && errors.applicationEmail?.message ? (
                <p className="mt-2 text-xs text-rose-300">{errors.applicationEmail.message}</p>
              ) : null}
            </div>
            <button
              type="button"
              className="w-fit rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-500"
              onClick={() => {
                setContactPersonDraft({ name: "", phone: "", email: "" });
                setIsContactPersonsModalOpen(true);
              }}
            >
              + {messages.contactPeopleAdd}
            </button>
            {showFieldErrors && errors.contactPersons?.message ? (
              <p className="text-xs text-rose-300">{errors.contactPersons.message}</p>
            ) : null}
            {contactPersonFields.length === 0 ? (
              <p className="text-xs text-slate-400">{messages.contactPeopleEmpty}</p>
            ) : (
              <div className="grid gap-2">
                {contactPersonFields.map((field, index) => (
                  <div
                    key={field.id}
                    className="flex items-start justify-between gap-3 rounded-md border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-300"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-100">
                        {contactPersons?.[index]?.name?.trim() ||
                          messages.contactPersonLabel.replace("{index}", String(index + 1))}
                      </p>
                      {contactPersons?.[index]?.email?.trim() ? (
                        <p>{contactPersons[index]?.email}</p>
                      ) : null}
                      {contactPersons?.[index]?.phone?.trim() ? (
                        <p>{contactPersons[index]?.phone}</p>
                      ) : null}
                      {!contactPersons?.[index]?.email?.trim() &&
                      !contactPersons?.[index]?.phone?.trim() ? (
                        <p>-</p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="rounded border border-rose-700 px-2 py-1 text-[11px] text-rose-200 hover:border-rose-500"
                      onClick={() => {
                        clearErrors("contactPersons");
                        removeContactPerson(index);
                      }}
                      aria-label={messages.contactPeopleRemove}
                    >
                      X
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 px-4 pt-4 pb-4 sm:px-5 sm:pb-5">
            <button
              type="button"
              className="rounded-md border border-indigo-500/70 bg-indigo-500/15 px-4 py-2 text-sm font-medium text-indigo-200 hover:border-indigo-400"
              onClick={() => {
                setIsPreviewOpen(true);
              }}
            >
              {messages.previewOpen}
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              className="rounded-md bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-sky-400 disabled:opacity-60"
              onClick={() => {
                void handleSubmit(
                  (values) => {
                    void onSubmit(values);
                  },
                  () => {
                    toast.warning(messages.validationError);
                  },
                )();
              }}
            >
              {isSubmitting ? messages.publishing : (submitLabel ?? messages.formSubmit)}
            </button>
          </div>
        </div>
      </section>

      <JobAnnouncementPreviewModal
        isOpen={isPreviewOpen}
        messages={messages}
        selectedCompany={selectedCompany}
        selectedCompanyBenefitLabels={selectedCompanyBenefitLabels}
        companyBenefitsTitle={companyBenefitsTitle}
        title={title}
        workModel={workModel}
        employmentType={employmentType}
        contractTypes={contractTypes}
        previewLocationCity={previewLocationCity}
        previewLocation={previewLocation}
        previewDescription={previewDescription}
        salaryPreviewText={salaryPreviewText}
        tags={tags}
        selectedRequirementLabels={selectedRequirementOptions.map((item) => item.label)}
        externalLinks={externalLinks}
        contactPersons={contactPersons ?? []}
        onClose={() => {
          setIsPreviewOpen(false);
        }}
      />

      <ExternalLinksModal
        isOpen={isExternalLinksModalOpen}
        messages={messages}
        externalLinkDraft={externalLinkDraft}
        errorMessage={errors.externalLinks?.message}
        onClose={() => {
          setIsExternalLinksModalOpen(false);
        }}
        onDraftChange={(value) => {
          setExternalLinkDraft(value);
          clearErrors("externalLinks");
        }}
        onAddLink={() => {
          const wasAdded = addExternalLink(externalLinkDraft);
          if (wasAdded) {
            setExternalLinkDraft("https://");
          }
          return wasAdded;
        }}
      />

      <ContactPersonsModal
        isOpen={isContactPersonsModalOpen}
        messages={messages}
        draft={contactPersonDraft}
        maxReached={contactPersonFields.length >= MAX_ADDITIONAL_CONTACTS}
        errorMessage={errors.contactPersons?.message}
        onClose={() => {
          setIsContactPersonsModalOpen(false);
        }}
        onDraftChange={setContactPersonDraft}
        onSubmitDraft={submitContactPersonDraft}
        onClearError={() => {
          clearErrors("contactPersons");
        }}
      />

      <RequirementsModal
        isOpen={isRequirementsModalOpen}
        messages={messages}
        requirementOptions={requirementOptions}
        register={register}
        onClose={() => {
          setIsRequirementsModalOpen(false);
        }}
      />
    </>
  );
}
