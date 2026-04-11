"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/toast-provider";
import type { ContainerListingItem } from "@/lib/container-listings";
import { getContainerShortLabel } from "@/lib/container-listing-types";

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
  locale: string;
};

export function AdminContainersTable({ locale }: AdminContainersTableProps) {
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
        throw new Error(data.error ?? `Blad API (${response.status})`);
      }

      setItems(data.items ?? []);
      setTotalPages(data.meta?.totalPages ?? 1);
      setTotal(data.meta?.total ?? 0);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Nie udalo sie pobrac kontenerow");
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
        throw new Error(data?.error ?? "Nie udalo sie zmienic statusu");
      }

      toast.success("Status zaktualizowany");
      await loadItems();
    } catch (actionError) {
      toast.error(actionError instanceof Error ? actionError.message : "Wystapil blad");
    }
  }

  async function deleteListing(id: string) {
    try {
      const response = await fetch(`/api/containers/${id}`, {
        method: "DELETE",
      });

      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(data?.error ?? "Nie udalo sie usunac kontenera");
      }

      toast.success("Kontener usuniety");
      await loadItems();
    } catch (actionError) {
      toast.error(actionError instanceof Error ? actionError.message : "Wystapil blad");
    }
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-100">Kontenery</h2>
        <p className="text-xs text-slate-400">Lacznie: {total}</p>
      </div>

      <div className="mb-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_220px]">
        <input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Szukaj po firmie, lokalizacji, emailu"
          className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
        />
        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as "all" | "active" | "expired" | "closed");
            setPage(1);
          }}
          className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
        >
          <option value="all">Status: wszystkie</option>
          <option value="active">Aktywne</option>
          <option value="expired">Wygasle</option>
          <option value="closed">Zamkniete</option>
        </select>
      </div>

      {error ? <p className="mb-2 text-sm text-red-300">{error}</p> : null}
      {isLoading ? <p className="mb-2 text-sm text-slate-300">Ladowanie...</p> : null}

      <div className="overflow-auto">
        <table className="w-full min-w-[1080px] text-left text-sm">
          <thead>
            <tr className="text-slate-400">
              <th className="pb-2">Firma</th>
              <th className="pb-2">Kontener</th>
              <th className="pb-2">Lokalizacja</th>
              <th className="pb-2">Ilosc</th>
              <th className="pb-2">Status</th>
              <th className="pb-2">Wygasa</th>
              <th className="pb-2">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-slate-800 align-top">
                <td className="py-2 pr-3 text-slate-200">{item.companyName}</td>
                <td className="py-2 pr-3 text-slate-300">{getContainerShortLabel(item.container)} ({item.type})</td>
                <td className="py-2 pr-3 text-slate-300">{item.locationCity}, {item.locationCountry}</td>
                <td className="py-2 pr-3 text-slate-300">{item.quantity}</td>
                <td className="py-2 pr-3 text-slate-300">{item.status}</td>
                <td className="py-2 pr-3 text-slate-300">{new Date(item.expiresAt).toLocaleDateString(locale)}</td>
                <td className="py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/containers/${item.id}`}
                      target="_blank"
                      className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:border-slate-500"
                    >
                      Podglad
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        void setListingStatus(item.id, "active");
                      }}
                      className="rounded-md border border-emerald-700 px-2 py-1 text-xs text-emerald-200 hover:border-emerald-500"
                    >
                      Aktywuj
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void setListingStatus(item.id, "expired");
                      }}
                      className="rounded-md border border-amber-700 px-2 py-1 text-xs text-amber-200 hover:border-amber-500"
                    >
                      Wygas
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void setListingStatus(item.id, "closed");
                      }}
                      className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:border-slate-500"
                    >
                      Zamknij
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm("Czy na pewno usunac kontener?")) {
                          void deleteListing(item.id);
                        }
                      }}
                      className="rounded-md border border-rose-700 px-2 py-1 text-xs text-rose-200 hover:border-rose-500"
                    >
                      Usun
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
          className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-200 disabled:opacity-50"
        >
          Poprzednia
        </button>
        <span className="text-xs text-slate-400">{page}/{totalPages}</span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
          className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-200 disabled:opacity-50"
        >
          Nastepna
        </button>
      </div>
    </section>
  );
}

