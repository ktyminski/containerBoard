"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast-provider";
import { withLang, type AppLocale, type AppMessages } from "@/lib/i18n";

type UserSettingsDangerZoneProps = {
  locale: AppLocale;
  messages: AppMessages["settingsPage"];
};

export function UserSettingsDangerZone({
  locale,
  messages,
}: UserSettingsDangerZoneProps) {
  const router = useRouter();
  const toast = useToast();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const deleteAccount = async () => {
    if (isDeleting) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch("/api/auth/account", {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        toast.error(payload?.error ?? messages.unknownError);
        return;
      }

      toast.success(messages.deleteAccountSuccess);
      router.push(withLang("/", locale));
      router.refresh();
    } catch {
      toast.error(messages.unknownError);
    } finally {
      setIsDeleting(false);
      setIsConfirmOpen(false);
    }
  };

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5">
      <h2 className="text-lg font-semibold text-neutral-100">{messages.deleteAccountTitle}</h2>
      <p className="mt-2 text-sm text-neutral-300">{messages.deleteAccountDescription}</p>
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          className="rounded-md border border-red-700 bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-70"
          onClick={() => {
            setIsConfirmOpen(true);
          }}
          disabled={isDeleting}
        >
          {isDeleting ? messages.deleteAccountDeleting : messages.deleteAccountButton}
        </button>
      </div>

      {isConfirmOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-[rgba(2,6,23,0.45)] p-4 backdrop-blur-[2px] [&>div:not(.fixed)]:my-auto [&>div:not(.fixed)]:max-h-[calc(100dvh-2rem)] [&>div:not(.fixed)]:!overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-neutral-700 bg-neutral-900 p-4 shadow-2xl">
            <h3 className="text-sm font-semibold text-neutral-100">
              {messages.deleteConfirmTitle}
            </h3>
            <p className="mt-2 text-xs leading-5 text-neutral-300">
              {messages.deleteConfirmText}
            </p>
            <p className="mt-2 text-xs leading-5 text-neutral-400">
              {messages.deleteConfirmWarning}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:border-neutral-500"
                onClick={() => {
                  setIsConfirmOpen(false);
                }}
                disabled={isDeleting}
              >
                {messages.cancel}
              </button>
              <button
                type="button"
                className="rounded-md border border-red-700 bg-red-600 px-3 py-1.5 text-xs text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-70"
                onClick={() => {
                  void deleteAccount();
                }}
                disabled={isDeleting}
              >
                {isDeleting ? messages.deleteAccountDeleting : messages.confirmDelete}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}



