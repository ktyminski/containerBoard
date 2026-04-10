"use client";

import { useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/toast-provider";
import {
  LOCALE_HEADER_NAME,
  withLang,
  type AppLocale,
  type AppMessages,
} from "@/lib/i18n";

type CompanyOwnershipClaimButtonProps = {
  companyId: string;
  locale: AppLocale;
  messages: AppMessages["companyDetails"]["ownershipClaim"];
};

type ClaimStatus = "idle" | "submitting" | "success" | "error" | "unauthorized";

export function CompanyOwnershipClaimButton({
  companyId,
  locale,
  messages,
}: CompanyOwnershipClaimButtonProps) {
  const toast = useToast();
  const [status, setStatus] = useState<ClaimStatus>("idle");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const submitClaim = async () => {
    if (status === "submitting" || status === "success") {
      return;
    }

    setStatus("submitting");

    try {
      const response = await fetch(`/api/companies/${companyId}/claim`, {
        method: "POST",
        headers: {
          [LOCALE_HEADER_NAME]: locale,
        },
      });

      if (response.status === 401) {
        setStatus("unauthorized");
        toast.info(messages.toastUnauthorized);
        return;
      }

      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        setStatus("error");
        toast.error(payload?.error ?? messages.toastError);
        return;
      }

      setStatus("success");
      toast.success(messages.toastSubmitted);
    } catch {
      setStatus("error");
      toast.error(messages.toastError);
    }
  };

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <button
        type="button"
        className="text-xs text-slate-400 transition hover:text-slate-200 disabled:cursor-default disabled:text-emerald-300"
        onClick={() => {
          setIsConfirmOpen(true);
        }}
        disabled={status === "submitting" || status === "success"}
      >
        {status === "submitting"
          ? messages.statusSubmitting
          : status === "success"
            ? messages.statusSuccess
            : messages.action}
      </button>

      {status === "unauthorized" ? (
        <p className="mt-1 text-xs text-slate-500">
          {messages.unauthorizedText}{" "}
          <Link href={withLang("/login", locale)} className="text-slate-300 hover:text-slate-100">
            {messages.loginCta}
          </Link>
        </p>
      ) : null}

      {isConfirmOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto [&>div:not(.fixed)]:my-auto [&>div:not(.fixed)]:max-h-[calc(100dvh-2rem)] [&>div:not(.fixed)]:!overflow-y-auto bg-slate-950/75 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-2xl">
            <h3 className="text-sm font-semibold text-slate-100">{messages.dialogTitle}</h3>
            <p className="mt-2 text-xs leading-5 text-slate-300">
              {messages.dialogConfirmText}
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              {messages.dialogLimitText}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500"
                onClick={() => {
                  setIsConfirmOpen(false);
                }}
              >
                {messages.cancel}
              </button>
              <button
                type="button"
                className="rounded-md border border-emerald-700 px-3 py-1.5 text-xs text-emerald-200 hover:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-70"
                onClick={() => {
                  setIsConfirmOpen(false);
                  void submitClaim();
                }}
                disabled={status === "submitting"}
              >
                {messages.confirm}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}


