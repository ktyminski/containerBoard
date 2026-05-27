"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/toast-provider";
import type { AppLocale } from "@/lib/i18n";

type SocialPlatform = "facebook" | "instagram";
type SocialDraftStatus = "draft" | "posted" | "skipped";

type SocialPostDraftItem = {
  id: string;
  listingId: string;
  platform: SocialPlatform;
  status: SocialDraftStatus;
  title: string;
  caption: string;
  imageUrl: string;
  listingUrl: string;
  dateKey: string;
  generatedAt: string;
  postedAt: string | null;
  skippedAt: string | null;
  listing: {
    companyName: string;
    containerLabel: string;
    location: string;
    status: string;
  } | null;
};

type SocialPostDraftsResponse = {
  items?: SocialPostDraftItem[];
  meta?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  error?: string;
};

type AdminSocialPostDraftsPanelProps = {
  locale: AppLocale;
};

const ADMIN_NEUTRAL_BUTTON_CLASS =
  "rounded-md border border-neutral-600 bg-neutral-800/90 px-2 py-1 text-xs text-neutral-100 hover:border-neutral-500 hover:bg-neutral-700/90";
const ADMIN_SUCCESS_BUTTON_CLASS =
  "rounded-md border border-emerald-500/85 bg-emerald-700/45 px-2 py-1 text-xs text-emerald-50 hover:border-emerald-400 hover:bg-emerald-700/60";
const ADMIN_WARNING_BUTTON_CLASS =
  "rounded-md border border-amber-500/85 bg-amber-700/45 px-2 py-1 text-xs text-amber-50 hover:border-amber-400 hover:bg-amber-700/60";

const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
};

const STATUS_LABELS: Record<SocialDraftStatus, string> = {
  draft: "Draft",
  posted: "Opublikowany",
  skipped: "Pominiety",
};

async function copyTextToClipboard(value: string): Promise<boolean> {
  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function"
  ) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      return false;
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    return document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
}

