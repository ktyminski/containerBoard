"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatTemplate, type AppLocale, type AppMessages, withLang } from "@/lib/i18n";

type ConciergeAdminItem = {
  id: string;
  companyName: string;
  companySlug?: string;
  userName: string;
  userEmail: string;
  contactEmail?: string;
  contactPhone?: string;
  note?: string;
  stockFile: {
    filename: string;
    contentType: string;
    size: number;
  };
  status: "new" | "completed";
  notificationSentAt?: string;
  notificationError?: string;
  createdAt: string;
};

type ConciergeAdminResponse = {
  items?: ConciergeAdminItem[];
  meta?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  error?: string;
};

type AdminConciergeRequestsTableProps = {
  locale: AppLocale;
  messages: AppMessages["adminConcierge"];
};

const ADMIN_NEUTRAL_BUTTON_CLASS =
  "rounded-md border border-neutral-600 bg-neutral-800/90 px-2 py-1 text-xs text-neutral-100 hover:border-neutral-500 hover:bg-neutral-700/90";
const ADMIN_INFO_BUTTON_CLASS =
  "rounded-md border border-sky-500/85 bg-sky-700/50 px-2 py-1 text-xs text-sky-50 hover:border-sky-400 hover:bg-sky-700/65";

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value < 0) {
    return "-";
  }
  if (value < 1024) {
    return `${value} B`;
  }
  const kb = value / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

export function AdminConciergeRequestsTable({
  locale,
  messages,
}: AdminConciergeRequestsTableProps) {
  const [items, setItems] = useState<ConciergeAdminItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [queryDraft, setQueryDraft] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "new" | "completed">(
    "all",
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setQuery(queryDraft.trim());
      setPage(1);
    }, 300);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [queryDraft]);

  const loadItems = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "20",
        status: statusFilter,
      });
      if (query) {
        params.set("q", query);
      }
      const response = await fetch(
        `/api/admin/concierge-requests?${params.toString()}`,
        {
          cache: "no-store",
        },
      );
      const data = (await response.json()) as ConciergeAdminResponse;
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
        loadError instanceof Error
          ? loadError.message
          : messages.loadFallbackError,
      );
    } finally {
      setIsLoading(false);
    }
  }, [page, query, statusFilter]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-neutral-100">{messages.title}</h2>
        <p className="text-xs text-neutral-400">
          {formatTemplate(messages.totalLabel, { total })}
        </p>
      </div>

      <div className="mb-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_220px_auto]">
        <input
          value={queryDraft}
          onChange={(event) => {
            setQueryDraft(event.target.value);
          }}
          placeholder={messages.searchPlaceholder}
          className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
        />
        <select
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value as "all" | "new" | "completed");
            setPage(1);
          }}
          className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
        >
          <option value="all">{messages.statusOptions.all}</option>
          <option value="new">{messages.statusOptions.new}</option>
          <option value="completed">{messages.statusOptions.completed}</option>
        </select>
        <button
          type="button"
          onClick={() => {
            void loadItems();
          }}
          className={ADMIN_NEUTRAL_BUTTON_CLASS}
        >
          {messages.refresh}
        </button>
      </div>

      {error ? <p className="mb-2 text-sm text-red-300">{error}</p> : null}
      {isLoading ? <p className="mb-2 text-sm text-neutral-300">{messages.loading}</p> : null}

      {items.length === 0 && !isLoading ? (
        <p className="mb-2 text-sm text-neutral-400">{messages.empty}</p>
      ) : null}

      <div className="overflow-auto">
        <table className="w-full min-w-[1240px] text-left text-sm">
          <thead>
            <tr className="text-neutral-400">
              <th className="pb-2">{messages.columns.company}</th>
              <th className="pb-2">{messages.columns.requester}</th>
              <th className="pb-2">{messages.columns.contact}</th>
              <th className="pb-2">{messages.columns.stockFile}</th>
              <th className="pb-2">{messages.columns.note}</th>
              <th className="pb-2">{messages.columns.mail}</th>
              <th className="pb-2">{messages.columns.date}</th>
              <th className="pb-2">{messages.columns.actions}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-neutral-800 align-top">
                <td className="py-2 pr-3 text-neutral-200">
                  <div className="grid gap-1">
                    {item.companySlug ? (
                      <Link
                        href={withLang(`/companies/${item.companySlug}`, locale)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex w-fit text-sky-200 hover:text-sky-100 hover:underline"
                      >
                        {item.companyName}
                      </Link>
                    ) : (
                      <span>{item.companyName}</span>
                    )}
                    <span className="text-xs text-neutral-500">
                      {messages.statusLabel}: {messages.statusValues[item.status]}
                    </span>
                  </div>
                </td>
                <td className="py-2 pr-3 text-neutral-300">
                  <p>{item.userName}</p>
                  <p className="text-xs text-neutral-500">{item.userEmail}</p>
                </td>
                <td className="py-2 pr-3 text-neutral-300">
                  <p className="text-xs text-neutral-500">
                    {item.contactEmail ?? messages.notProvided}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {item.contactPhone ?? messages.notProvided}
                  </p>
                </td>
                <td className="py-2 pr-3 text-neutral-300">
                  <p className="truncate" title={item.stockFile.filename}>
                    {item.stockFile.filename}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {item.stockFile.contentType}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {formatBytes(item.stockFile.size)}
                  </p>
                </td>
                <td className="py-2 pr-3 text-neutral-300">
                  {item.note ? (
                    <p className="line-clamp-3 max-w-[260px] whitespace-pre-wrap text-xs text-neutral-300">
                      {item.note}
                    </p>
                  ) : (
                    <span className="text-xs text-neutral-500">{messages.notProvided}</span>
                  )}
                </td>
                <td className="py-2 pr-3 text-neutral-300">
                  {item.notificationSentAt ? (
                    <div className="grid gap-1">
                      <span className="inline-flex w-fit rounded-md border border-emerald-500/80 bg-emerald-700/45 px-2 py-0.5 text-xs text-emerald-50">
                        {messages.notification.sent}
                      </span>
                      <span className="text-xs text-neutral-500">
                        {new Date(item.notificationSentAt).toLocaleString(locale)}
                      </span>
                    </div>
                  ) : item.notificationError ? (
                    <div className="grid gap-1">
                      <span className="inline-flex w-fit rounded-md border border-rose-500/80 bg-rose-700/45 px-2 py-0.5 text-xs text-rose-50">
                        {messages.notification.error}
                      </span>
                      <span className="max-w-[260px] text-xs text-rose-300">
                        {item.notificationError}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-neutral-500">{messages.notification.pending}</span>
                  )}
                </td>
                <td className="py-2 pr-3 text-neutral-400">
                  {new Date(item.createdAt).toLocaleString(locale)}
                </td>
                <td className="py-2">
                  <a
                    href={`/api/admin/concierge-requests/${item.id}/file`}
                    target="_blank"
                    rel="noreferrer"
                    className={ADMIN_INFO_BUTTON_CLASS}
                  >
                    {messages.downloadFile}
                  </a>
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
          onClick={() => {
            setPage((current) => Math.max(1, current - 1));
          }}
          className={`${ADMIN_NEUTRAL_BUTTON_CLASS} disabled:opacity-50`}
        >
          {messages.previous}
        </button>
        <span className="text-xs text-neutral-400">
          {page}/{totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => {
            setPage((current) => Math.min(totalPages, current + 1));
          }}
          className={`${ADMIN_NEUTRAL_BUTTON_CLASS} disabled:opacity-50`}
        >
          {messages.next}
        </button>
      </div>
    </section>
  );
}
