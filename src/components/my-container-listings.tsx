"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useToast } from "@/components/toast-provider";
import { getSortParams } from "@/components/container-listings-utils";
import { SORT_OPTIONS, type SortPreset } from "@/components/container-listings-shared";
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

type BulkUploadResponse = {
  createdCount?: number;
  failedCount?: number;
  totalRows?: number;
  maxRows?: number;
  failures?: Array<{
    rowNumber: number;
    error: string;
  }>;
  error?: string;
  message?: string;
};

type ConciergeUploadResponse = {
  id?: string;
  filename?: string;
  createdAt?: string;
  notificationSent?: boolean;
  warning?: string;
  error?: string;
  message?: string;
};

const LISTING_TYPE_LABEL: Record<ListingType, string> = {
  sell: "Sprzedaz",
  rent: "Wynajem",
  buy: "Chce zakupic",
};

const DARK_BLUE_CTA_CLASS =
  "border border-[#2f639a] bg-[linear-gradient(180deg,#082650_0%,#0c3466_100%)] text-[#e2efff] transition hover:border-[#67c7ff] hover:text-white";
const MAX_CONCIERGE_FILE_MB = 25;

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

function SelectWithChevron(props: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  children: ReactNode;
}) {
  const { value, onChange, className, children } = props;
  return (
    <div className={`relative min-w-0 ${className ?? ""}`}>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full min-w-0 appearance-none rounded-md border border-neutral-300 bg-white px-3 pr-10 text-sm text-neutral-900 transition"
      >
        {children}
      </select>
      <svg
        viewBox="0 0 20 20"
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500"
        fill="none"
      >
        <path
          d="M5 7.5L10 12.5L15 7.5"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export function MyContainerListings(input?: { canUseBulkImport?: boolean }) {
  const canUseBulkImport = input?.canUseBulkImport ?? true;
  const toast = useToast();
  const [items, setItems] = useState<ContainerListingItem[]>([]);
  const [status, setStatus] = useState<"all" | "active" | "expired" | "closed">("all");
  const [sortPreset, setSortPreset] = useState<SortPreset>("newest");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [isBulkImporting, setIsBulkImporting] = useState(false);
  const [bulkReport, setBulkReport] = useState<BulkUploadResponse | null>(null);
  const [conciergeFile, setConciergeFile] = useState<File | null>(null);
  const [conciergeNote, setConciergeNote] = useState("");
  const [isConciergeSubmitting, setIsConciergeSubmitting] = useState(false);
  const [conciergeReport, setConciergeReport] =
    useState<ConciergeUploadResponse | null>(null);

  const loadMine = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { sortBy, sortDir } = getSortParams(sortPreset);
      const params = new URLSearchParams({
        mine: "1",
        page: String(page),
        pageSize: String(pageSize),
        sortBy,
        sortDir,
      });
      if (status !== "all") {
        params.set("status", status);
      }
      if (sortBy === "priceNet") {
        params.set("priceCurrency", "PLN");
      }

      const response = await fetch(`/api/containers?${params.toString()}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as MineResponse;

      if (!response.ok) {
        throw new Error(data.error ?? `Blad API (${response.status})`);
      }

      setItems(data.items ?? []);
      setTotalPages(data.meta?.totalPages ?? 1);
      const resolvedPage = data.meta?.page ?? page;
      setPage((current) => (current === resolvedPage ? current : resolvedPage));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Nie udalo sie pobrac listy");
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, sortPreset, status]);

  useEffect(() => {
    void loadMine();
  }, [loadMine]);

  const goToPreviousPage = () => {
    setPage((current) => Math.max(1, current - 1));
  };

  const goToNextPage = () => {
    setPage((current) => Math.min(totalPages, current + 1));
  };

  async function handleBulkImport() {
    if (!canUseBulkImport) {
      toast.error("Zaloz profil firmy, zeby skorzystac z Multi Importu");
      return;
    }
    if (!bulkFile) {
      toast.error("Najpierw wybierz plik Excel");
      return;
    }

    const filename = bulkFile.name.trim().toLowerCase();
    if (!filename.endsWith(".xlsx") && !filename.endsWith(".xls")) {
      toast.error("Dozwolone sa tylko pliki Excel (.xlsx, .xls)");
      return;
    }

    setIsBulkImporting(true);
    try {
      const formData = new FormData();
      formData.set("file", bulkFile);
      const response = await fetch("/api/containers/bulk", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json().catch(() => null)) as BulkUploadResponse | null;
      if (!response.ok) {
        throw new Error(
          data?.error ?? data?.message ?? `Blad importu (${response.status})`,
        );
      }

      setBulkReport(data ?? null);
      const createdCount = data?.createdCount ?? 0;
      const failedCount = data?.failedCount ?? 0;
      if (createdCount > 0) {
        toast.success(`Dodano ${createdCount} ogloszen`);
        await loadMine();
      }
      if (failedCount > 0) {
        toast.warning(`${failedCount} wierszy nie zostalo zaimportowanych`);
      }
      if (createdCount === 0 && failedCount === 0) {
        toast.warning("Brak rekordow do importu");
      }
    } catch (importError) {
      toast.error(
        importError instanceof Error ? importError.message : "Nie udalo sie zaimportowac Excela",
      );
    } finally {
      setIsBulkImporting(false);
    }
  }

  async function handleConciergeUpload() {
    if (!canUseBulkImport) {
      toast.error("Najpierw zaloz profil firmy, aby wyslac stock do Concierge");
      return;
    }
    if (!conciergeFile) {
      toast.error("Najpierw wybierz plik stock");
      return;
    }
    if (conciergeFile.size > MAX_CONCIERGE_FILE_MB * 1024 * 1024) {
      toast.error(`Plik stock moze miec maksymalnie ${MAX_CONCIERGE_FILE_MB} MB`);
      return;
    }

    setIsConciergeSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("stockFile", conciergeFile);
      if (conciergeNote.trim()) {
        formData.set("note", conciergeNote.trim());
      }

      const response = await fetch("/api/containers/bulk/concierge", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json().catch(() => null)) as ConciergeUploadResponse | null;
      if (!response.ok) {
        throw new Error(
          data?.error ?? data?.message ?? `Blad Concierge (${response.status})`,
        );
      }

      const nextReport = data ?? null;
      setConciergeReport(nextReport);
      setConciergeFile(null);
      setConciergeNote("");
      toast.success("Stock wyslany do Concierge");
      if (nextReport?.warning) {
        toast.warning(nextReport.warning);
      }
    } catch (conciergeError) {
      toast.error(
        conciergeError instanceof Error
          ? conciergeError.message
          : "Nie udalo sie wyslac stock do Concierge",
      );
    } finally {
      setIsConciergeSubmitting(false);
    }
  }

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

  const renderPaginationControls = () => {
    if (totalPages <= 1) {
      return null;
    }

    return (
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          disabled={page <= 1 || isLoading}
          onClick={goToPreviousPage}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Poprzednia
        </button>
        <span className="text-xs text-neutral-500">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages || isLoading}
          onClick={goToNextPage}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Nastepna
        </button>
      </div>
    );
  };

  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-neutral-300 bg-neutral-50/95 p-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-neutral-50/90">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold text-neutral-900">Moje kontenery</h1>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <SelectWithChevron
            value={status}
            onChange={(value) => {
              setStatus(value as "all" | "active" | "expired" | "closed");
              setPage(1);
            }}
            className="w-[170px]"
          >
            <option value="all">Status: wszystkie</option>
            <option value="active">Aktywne</option>
            <option value="expired">Wygasle</option>
            <option value="closed">Zamkniete</option>
          </SelectWithChevron>
          <SelectWithChevron
            value={sortPreset}
            onChange={(value) => {
              setSortPreset(value as SortPreset);
              setPage(1);
            }}
            className="w-[205px]"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectWithChevron>
          <Link
            href="/containers/new"
            className={`inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-medium ${DARK_BLUE_CTA_CLASS}`}
          >
            <span>Dodaj ogloszenie</span>
            <svg
              viewBox="0 0 20 20"
              fill="none"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path
                d="M10 4.5v11M4.5 10h11"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
          <button
            type="button"
            onClick={() => {
              setIsBulkModalOpen(true);
              setBulkReport(null);
              setConciergeReport(null);
            }}
            className={`inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-medium ${DARK_BLUE_CTA_CLASS}`}
          >
            <span>Multi Import</span>
            <svg
              viewBox="0 0 20 20"
              fill="none"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path
                d="M10 15.5v-11M6 8.5l4-4 4 4"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>

      <div className="rounded-md border border-neutral-300 bg-neutral-100/95 p-3 shadow-sm">
        <div className="mb-3">{renderPaginationControls()}</div>
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
                {item.containerColors && item.containerColors.length > 0 ? (
                  <p>
                    Kolory:{" "}
                    {item.containerColors.map((color) => color.ral).join(", ")}
                  </p>
                ) : null}
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
        <div className="mt-3">{renderPaginationControls()}</div>
      </div>
      <div className="flex justify-end">
        <Link
          href="/containers/new?intent=buy"
          className="inline-flex h-9 items-center rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-500 transition-colors hover:border-neutral-400 hover:bg-neutral-50 hover:text-neutral-700"
        >
          Szukasz kontenera?
        </Link>
      </div>

      {isBulkModalOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(2,6,23,0.45)] p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-label="Multiimport Excel"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsBulkModalOpen(false);
            }
          }}
        >
          <div className="w-full max-w-2xl rounded-xl border border-neutral-300 bg-white p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-neutral-900">Multiimport Excel</h3>
              <button
                type="button"
                onClick={() => {
                  setIsBulkModalOpen(false);
                }}
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs text-neutral-700 transition hover:bg-neutral-100"
              >
                Zamknij
              </button>
            </div>

            {canUseBulkImport ? (
              <>
                <div className="grid gap-5">
                  <div className="grid gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
                    <p className="text-sm text-neutral-700">
                      Pobierz szablon Excel, uzupelnij rekordy i wgraj plik XLSX lub XLS.
                      W arkuszu <strong>Slownik</strong> masz wszystkie dozwolone wartosci.
                      Zolte kolumny sa wymagane, a lokalizacja to jedno pole tekstowe.
                      Maksymalnie 250 rekordow na import.
                      Multiimport tworzy tylko oferty <strong>sell</strong>.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href="/api/containers/bulk/template"
                        download
                        className="inline-flex h-10 items-center rounded-md border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
                      >
                        Pobierz szablon Excel
                      </a>
                      <label className="inline-flex h-10 cursor-pointer items-center rounded-md border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100">
                        Wybierz plik
                        <input
                          type="file"
                          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                          className="hidden"
                          onChange={(event) => {
                            const nextFile = event.target.files?.[0] ?? null;
                            setBulkFile(nextFile);
                            setBulkReport(null);
                          }}
                        />
                      </label>
                      {bulkFile ? (
                        <span className="max-w-full truncate text-sm text-neutral-600">
                          {bulkFile.name}
                        </span>
                      ) : (
                        <span className="text-sm text-neutral-500">
                          Brak wybranego pliku
                        </span>
                      )}
                    </div>

                    {bulkReport ? (
                      <div className="rounded-md border border-neutral-200 bg-white p-3">
                        <p className="text-sm text-neutral-800">
                          Zaimportowano: <strong>{bulkReport.createdCount ?? 0}</strong>{" "}
                          / <strong>{bulkReport.totalRows ?? 0}</strong>
                        </p>
                        {(bulkReport.failedCount ?? 0) > 0 ? (
                          <div className="mt-2 grid gap-1 text-xs text-red-800">
                            {(bulkReport.failures ?? []).slice(0, 10).map((failure) => (
                              <p key={`${failure.rowNumber}-${failure.error}`}>
                                Wiersz {failure.rowNumber}: {failure.error}
                              </p>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="mt-1 flex items-center justify-end">
                      <button
                        type="button"
                        disabled={isBulkImporting}
                        onClick={() => {
                          void handleBulkImport();
                        }}
                        className={`rounded-md px-3 py-2 text-sm font-medium ${DARK_BLUE_CTA_CLASS} disabled:cursor-not-allowed disabled:opacity-60`}
                      >
                        {isBulkImporting ? "Importowanie..." : "Importuj ogloszenia"}
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
                    <p className="text-sm text-neutral-700">
                      Wolisz, zebysmy zrobili to za Ciebie? Przeslij swoj{" "}
                      <strong>stock w dowolnym formacie</strong>, a zajmiemy sie
                      przygotowaniem i publikacja ogloszen.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex h-10 cursor-pointer items-center rounded-md border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100">
                        Wybierz plik stock
                        <input
                          type="file"
                          className="hidden"
                          onChange={(event) => {
                            const nextFile = event.target.files?.[0] ?? null;
                            setConciergeFile(nextFile);
                            setConciergeReport(null);
                          }}
                        />
                      </label>
                      {conciergeFile ? (
                        <span className="max-w-full truncate text-sm text-neutral-600">
                          {conciergeFile.name}
                        </span>
                      ) : (
                        <span className="text-sm text-neutral-500">
                          Brak wybranego pliku
                        </span>
                      )}
                    </div>
                    <label className="grid gap-1 text-sm">
                      <span className="text-neutral-700">
                        Notatka dla zespolu Concierge (opcjonalnie)
                      </span>
                      <textarea
                        rows={3}
                        value={conciergeNote}
                        onChange={(event) => {
                          setConciergeNote(event.target.value);
                        }}
                        className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
                        placeholder="Np. format pliku, priorytet, uwagi do cen i dostepnosci"
                        maxLength={2000}
                      />
                    </label>
                    {conciergeReport ? (
                      <div className="rounded-md border border-neutral-200 bg-white p-3">
                        <p className="text-sm text-neutral-800">
                          Zlecenie Concierge zapisane.
                        </p>
                        <p className="text-xs text-neutral-500">
                          Plik: {conciergeReport.filename ?? "-"}
                        </p>
                        {conciergeReport.createdAt ? (
                          <p className="text-xs text-neutral-500">
                            Data: {new Date(conciergeReport.createdAt).toLocaleString("pl-PL")}
                          </p>
                        ) : null}
                        {conciergeReport.warning ? (
                          <p className="mt-1 text-xs text-amber-700">
                            {conciergeReport.warning}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="mt-1 flex items-center justify-end">
                      <button
                        type="button"
                        disabled={isConciergeSubmitting}
                        onClick={() => {
                          void handleConciergeUpload();
                        }}
                        className={`rounded-md px-3 py-2 text-sm font-medium ${DARK_BLUE_CTA_CLASS} disabled:cursor-not-allowed disabled:opacity-60`}
                      >
                        {isConciergeSubmitting ? "Wysylanie..." : "Wyslij do Concierge"}
                      </button>
                    </div>
                    <p className="text-xs text-neutral-500">
                      Maksymalny rozmiar pliku: {MAX_CONCIERGE_FILE_MB} MB.
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="grid gap-4">
                <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
                  <p className="text-sm text-neutral-700">
                    Zaloz profil firmy, zeby skorzystac z Multi Importu.
                  </p>
                  <p className="mt-1 text-sm text-neutral-600">
                    Masz stock w dowolnym formacie? Concierge zrobi to za Ciebie i
                    wrzuci oferty za Ciebie.
                  </p>
                  <div className="mt-3 flex items-center justify-end">
                    <Link
                      href="/companies/new"
                      className={`inline-flex h-10 items-center rounded-md px-3 text-sm font-medium ${DARK_BLUE_CTA_CLASS}`}
                    >
                      Zaloz profil firmy
                    </Link>
                  </div>
                </div>
                <div className="rounded-md border border-neutral-200 bg-white p-3">
                  <p className="text-xs text-neutral-500">
                    Po zalozeniu firmy aktywujesz tutaj 2 opcje:
                    <br />
                    1) Multi Import z Excela.
                    <br />
                    2) Concierge upload - przesylasz plik stock, my robimy reszte.
                      </p>
                </div>
                </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

