"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useToast } from "@/components/toast-provider";
import type { AppMessages } from "@/lib/i18n";

type AnnouncementApplyFormProps = {
  announcementId: string;
  canApply: boolean;
  defaultApplicant?: {
    name: string;
    email: string;
    phone: string;
  };
  storedCv?: {
    filename: string;
    size: number;
  } | null;
  messages: AppMessages["announcementDetails"];
};

type AnnouncementApplyFormValues = {
  name: string;
  email: string;
  phone: string;
  message: string;
  cv?: FileList;
};

const MAX_CV_BYTES = 8 * 1024 * 1024;
const ALLOWED_CV_EXTENSIONS = new Set(["pdf", "doc", "docx"]);
const ALLOWED_CV_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function getCvExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot < 0) {
    return "";
  }
  return filename.slice(lastDot + 1).toLowerCase();
}

function validateCvClientFile(file: File): "ok" | "required" | "too_large" | "invalid_type" {
  if (!file || !file.name?.trim() || file.size <= 0) {
    return "required";
  }

  if (file.size > MAX_CV_BYTES) {
    return "too_large";
  }

  const extension = getCvExtension(file.name);
  if (!ALLOWED_CV_EXTENSIONS.has(extension)) {
    return "invalid_type";
  }

  const normalizedType = (file.type || "").toLowerCase();
  if (normalizedType && !ALLOWED_CV_MIME_TYPES.has(normalizedType)) {
    return "invalid_type";
  }

  return "ok";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AnnouncementApplyForm({
  announcementId,
  canApply,
  defaultApplicant,
  storedCv = null,
  messages,
}: AnnouncementApplyFormProps) {
  const toast = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [useStoredCv, setUseStoredCv] = useState(Boolean(storedCv));
  const {
    clearErrors,
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting, submitCount },
  } = useForm<AnnouncementApplyFormValues>({
    defaultValues: {
      name: defaultApplicant?.name ?? "",
      email: defaultApplicant?.email ?? "",
      phone: defaultApplicant?.phone ?? "",
      message: "",
    },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  const showFieldErrors = submitCount > 0;
  const inputClass = (hasError: boolean): string =>
    `rounded-md border bg-slate-950 px-3 py-2 text-slate-100 ${
      hasError ? "border-rose-500" : "border-slate-700"
    }`;

  useEffect(() => {
    if (!isModalOpen) {
      return;
    }

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsModalOpen(false);
      }
    };

    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("keydown", onEscape);
    };
  }, [isModalOpen]);

  function openApplyModal() {
    reset({
      name: defaultApplicant?.name ?? "",
      email: defaultApplicant?.email ?? "",
      phone: defaultApplicant?.phone ?? "",
      message: "",
    });
    setUseStoredCv(Boolean(storedCv));
    setIsModalOpen(true);
  }

  const onSubmit = async (values: AnnouncementApplyFormValues) => {
    const shouldUseStoredCv = Boolean(storedCv) && useStoredCv;
    const cvFile = shouldUseStoredCv ? undefined : values.cv?.[0];
    if (!cvFile && !shouldUseStoredCv) {
      toast.warning(messages.cvRequired);
      return;
    }

    if (cvFile) {
      const status = validateCvClientFile(cvFile);
      if (status === "required") {
        toast.warning(messages.cvRequired);
        return;
      }
      if (status === "too_large") {
        toast.warning(messages.cvTooLarge);
        return;
      }
      if (status === "invalid_type") {
        toast.warning(messages.cvInvalidType);
        return;
      }
    }

    try {
      const payload = new FormData();
      payload.set("name", values.name);
      payload.set("email", values.email);
      payload.set("phone", values.phone);
      payload.set("message", values.message);
      if (cvFile) {
        payload.set("cv", cvFile, cvFile.name);
      } else if (shouldUseStoredCv) {
        payload.set("useStoredCv", "1");
      }

      const response = await fetch(`/api/announcements/${announcementId}/apply`, {
        method: "POST",
        body: payload,
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as
          | { error?: string; issues?: string[]; detail?: string }
          | null;
        const apiError = data?.error ?? "";
        const apiIssues = Array.isArray(data?.issues) ? data.issues : [];
        const apiDetail = typeof data?.detail === "string" ? data.detail.trim() : "";

        if (apiError === "No recipients configured for this announcement") {
          throw new Error(messages.applyNoRecipients);
        }
        if (apiError === "CV file is required") {
          throw new Error(messages.cvRequired);
        }
        if (apiError === "Unsupported CV file type") {
          throw new Error(messages.cvInvalidType);
        }
        if (apiError === "CV file is too large") {
          throw new Error(messages.cvTooLarge);
        }
        if (apiError === "Stored CV not found" || apiError === "Stored CV requires authentication") {
          throw new Error(messages.storedCvUnavailable);
        }

        if (apiError === "Validation failed" || apiIssues.length > 0) {
          throw new Error(messages.formError);
        }
        if (apiError === "Mail delivery failed" && apiDetail) {
          throw new Error(apiDetail);
        }

        throw new Error(messages.formError);
      }

      reset();
      setUseStoredCv(Boolean(storedCv));
      setIsModalOpen(false);
      toast.success(messages.formSuccess);
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : messages.formError,
      );
    }
  };

  return (
    <>
      <button
        type="button"
        className="w-full rounded-md bg-gradient-to-r from-rose-500 to-fuchsia-500 px-4 py-2 text-sm font-medium text-white transition hover:brightness-110"
        onClick={openApplyModal}
      >
        {messages.applyNowCta}
      </button>

      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-40 sm:inset-x-auto sm:right-6 sm:bottom-6">
        <button
          type="button"
          className="pointer-events-auto w-full rounded-xl bg-gradient-to-r from-rose-500 to-fuchsia-500 px-5 py-3 text-sm font-medium text-white shadow-[0_18px_40px_rgba(15,23,42,0.45)] transition hover:brightness-110 sm:w-auto"
          onClick={openApplyModal}
        >
          {messages.applyNowCta}
        </button>
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto [&>div:not(.fixed)]:my-auto [&>div:not(.fixed)]:max-h-[calc(100dvh-2rem)] [&>div:not(.fixed)]:!overflow-y-auto p-4">
          <div
            className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm"
            onClick={() => {
              setIsModalOpen(false);
            }}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">{messages.applyTitle}</h2>
                <p className="mt-1 text-sm text-slate-300">{messages.applySubtitle}</p>
              </div>
              <button
                type="button"
                className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500"
                onClick={() => {
                  setIsModalOpen(false);
                }}
              >
                {messages.closeModal}
              </button>
            </div>

            <div className="max-h-[80vh] overflow-y-auto p-4">
              {!canApply ? (
                <p className="rounded-md border border-amber-700/70 bg-amber-950/25 px-3 py-2 text-sm text-amber-100">
                  {messages.applyNoRecipients}
                </p>
              ) : (
                <form className="grid gap-3" onSubmit={handleSubmit(onSubmit)} noValidate>
                  <label className="grid gap-1 text-sm">
                    <span className="text-slate-300">
                      {messages.formName}
                      <span className="ml-1 text-rose-300">*</span>
                    </span>
                    <input
                      className={inputClass(Boolean(showFieldErrors && errors.name))}
                      {...register("name", {
                        required: messages.requiredField,
                        minLength: { value: 2, message: messages.requiredField },
                        maxLength: { value: 120, message: messages.requiredField },
                      })}
                    />
                    {showFieldErrors && errors.name?.message ? (
                      <p className="text-xs text-rose-300">{errors.name.message}</p>
                    ) : null}
                  </label>

                  <label className="grid gap-1 text-sm">
                    <span className="text-slate-300">
                      {messages.formEmail}
                      <span className="ml-1 text-rose-300">*</span>
                    </span>
                    <input
                      type="email"
                      className={inputClass(Boolean(showFieldErrors && errors.email))}
                      {...register("email", {
                        required: messages.requiredField,
                        pattern: {
                          value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                          message: messages.invalidEmail,
                        },
                        maxLength: { value: 220, message: messages.invalidEmail },
                      })}
                    />
                    {showFieldErrors && errors.email?.message ? (
                      <p className="text-xs text-rose-300">{errors.email.message}</p>
                    ) : null}
                  </label>

                  <label className="grid gap-1 text-sm">
                    <span className="text-slate-300">{messages.formPhone}</span>
                    <input
                      className={inputClass(Boolean(showFieldErrors && errors.phone))}
                      {...register("phone", {
                        maxLength: { value: 60, message: messages.formError },
                      })}
                    />
                    {showFieldErrors && errors.phone?.message ? (
                      <p className="text-xs text-rose-300">{errors.phone.message}</p>
                    ) : null}
                  </label>

                  <label className="grid gap-1 text-sm">
                    <span className="text-slate-300">{messages.formMessage}</span>
                    <textarea
                      rows={6}
                      className={inputClass(Boolean(showFieldErrors && errors.message))}
                      {...register("message")}
                    />
                  </label>

                  <label className="grid gap-1 text-sm">
                    <span className="text-slate-300">
                      {messages.formCv}
                      {!storedCv || !useStoredCv ? <span className="ml-1 text-rose-300">*</span> : null}
                    </span>
                    {storedCv ? (
                      <div className="rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-300">
                        <p>
                          {messages.storedCvLabel}: {storedCv.filename} ({formatFileSize(storedCv.size)})
                        </p>
                        <label className="mt-2 inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-sky-500"
                            checked={useStoredCv}
                            onChange={(event) => {
                              const nextUseStoredCv = event.target.checked;
                              setUseStoredCv(nextUseStoredCv);
                              if (nextUseStoredCv) {
                                setValue("cv", undefined);
                                clearErrors("cv");
                              }
                            }}
                          />
                          <span>{messages.useStoredCvLabel}</span>
                        </label>
                      </div>
                    ) : null}
                    {!storedCv || !useStoredCv ? (
                      <>
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                          className={inputClass(Boolean(showFieldErrors && errors.cv))}
                          {...register("cv", {
                            validate: (value) => {
                              const file = value?.[0];
                              if (!file) {
                                return storedCv && useStoredCv ? true : messages.cvRequired;
                              }
                              const status = validateCvClientFile(file);
                              if (status === "required") {
                                return messages.cvRequired;
                              }
                              if (status === "too_large") {
                                return messages.cvTooLarge;
                              }
                              if (status === "invalid_type") {
                                return messages.cvInvalidType;
                              }
                              return true;
                            },
                            onChange: (event) => {
                              if (event.target?.files?.[0]) {
                                setUseStoredCv(false);
                              }
                            },
                          })}
                        />
                        <p className="text-xs text-slate-300">{messages.cvHint}</p>
                        {showFieldErrors && errors.cv?.message ? (
                          <p className="text-xs text-rose-300">{errors.cv.message}</p>
                        ) : null}
                      </>
                    ) : null}
                  </label>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-md bg-gradient-to-r from-rose-500 to-fuchsia-500 px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-60"
                  >
                    {isSubmitting ? messages.formSubmitting : messages.formSubmit}
                  </button>

                  <div className="rounded-md border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs text-slate-400">
                    <p className="font-medium text-slate-300">{messages.dataInfoTitle}</p>
                    <p className="mt-1">{messages.dataInfoText}</p>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}


