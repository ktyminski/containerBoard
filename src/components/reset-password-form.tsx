"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useToast } from "@/components/toast-provider";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { AUTH_ERROR } from "@/lib/auth-error-codes";
import { withLang, type AppLocale, type AppMessages } from "@/lib/i18n";

type ResetPasswordFormProps = {
  locale: AppLocale;
  messages: AppMessages["authForm"];
  token: string;
  turnstileSiteKey?: string | null;
};

type ResetPasswordFormValues = {
  password: string;
  confirmPassword: string;
};

type ResetPasswordResponse = {
  error?: string;
  issues?: string[];
};

function resolveResetPasswordErrorMessage(input: {
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
  if (errorCode === AUTH_ERROR.PASSWORD_RESET_INVALID_TOKEN) {
    return messages.resetPasswordInvalidToken;
  }
  if (errorCode === AUTH_ERROR.INVALID_PAYLOAD || status === 400) {
    return messages.validationError;
  }
  return messages.unknownAuthError;
}

export function ResetPasswordForm({
  locale,
  messages,
  token,
  turnstileSiteKey,
}: ResetPasswordFormProps) {
  const router = useRouter();
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileRefreshKey, setTurnstileRefreshKey] = useState(0);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ResetPasswordFormValues>({
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
    mode: "onSubmit",
  });
  const passwordValue = watch("password");

  if (!token.trim()) {
    return (
      <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900/70 p-6">
        <h1 className="text-2xl font-semibold text-slate-100">{messages.resetPasswordTitle}</h1>
        <p className="mt-3 text-sm text-red-300">{messages.resetPasswordInvalidToken}</p>
        <p className="mt-4 text-sm text-slate-400">
          <Link href={withLang("/login", locale)} className="text-sky-400 hover:text-sky-300">
            {messages.goToLogin}
          </Link>
        </p>
      </div>
    );
  }

  const submit = async (values: ResetPasswordFormValues) => {
    setIsSubmitting(true);
    try {
      if (turnstileSiteKey && !turnstileToken) {
        throw new Error(messages.turnstileRequired);
      }

      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password: values.password,
          turnstileToken,
        }),
      });

      if (!response.ok) {
        let data: ResetPasswordResponse = {};
        try {
          data = (await response.json()) as ResetPasswordResponse;
        } catch {
          data = {};
        }

        throw new Error(
          resolveResetPasswordErrorMessage({
            errorCode: data.error,
            status: response.status,
            messages,
          }),
        );
      }

      toast.success(messages.resetPasswordSuccess);
      router.push(withLang("/login?notice=password_reset_success", locale));
      router.refresh();
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
    <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900/70 p-6">
      <h1 className="text-2xl font-semibold text-slate-100">{messages.resetPasswordTitle}</h1>
      <p className="mt-1 text-sm text-slate-400">{messages.resetPasswordSubtitle}</p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit(submit)();
        }}
      >
        <input
          className="mt-4 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          placeholder={messages.passwordPlaceholder}
          type="password"
          {...register("password", {
            required: messages.requiredField,
            minLength: { value: 8, message: messages.passwordMinLength },
            maxLength: { value: 72, message: messages.validationError },
          })}
        />
        {errors.password?.message ? (
          <p className="mt-1 text-xs text-red-300">{errors.password.message}</p>
        ) : null}

        <input
          className="mt-3 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          placeholder={messages.resetPasswordConfirmPlaceholder}
          type="password"
          {...register("confirmPassword", {
            required: messages.requiredField,
            validate: (value) => value === passwordValue || messages.resetPasswordMismatch,
          })}
        />
        {errors.confirmPassword?.message ? (
          <p className="mt-1 text-xs text-red-300">{errors.confirmPassword.message}</p>
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
          className="mt-4 w-full rounded-md bg-sky-500 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-sky-400 disabled:opacity-60"
          disabled={isSubmitting}
        >
          {isSubmitting ? messages.submitLoading : messages.resetPasswordSubmit}
        </button>
      </form>

      <p className="mt-4 text-sm text-slate-400">
        <Link href={withLang("/login", locale)} className="text-sky-400 hover:text-sky-300">
          {messages.goToLogin}
        </Link>
      </p>
    </div>
  );
}
