"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast-provider";
import {
  LOCALE_HEADER_NAME,
  formatTemplate,
  type AppLocale,
  type AppMessages,
} from "@/lib/i18n";

type CompanyDeletionRequestButtonProps = {
  companyId: string;
  locale: AppLocale;
  messages: AppMessages["companyPanelPage"];
  initialReason?: string;
  isAlreadyRequested: boolean;
  triggerClassName?: string;
};

type RequestStatus = "idle" | "submitting" | "withdrawing";
const MIN_REASON_LENGTH = 10;
const MAX_REASON_LENGTH = 1500;

export function CompanyDeletionRequestButton({
  companyId,
  locale,
  messages,
  initialReason = "",
  isAlreadyRequested,
  triggerClassName,
}: CompanyDeletionRequestButtonProps) {
  const toast = useToast();
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [status, setStatus] = useState<RequestStatus>("idle");
  const [reason, setReason] = useState(initialReason);
  const isBusy = status !== "idle";

  const submitRequest = async () => {
    const normalizedReason = reason.trim();
    if (normalizedReason.length < MIN_REASON_LENGTH) {
      toast.warning(messages.deletionRequestValidation);
      return;
    }

    setStatus("submitting");
    try {
      const response = await fetch(`/api/companies/${companyId}/deletion-request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [LOCALE_HEADER_NAME]: locale,
        },
        body: JSON.stringify({ reason: normalizedReason }),
      });

      if (response.status === 401) {
        toast.warning(messages.deletionRequestUnauthorized);
        return;
      }

      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        toast.error(payload?.error ?? messages.deletionRequestUnknownError);
        return;
      }

      toast.success(
        isAlreadyRequested
          ? messages.deletionRequestUpdated
          : messages.deletionRequestSubmitted,
      );
      setIsModalOpen(false);
      router.refresh();
    } catch {
      toast.error(messages.deletionRequestUnknownError);
    } finally {
      setStatus("idle");
    }
  };

  const withdrawRequest = async () => {
    if (!isAlreadyRequested) {
      return;
    }

    setStatus("withdrawing");
    try {
      const response = await fetch(`/api/companies/${companyId}/deletion-request`, {
        method: "DELETE",
        headers: {
          [LOCALE_HEADER_NAME]: locale,
        },
      });

      if (response.status === 401) {
        toast.warning(messages.deletionRequestUnauthorized);
        return;
      }

      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        toast.error(payload?.error ?? messages.deletionRequestWithdrawUnknownError);
        return;
      }

      toast.success(messages.deletionRequestWithdrawn);
      setIsModalOpen(false);
      router.refresh();
    } catch {
      toast.error(messages.deletionRequestWithdrawUnknownError);
    } finally {
      setStatus("idle");
    }
  };

  return (
    <>
      <button
        type="button"
        className={
          triggerClassName ??
          "cursor-pointer rounded-md border border-rose-700 px-3 py-2 text-sm text-rose-200 hover:border-rose-500"
        }
        onClick={() => {
          setReason(initialReason);
          setIsModalOpen(true);
        }}
      >
        {isAlreadyRequested
          ? messages.deletionRequestEditAction
          : messages.deletionRequestAction}
      </button>

      {isModalOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto [&>div:not(.fixed)]:my-auto [&>div:not(.fixed)]:max-h-[calc(100dvh-2rem)] [&>div:not(.fixed)]:!overflow-y-auto bg-neutral-950/80 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-xl border border-neutral-700 bg-neutral-900 p-5 shadow-2xl">
            <h3 className="text-base font-semibold text-neutral-100">
              {isAlreadyRequested
                ? messages.deletionRequestEditModalTitle
                : messages.deletionRequestModalTitle}
            </h3>
            <p className="mt-1 text-xs text-neutral-400">{messages.deletionRequestModalHint}</p>

            <label className="mt-4 grid gap-1 text-sm">
              <span className="text-neutral-300">{messages.deletionRequestReasonLabel}</span>
              <textarea
                className="min-h-28 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100"
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value);
                }}
                maxLength={MAX_REASON_LENGTH}
                placeholder={messages.deletionRequestReasonPlaceholder}
              />
              <p className="text-xs text-neutral-500">
                {formatTemplate(messages.deletionRequestReasonLimits, {
                  min: MIN_REASON_LENGTH,
                  max: MAX_REASON_LENGTH,
                })}
              </p>
            </label>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                className="cursor-pointer rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-200 hover:border-neutral-500"
                onClick={() => {
                  setIsModalOpen(false);
                }}
                disabled={isBusy}
              >
                {messages.deletionRequestCancel}
              </button>
              {isAlreadyRequested ? (
                <button
                  type="button"
                  className="cursor-pointer rounded-md border border-amber-700 px-3 py-2 text-sm text-amber-200 hover:border-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => {
                    void withdrawRequest();
                  }}
                  disabled={isBusy}
                >
                  {status === "withdrawing"
                    ? messages.deletionRequestWithdrawSubmitting
                    : messages.deletionRequestWithdraw}
                </button>
              ) : null}
              <button
                type="button"
                className="cursor-pointer rounded-md border border-rose-700 px-3 py-2 text-sm text-rose-200 hover:border-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => {
                  void submitRequest();
                }}
                disabled={isBusy}
              >
                {status === "submitting"
                  ? messages.deletionRequestSubmitting
                  : isAlreadyRequested
                    ? messages.deletionRequestUpdateConfirm
                    : messages.deletionRequestConfirm}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}



