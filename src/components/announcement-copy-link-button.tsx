"use client";

import { useState } from "react";
import { useToast } from "@/components/toast-provider";
import type { AppMessages } from "@/lib/i18n";

type AnnouncementCopyLinkButtonProps = {
  url: string;
  messages: Pick<
    AppMessages["announcementDetails"],
    "copyLinkCta" | "copyLinkSuccess" | "copyLinkError"
  >;
};

export function AnnouncementCopyLinkButton({
  url,
  messages,
}: AnnouncementCopyLinkButtonProps) {
  const toast = useToast();
  const [isPending, setIsPending] = useState(false);

  const copyLink = async () => {
    if (isPending) {
      return;
    }
    setIsPending(true);
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else if (typeof document !== "undefined") {
        const input = document.createElement("textarea");
        input.value = url;
        input.setAttribute("readonly", "");
        input.style.position = "fixed";
        input.style.left = "-9999px";
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      } else {
        throw new Error("Clipboard not available");
      }
      toast.success(messages.copyLinkSuccess);
    } catch {
      toast.error(messages.copyLinkError);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <button
      type="button"
      className="inline-flex items-center gap-2 rounded-md border border-slate-700 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
      onClick={() => {
        void copyLink();
      }}
      disabled={isPending}
      aria-label={messages.copyLinkCta}
    >
      <svg
        className="h-4 w-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path d="M13.5 10.5l-3 3" />
        <path d="M16.5 7.5l1.5-1.5a3 3 0 0 1 4.24 4.24l-3 3a3 3 0 0 1-4.24 0l-.5-.5" />
        <path d="M7.5 16.5L6 18a3 3 0 1 1-4.24-4.24l3-3a3 3 0 0 1 4.24 0l.5.5" />
      </svg>
      <span>{messages.copyLinkCta}</span>
    </button>
  );
}
