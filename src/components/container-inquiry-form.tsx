"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { useToast } from "@/components/toast-provider";

type InquiryFormValues = {
  buyerName: string;
  buyerEmail: string;
  buyerPhone?: string;
  message?: string;
  requestedQuantity?: number;
  offeredPrice?: string;
  turnstileToken?: string;
};

type InquiryFormInitialValues = {
  buyerName?: string;
  buyerEmail?: string;
  buyerPhone?: string;
};

type ContainerInquiryFormProps = {
  listingId: string;
  heading?: string;
  hideHeading?: boolean;
  theme?: "dark" | "light";
  onSuccess?: () => void;
  submitLabel?: string;
  initialValues?: InquiryFormInitialValues;
  showOfferedPrice?: boolean;
  isLoggedIn?: boolean;
  turnstileSiteKey?: string | null;
};

export function ContainerInquiryForm({
  listingId,
  heading = "Wyslij zapytanie",
  hideHeading = false,
  theme = "dark",
  onSuccess,
  submitLabel = "Wyslij",
  initialValues,
  showOfferedPrice = true,
  isLoggedIn = false,
  turnstileSiteKey = null,
}: ContainerInquiryFormProps) {
  const toast = useToast();
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileRefreshKey, setTurnstileRefreshKey] = useState(0);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InquiryFormValues>({
    defaultValues: {
      buyerName: initialValues?.buyerName?.trim() ?? "",
      buyerEmail: initialValues?.buyerEmail?.trim() ?? "",
      buyerPhone: initialValues?.buyerPhone?.trim() ?? "",
      message: "",
      requestedQuantity: undefined,
      offeredPrice: "",
    },
  });

  const onSubmit = async (values: InquiryFormValues) => {
    try {
      if (!isLoggedIn && turnstileSiteKey && !turnstileToken) {
        throw new Error("Potwierdz, ze nie jestes robotem.");
      }

      const payload: InquiryFormValues = {
        ...values,
        offeredPrice: showOfferedPrice ? values.offeredPrice : undefined,
        turnstileToken: !isLoggedIn ? turnstileToken : undefined,
      };

      const response = await fetch(`/api/containers/${listingId}/inquiry`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json().catch(() => null)) as
        | { error?: string; issues?: string[] }
        | null;

      if (!response.ok) {
        if (data?.error === "TURNSTILE_REQUIRED" || data?.error === "TURNSTILE_FAILED") {
          throw new Error("Potwierdz, ze nie jestes robotem.");
        }
        const details = Array.isArray(data?.issues) ? ` (${data.issues.join(", ")})` : "";
        throw new Error((data?.error ?? "Nie udalo sie wyslac zapytania") + details);
      }

      toast.success("Zapytanie wyslane");
      reset();
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Wystapil blad");
    } finally {
      if (!isLoggedIn && turnstileSiteKey) {
        setTurnstileToken("");
        setTurnstileRefreshKey((current) => current + 1);
      }
    }
  };

  const isLightTheme = theme === "light";
  const formClassName = isLightTheme
    ? "grid gap-3 rounded-md border border-neutral-300 bg-white p-4"
    : "grid gap-3 rounded-xl border border-neutral-800 bg-neutral-900/60 p-4";
  const headingClassName = isLightTheme
    ? "text-lg font-semibold text-neutral-900"
    : "text-lg font-semibold text-neutral-100";
  const labelClassName = isLightTheme ? "text-neutral-700" : "text-neutral-300";
  const inputClassName = isLightTheme
    ? "rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-900"
    : "rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100";
  const submitButtonClassName = isLightTheme
    ? "rounded-md border border-sky-700 bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-60"
    : "rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-emerald-400 disabled:opacity-60";
  const sectionLabelClassName = isLightTheme
    ? "text-xs font-semibold uppercase tracking-wide text-neutral-500"
    : "text-xs font-semibold uppercase tracking-wide text-neutral-400";
  const dividerClassName = isLightTheme ? "border-t border-neutral-200" : "border-t border-neutral-700";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={formClassName}>
      {!hideHeading ? <h2 className={headingClassName}>{heading}</h2> : null}

      <div className="grid gap-3">
        <p className={sectionLabelClassName}>Moje dane</p>
        <label className="grid gap-1 text-sm">
          <span className={labelClassName}>Imie i nazwisko *</span>
          <input
            {...register("buyerName", { required: "Podaj imie i nazwisko", minLength: { value: 2, message: "Min. 2 znaki" } })}
            className={inputClassName}
          />
          {errors.buyerName?.message ? <span className="text-xs text-red-300">{errors.buyerName.message}</span> : null}
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className={labelClassName}>Email *</span>
            <input
              type="email"
              {...register("buyerEmail", { required: "Podaj email" })}
              className={inputClassName}
            />
            {errors.buyerEmail?.message ? <span className="text-xs text-red-300">{errors.buyerEmail.message}</span> : null}
          </label>
          <label className="grid gap-1 text-sm">
            <span className={labelClassName}>Telefon</span>
            <input
              type="tel"
              {...register("buyerPhone", {
                setValueAs: (value) => (typeof value === "string" && value.trim() ? value.trim() : undefined),
              })}
              className={inputClassName}
              placeholder="np. +48 600 700 800"
            />
          </label>
        </div>
      </div>

      <div className={dividerClassName} />

      <div className="grid gap-3">
        <p className={sectionLabelClassName}>Tresc zapytania</p>

        <label className="grid gap-1 text-sm">
          <span className={labelClassName}>Wiadomosc</span>
          <textarea
            rows={5}
            {...register("message", {
              setValueAs: (value) => (typeof value === "string" && value.trim() ? value.trim() : undefined),
            })}
            className={inputClassName}
            placeholder="Opcjonalnie dopisz szczegoly zapytania"
          />
          {errors.message?.message ? <span className="text-xs text-red-300">{errors.message.message}</span> : null}
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className={labelClassName}>Oczekiwana ilosc</span>
            <input
              type="number"
              min={1}
              {...register("requestedQuantity", {
                setValueAs: (value) => (value === "" ? undefined : Number(value)),
              })}
              className={inputClassName}
            />
          </label>

          {showOfferedPrice ? (
            <label className="grid gap-1 text-sm">
              <span className={labelClassName}>Proponowana cena</span>
              <input
                {...register("offeredPrice", {
                  setValueAs: (value) =>
                    typeof value === "string" && value.trim() ? value.trim() : undefined,
                })}
                className={inputClassName}
                placeholder="np. 2100 EUR"
              />
            </label>
          ) : null}
        </div>
      </div>

      {!isLoggedIn && turnstileSiteKey ? (
        <div>
          <TurnstileWidget
            siteKey={turnstileSiteKey}
            onTokenChange={setTurnstileToken}
            refreshKey={turnstileRefreshKey}
          />
        </div>
      ) : null}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className={submitButtonClassName}
        >
          {isSubmitting ? "Wysylanie..." : submitLabel}
        </button>
      </div>
    </form>
  );
}


