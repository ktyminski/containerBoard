"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { type AppLocale, withLang } from "@/lib/i18n";

type ContactActivityItem = {
  id: string;
  type: "inquiry_sent" | "contact_revealed";
  listingId: string;
  listingType?: string;
  listingSummary: string;
  listingCompanyName?: string;
  actorUserId?: string;
  actorIsGuest: boolean;
  actorName?: string;
  actorEmail?: string;
  actorPhone?: string;
  actorAccountName?: string;
  actorAccountEmail?: string;
  actorIp?: string;
  recipientUserId?: string;
  recipientCompanyName?: string;
  recipientEmail?: string;
  recipientPhone?: string;
  inquiryMessage?: string;
  requestedQuantity?: number;
  offeredPrice?: string;
  createdAt: string;
};

type ContactActivityResponse = {
  items?: ContactActivityItem[];
  meta?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  error?: string;
};

type AdminContactActivityTableProps = {
  locale: AppLocale;
};

const ADMIN_NEUTRAL_BUTTON_CLASS =
  "rounded-md border border-neutral-600 bg-neutral-800/90 px-2 py-1 text-xs text-neutral-100 hover:border-neutral-500 hover:bg-neutral-700/90";

export function AdminContactActivityTable({
  locale,
}: AdminContactActivityTableProps) {
  const [items, setItems] = useState<ContactActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [queryDraft, setQueryDraft] = useState("");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<
    "all" | "inquiry_sent" | "contact_revealed"
  >("all");

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
        type: typeFilter,
      });
      if (query) {
        params.set("q", query);
      }
      const response = await fetch(`/api/admin/contact-activity?${params.toString()}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as ContactActivityResponse;
      if (!response.ok) {
        throw new Error(
          data.error ?? `Nie udalo sie zaladowac logow kontaktu (${response.status})`,
        );
      }
      setItems(data.items ?? []);
      setTotalPages(data.meta?.totalPages ?? 1);
      setTotal(data.meta?.total ?? 0);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Nie udalo sie pobrac logow kontaktu.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [page, query, typeFilter]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-neutral-100">Logi kontaktu</h2>
        <p className="text-xs text-neutral-400">Lacznie: {total}</p>
      </div>

      <div className="mb-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_220px_auto]">
        <input
          value={queryDraft}
          onChange={(event) => {
            setQueryDraft(event.target.value);
          }}
          placeholder="Szukaj po ogloszeniu, wiadomosci, emailu, telefonie lub IP"
          className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
        />
        <select
          value={typeFilter}
          onChange={(event) => {
            setTypeFilter(
              event.target.value as "all" | "inquiry_sent" | "contact_revealed",
            );
            setPage(1);
          }}
          className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
        >
          <option value="all">Typ: wszystkie</option>
          <option value="inquiry_sent">Wyslane zapytania</option>
          <option value="contact_revealed">Odslony kontaktu</option>
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
        <p className="mb-2 text-sm text-neutral-400">Brak logow kontaktu.</p>
      ) : null}

      <div className="overflow-auto">
        <table className="w-full min-w-[1400px] text-left text-sm">
          <thead>
            <tr className="text-neutral-400">
              <th className="pb-2">Typ</th>
              <th className="pb-2">Kto</th>
              <th className="pb-2">Do kogo</th>
              <th className="pb-2">Ogloszenie</th>
              <th className="pb-2">Szczegoly</th>
              <th className="pb-2">Data</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-neutral-800 align-top">
                <td className="py-2 pr-3 text-neutral-300">
                  <span className="inline-flex rounded-md border border-sky-500/70 bg-sky-700/35 px-2 py-0.5 text-xs text-sky-50">
                    {item.type === "inquiry_sent" ? "Zapytanie" : "Odslona kontaktu"}
                  </span>
                </td>
                <td className="py-2 pr-3 text-neutral-300">
                  <div className="grid gap-1">
                    <span className="font-medium text-neutral-100">
                      {item.actorName || item.actorAccountName || "Gosc"}
                    </span>
                    <span className="text-xs text-neutral-500">
                      {item.actorEmail || item.actorAccountEmail || "-"}
                    </span>
                    <span className="text-xs text-neutral-500">
                      {item.actorPhone || "-"}
                    </span>
                    <span className="text-xs text-neutral-500">
                      {item.actorIsGuest ? "Gosc" : "Uzytkownik"}
                    </span>
                    {item.actorIp ? (
                      <span className="text-xs text-neutral-500">
                        IP: {item.actorIp}
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="py-2 pr-3 text-neutral-300">
                  <div className="grid gap-1">
                    <span className="font-medium text-neutral-100">
                      {item.recipientCompanyName || "-"}
                    </span>
                    <span className="text-xs text-neutral-500">
                      {item.recipientEmail || "-"}
                    </span>
                    <span className="text-xs text-neutral-500">
                      {item.recipientPhone || "-"}
                    </span>
                  </div>
                </td>
                <td className="py-2 pr-3 text-neutral-300">
                  <div className="grid gap-1">
                    <Link
                      href={withLang(`/containers/${item.listingId}`, locale)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex w-fit text-sky-200 hover:text-sky-100 hover:underline"
                    >
                      {item.listingSummary}
                    </Link>
                    <span className="text-xs text-neutral-500">{item.listingId}</span>
                  </div>
                </td>
                <td className="py-2 pr-3 text-neutral-300">
                  {item.type === "inquiry_sent" ? (
                    <div className="grid gap-1">
                      <p className="line-clamp-4 max-w-[320px] whitespace-pre-wrap text-xs text-neutral-300">
                        {item.inquiryMessage || "Brak wiadomosci"}
                      </p>
                      <span className="text-xs text-neutral-500">
                        Ilosc:{" "}
                        {typeof item.requestedQuantity === "number"
                          ? item.requestedQuantity
                          : "-"}
                      </span>
                      <span className="text-xs text-neutral-500">
                        Cena: {item.offeredPrice || "-"}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-neutral-500">
                      Kontakt zostal odsloniety z karty ogloszenia.
                    </span>
                  )}
                </td>
                <td className="py-2 text-neutral-400">
                  {new Date(item.createdAt).toLocaleString(locale)}
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
