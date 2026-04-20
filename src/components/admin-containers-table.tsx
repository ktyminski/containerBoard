"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  getContainerShortLabelLocalized,
  getListingKindLabel,
  type ContainerListingsMessages,
} from "@/components/container-listings-i18n";
import { useToast } from "@/components/toast-provider";
import type { ContainerListingItem } from "@/lib/container-listings";
import { formatTemplate, type AppLocale, type AppMessages, withLang } from "@/lib/i18n";

type AdminContainersResponse = {
  items?: ContainerListingItem[];
  meta?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  error?: string;
};

type AdminContainersTableProps = {
  locale: AppLocale;
  messages: AppMessages["adminContainers"];
  listingMessages: ContainerListingsMessages;
};

const ADMIN_NEUTRAL_BUTTON_CLASS =
  "rounded-md border border-neutral-600 bg-neutral-800/90 px-2 py-1 text-xs text-neutral-100 hover:border-neutral-500 hover:bg-neutral-700/90";
const ADMIN_SUCCESS_BUTTON_CLASS =
  "rounded-md border border-emerald-500/85 bg-emerald-700/45 px-2 py-1 text-xs text-emerald-50 hover:border-emerald-400 hover:bg-emerald-700/60";
const ADMIN_WARNING_BUTTON_CLASS =
  "rounded-md border border-amber-500/85 bg-amber-700/45 px-2 py-1 text-xs text-amber-50 hover:border-amber-400 hover:bg-amber-700/60";
const ADMIN_DANGER_BUTTON_CLASS =
  "rounded-md border border-rose-500/85 bg-rose-700/45 px-2 py-1 text-xs text-rose-50 hover:border-rose-400 hover:bg-rose-700/60";

export function AdminContainersTable({
  locale,
  messages,
  listingMessages,
}: AdminContainersTableProps) {
  const toast = useToast();
  const [items, setItems] = useState<ContainerListingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "expired" | "closed">("all");

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setQuery(q.trim());
      setPage(1);
    }, 300);

    return () => window.clearTimeout(handle);
  }, [q]);

  const loadItems = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "20",
        status,
      });
      if (query) {
        params.set("q", query);
      }

      const response = await fetch(`/api/admin/containers?${params.toString()}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as AdminContainersResponse;

      if (!response.ok) {
        throw new Error(
          data.error ?? formatTemplate(messages.failedLoad, { status: response.status }),
        );
      }

      setItems(data.items ?? []);
      setTotalPages(data.meta?.totalPages ?? 1);
      setTotal(data.meta?.total ?? 0);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : messages.loadFallbackError,
      );
    } finally {
      setIsLoading(false);
    }
  }, [page, query, status]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  async function setListingStatus(id: string, nextStatus: "active" | "expired" | "closed") {
    try {
      const response = await fetch(`/api/containers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setStatus", status: nextStatus }),
      });

      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(data?.error ?? messages.statusUpdateError);
      }

      toast.success(messages.statusUpdatedSuccess);
      await loadItems();
    } catch (actionError) {
      toast.error(actionError instanceof Error ? actionError.message : messages.unknownError);
    }
  }

  async function deleteListing(id: string) {
    try {
      const response = await fetch(`/api/containers/${id}`, {
        method: "DELETE",
      });

      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(data?.error ?? messages.deleteError);
      }

      toast.success(messages.deletedSuccess);
      await loadItems();
    } catch (actionError) {
      toast.error(actionError instanceof Error ? actionError.message : messages.unknownError);
    }
  }

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-neutral-100">{messages.title}</h2>
        <p className="text-xs text-neutral-400">
          {formatTemplate(messages.totalLabel, { total })}
        </p>
      </div>

      <div className="mb-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_220px]">
        <input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder={messages.searchPlaceholder}
          className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
        />
        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as "all" | "active" | "expired" | "closed");
            setPage(1);
          }}
          className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
        >
          <option value="all">{messages.statusOptions.all}</option>
          <option value="active">{messages.statusOptions.active}</option>
          <option value="expired">{messages.statusOptions.expired}</option>
          <option value="closed">{messages.statusOptions.closed}</option>
        </select>
      </div>

      {error ? <p className="mb-2 text-sm text-red-300">{error}</p> : null}
      {isLoading ? <p className="mb-2 text-sm text-neutral-300">{messages.loading}</p> : null}
      {!isLoading && !error && items.length === 0 ? (
        <p className="mb-2 text-sm text-neutral-400">{messages.empty}</p>
      ) : null}

      <div className="overflow-auto">
        <table className="w-full min-w-[1080px] text-left text-sm">
          <thead>
            <tr className="text-neutral-400">
              <th className="pb-2">{messages.columns.company}</th>
              <th className="pb-2">{messages.columns.container}</th>
              <th className="pb-2">{messages.columns.location}</th>
              <th className="pb-2">{messages.columns.quantity}</th>
              <th className="pb-2">{messages.columns.status}</th>
              <th className="pb-2">{messages.columns.expires}</th>
              <th className="pb-2">{messages.columns.actions}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-neutral-800 align-top">
                <td className="py-2 pr-3 text-neutral-200">{item.companyName}</td>
                <td className="py-2 pr-3 text-neutral-300">
                  {getContainerShortLabelLocalized(listingMessages, item.container)} (
                  {getListingKindLabel(listingMessages, item.type)})
                </td>
                <td className="py-2 pr-3 text-neutral-300">{item.locationCity}, {item.locationCountry}</td>
                <td className="py-2 pr-3 text-neutral-300">{item.quantity}</td>
                <td className="py-2 pr-3 text-neutral-300">{messages.statusValues[item.status]}</td>
                <td className="py-2 pr-3 text-neutral-300">{new Date(item.expiresAt).toLocaleDateString(locale)}</td>
                <td className="py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={withLang(`/containers/${item.id}`, locale)}
                      target="_blank"
                      className={ADMIN_NEUTRAL_BUTTON_CLASS}
                    >
                      {messages.actions.preview}
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        void setListingStatus(item.id, "active");
                      }}
                      className={ADMIN_SUCCESS_BUTTON_CLASS}
                    >
                      {messages.actions.activate}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void setListingStatus(item.id, "expired");
                      }}
                      className={ADMIN_WARNING_BUTTON_CLASS}
                    >
                      {messages.actions.expire}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void setListingStatus(item.id, "closed");
                      }}
                      className={ADMIN_NEUTRAL_BUTTON_CLASS}
                    >
                      {messages.actions.close}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(messages.confirmDelete)) {
                          void deleteListing(item.id);
                        }
                      }}
                      className={ADMIN_DANGER_BUTTON_CLASS}
                    >
                      {messages.actions.delete}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage((current) => Math.max(1, current - 1))}
          className={`${ADMIN_NEUTRAL_BUTTON_CLASS} disabled:opacity-50`}
        >
          {messages.previous}
        </button>
        <span className="text-xs text-neutral-400">{page}/{totalPages}</span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
          className={`${ADMIN_NEUTRAL_BUTTON_CLASS} disabled:opacity-50`}
        >
          {messages.next}
        </button>
      </div>
    </section>
  );
}


