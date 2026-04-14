"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast-provider";
import {
  LOCALE_HEADER_NAME,
  type AppLocale,
  type AppMessages,
} from "@/lib/i18n";

type CompanyDeletionRequestButtonProps = {
  companyId: string;
  locale: AppLocale;
  messages: AppMessages["companyPanelPage"];
  triggerClassName?: string;
};

type RequestStatus = "idle" | "submitting";

export function CompanyDeletionRequestButton({
  companyId,
  locale,
  messages,
  triggerClassName,
}: CompanyDeletionRequestButtonProps) {
  const toast = useToast();
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [status, setStatus] = useState<RequestStatus>("idle");
  const isBusy = status !== "idle";

  useEffect(() => {
    if (!isModalOpen) {
      return;
    }

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isBusy) {
        setIsModalOpen(false);
      }
    };

    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("keydown", onEscape);
    };
  }, [isBusy, isModalOpen]);

  const deleteCompany = async () => {
    setStatus("submitting");
    try {
      const response = await fetch(`/api/companies/${companyId}/deletion-request`, {
        method: "DELETE",
        headers: { [LOCALE_HEADER_NAME]: locale },
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

      toast.success(messages.deletionRequestSubmitted);
      setIsModalOpen(false);
      router.refresh();
    } catch {
      toast.error(messages.deletionRequestUnknownError);
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
          setIsModalOpen(true);
        }}
      >
        {messages.deletionRequestAction}
      </button>

      {isModalOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-[rgba(2,6,23,0.45)] p-4 backdrop-blur-[2px] [&>div:not(.fixed)]:my-auto [&>div:not(.fixed)]:max-h-[calc(100dvh-2rem)] [&>div:not(.fixed)]:!overflow-y-auto"
          role="dialog"
          aria-modal="true"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isBusy) {
              setIsModalOpen(false);
            }
          }}
        >
          <div className="w-full max-w-lg rounded-xl border border-neutral-300 bg-white p-5 shadow-2xl">
            <h3 className="text-base font-semibold text-neutral-900">
              {messages.deletionRequestModalTitle}
            </h3>
            <p className="mt-2 text-sm text-neutral-700">{messages.deletionRequestModalHint}</p>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                className="cursor-pointer rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                onClick={() => {
                  setIsModalOpen(false);
                }}
                disabled={isBusy}
              >
                {messages.deletionRequestCancel}
              </button>
              <button
                type="button"
                className="cursor-pointer rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => {
                  void deleteCompany();
                }}
                disabled={isBusy}
              >
                {status === "submitting"
                  ? messages.deletionRequestSubmitting
                  : messages.deletionRequestConfirm}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}



