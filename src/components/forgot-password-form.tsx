"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useToast } from "@/components/toast-provider";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { AUTH_ERROR } from "@/lib/auth-error-codes";
import { withLang, type AppLocale, type AppMessages } from "@/lib/i18n";

type ForgotPasswordFormProps = {
  locale: AppLocale;
  messages: AppMessages["authForm"];
  turnstileSiteKey?: string | null;
};

type ForgotPasswordFormValues = {
  email: string;
};

type ForgotPasswordResponse = {
  error?: string;
  issues?: string[];
};

function resolveForgotPasswordErrorMessage(input: {
  errorCode?: string;
  status: number;
  messages: AppMessages["authForm"];
}): string {
  const { errorCode, status, messages } = input;

  if (errorCode === "TURNSTILE_REQUIRED" || errorCode === "TURNSTILE_FAILED") {
    return messages.turnstileRequired;
  }
  if (errorCode === "Rate limit exceeded" || status === 429) {
    return messages.rateLimitExceeded;
  }
  if (errorCode === AUTH_ERROR.INVALID_PAYLOAD || status === 400) {
    return messages.validationError;
  }
  return messages.unknownAuthError;
}

export function ForgotPasswordForm({
  locale,
  messages,
  turnstileSiteKey,
}: ForgotPasswordFormProps) {
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileRefreshKey, setTurnstileRefreshKey] = useState(0);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({
    defaultValues: {
      email: "",
    },
    mode: "onSubmit",
  });

  const submit = async (values: ForgotPasswordFormValues) => {
    setIsSubmitting(true);
    try {
      if (turnstileSiteKey && !turnstileToken) {
        throw new Error(messages.turnstileRequired);
      }

      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: values.email.trim(),
          turnstileToken,
        }),
      });

      if (!response.ok) {
        let data: ForgotPasswordResponse = {};
        try {
          data = (await response.json()) as ForgotPasswordResponse;
        } catch {
          data = {};
        }

        throw new Error(
          resolveForgotPasswordErrorMessage({
            errorCode: data.error,
            status: response.status,
            messages,
          }),
        );
      }

      reset();
      toast.success(messages.forgotPasswordRequestSuccess);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : messages.unknownAuthError);
    } finally {
      setIsSubmitting(false);
      if (turnstileSiteKey) {
        setTurnstileToken("");
        setTurnstileRefreshKey((current) => current + 1);
      }
    }
  };

  return (
    <div className="w-full max-w-md rounded-xl border border-neutral-800 bg-neutral-900/70 p-6">
      <h1 className="text-2xl font-semibold text-neutral-100">{messages.forgotPasswordTitle}</h1>
      <p className="mt-1 text-sm text-neutral-400">{messages.forgotPasswordSubtitle}</p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit(submit)();
        }}
      >
        <input
          className="mt-4 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
          placeholder={messages.emailPlaceholder}
          type="email"
          {...register("email", {
            required: messages.requiredField,
            pattern: {
              value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
              message: messages.invalidEmail,
            },
          })}
        />
        {errors.email?.message ? (
          <p className="mt-1 text-xs text-red-300">{errors.email.message}</p>
        ) : null}

        {turnstileSiteKey ? (
          <div className="mt-3">
            <TurnstileWidget
              siteKey={turnstileSiteKey}
              onTokenChange={setTurnstileToken}
              refreshKey={turnstileRefreshKey}
            />
          </div>
        ) : null}

        <button
          type="submit"
          className="mt-4 w-full rounded-md bg-sky-500 px-3 py-2 text-sm font-medium text-neutral-950 hover:bg-sky-400 disabled:opacity-60"
          disabled={isSubmitting}
        >
          {isSubmitting ? messages.submitLoading : messages.forgotPasswordSubmit}
        </button>
      </form>

      <p className="mt-4 text-sm text-neutral-400">
        <Link href={withLang("/login", locale)} className="text-sky-400 hover:text-sky-300">
          {messages.goToLogin}
        </Link>
      </p>
    </div>
  );
}

