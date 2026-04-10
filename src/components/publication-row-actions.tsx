"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/toast-provider";

type PublicationEntity = "offers" | "announcements";

type PublicationRowActionsProps = {
  entity: PublicationEntity;
  itemId: string;
  isPublished: boolean;
  publishLabel: string;
  suspendLabel: string;
  deleteLabel: string;
  publishSuccessMessage: string;
  suspendSuccessMessage: string;
  deleteSuccessMessage: string;
  confirmDeleteText: string;
  unknownError: string;
  onStatusChanged?: (nextPublished: boolean) => void | Promise<void>;
  onDeleted?: () => void | Promise<void>;
  onChanged?: () => void | Promise<void>;
  refreshOnSuccess?: boolean;
  tone?: "default" | "muted";
};

export function PublicationRowActions({
  entity,
  itemId,
  isPublished,
  publishLabel,
  suspendLabel,
  deleteLabel,
  publishSuccessMessage,
  suspendSuccessMessage,
  deleteSuccessMessage,
  confirmDeleteText,
  unknownError,
  onStatusChanged,
  onDeleted,
  onChanged,
  refreshOnSuccess = true,
  tone = "default",
}: PublicationRowActionsProps) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, setIsPending] = useState(false);

  const endpoint = `/api/${entity}/${itemId}`;

  async function runSafeCallback(callback: (() => void | Promise<void>) | undefined) {
    if (!callback) {
      return;
    }
    try {
      await callback();
    } catch {
      // Ignore callback failures to avoid masking successful API actions.
    }
  }

  async function handleStatusChange(nextPublished: boolean) {
    setIsPending(true);
    try {
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "setPublicationStatus",
          isPublished: nextPublished,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? unknownError);
      }
      await runSafeCallback(() => onStatusChanged?.(nextPublished));
      toast.success(nextPublished ? publishSuccessMessage : suspendSuccessMessage);
      if (onChanged) {
        await onChanged();
      } else if (refreshOnSuccess) {
        router.refresh();
      }
    } catch (actionError) {
      toast.error(actionError instanceof Error ? actionError.message : unknownError);
    } finally {
      setIsPending(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(confirmDeleteText)) {
      return;
    }

    setIsPending(true);
    try {
      const response = await fetch(endpoint, { method: "DELETE" });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? unknownError);
      }
      await runSafeCallback(onDeleted);
      toast.success(deleteSuccessMessage);
      if (onChanged) {
        await onChanged();
      } else if (refreshOnSuccess) {
        router.refresh();
      }
    } catch (actionError) {
      toast.error(actionError instanceof Error ? actionError.message : unknownError);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className={
          tone === "muted"
            ? "rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:border-slate-500 disabled:opacity-50"
            : isPublished
              ? "rounded-md border border-amber-700 px-2 py-1 text-xs text-amber-200 hover:border-amber-500 disabled:opacity-50"
              : "rounded-md border border-emerald-700 px-2 py-1 text-xs text-emerald-200 hover:border-emerald-500 disabled:opacity-50"
        }
        disabled={isPending}
        onClick={() => {
          void handleStatusChange(!isPublished);
        }}
      >
        {isPublished ? suspendLabel : publishLabel}
      </button>
      <button
        type="button"
        className={
          tone === "muted"
            ? "rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:border-slate-500 disabled:opacity-50"
            : "rounded-md border border-rose-700 px-2 py-1 text-xs text-rose-200 hover:border-rose-500 disabled:opacity-50"
        }
        disabled={isPending}
        onClick={() => {
          void handleDelete();
        }}
      >
        {deleteLabel}
      </button>
    </div>
  );
}