export function AdminSocialPostDraftsPanel({
  locale,
}: AdminSocialPostDraftsPanelProps) {
  const toast = useToast();
  const [items, setItems] = useState<SocialPostDraftItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<"all" | SocialDraftStatus>("all");
  const [platform, setPlatform] = useState<"all" | SocialPlatform>("all");

  const loadItems = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "20",
        status,
        platform,
      });
      const response = await fetch(`/api/admin/social-post-drafts?${params.toString()}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as SocialPostDraftsResponse;
      if (!response.ok) {
        throw new Error(
          data.error ?? `Nie udalo sie zaladowac draftow (${response.status})`,
        );
      }

      setItems(data.items ?? []);
      setTotalPages(data.meta?.totalPages ?? 1);
      setTotal(data.meta?.total ?? 0);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Nie udalo sie pobrac draftow social.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [page, platform, status]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  async function updateStatus(id: string, nextStatus: SocialDraftStatus) {
    try {
      const response = await fetch("/api/admin/social-post-drafts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: nextStatus }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(data?.error ?? "Nie udalo sie zmienic statusu.");
      }
      toast.success("Status draftu zaktualizowany.");
      await loadItems();
    } catch (updateError) {
      toast.error(
        updateError instanceof Error
          ? updateError.message
          : "Nie udalo sie zmienic statusu.",
      );
    }
  }

  async function copyCaption(caption: string) {
    const copied = await copyTextToClipboard(caption);
    if (copied) {
      toast.success("Caption skopiowany.");
    } else {
      toast.error("Nie udalo sie skopiowac captionu.");
    }
  }

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-neutral-100">Social posty</h2>
        <p className="text-xs text-neutral-400">Lacznie: {total}</p>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-[180px_180px_auto]">
        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as "all" | SocialDraftStatus);
            setPage(1);
          }}
          className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
        >
          <option value="all">Status: wszystkie</option>
          <option value="draft">Draft</option>
          <option value="posted">Opublikowane</option>
          <option value="skipped">Pominiete</option>
        </select>
        <select
          value={platform}
          onChange={(event) => {
            setPlatform(event.target.value as "all" | SocialPlatform);
            setPage(1);
          }}
          className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
        >
          <option value="all">Platforma: wszystkie</option>
          <option value="facebook">Facebook</option>
          <option value="instagram">Instagram</option>
        </select>
        <button
          type="button"
          onClick={() => {
            void loadItems();
          }}
          className={ADMIN_NEUTRAL_BUTTON_CLASS}
        >
          Odswiez
        </button>
      </div>

      {error ? <p className="mb-3 text-sm text-red-300">{error}</p> : null}
      {isLoading ? <p className="mb-3 text-sm text-neutral-300">Ladowanie...</p> : null}
      {!isLoading && !error && items.length === 0 ? (
        <p className="mb-3 text-sm text-neutral-400">Brak draftow social.</p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {items.map((item) => (
          <article
            key={item.id}
            className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950/60"
          >
            <div className="grid gap-0 md:grid-cols-[220px_minmax(0,1fr)]">
              <a
                href={item.imageUrl}
                target="_blank"
                rel="noreferrer"
                className="block bg-neutral-950"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.imageUrl}
                  alt=""
                  className="aspect-[4/5] h-full w-full object-cover"
                />
              </a>
              <div className="flex min-w-0 flex-col gap-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-md border border-sky-700 bg-sky-950/70 px-2 py-1 text-xs font-medium text-sky-100">
                        {PLATFORM_LABELS[item.platform]}
                      </span>
                      <span className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-200">
                        {STATUS_LABELS[item.status]}
                      </span>
                    </div>
                    <h3 className="mt-2 truncate text-base font-semibold text-neutral-100">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-xs text-neutral-400">
                      {new Date(item.generatedAt).toLocaleString(locale)} | {item.dateKey}
                    </p>
                  </div>
                </div>

                {item.listing ? (
                  <p className="text-xs leading-5 text-neutral-400">
                    {item.listing.companyName} | {item.listing.containerLabel}
                    {item.listing.location ? ` | ${item.listing.location}` : ""}
                  </p>
                ) : (
                  <p className="text-xs text-amber-300">Listing nie jest juz dostepny.</p>
                )}

                <textarea
                  value={item.caption}
                  readOnly
                  rows={8}
                  className="min-h-44 resize-y rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm leading-6 text-neutral-100"
                />

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      void copyCaption(item.caption);
                    }}
                    className={ADMIN_SUCCESS_BUTTON_CLASS}
                  >
                    Kopiuj caption
                  </button>
                  <a
                    href={item.imageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={ADMIN_NEUTRAL_BUTTON_CLASS}
                  >
                    Otworz obraz
                  </a>
                  <a
                    href={item.listingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={ADMIN_NEUTRAL_BUTTON_CLASS}
                  >
                    Otworz listing
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      void updateStatus(item.id, "posted");
                    }}
                    className={ADMIN_SUCCESS_BUTTON_CLASS}
                  >
                    Oznacz posted
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void updateStatus(item.id, "skipped");
                    }}
                    className={ADMIN_WARNING_BUTTON_CLASS}
                  >
                    Skip
                  </button>
                  {item.status !== "draft" ? (
                    <button
                      type="button"
                      onClick={() => {
                        void updateStatus(item.id, "draft");
                      }}
                      className={ADMIN_NEUTRAL_BUTTON_CLASS}
                    >
                      Przywroc draft
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage((current) => Math.max(1, current - 1))}
          className={`${ADMIN_NEUTRAL_BUTTON_CLASS} disabled:opacity-50`}
        >
          Poprzednia
        </button>
        <span className="text-xs text-neutral-400">
          {page}/{totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
          className={`${ADMIN_NEUTRAL_BUTTON_CLASS} disabled:opacity-50`}
        >
          Nastepna
        </button>
      </div>
    </section>
  );
}

