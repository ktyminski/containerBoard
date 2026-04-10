"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { createPortal } from "react-dom";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { useToast } from "@/components/toast-provider";
import {
  CountryFlag,
  LeadRequestSubmitError,
  getTransportModeIcon,
  getTransportModeLabel,
  resolveCountryCodeFromSuggestions,
  useLocationSuggestions,
  isValidEmail,
  type LeadRequestBoardItem,
  type LeadRequestFormValues,
  type LeadRequestSubmitPayload,
  type ModalMode,
} from "@/components/lead-requests-board.shared";
import {
  LEAD_REQUEST_TRANSPORT_MODE,
  LEAD_REQUEST_TYPE,
} from "@/lib/lead-request-types";
import type { AppMessages } from "@/lib/i18n";

type LeadRequestFormModalProps = {
  isOpen: boolean;
  mode: ModalMode;
  messages: AppMessages["leadRequestsPage"];
  intlLocale: string;
  initialValues: LeadRequestFormValues;
  editingItem: LeadRequestBoardItem | null;
  turnstileSiteKey?: string | null;
  isExtending: boolean;
  onClose: () => void;
  onSubmit: (payload: LeadRequestSubmitPayload) => Promise<void>;
  onExtend: () => Promise<void>;
};

export function LeadRequestFormModal({
  isOpen,
  mode,
  messages,
  intlLocale,
  initialValues,
  editingItem,
  turnstileSiteKey,
  isExtending,
  onClose,
  onSubmit,
  onExtend,
}: LeadRequestFormModalProps) {
  const toast = useToast();
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileRefreshKey, setTurnstileRefreshKey] = useState(0);
  const {
    register,
    handleSubmit,
    setValue,
    reset,
    setError,
    clearErrors,
    control,
    formState: { errors, isSubmitting },
  } = useForm<LeadRequestFormValues>({
    defaultValues: initialValues,
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  useEffect(() => {
    register("leadType");
    register("transportMode");
    register("originCountryCode");
    register("destinationCountryCode");
  }, [register]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    reset(initialValues);
    setTurnstileToken("");
    setTurnstileRefreshKey((current) => current + 1);
  }, [initialValues, isOpen, reset]);

  const leadType = useWatch({ control, name: "leadType" });
  const transportMode = useWatch({ control, name: "transportMode" });
  const originLocation = useWatch({ control, name: "originLocation" }) ?? "";
  const originCountryCode = useWatch({ control, name: "originCountryCode" }) ?? "";
  const destinationLocation = useWatch({ control, name: "destinationLocation" }) ?? "";
  const destinationCountryCode = useWatch({ control, name: "destinationCountryCode" }) ?? "";
  const isTransportRequest = leadType === LEAD_REQUEST_TYPE.TRANSPORT;
  const originSuggestions = useLocationSuggestions(originLocation, intlLocale);
  const destinationSuggestions = useLocationSuggestions(destinationLocation, intlLocale);
  const modalTitle = mode === "create" ? messages.modalCreateTitle : messages.modalEditTitle;
  const submitLabel =
    mode === "create"
      ? isSubmitting
        ? messages.submitting
        : messages.submit
      : isSubmitting
        ? messages.saving
        : messages.save;
  const hasSharedContactError =
    errors.contactPhone?.message &&
    errors.contactPhone.message === errors.contactEmail?.message;
  const contactError = hasSharedContactError ? errors.contactPhone?.message : undefined;

  useEffect(() => {
    if (leadType !== LEAD_REQUEST_TYPE.OTHER) {
      return;
    }

    setValue("transportMode", LEAD_REQUEST_TRANSPORT_MODE.ANY, { shouldDirty: false });
    setValue("originLocation", "", { shouldDirty: false });
    setValue("originCountryCode", "", { shouldDirty: false });
    setValue("destinationLocation", "", { shouldDirty: false });
    setValue("destinationCountryCode", "", { shouldDirty: false });
    clearErrors(["originLocation", "destinationLocation"]);
  }, [clearErrors, leadType, setValue]);

  const applyValidationErrors = (values: LeadRequestFormValues): boolean => {
    const isTransportRequest = values.leadType === LEAD_REQUEST_TYPE.TRANSPORT;
    const trimmedOriginLocation = values.originLocation.trim();
    const trimmedDestinationLocation = values.destinationLocation.trim();
    const trimmedDescription = values.description.trim();
    const trimmedPhone = values.contactPhone.trim();
    const trimmedEmail = values.contactEmail.trim();
    let hasErrors = false;

    clearErrors([
      "originLocation",
      "destinationLocation",
      "description",
      "contactPhone",
      "contactEmail",
    ]);

    if (isTransportRequest && trimmedOriginLocation.length < 2) {
      setError("originLocation", {
        type: "manual",
        message: messages.originLocationRequiredError,
      });
      hasErrors = true;
    }
    if (isTransportRequest && trimmedDestinationLocation.length < 2) {
      setError("destinationLocation", {
        type: "manual",
        message: messages.destinationLocationRequiredError,
      });
      hasErrors = true;
    }
    if (trimmedDescription.length < 20 || trimmedDescription.length > 10_000) {
      setError("description", {
        type: "manual",
        message: messages.descriptionLengthError,
      });
      hasErrors = true;
    }
    if (!trimmedPhone && !trimmedEmail) {
      const contactErrorMessage = messages.contactRequiredError;
      setError("contactPhone", {
        type: "manual",
        message: contactErrorMessage,
      });
      setError("contactEmail", {
        type: "manual",
        message: contactErrorMessage,
      });
      hasErrors = true;
    }
    if (trimmedEmail && !isValidEmail(trimmedEmail)) {
      setError("contactEmail", {
        type: "manual",
        message: messages.invalidEmail,
      });
      hasErrors = true;
    }

    return !hasErrors;
  };

  const submitForm = async (values: LeadRequestFormValues) => {
    const isTransportRequest = values.leadType === LEAD_REQUEST_TYPE.TRANSPORT;
    if (!applyValidationErrors(values)) {
      toast.warning(messages.validationError);
      return;
    }

    if (mode === "create" && turnstileSiteKey && !turnstileToken) {
      throw new LeadRequestSubmitError(messages.turnstileRequired, "TURNSTILE_REQUIRED");
    }

    const normalizedValues: LeadRequestFormValues = {
      ...values,
      description: values.description.trim(),
      contactPhone: values.contactPhone.trim(),
      contactEmail: values.contactEmail.trim(),
      transportMode: isTransportRequest ? values.transportMode : LEAD_REQUEST_TRANSPORT_MODE.ANY,
      originLocation: isTransportRequest ? values.originLocation : "",
      originCountryCode: isTransportRequest ? values.originCountryCode : "",
      destinationLocation: isTransportRequest ? values.destinationLocation : "",
      destinationCountryCode: isTransportRequest ? values.destinationCountryCode : "",
    };

    try {
      await onSubmit({
        ...normalizedValues,
        turnstileToken: mode === "create" ? turnstileToken : "",
      });
    } catch (error) {
      if (error instanceof LeadRequestSubmitError) {
        if (error.code === "ORIGIN_GEOCODE_FAILED") {
          setError("originLocation", {
            type: "manual",
            message: messages.originLocationGeocodeError,
          });
        }
        if (error.code === "DESTINATION_GEOCODE_FAILED") {
          setError("destinationLocation", {
            type: "manual",
            message: messages.destinationLocationGeocodeError,
          });
        }
      }
      throw error;
    } finally {
      if (mode === "create" && turnstileSiteKey) {
        setTurnstileToken("");
        setTurnstileRefreshKey((current) => current + 1);
      }
    }
  };

  const formSubmit = handleSubmit(async (values) => {
    try {
      await submitForm(values);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : messages.submitError,
      );
    }
  });

  const originInput = register("originLocation");
  const destinationInput = register("destinationLocation");
  const descriptionInput = register("description");
  const contactPhoneInput = register("contactPhone");
  const contactEmailInput = register("contactEmail");

  const transportModeSummary = useMemo(
    () => getTransportModeLabel(transportMode ?? LEAD_REQUEST_TRANSPORT_MODE.ANY, messages),
    [messages, transportMode],
  );

  if (!isOpen) {
    return null;
  }

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto [&>div:not(.fixed)]:my-auto [&>div:not(.fixed)]:max-h-[calc(100dvh-2rem)] [&>div:not(.fixed)]:!overflow-y-auto p-4">
      <div
        className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm"
        onClick={() => {
          if (!isSubmitting && !isExtending) {
            onClose();
          }
        }}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-100">{modalTitle}</h3>
          <button
            type="button"
            className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500"
            onClick={onClose}
            disabled={isSubmitting || isExtending}
          >
            {messages.modalClose}
          </button>
        </div>

        <form onSubmit={formSubmit} className="grid gap-4 p-4">
          <div className="grid gap-2 text-sm">
            <p className="text-slate-300">{messages.typeLabel}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  setValue("leadType", LEAD_REQUEST_TYPE.TRANSPORT, {
                    shouldDirty: true,
                    shouldTouch: true,
                  })
                }
                className={`rounded-md border px-3 py-2 ${
                  leadType === LEAD_REQUEST_TYPE.TRANSPORT
                    ? "border-cyan-500 bg-cyan-500/15 text-cyan-200"
                    : "border-slate-700 text-slate-200 hover:border-slate-500"
                }`}
              >
                {messages.typeTransport}
              </button>
              <button
                type="button"
                onClick={() =>
                  setValue("leadType", LEAD_REQUEST_TYPE.OTHER, {
                    shouldDirty: true,
                    shouldTouch: true,
                  })
                }
                className={`rounded-md border px-3 py-2 ${
                  leadType === LEAD_REQUEST_TYPE.OTHER
                    ? "border-cyan-500 bg-cyan-500/15 text-cyan-200"
                    : "border-slate-700 text-slate-200 hover:border-slate-500"
                }`}
              >
                {messages.typeOther}
              </button>
            </div>
          </div>

          {isTransportRequest ? (
            <div className="grid gap-4 rounded-xl border border-sky-700/40 bg-sky-500/10 p-4 md:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="text-slate-100">{messages.originLocationLabel}</span>
                <input
                  {...originInput}
                  list="lead-origin-location-suggestions"
                  onChange={(event) => {
                    originInput.onChange(event);
                    setValue(
                      "originCountryCode",
                      resolveCountryCodeFromSuggestions(event.target.value, originSuggestions),
                      { shouldDirty: true },
                    );
                    clearErrors("originLocation");
                  }}
                  className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                  placeholder={messages.originLocationPlaceholder}
                />
                <datalist id="lead-origin-location-suggestions">
                  {originSuggestions.map((item) => (
                    <option key={`${item.label}-${item.countryCode ?? "xx"}`} value={item.label} />
                  ))}
                </datalist>
                <div className="flex items-center gap-2 text-xs text-slate-200">
                  <CountryFlag countryCode={originCountryCode || null} />
                  <span>{originCountryCode || "--"}</span>
                </div>
                {errors.originLocation?.message ? (
                  <span className="text-xs text-rose-300">{errors.originLocation.message}</span>
                ) : null}
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-100">{messages.destinationLocationLabel}</span>
                <input
                  {...destinationInput}
                  list="lead-destination-location-suggestions"
                  onChange={(event) => {
                    destinationInput.onChange(event);
                    setValue(
                      "destinationCountryCode",
                      resolveCountryCodeFromSuggestions(event.target.value, destinationSuggestions),
                      { shouldDirty: true },
                    );
                    clearErrors("destinationLocation");
                  }}
                  className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                  placeholder={messages.destinationLocationPlaceholder}
                />
                <datalist id="lead-destination-location-suggestions">
                  {destinationSuggestions.map((item) => (
                    <option key={`${item.label}-${item.countryCode ?? "xx"}`} value={item.label} />
                  ))}
                </datalist>
                <div className="flex items-center gap-2 text-xs text-slate-200">
                  <CountryFlag countryCode={destinationCountryCode || null} />
                  <span>{destinationCountryCode || "--"}</span>
                </div>
                {errors.destinationLocation?.message ? (
                  <span className="text-xs text-rose-300">
                    {errors.destinationLocation.message}
                  </span>
                ) : null}
              </label>
            </div>
          ) : null}

          {isTransportRequest ? (
            <div className="grid gap-2 rounded-xl border border-emerald-700/40 bg-emerald-500/10 p-4">
              <p className="text-sm font-semibold text-emerald-100">{messages.transportModeLabel}</p>
              <div className="flex items-center gap-2 text-xs text-emerald-200">
                {getTransportModeIcon(transportMode ?? LEAD_REQUEST_TRANSPORT_MODE.ANY)}
                <span>{transportModeSummary}</span>
              </div>
              <label className="grid gap-1 text-sm">
                <select
                  value={transportMode ?? LEAD_REQUEST_TRANSPORT_MODE.ANY}
                  onChange={(event) =>
                    setValue("transportMode", event.target.value as LeadRequestFormValues["transportMode"], {
                      shouldDirty: true,
                    })
                  }
                  className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                >
                  <option value={LEAD_REQUEST_TRANSPORT_MODE.SEA}>{messages.transportModeSea}</option>
                  <option value={LEAD_REQUEST_TRANSPORT_MODE.RAIL}>{messages.transportModeRail}</option>
                  <option value={LEAD_REQUEST_TRANSPORT_MODE.ROAD}>{messages.transportModeRoad}</option>
                  <option value={LEAD_REQUEST_TRANSPORT_MODE.AIR}>{messages.transportModeAir}</option>
                  <option value={LEAD_REQUEST_TRANSPORT_MODE.ANY}>{messages.transportModeAny}</option>
                </select>
              </label>
            </div>
          ) : null}

          <label className="grid gap-1 text-sm">
            <span className="text-slate-300">{messages.descriptionLabel}</span>
            <textarea
              {...descriptionInput}
              rows={6}
              onChange={(event) => {
                descriptionInput.onChange(event);
                clearErrors("description");
              }}
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
              placeholder={messages.descriptionPlaceholder}
            />
            {errors.description?.message ? (
              <span className="text-xs text-rose-300">{errors.description.message}</span>
            ) : null}
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="text-slate-300">{messages.phoneLabel}</span>
              <input
                {...contactPhoneInput}
                onChange={(event) => {
                  contactPhoneInput.onChange(event);
                  clearErrors(["contactPhone", "contactEmail"]);
                }}
                className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                placeholder={messages.phonePlaceholder}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-slate-300">{messages.emailLabel}</span>
              <input
                {...contactEmailInput}
                onChange={(event) => {
                  contactEmailInput.onChange(event);
                  clearErrors(["contactPhone", "contactEmail"]);
                }}
                className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                placeholder={messages.emailPlaceholder}
              />
              {errors.contactEmail?.message && !hasSharedContactError ? (
                <span className="text-xs text-rose-300">{errors.contactEmail.message}</span>
              ) : null}
            </label>
          </div>

          {contactError ? <p className="text-xs text-rose-300">{contactError}</p> : null}
          <p className="text-xs text-slate-400">{messages.contactHint}</p>
          {mode === "create" && turnstileSiteKey ? (
            <TurnstileWidget
              siteKey={turnstileSiteKey}
              onTokenChange={setTurnstileToken}
              refreshKey={turnstileRefreshKey}
            />
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex min-h-[40px] items-center">
              {mode === "edit" && editingItem?.isExpired ? (
                <button
                  type="button"
                  onClick={() => {
                    void onExtend();
                  }}
                  disabled={isSubmitting || isExtending || !editingItem}
                  className="rounded-md border border-amber-600 bg-amber-500/10 px-3 py-2 text-sm text-amber-200 hover:border-amber-500 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isExtending ? messages.extending : messages.extendAction}
                </button>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting || isExtending}
                className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {messages.modalClose}
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isExtending}
                className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitLabel}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}


