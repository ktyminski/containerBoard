"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/toast-provider";
import { type ContainerListingItem } from "@/lib/container-listings";
import {
  getContainerShortLabel,
  LISTING_STATUS,
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

const DARK_BLUE_CTA_CLASS =
  "border border-[#2f639a] bg-[linear-gradient(180deg,#082650_0%,#0c3466_100%)] text-[#e2efff] transition hover:border-[#67c7ff] hover:text-white";

const STATUS_BADGE_CLASS: Record<"active" | "expired" | "closed", string> = {
  active: "rounded-md border border-emerald-300 bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800",
  expired: "rounded-md border border-amber-300 bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800",
  closed: "rounded-md border border-neutral-300 bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-700",
};

const STATUS_LABEL: Record<"active" | "expired" | "closed", string> = {
  active: "Aktywny",
  expired: "Wygasl",
  closed: "Zamkniety",
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
    <section className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-neutral-300 bg-neutral-50/95 p-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-neutral-50/90">
        <h1 className="text-2xl font-semibold text-neutral-900">Moje kontenery</h1>
        <div className="flex items-center gap-2">
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as "all" | "active" | "expired" | "closed")}
            className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-900"
          >
            <option value="all">Status: wszystkie</option>
            <option value="active">Aktywne</option>
            <option value="expired">Wygasle</option>
            <option value="closed">Zamkniete</option>
          </select>
          <Link
            href="/containers/new"
            className={`inline-flex h-10 items-center rounded-md px-3 text-sm font-medium ${DARK_BLUE_CTA_CLASS}`}
          >
            Dodaj kontener
          </Link>
        </div>
      </div>

      <div className="rounded-md border border-neutral-300 bg-neutral-100/95 p-3 shadow-sm">
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}

        {isLoading ? (
          <div className="rounded-md border border-neutral-300 bg-neutral-50/95 p-5 shadow-sm">
            <div className="flex items-center justify-center gap-3 text-neutral-700">
              <span
                className="h-7 w-7 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-500"
                aria-label="Ladowanie kontenerow"
              />
              <span className="text-sm font-medium">Ladowanie kontenerow...</span>
            </div>
          </div>
        ) : null}

        {!isLoading && items.length === 0 ? (
          <div className="flex min-h-[220px] items-center justify-center px-4 text-center">
            <p className="text-xl font-medium text-neutral-400 sm:text-2xl">
              Brak kontenerow dla wybranego statusu.
            </p>
          </div>
        ) : null}

        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-md border border-neutral-200 bg-white p-4 shadow-sm transition-colors duration-150 hover:border-sky-100 hover:bg-sky-50/60"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-neutral-900">
                  {getContainerShortLabel(item.container)} - {LISTING_TYPE_LABEL[item.type]}
                </h2>
                <span className={STATUS_BADGE_CLASS[item.status]}>
                  {STATUS_LABEL[item.status]}
                </span>
              </div>

              <div className="mt-2 text-sm text-neutral-700">
                <p>
                  {item.companyName} - {item.locationCity}, {item.locationCountry}
                </p>
                <p>Ilosc: {item.quantity}</p>
                <p>Wygasa: {new Date(item.expiresAt).toLocaleDateString("pl-PL")}</p>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                <Link
                  href={`/containers/${item.id}`}
                  className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-700 transition-colors hover:border-neutral-400 hover:bg-neutral-100"
                >
                  Szczegoly
                </Link>
                <Link
                  href={`/containers/${item.id}/edit`}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${DARK_BLUE_CTA_CLASS}`}
                >
                  Edytuj
                </Link>
                {item.status !== LISTING_STATUS.CLOSED ? (
                  <button
                    type="button"
                    onClick={() => {
                      void runAction(item.id, "close");
                    }}
                    className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm text-amber-800 transition-colors hover:bg-amber-50"
                  >
                    Zamknij
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    void runAction(item.id, "refresh");
                  }}
                  className="rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-sm text-emerald-800 transition-colors hover:bg-emerald-50"
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
                  className="rounded-md border border-rose-300 bg-white px-3 py-1.5 text-sm text-rose-800 transition-colors hover:bg-rose-50"
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

