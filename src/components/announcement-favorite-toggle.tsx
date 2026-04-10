"use client";

import { useState } from "react";
import { useToast } from "@/components/toast-provider";
import { withLang, type AppLocale, type AppMessages } from "@/lib/i18n";

type AnnouncementFavoriteToggleProps = {
  announcementId: string;
  locale: AppLocale;
  canFavorite: boolean;
  initialIsFavorite: boolean;
  messages: Pick<
    AppMessages["announcementDetails"],
    "favoriteAdd" | "favoriteRemove" | "favoriteActionError" | "favoriteAddedNotice"
  >;
};

export function AnnouncementFavoriteToggle({
  announcementId,
  locale,
  canFavorite,
  initialIsFavorite,
  messages,
}: AnnouncementFavoriteToggleProps) {
  const toast = useToast();
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleFavorite = async () => {
    if (isPending) {
      return;
    }

    if (!canFavorite) {
      window.location.href = withLang(`/login?next=/announcements/${announcementId}`, locale);
      return;
    }

    setIsPending(true);
    setError(null);
    const nextIsFavorite = !isFavorite;
    setIsFavorite(nextIsFavorite);

    try {
      const response = await fetch(`/api/announcements/${announcementId}/favorite`, {
        method: nextIsFavorite ? "POST" : "DELETE",
      });
      if (response.status === 401) {
        window.location.href = withLang(`/login?next=/announcements/${announcementId}`, locale);
        return;
      }
      if (!response.ok) {
        throw new Error("Favorite action failed");
      }

      const payload = (await response.json().catch(() => null)) as
        | { isFavorite?: boolean }
        | null;
      let resolvedIsFavorite = nextIsFavorite;
      if (typeof payload?.isFavorite === "boolean") {
        resolvedIsFavorite = payload.isFavorite;
        setIsFavorite(payload.isFavorite);
      }
      if (!isFavorite && resolvedIsFavorite) {
        toast.success(messages.favoriteAddedNotice);
      }
    } catch {
      setIsFavorite(!nextIsFavorite);
      setError(messages.favoriteActionError);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="grid gap-2">
      <button
        type="button"
        className={`inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition ${
          isFavorite
            ? "border-rose-600 text-rose-200 hover:border-rose-500"
            : "border-slate-700 text-slate-100 hover:border-slate-500"
        } disabled:cursor-not-allowed disabled:opacity-60`}
        onClick={() => {
          void toggleFavorite();
        }}
        disabled={isPending}
        aria-label={isFavorite ? messages.favoriteRemove : messages.favoriteAdd}
      >
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill={isFavorite ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M12 21s-6.7-4.35-9.25-8.09C.83 10.09 1.64 6.1 4.68 4.3a5.46 5.46 0 0 1 6.24.46L12 5.66l1.08-.9a5.46 5.46 0 0 1 6.24-.46c3.04 1.8 3.85 5.8 1.93 8.61C18.7 16.65 12 21 12 21Z" />
        </svg>
        <span>{isFavorite ? messages.favoriteRemove : messages.favoriteAdd}</span>
      </button>
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
    </div>
  );
}
