"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/toast-provider";
import { type ContainerListingItem } from "@/lib/container-listings";
import {
  LISTING_STATUS,
  type ContainerType,
  type ListingType,
} from "@/lib/container-listing-types";

type MineResponse = {
  items?: ContainerListingItem[];
  meta?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  error?: string;
};

const LISTING_TYPE_LABEL: Record<ListingType, string> = {
  available: "Dostepny",
  wanted: "Poszukiwany",
};

const CONTAINER_TYPE_LABEL: Record<ContainerType, string> = {
  "20DV": "20DV",
  "40DV": "40DV",
  "40HC": "40HC",
  reefer: "Reefer",
  open_top: "Open Top",
  flat_rack: "Flat Rack",
  other: "Inny",
};

export function MyContainerListings() {
  const toast = useToast();
  const [items, setItems] = useState<ContainerListingItem[]>([]);
  const [status, setStatus] = useState<"all" | "active" | "expired" | "closed">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMine = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        mine: "1",
        pageSize: "100",
      });
      if (status !== "all") {
        params.set("status", status);
      }

      const response = await fetch(`/api/containers?${params.toString()}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as MineResponse;

      if (!response.ok) {
        throw new Error(data.error ?? `Blad API (${response.status})`);
      }

      setItems(data.items ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Nie udalo sie pobrac listy");
    } finally {
      setIsLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void loadMine();
  }, [loadMine]);

  async function runAction(id: string, action: "close" | "refresh" | "delete") {
    try {
      const response = await fetch(`/api/containers/${id}`, {
        method: action === "delete" ? "DELETE" : "PATCH",
        headers: action === "delete" ? undefined : { "Content-Type": "application/json" },
        body: action === "delete" ? undefined : JSON.stringify({ action }),
      });

      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(data?.error ?? "Nie udalo sie wykonac akcji");
      }

      toast.success(
        action === "close"
          ? "Kontener zamkniety"
          : action === "refresh"
            ? "Kontener odswiezony"
            : "Kontener usuniety",
      );
      await loadMine();
    } catch (actionError) {
      toast.error(actionError instanceof Error ? actionError.message : "Wystapil blad");
    }
  }

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <h1 className="text-2xl font-semibold text-slate-100">Moje kontenery</h1>
        <div className="flex items-center gap-2">
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as "all" | "active" | "expired" | "closed")}
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          >
            <option value="all">Status: wszystkie</option>
            <option value="active">Aktywne</option>
            <option value="expired">Wygasle</option>
            <option value="closed">Zamkniete</option>
          </select>
          <Link
            href="/containers/new"
            className="rounded-md bg-emerald-500 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400"
          >
            Dodaj kontener
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        {isLoading ? <p className="text-sm text-slate-400">Ladowanie...</p> : null}

        {!isLoading && items.length === 0 ? (
          <p className="text-sm text-slate-400">Brak kontenerow dla wybranego statusu.</p>
        ) : null}

        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-slate-100">
                  {CONTAINER_TYPE_LABEL[item.containerType]} • {LISTING_TYPE_LABEL[item.type]}
                </h2>
                <span
                  className={
                    item.status === LISTING_STATUS.ACTIVE
                      ? "rounded-md border border-emerald-700 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200"
                      : item.status === LISTING_STATUS.EXPIRED
                        ? "rounded-md border border-amber-700 bg-amber-500/10 px-2 py-1 text-xs text-amber-200"
                        : "rounded-md border border-slate-700 bg-slate-700/30 px-2 py-1 text-xs text-slate-200"
                  }
                >
                  {item.status === "active" ? "Aktywny" : item.status === "expired" ? "Wygasl" : "Zamkniety"}
                </span>
              </div>

              <div className="mt-2 text-sm text-slate-300">
                <p>{item.companyName} • {item.locationCity}, {item.locationCountry}</p>
                <p>Ilosc: {item.quantity}</p>
                <p>Wygasa: {new Date(item.expiresAt).toLocaleDateString("pl-PL")}</p>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                <Link
                  href={`/containers/${item.id}`}
                  className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:border-slate-500"
                >
                  Szczegoly
                </Link>
                <Link
                  href={`/containers/${item.id}/edit`}
                  className="rounded-md border border-sky-700 px-3 py-1.5 text-sm text-sky-200 hover:border-sky-500"
                >
                  Edytuj
                </Link>
                {item.status !== "closed" ? (
                  <button
                    type="button"
                    onClick={() => {
                      void runAction(item.id, "close");
                    }}
                    className="rounded-md border border-amber-700 px-3 py-1.5 text-sm text-amber-200 hover:border-amber-500"
                  >
                    Zamknij
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    void runAction(item.id, "refresh");
                  }}
                  className="rounded-md border border-emerald-700 px-3 py-1.5 text-sm text-emerald-200 hover:border-emerald-500"
                >
                  Odswiez 14 dni
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("Czy na pewno usunac kontener?")) {
                      void runAction(item.id, "delete");
                    }
                  }}
                  className="rounded-md border border-rose-700 px-3 py-1.5 text-sm text-rose-200 hover:border-rose-500"
                >
                  Usun
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

