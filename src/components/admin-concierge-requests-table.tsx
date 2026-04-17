"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

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
  locale: string;
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
        throw new Error(data.error ?? `Blad API (${response.status})`);
      }
      setItems(data.items ?? []);
      setTotalPages(data.meta?.totalPages ?? 1);
      setTotal(data.meta?.total ?? 0);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Nie udalo sie pobrac zgloszen concierge",
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
        <h2 className="text-lg font-semibold text-neutral-100">Zlecenia Concierge</h2>
        <p className="text-xs text-neutral-400">Lacznie: {total}</p>
      </div>

      <div className="mb-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_220px_auto]">
        <input
          value={queryDraft}
          onChange={(event) => {
            setQueryDraft(event.target.value);
          }}
          placeholder="Szukaj po firmie, userze, emailu, pliku"
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
          <option value="all">Status: wszystkie</option>
          <option value="new">Nowe</option>
          <option value="completed">Zamkniete</option>
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

      {error ? <p className="mb-2 text-sm text-red-300">{error}</p> : null}
      {isLoading ? <p className="mb-2 text-sm text-neutral-300">Ladowanie...</p> : null}

      {items.length === 0 && !isLoading ? (
        <p className="mb-2 text-sm text-neutral-400">Brak zgloszen concierge.</p>
      ) : null}

      <div className="overflow-auto">
        <table className="w-full min-w-[1240px] text-left text-sm">
          <thead>
            <tr className="text-neutral-400">
              <th className="pb-2">Firma</th>
              <th className="pb-2">Zglaszajacy</th>
              <th className="pb-2">Kontakt</th>
              <th className="pb-2">Plik stock</th>
              <th className="pb-2">Notatka</th>
              <th className="pb-2">Mail</th>
              <th className="pb-2">Data</th>
              <th className="pb-2">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-neutral-800 align-top">
                <td className="py-2 pr-3 text-neutral-200">
                  <div className="grid gap-1">
                    {item.companySlug ? (
                      <Link
                        href={`/companies/${item.companySlug}`}
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
                      Status: {item.status === "completed" ? "zamkniete" : "nowe"}
                    </span>
                  </div>
                </td>
                <td className="py-2 pr-3 text-neutral-300">
                  <p>{item.userName}</p>
                  <p className="text-xs text-neutral-500">{item.userEmail}</p>
                </td>
                <td className="py-2 pr-3 text-neutral-300">
                  <p className="text-xs text-neutral-500">
                    {item.contactEmail ?? "-"}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {item.contactPhone ?? "-"}
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
                    <span className="text-xs text-neutral-500">-</span>
                  )}
                </td>
                <td className="py-2 pr-3 text-neutral-300">
                  {item.notificationSentAt ? (
                    <div className="grid gap-1">
                      <span className="inline-flex w-fit rounded-md border border-emerald-500/80 bg-emerald-700/45 px-2 py-0.5 text-xs text-emerald-50">
                        Wyslano
                      </span>
                      <span className="text-xs text-neutral-500">
                        {new Date(item.notificationSentAt).toLocaleString(locale)}
                      </span>
                    </div>
                  ) : item.notificationError ? (
                    <div className="grid gap-1">
                      <span className="inline-flex w-fit rounded-md border border-rose-500/80 bg-rose-700/45 px-2 py-0.5 text-xs text-rose-50">
                        Blad
                      </span>
                      <span className="max-w-[260px] text-xs text-rose-300">
                        {item.notificationError}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-neutral-500">Oczekuje</span>
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
                    Pobierz plik
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
          Poprzednia
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
          Nastepna
        </button>
      </div>
    </section>
  );
}

