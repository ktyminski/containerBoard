"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useToast } from "@/components/toast-provider";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { AUTH_ERROR } from "@/lib/auth-error-codes";
import { withLang, type AppLocale, type AppMessages } from "@/lib/i18n";

type Mode = "login" | "register";

type AuthResponse = {
  error?: string;
  issues?: string[];
  requiresEmailVerification?: boolean;
};

type AuthFormProps = {
  mode: Mode;
  next?: string;
  error?: string;
  notice?: string;
  turnstileSiteKey?: string | null;
  locale: AppLocale;
  messages: AppMessages["authForm"];
};

type AuthFormValues = {
  name: string;
  email: string;
  password: string;
  legalConsent: boolean;
};

const LEGAL_CONSENT_REQUIRED_ISSUE = "LEGAL_CONSENT_REQUIRED";

function resolveAuthErrorMessage(input: {
  errorCode?: string;
  issues?: string[];
  status: number;
  messages: AppMessages["authForm"];
}): string {
  const { errorCode, issues, status, messages } = input;

  if (errorCode === "TURNSTILE_REQUIRED" || errorCode === "TURNSTILE_FAILED") {
    return messages.turnstileRequired;
  }

  if (
    errorCode === AUTH_ERROR.INVALID_PAYLOAD ||
    errorCode === "Invalid payload" ||
    status === 400
  ) {
    if (issues?.[0] === LEGAL_CONSENT_REQUIRED_ISSUE) {
      return messages.legalConsentRequired;
    }
    return messages.validationError;
  }

  if (errorCode === AUTH_ERROR.EMAIL_NOT_VERIFIED || errorCode === "EMAIL_NOT_VERIFIED") {
    return messages.emailVerificationRequired;
  }

  if (errorCode === "Rate limit exceeded" || status === 429) {
    return messages.rateLimitExceeded;
  }

  if (errorCode === AUTH_ERROR.INVALID_CREDENTIALS || errorCode === "Invalid email or password") {
    return messages.invalidCredentials;
  }

  if (
    errorCode === AUTH_ERROR.GOOGLE_SIGN_IN_REQUIRED ||
    errorCode === "This account uses Google sign-in"
  ) {
    return messages.googleSignInRequired;
  }

  if (
    errorCode === AUTH_ERROR.EMAIL_ALREADY_REGISTERED ||
    errorCode === "Email is already registered"
  ) {
    return messages.emailAlreadyRegistered;
  }

  if (
    errorCode === AUTH_ERROR.VERIFICATION_MAIL_FAILED ||
    errorCode === "Verification mail delivery failed"
  ) {
    return messages.verificationMailDeliveryFailed;
  }

  if (status >= 500) {
    return messages.unknownAuthError;
  }

  return messages.unknownAuthError;
}

