"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import {
  JobDescriptionEditor,
  sanitizeJobDescriptionHtml,
} from "@/components/job-description-editor";
import { useToast } from "@/components/toast-provider";
import { normalizeExternalLink } from "@/lib/external-links";
import { stripHtmlToPlainText } from "@/lib/rich-text";
import { OFFER_TYPE } from "@/lib/offer-type";
import { withLang } from "@/lib/i18n";
import { ExternalLinksModal } from "@/components/new-offer-form/external-links-modal";
import {
  dedupeNonEmpty,
  getBranchAddressLabel,
  getOfferSubmitErrorMessage,
  resolveDefaultOfferValues,
  resolveSelectedBranch,
  resolveSelectedCompany,
  validateOfferForSubmit,
} from "@/components/new-offer-form/helpers";
import { OfferCompanyHero } from "@/components/new-offer-form/offer-company-hero";
import { OfferPreviewModal } from "@/components/new-offer-form/offer-preview-modal";
import type {
  NewOfferFormProps,
  OfferFormValues,
} from "@/components/new-offer-form/types";

export type { OfferCompany, OfferFormValues } from "@/components/new-offer-form/types";

export function NewOfferForm({
  locale,
  messages,
  descriptionEditorLabels,
  companies,
  mode = "create",
  initialValues,
  submitEndpoint = "/api/offers",
  submitMethod = "POST",
  submitLabel,
  successMessage,
  submitErrorMessage,
}: NewOfferFormProps) {
  const toast = useToast();
  const router = useRouter();
  const [externalLinkDraft, setExternalLinkDraft] = useState("https://");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isExternalLinkModalOpen, setIsExternalLinkModalOpen] = useState(false);

  const defaultValues = useMemo(
    () =>
      resolveDefaultOfferValues({
        companies,
        initialValues,
      }),
    [companies, initialValues],
  );

  const {
    control,
    register,
    setValue,
    getValues,
    handleSubmit,
    setError,
    clearErrors,
    reset,
    formState: { errors, isSubmitting, submitCount },
  } = useForm<OfferFormValues>({
    defaultValues,
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  useEffect(() => {
    register("tags");
    register("externalLinks");
  }, [register]);

  const companyId = useWatch({ control, name: "companyId" });
  const branchId = useWatch({ control, name: "branchId" });
  const offerType = useWatch({ control, name: "offerType" });
  const title = useWatch({ control, name: "title" });
  const description = useWatch({ control, name: "description" });
  const externalLinks = useWatch({ control, name: "externalLinks" }) ?? [];

  const selectedCompany = useMemo(
    () => resolveSelectedCompany(companies, companyId),
    [companies, companyId],
  );

  useEffect(() => {
    if (companies.length === 0 || selectedCompany) {
      return;
    }

    setValue("companyId", companies[0].id, { shouldDirty: false });
  }, [companies, selectedCompany, setValue]);

  useEffect(() => {
    if (!selectedCompany) {
      if (getValues("branchId")) {
        setValue("branchId", "", { shouldDirty: false });
      }
      return;
    }

    const currentBranchId = getValues("branchId");
    const hasCurrentBranch = selectedCompany.branches.some(
      (branch) => branch.id === currentBranchId,
    );
    if (hasCurrentBranch) {
      return;
    }

    setValue("branchId", selectedCompany.branches[0]?.id ?? "", {
      shouldDirty: false,
    });
  }, [getValues, selectedCompany, setValue]);

  const selectedBranch = useMemo(
    () => resolveSelectedBranch(selectedCompany, branchId),
    [selectedCompany, branchId],
  );

  const selectedBranchAddressLabel = useMemo(
    () => getBranchAddressLabel(selectedBranch),
    [selectedBranch],
  );

  const contactEmails = useMemo(
    () => dedupeNonEmpty([selectedCompany?.email, selectedBranch?.email]),
    [selectedBranch?.email, selectedCompany?.email],
  );
  const contactPhones = useMemo(
    () => dedupeNonEmpty([selectedCompany?.phone, selectedBranch?.phone]),
    [selectedBranch?.phone, selectedCompany?.phone],
  );

  const previewDescription = useMemo(
    () => sanitizeJobDescriptionHtml(description ?? ""),
    [description],
  );

  const offerTypeLabel =
    offerType === OFFER_TYPE.TRANSPORT
      ? messages.offerTypeTransport
      : messages.offerTypeCooperation;

  const effectiveSubmitLabel = submitLabel ?? messages.formSubmit;
  const effectiveSuccessMessage = successMessage ?? messages.submitSuccess;
  const effectiveSubmitErrorMessage = submitErrorMessage ?? messages.submitError;
  const shouldShowCompanySelect = companies.length !== 1;
  const shouldShowBranchSelect = (selectedCompany?.branches.length ?? 0) !== 1;
  const shouldShowSelectorSection = shouldShowCompanySelect || shouldShowBranchSelect;
  const showFieldErrors = submitCount > 0;

  useEffect(() => {
    if (!isPreviewOpen && !isExternalLinkModalOpen) {
      return;
    }

    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      setIsPreviewOpen(false);
      setIsExternalLinkModalOpen(false);
    };

    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("keydown", onEscape);
    };
  }, [isExternalLinkModalOpen, isPreviewOpen]);

  const addExternalLink = (rawValue: string): boolean => {
    const current = getValues("externalLinks");
    const normalized = normalizeExternalLink(rawValue);

    if (!normalized || current.length >= 10) {
      setError("externalLinks", {
        type: "manual",
        message: messages.externalLinksInvalid,
      });
      return false;
    }

    if (current.some((link) => link.toLowerCase() === normalized.toLowerCase())) {
      clearErrors("externalLinks");
      return true;
    }

    setValue("externalLinks", [...current, normalized], { shouldDirty: true });
    clearErrors("externalLinks");
    return true;
  };

  const removeExternalLink = (value: string) => {
    const current = getValues("externalLinks");
    setValue(
      "externalLinks",
      current.filter((link) => link !== value),
      { shouldDirty: true },
    );
    clearErrors("externalLinks");
  };

  const applyValidationErrors = (values: OfferFormValues): OfferFormValues | null => {
    clearErrors([
      "offerType",
      "branchId",
      "title",
      "description",
      "tags",
      "externalLinks",
    ]);

    const { fieldErrors, payload } = validateOfferForSubmit(values, messages);
    for (const [fieldName, message] of Object.entries(fieldErrors)) {
      if (!message) {
        continue;
      }

      setError(fieldName as keyof OfferFormValues, {
        type: "manual",
        message,
      });
    }

    if (Object.keys(fieldErrors).length > 0) {
      toast.warning(messages.validationError);
      return null;
    }

    return payload;
  };

  const onSubmit = async (values: OfferFormValues) => {
    const payload = applyValidationErrors(values);
    if (!payload) {
      return;
    }

    try {
      const response = await fetch(submitEndpoint, {
        method: submitMethod,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const responsePayload = (await response.json().catch(() => null)) as
        | { id?: string; error?: string; issues?: string[] }
        | null;

      if (!response.ok) {
        throw new Error(
          getOfferSubmitErrorMessage({
            apiError: responsePayload?.error,
            apiIssues: Array.isArray(responsePayload?.issues)
              ? responsePayload.issues
              : [],
            messages,
            fallback: effectiveSubmitErrorMessage,
          }),
        );
      }

      toast.success(effectiveSuccessMessage);
      clearErrors([
        "offerType",
        "branchId",
        "title",
        "description",
        "tags",
        "externalLinks",
      ]);

      if (mode === "create") {
        router.push(withLang("/companies/panel", locale));
        return;
      }

      if (mode === "edit") {
        const responseId = responsePayload?.id?.trim() ?? "";
        const endpointIdMatch = submitEndpoint.match(/\/api\/offers\/([^/?#]+)/);
        const endpointId = endpointIdMatch?.[1]?.trim() ?? "";
        const targetOfferId = responseId || endpointId;
        if (targetOfferId) {
          router.push(withLang(`/offers/${targetOfferId}`, locale));
        }
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : effectiveSubmitErrorMessage,
      );
    }
  };

  if (!selectedCompany) {
    return null;
  }

  return (
    <>
      <form
        onSubmit={handleSubmit(onSubmit, () => {
          applyValidationErrors(getValues());
        })}
        className="grid gap-5"
      >
        <input type="hidden" {...register("companyId")} />
        <input type="hidden" {...register("branchId")} />
        <input type="hidden" {...register("offerType")} />

        {shouldShowSelectorSection ? (
          <div className="grid gap-3">
            {shouldShowCompanySelect ? (
              <label className="grid min-w-0 w-full gap-1 text-sm md:w-1/2">
                <span className="text-slate-300">{messages.companySelect} *</span>
                <select
                  value={companyId ?? ""}
                  onChange={(event) => {
                    setValue("companyId", event.target.value, { shouldDirty: true });
                    clearErrors(["branchId", "companyId"]);
                  }}
                  className="w-full min-w-0 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                >
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {shouldShowBranchSelect ? (
              <label className="grid min-w-0 w-full gap-1 text-sm md:w-1/2">
                <span className="text-slate-300">{messages.branchSelect} *</span>
                <select
                  value={branchId ?? ""}
                  onChange={(event) => {
                    setValue("branchId", event.target.value, { shouldDirty: true });
                    clearErrors("branchId");
                  }}
                  className="w-full min-w-0 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                >
                  {(selectedCompany?.branches ?? []).map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.label}
                    </option>
                  ))}
                </select>
                {selectedBranch?.addressText ? (
                  <span className="truncate text-xs text-slate-500">
                    {selectedBranchAddressLabel}
                  </span>
                ) : null}
                {showFieldErrors && errors.branchId?.message ? (
                  <span className="text-xs text-red-300">{errors.branchId.message}</span>
                ) : null}
              </label>
            ) : null}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
          <OfferCompanyHero company={selectedCompany} />

          <div className="grid gap-5 p-5">
            <div className="grid gap-2 text-sm">
              <p className="text-slate-300">{messages.offerTypeLabel} *</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={`rounded-md border px-3 py-2 text-sm transition ${
                    offerType === OFFER_TYPE.TRANSPORT
                      ? "border-cyan-500 bg-cyan-500/15 text-cyan-200"
                      : "border-slate-700 text-slate-200 hover:border-slate-500"
                  }`}
                  onClick={() => {
                    setValue("offerType", OFFER_TYPE.TRANSPORT, { shouldDirty: true });
                    clearErrors("offerType");
                  }}
                >
                  {messages.offerTypeTransport}
                </button>
                <button
                  type="button"
                  className={`rounded-md border px-3 py-2 text-sm transition ${
                    offerType === OFFER_TYPE.COOPERATION
                      ? "border-cyan-500 bg-cyan-500/15 text-cyan-200"
                      : "border-slate-700 text-slate-200 hover:border-slate-500"
                  }`}
                  onClick={() => {
                    setValue("offerType", OFFER_TYPE.COOPERATION, {
                      shouldDirty: true,
                    });
                    clearErrors("offerType");
                  }}
                >
                  {messages.offerTypeCooperation}
                </button>
              </div>
              {showFieldErrors && errors.offerType?.message ? (
                <span className="text-xs text-red-300">{errors.offerType.message}</span>
              ) : null}
            </div>

            <label className="grid gap-1 text-sm">
              <span className="text-slate-300">{messages.formTitle} *</span>
              <input
                {...register("title")}
                className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                placeholder={messages.formTitle}
              />
              {showFieldErrors && errors.title?.message ? (
                <span className="text-xs text-red-300">{errors.title.message}</span>
              ) : null}
            </label>

            <div className="grid gap-1 text-sm">
              <span className="text-slate-300">{messages.formDescription} *</span>
              <Controller
                control={control}
                name="description"
                rules={{
                  validate: (value) => {
                    const normalized = sanitizeJobDescriptionHtml(value ?? "");
                    const plainDescription = stripHtmlToPlainText(normalized);
                    if (plainDescription.length < 20 || plainDescription.length > 5_000) {
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
                    placeholder={messages.descriptionFieldHint}
                    labels={descriptionEditorLabels}
                    disabled={isSubmitting}
                  />
                )}
              />
              {showFieldErrors && errors.description?.message ? (
                <span className="text-xs text-red-300">{errors.description.message}</span>
              ) : null}
            </div>

            <div className="grid gap-2">
              <div>
                <p className="text-sm text-slate-200">{messages.externalLinksTitle}</p>
                <p className="text-xs text-slate-400">{messages.externalLinksHint}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setExternalLinkDraft("https://");
                  setIsExternalLinkModalOpen(true);
                }}
                className="w-fit rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-500"
              >
                + {messages.externalLinksAdd}
              </button>
              {externalLinks.length === 0 ? (
                <p className="text-xs text-slate-500">{messages.externalLinksEmpty}</p>
              ) : (
                <ul className="space-y-2">
                  {externalLinks.map((link) => (
                    <li
                      key={link}
                      className="flex items-center justify-between gap-3 rounded-md border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs"
                    >
                      <span className="truncate text-slate-200">{link}</span>
                      <button
                        type="button"
                        onClick={() => {
                          removeExternalLink(link);
                        }}
                        className="shrink-0 text-slate-300 hover:text-slate-100"
                      >
                        {messages.removeLink}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {errors.externalLinks?.message ? (
                <span className="text-xs text-red-300">{errors.externalLinks.message}</span>
              ) : null}
            </div>

            <div className="grid gap-2 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
              <p className="text-sm text-slate-200">{messages.contactSectionTitle}</p>
              <p className="text-xs text-slate-400">{messages.contactSectionHint}</p>
              <div className="grid gap-3 text-xs md:grid-cols-2">
                <div>
                  <p className="font-medium text-slate-300">
                    {messages.contactEmailsLabel}
                  </p>
                  {contactEmails.length === 0 ? (
                    <p className="mt-1 text-slate-500">{messages.noContactData}</p>
                  ) : (
                    <ul className="mt-1 space-y-1 text-slate-200">
                      {contactEmails.map((email) => (
                        <li key={email}>{email}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <p className="font-medium text-slate-300">
                    {messages.contactPhonesLabel}
                  </p>
                  {contactPhones.length === 0 ? (
                    <p className="mt-1 text-slate-500">{messages.noContactData}</p>
                  ) : (
                    <ul className="mt-1 space-y-1 text-slate-200">
                      {contactPhones.map((phone) => (
                        <li key={phone}>{phone}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            {mode === "create" ? (
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-800 pt-4">
                <button
                  type="button"
                  className="rounded-md border border-indigo-500/70 bg-indigo-500/15 px-4 py-2 text-sm font-medium text-indigo-200 hover:border-indigo-400"
                  onClick={() => {
                    setIsPreviewOpen(true);
                  }}
                >
                  {messages.previewAction}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSubmitting ? messages.publishing : effectiveSubmitLabel}
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-800 pt-4">
                <button
                  type="button"
                  className="rounded-md border border-indigo-500/70 bg-indigo-500/15 px-4 py-2 text-sm font-medium text-indigo-200 hover:border-indigo-400"
                  onClick={() => {
                    setIsPreviewOpen(true);
                  }}
                >
                  {messages.previewAction}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSubmitting ? messages.publishing : effectiveSubmitLabel}
                </button>
              </div>
            )}
          </div>
        </div>

      </form>

      <OfferPreviewModal
        open={isPreviewOpen}
        company={selectedCompany}
        title={title ?? ""}
        offerTypeLabel={offerTypeLabel}
        previewDescription={previewDescription}
        previewLocation={selectedBranchAddressLabel}
        externalLinks={externalLinks}
        messages={messages}
        onClose={() => {
          setIsPreviewOpen(false);
        }}
      />

      <ExternalLinksModal
        open={isExternalLinkModalOpen}
        messages={messages}
        draft={externalLinkDraft}
        errorMessage={
          typeof errors.externalLinks?.message === "string"
            ? errors.externalLinks.message
            : undefined
        }
        onDraftChange={(value) => {
          setExternalLinkDraft(value);
          clearErrors("externalLinks");
        }}
        onClose={() => {
          setIsExternalLinkModalOpen(false);
        }}
        onConfirm={() => {
          const wasAdded = addExternalLink(externalLinkDraft);
          if (!wasAdded) {
            return;
          }

          setExternalLinkDraft("https://");
          setIsExternalLinkModalOpen(false);
        }}
      />
    </>
  );
}
