"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CONTAINER_TYPES,
  DEAL_TYPES,
  LISTING_TYPES,
  type ContainerType,
  type DealType,
  type ListingType,
} from "@/lib/container-listing-types";
import type { ContainerListingItem } from "@/lib/container-listings";

type ContainersApiResponse = {
  items?: ContainerListingItem[];
  meta?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  error?: string;
};

type ContainerListingsBoardProps = {
  isLoggedIn: boolean;
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

const DEAL_TYPE_LABEL: Record<DealType, string> = {
  sale: "Sprzedaz",
  rent: "Wynajem",
  one_way: "One way",
  long_term: "Wspolpraca dlugoterminowa",
};

export function ContainerListingsBoard({ isLoggedIn }: ContainerListingsBoardProps) {
  const [items, setItems] = useState<ContainerListingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"all" | ListingType>("all");
  const [containerType, setContainerType] = useState<"all" | ContainerType>("all");
  const [dealType, setDealType] = useState<"all" | DealType>("all");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setQuery(q.trim());
      setPage(1);
    }, 300);

    return () => {
      window.clearTimeout(handle);
    };
  }, [q]);

  const requestUrl = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "20",
      sortBy: "createdAt",
      sortDir: "desc",
    });

    if (query) {
      params.set("q", query);
    }
    if (type !== "all") {
      params.set("type", type);
    }
    if (containerType !== "all") {
      params.set("containerType", containerType);
    }
    if (dealType !== "all") {
      params.set("dealType", dealType);
    }
    if (city.trim()) {
      params.set("city", city.trim());
    }
    if (country.trim()) {
      params.set("country", country.trim());
    }

    return `/api/containers?${params.toString()}`;
  }, [page, query, type, containerType, dealType, city, country]);

  useEffect(() => {
    const controller = new AbortController();

    void fetch(requestUrl, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = (await response.json()) as ContainersApiResponse;
        if (!response.ok) {
          throw new Error(data.error ?? `Blad API (${response.status})`);
        }
        return data;
      })
      .then((data) => {
        if (controller.signal.aborted) {
          return;
        }

        setError(null);
        setItems(data.items ?? []);
        setTotalPages(data.meta?.totalPages ?? 1);
        setTotal(data.meta?.total ?? 0);
      })
      .catch((loadError) => {
        if (controller.signal.aborted) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "Nie udalo sie zaladowac kontenerow");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [requestUrl]);

  return (
    <section className="grid gap-4">
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold text-slate-100">ContainerBoard</h1>
          <div className="flex flex-wrap items-center gap-2">
            {isLoggedIn ? (
              <Link
                href="/containers/mine"
                className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-500"
              >
                Moje kontenery
              </Link>
            ) : null}
            <Link
              href={isLoggedIn ? "/containers/new" : "/login?next=/containers/new"}
              className="rounded-md bg-emerald-500 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400"
            >
              Dodaj kontener
            </Link>
          </div>
        </div>

        <p className="mb-3 text-sm text-slate-300">
          Prosta tablica kontenerow: dostepne i poszukiwane. Filtruj i wysylaj zapytania bezposrednio do wlasciciela.
        </p>

        <div className="grid gap-2 md:grid-cols-3 lg:grid-cols-6">
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Szukaj"
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          />
          <select
            value={type}
            onChange={(event) => {
              setType(event.target.value as "all" | ListingType);
              setPage(1);
            }}
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          >
            <option value="all">Typ: wszystkie</option>
            {LISTING_TYPES.map((itemType) => (
              <option key={itemType} value={itemType}>{LISTING_TYPE_LABEL[itemType]}</option>
            ))}
          </select>
          <select
            value={containerType}
            onChange={(event) => {
              setContainerType(event.target.value as "all" | ContainerType);
              setPage(1);
            }}
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          >
            <option value="all">Kontener: wszystkie</option>
            {CONTAINER_TYPES.map((itemType) => (
              <option key={itemType} value={itemType}>{CONTAINER_TYPE_LABEL[itemType]}</option>
            ))}
          </select>
          <select
            value={dealType}
            onChange={(event) => {
              setDealType(event.target.value as "all" | DealType);
              setPage(1);
            }}
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          >
            <option value="all">Transakcja: wszystkie</option>
            {DEAL_TYPES.map((itemType) => (
              <option key={itemType} value={itemType}>{DEAL_TYPE_LABEL[itemType]}</option>
            ))}
          </select>
          <input
            value={city}
            onChange={(event) => {
              setCity(event.target.value);
              setPage(1);
            }}
            placeholder="Miasto"
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          />
          <input
            value={country}
            onChange={(event) => {
              setCountry(event.target.value);
              setPage(1);
            }}
            placeholder="Kraj"
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          />
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm text-slate-300">Wyniki: {total}</p>
        </div>

        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        {isLoading ? <p className="text-sm text-slate-400">Ladowanie kontenerow...</p> : null}

        {!isLoading && items.length === 0 ? (
          <p className="text-sm text-slate-400">Brak kontenerow dla aktualnych filtrow.</p>
        ) : null}

        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm text-slate-400">{item.companyName}</p>
                  <h2 className="text-lg font-semibold text-slate-100">
                    {CONTAINER_TYPE_LABEL[item.containerType]} • {LISTING_TYPE_LABEL[item.type]}
                  </h2>
                </div>
                <span className="rounded-md border border-cyan-700/80 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-200">
                  {DEAL_TYPE_LABEL[item.dealType]}
                </span>
              </div>

              <div className="mt-2 grid gap-2 text-sm text-slate-300 sm:grid-cols-2 lg:grid-cols-4">
                <p>Ilosc: <span className="text-slate-100">{item.quantity}</span></p>
                <p>Lokalizacja: <span className="text-slate-100">{item.locationCity}, {item.locationCountry}</span></p>
                <p>Dostepny od: <span className="text-slate-100">{new Date(item.availableFrom).toLocaleDateString("pl-PL")}</span></p>
                <p>Wygasa: <span className="text-slate-100">{new Date(item.expiresAt).toLocaleDateString("pl-PL")}</span></p>
              </div>

              {item.description ? (
                <p className="mt-2 line-clamp-2 text-sm text-slate-300">{item.description}</p>
              ) : null}

              <div className="mt-3 flex items-center justify-end">
                <Link
                  href={`/containers/${item.id}`}
                  className="rounded-md border border-emerald-700 px-3 py-2 text-sm text-emerald-200 hover:border-emerald-500"
                >
                  Szczegoly i zapytanie
                </Link>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="rounded-md border border-slate-700 px-3 py-1 text-sm text-slate-200 disabled:opacity-50"
          >
            Poprzednia
          </button>
          <span className="text-xs text-slate-400">Strona {page} / {totalPages}</span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            className="rounded-md border border-slate-700 px-3 py-1 text-sm text-slate-200 disabled:opacity-50"
          >
            Nastepna
          </button>
        </div>
      </div>
    </section>
  );
}