export function AuthForm({
  mode,
  next = "/",
  error: initialErrorCode,
  notice: initialNoticeCode,
  turnstileSiteKey,
  locale,
  messages,
}: AuthFormProps) {
  const router = useRouter();
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileRefreshKey, setTurnstileRefreshKey] = useState(0);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AuthFormValues>({
    defaultValues: {
      name: "",
      email: "",
      password: "",
      legalConsent: false,
    },
    mode: "onSubmit",
  });
  const initialError =
    initialErrorCode === "google_auth_failed"
      ? messages.googleAuthFailed
      : initialErrorCode === "google_not_configured"
        ? messages.googleNotConfigured
        : initialErrorCode === "email_verification_failed"
          ? messages.emailVerificationFailed
        : null;
  const initialNotice =
    initialNoticeCode === "registered_check_email"
      ? messages.registerVerificationSent
      : initialNoticeCode === "email_verified"
        ? messages.emailVerifiedSuccess
        : initialNoticeCode === "password_reset_success"
          ? messages.resetPasswordSuccess
        : null;

  useEffect(() => {
    if (!initialError) {
      return;
    }
    toast.error(initialError);
  }, [initialError, toast]);

  useEffect(() => {
    if (!initialNotice) {
      return;
    }
    toast.success(initialNotice);
  }, [initialNotice, toast]);

  const submit = async (values: AuthFormValues) => {
    setIsSubmitting(true);
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      if (turnstileSiteKey && !turnstileToken) {
        throw new Error(messages.turnstileRequired);
      }
      const payload =
        mode === "login"
          ? {
              email: values.email.trim(),
              password: values.password,
              turnstileToken,
            }
          : {
              name: values.name.trim(),
              email: values.email.trim(),
              password: values.password,
              legalConsent: values.legalConsent === true,
              turnstileToken,
            };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let data: AuthResponse = {};
        try {
          data = (await response.json()) as AuthResponse;
        } catch {
          data = {};
        }

        throw new Error(
          resolveAuthErrorMessage({
            errorCode: data.error,
            issues: data.issues,
            status: response.status,
            messages,
          }),
        );
      }
      const data = (await response.json()) as AuthResponse;
      if (mode === "register" && data.requiresEmailVerification === true) {
        toast.success(messages.registerVerificationSent);
      }

      router.push(withLang(next, locale));
      router.refresh();
    } catch (submitError) {
      toast.error(
        submitError instanceof Error ? submitError.message : messages.unknownAuthError,
      );
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
      <h1 className="text-2xl font-semibold text-neutral-100">
        {mode === "login" ? messages.loginTitle : messages.registerTitle}
      </h1>
      <p className="mt-1 text-sm text-neutral-400">
        {mode === "login" ? messages.loginSubtitle : messages.registerSubtitle}
      </p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit(submit)();
        }}
      >
        {mode === "register" ? (
          <>
            <input
              className="mt-4 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
              placeholder={messages.namePlaceholder}
              {...register("name", {
                required: messages.requiredField,
                minLength: { value: 2, message: messages.nameMinLength },
                maxLength: { value: 80, message: messages.validationError },
              })}
            />
            {errors.name?.message ? (
              <p className="mt-1 text-xs text-red-300">{errors.name.message}</p>
            ) : null}
          </>
        ) : null}

        <input
          className="mt-3 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
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

        <input
          className="mt-3 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
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
        {mode === "login" ? (
          <div className="mt-2 text-right">
            <Link
              href={withLang("/forgot-password", locale)}
              className="text-xs text-[#2f639a] transition hover:text-[#4e86c3]"
            >
              {messages.forgotPasswordLink}
            </Link>
          </div>
        ) : null}

        {mode === "register" ? (
          <label className="mt-3 flex items-start gap-2 text-xs text-neutral-300">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-neutral-600 bg-neutral-950 text-[#67c7ff] focus:ring-[#4e86c3]"
              {...register("legalConsent", {
                validate: (value) => value || messages.legalConsentRequired,
              })}
            />
            <span>
              {messages.legalConsentPrefix}{" "}
              <Link
                href={withLang("/privacy-policy", locale)}
                className="text-[#2f639a] transition hover:text-[#4e86c3]"
              >
                {messages.legalConsentPrivacy}
              </Link>{" "}
              {messages.legalConsentAnd}{" "}
              <Link
                href={withLang("/terms", locale)}
                className="text-[#2f639a] transition hover:text-[#4e86c3]"
              >
                {messages.legalConsentTerms}
              </Link>
              .
            </span>
          </label>
        ) : null}
        {mode === "register" && errors.legalConsent?.message ? (
          <p className="mt-1 text-xs text-red-300">{errors.legalConsent.message}</p>
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
          className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-md border border-[#67c7ff] bg-[linear-gradient(90deg,#0ea5e9_0%,#38bdf8_52%,#7dd3fc_100%)] px-3 text-sm font-medium text-[#032447] shadow-[0_10px_24px_-14px_rgba(56,189,248,0.95)] transition hover:brightness-110 disabled:opacity-60"
          disabled={isSubmitting}
        >
          {isSubmitting
            ? messages.submitLoading
            : mode === "login"
              ? messages.submitLogin
              : messages.submitRegister}
        </button>
      </form>

      <a
        href={`/api/auth/google/start?next=${encodeURIComponent(withLang(next, locale))}`}
        className="mt-3 block w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-center text-sm text-neutral-200 hover:border-neutral-500"
      >
        {messages.continueWithGoogle}
      </a>

      <p className="mt-4 text-sm text-neutral-400">
        {mode === "login" ? messages.noAccount : messages.hasAccount}{" "}
        <Link
          href={
            mode === "login"
              ? withLang(`/register?next=${encodeURIComponent(next)}`, locale)
              : withLang(`/login?next=${encodeURIComponent(next)}`, locale)
          }
          className="text-[#2f639a] transition hover:text-[#4e86c3]"
        >
          {mode === "login" ? messages.goToRegister : messages.goToLogin}
        </Link>
      </p>
    </div>
  );
}

