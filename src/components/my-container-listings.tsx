"use client";

import Link from "next/link";
import { memo, useCallback, useEffect, useState, type ReactNode } from "react";
import { ContainerPhotoWithPlaceholder } from "@/components/container-photo-with-placeholder";
import { CopyLinkIcon } from "@/components/icons/copy-link-icon";
import { useToast } from "@/components/toast-provider";
import { getSortParams } from "@/components/container-listings-utils";
import { SORT_OPTIONS, type SortPreset } from "@/components/container-listings-shared";
import { type ContainerListingItem } from "@/lib/container-listings";
import {
  CONTAINER_CONDITION_LABEL,
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

type RefreshConfirmationAnswer = "yes" | "no" | null;

type RefreshConfirmationModalState = {
  listingId: string;
  editHref: string;
  listingLabel: string;
  quantity: number;
  priceLabel: string;
};

type DeleteConfirmationModalState = {
  listingId: string;
  listingLabel: string;
  locationLabel: string;
  listingStatus: ContainerListingItem["status"];
};

type BulkImportMode = "choose" | "self" | "concierge";

const LISTING_TYPE_LABEL: Record<ListingType, string> = {
  sell: "Sprzedaz",
  rent: "Wynajem",
  buy: "Chce zakupic",
};

const DARK_BLUE_CTA_CLASS =
  "border border-[#2f639a] bg-[linear-gradient(180deg,#082650_0%,#0c3466_100%)] text-[#e2efff] transition hover:border-[#67c7ff] hover:text-white";
const SEARCH_GRADIENT_CTA_CLASS =
  "border border-rose-500 bg-gradient-to-r from-rose-500 to-fuchsia-500 text-white transition-colors duration-200 hover:from-rose-600 hover:to-fuchsia-600 active:translate-y-px";
const MAX_CONCIERGE_FILE_MB = 25;

function getContainerPlaceholderSrc(item: ContainerListingItem): string {
  if (item.container.size === 20) {
    return "/placeholders/containers/container-20.svg";
  }
  if (item.container.size === 40) {
    return "/placeholders/containers/container-40.svg";
  }
  if (item.container.size === 45) {
    return "/placeholders/containers/container-45.svg";
  }
  return "/placeholders/containers/container-unknown.svg";
}

function getContainerPreviewSrc(item: ContainerListingItem): string {
  const firstPhotoUrl = item.photoUrls?.find((value) => {
    const trimmed = value?.trim();
    return Boolean(trimmed);
  });
  return firstPhotoUrl ?? getContainerPlaceholderSrc(item);
}

function getListingPriceLabel(item: ContainerListingItem): string {
  const originalAmount = item.pricing?.original.amount;
  const originalCurrency = item.pricing?.original.currency;
  if (
    typeof originalAmount === "number" &&
    Number.isFinite(originalAmount) &&
    originalCurrency
  ) {
    return `${Math.round(originalAmount).toLocaleString("pl-PL")} ${originalCurrency}`;
  }

  if (typeof item.priceAmount === "number" && Number.isFinite(item.priceAmount)) {
    return `${Math.round(item.priceAmount).toLocaleString("pl-PL")} PLN`;
  }

  return "Cena na zapytanie";
}

function getListingLocationLabel(item: ContainerListingItem): string {
  const primaryLocation = item.locations?.find((location) => location.isPrimary) ?? item.locations?.[0];
  const postalCode =
    primaryLocation?.locationAddressParts?.postalCode?.trim() ||
    item.locationAddressParts?.postalCode?.trim() ||
    "";
  const city =
    primaryLocation?.locationAddressParts?.city?.trim() ||
    primaryLocation?.locationCity?.trim() ||
    item.locationAddressParts?.city?.trim() ||
    item.locationCity.trim();
  const country =
    primaryLocation?.locationAddressParts?.country?.trim() ||
    primaryLocation?.locationCountry?.trim() ||
    item.locationAddressParts?.country?.trim() ||
    item.locationCountry.trim();
  const baseLabel = [postalCode, [city, country].filter(Boolean).join(", ")]
    .filter(Boolean)
    .join(" ");
  const locationLabel = baseLabel || "Nie podano lokalizacji";
  const extraCount = Math.max(0, (item.locations?.length ?? 0) - 1);

  if (extraCount <= 0) {
    return locationLabel;
  }

  return `${locationLabel} + ${extraCount} inne`;
}

const STATUS_BADGE_CLASS: Record<"active" | "expired" | "closed", string> = {
  active: "rounded-md border border-emerald-300 bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800",
  expired: "rounded-md border border-amber-300 bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800",
  closed: "rounded-md border border-neutral-300 bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-700",
};

const STATUS_LABEL: Record<"active" | "expired" | "closed", string> = {
  active: "Aktywny",
  expired: "Zdezaktywowany",
  closed: "Zdezaktywowany",
};

const LISTING_TYPE_BADGE_CLASS: Record<ListingType, string> = {
  sell: "rounded-md border border-sky-300 bg-sky-100 px-2 py-1 text-xs font-medium text-sky-800",
  rent: "rounded-md border border-violet-300 bg-violet-100 px-2 py-1 text-xs font-medium text-violet-800",
  buy: "rounded-md border border-neutral-300 bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-700",
};

type ListingAction = "close" | "refresh" | "delete";

type MyContainerListingRowProps = {
  item: ContainerListingItem;
  darkBlueCtaClass: string;
  onCopyListingUrl: (listingId: string) => Promise<void>;
  onRunAction: (id: string, action: ListingAction) => Promise<boolean>;
  onOpenRefreshConfirmationModal: (item: ContainerListingItem) => void;
  onOpenDeleteConfirmationModal: (item: ContainerListingItem) => void;
};

const MyContainerListingRow = memo(function MyContainerListingRow({
  item,
  darkBlueCtaClass,
  onCopyListingUrl,
  onRunAction,
  onOpenRefreshConfirmationModal,
  onOpenDeleteConfirmationModal,
}: MyContainerListingRowProps) {
  return (
    <li
      className="rounded-md border border-neutral-200 bg-white p-4 shadow-sm transition-colors duration-150 hover:border-sky-100 hover:bg-sky-50/60"
    >
      <div className="flex flex-col gap-4 sm:grid sm:grid-cols-[auto_minmax(0,1fr)] sm:items-stretch">
        <div className="relative h-32 w-32 shrink-0 sm:h-auto sm:w-auto sm:aspect-square sm:self-stretch">
          <div className="absolute inset-0 overflow-hidden rounded-md border border-neutral-200 bg-neutral-100">
            <ContainerPhotoWithPlaceholder
              src={getContainerPreviewSrc(item)}
              alt=""
              fill
              className={
                item.photoUrls && item.photoUrls.length > 0
                  ? "object-cover"
                  : "object-contain p-1"
              }
              sizes="200px"
            />
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-neutral-900">
              {getContainerShortLabel(item.container)}{" "}
              <span className="text-base font-medium text-neutral-500">
                | {CONTAINER_CONDITION_LABEL[item.container.condition]}
              </span>
            </h2>
            <div className="grid justify-items-end gap-1">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span className={STATUS_BADGE_CLASS[item.status]}>
                  {STATUS_LABEL[item.status]}
                </span>
                <span className={LISTING_TYPE_BADGE_CLASS[item.type]}>
                  {LISTING_TYPE_LABEL[item.type]}
                </span>
              </div>
              <p className="text-xs text-neutral-500">
                Wygasa: {new Date(item.expiresAt).toLocaleDateString("pl-PL")}
              </p>
            </div>
          </div>

          <div className="mt-2 text-sm text-neutral-700">
            <p className="font-semibold text-amber-600">
              {getListingPriceLabel(item)}
            </p>
            <p>{getListingLocationLabel(item)}</p>
            <p>Ilosc: {item.quantity}</p>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  void onCopyListingUrl(item.id);
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-neutral-300 bg-white text-neutral-700 transition-colors hover:border-neutral-400 hover:bg-neutral-100"
                aria-label="Kopiuj URL ogloszenia"
                title="Kopiuj URL"
              >
                <CopyLinkIcon className="h-4 w-4" />
              </button>
              <Link
                href={`/containers/${item.id}`}
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-700 transition-colors hover:border-neutral-400 hover:bg-neutral-100"
              >
                Szczegoly
              </Link>
              <Link
                href={`/containers/${item.id}/edit`}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${darkBlueCtaClass}`}
              >
                Edytuj
              </Link>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {item.status !== LISTING_STATUS.CLOSED ? (
                <button
                  type="button"
                  onClick={() => {
                    void onRunAction(item.id, "close");
                  }}
                  className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm text-amber-800 transition-colors hover:bg-amber-50"
                >
                  Dezaktywuj
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  onOpenRefreshConfirmationModal(item);
                }}
                className="rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-sm text-emerald-800 transition-colors hover:bg-emerald-50"
              >
                Przedluz 30 dni
              </button>
              <button
                type="button"
                onClick={() => {
                  onOpenDeleteConfirmationModal(item);
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-neutral-300 bg-neutral-100 text-neutral-500 transition-colors hover:border-neutral-400 hover:bg-neutral-200 hover:text-neutral-600"
                aria-label="Usun ogloszenie"
                title="Usun"
              >
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path
                    d="M4.5 6h11M8 6V4.8a.8.8 0 0 1 .8-.8h2.4a.8.8 0 0 1 .8.8V6m-6.2 0 .5 8.1a1 1 0 0 0 1 .9h5.4a1 1 0 0 0 1-.9L14.2 6"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
});

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
  const [bulkImportMode, setBulkImportMode] = useState<BulkImportMode>("choose");
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [isBulkImporting, setIsBulkImporting] = useState(false);
  const [bulkReport, setBulkReport] = useState<BulkUploadResponse | null>(null);
  const [conciergeFile, setConciergeFile] = useState<File | null>(null);
  const [conciergeNote, setConciergeNote] = useState("");
  const [isConciergeSubmitting, setIsConciergeSubmitting] = useState(false);
  const [conciergeReport, setConciergeReport] =
    useState<ConciergeUploadResponse | null>(null);
  const [refreshModalState, setRefreshModalState] =
    useState<RefreshConfirmationModalState | null>(null);
  const [deleteModalState, setDeleteModalState] =
    useState<DeleteConfirmationModalState | null>(null);
  const [isDeletingListing, setIsDeletingListing] = useState(false);
  const [isDeactivatingInsteadOfDelete, setIsDeactivatingInsteadOfDelete] = useState(false);
  const [quantityConfirmed, setQuantityConfirmed] =
    useState<RefreshConfirmationAnswer>(null);
  const [priceConfirmed, setPriceConfirmed] =
    useState<RefreshConfirmationAnswer>(null);

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

  const openBulkModal = () => {
    setIsBulkModalOpen(true);
    setBulkImportMode("choose");
    setBulkReport(null);
    setConciergeReport(null);
  };

  const closeBulkModal = () => {
    setIsBulkModalOpen(false);
    setBulkImportMode("choose");
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

  const runAction = useCallback(async (id: string, action: ListingAction) => {
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
      return true;
    } catch (actionError) {
      toast.error(actionError instanceof Error ? actionError.message : "Wystapil blad");
      return false;
    }
  }, [loadMine, toast]);

  const copyListingUrl = useCallback(async (listingId: string) => {
    const listingUrl = `${window.location.origin}/containers/${listingId}`;
    try {
      await navigator.clipboard.writeText(listingUrl);
      toast.success("Skopiowano link do ogloszenia");
    } catch {
      toast.error("Nie udalo sie skopiowac linku");
    }
  }, [toast]);

  const openRefreshConfirmationModal = useCallback((item: ContainerListingItem) => {
    setRefreshModalState({
      listingId: item.id,
      editHref: `/containers/${item.id}/edit`,
      listingLabel: getContainerShortLabel(item.container),
      quantity: item.quantity,
      priceLabel: getListingPriceLabel(item),
    });
    setQuantityConfirmed("yes");
    setPriceConfirmed("yes");
  }, []);

  const closeRefreshConfirmationModal = useCallback(() => {
    setRefreshModalState(null);
    setQuantityConfirmed(null);
    setPriceConfirmed(null);
  }, []);

  const openDeleteConfirmationModal = useCallback((item: ContainerListingItem) => {
    setDeleteModalState({
      listingId: item.id,
      listingLabel: getContainerShortLabel(item.container),
      locationLabel: getListingLocationLabel(item),
      listingStatus: item.status,
    });
  }, []);

  const closeDeleteConfirmationModal = useCallback(() => {
    if (isDeletingListing || isDeactivatingInsteadOfDelete) {
      return;
    }
    setDeleteModalState(null);
  }, [isDeactivatingInsteadOfDelete, isDeletingListing]);

  const confirmDeleteListing = useCallback(async () => {
    if (!deleteModalState?.listingId || isDeletingListing) {
      return;
    }
    setIsDeletingListing(true);
    const wasSuccessful = await runAction(deleteModalState.listingId, "delete");
    setIsDeletingListing(false);
    if (wasSuccessful) {
      setDeleteModalState(null);
    }
  }, [deleteModalState, isDeletingListing, runAction]);

  const confirmDeactivateInsteadOfDelete = useCallback(async () => {
    if (!deleteModalState?.listingId || isDeactivatingInsteadOfDelete) {
      return;
    }
    setIsDeactivatingInsteadOfDelete(true);
    const wasSuccessful = await runAction(deleteModalState.listingId, "close");
    setIsDeactivatingInsteadOfDelete(false);
    if (wasSuccessful) {
      setDeleteModalState(null);
    }
  }, [deleteModalState, isDeactivatingInsteadOfDelete, runAction]);

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

  const canConfirmRefresh =
    quantityConfirmed === "yes" && priceConfirmed === "yes";
  const shouldGoToEdit =
    quantityConfirmed === "no" || priceConfirmed === "no";

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
              openBulkModal();
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
            <MyContainerListingRow
              key={item.id}
              item={item}
              darkBlueCtaClass={DARK_BLUE_CTA_CLASS}
              onCopyListingUrl={copyListingUrl}
              onRunAction={runAction}
              onOpenRefreshConfirmationModal={openRefreshConfirmationModal}
              onOpenDeleteConfirmationModal={openDeleteConfirmationModal}
            />
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

      {refreshModalState ? (
        <div
          className="fixed inset-0 z-[75] flex items-center justify-center bg-[rgba(2,6,23,0.4)] p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Potwierdzenie przedluzenia ogloszenia"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeRefreshConfirmationModal();
            }
          }}
        >
          <div className="w-full max-w-xl rounded-xl border border-neutral-300 bg-white p-4 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="grid gap-1">
                <h3 className="text-base font-semibold text-neutral-900">
                  Przedluzyc ogloszenie o 30 dni?
                </h3>
                <p className="text-sm text-neutral-600">
                  Sprawdz przed przedluzeniem: ilosc i cena.
                </p>
              </div>
              <button
                type="button"
                onClick={closeRefreshConfirmationModal}
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs text-neutral-700 transition hover:bg-neutral-100"
              >
                Zamknij
              </button>
            </div>

            <div className="grid gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
              <p className="text-sm text-neutral-800">
                <span className="font-medium">Kontener:</span>{" "}
                {refreshModalState.listingLabel}
              </p>
              <p className="text-sm text-neutral-800">
                <span className="font-medium">Ilosc:</span>{" "}
                {refreshModalState.quantity}
              </p>
              <p className="text-sm text-neutral-800">
                <span className="font-medium">Cena:</span>{" "}
                {refreshModalState.priceLabel}
              </p>
            </div>

            <div className="mt-4 grid gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2">
                <p className="text-sm text-neutral-800">Czy ilosc sie zgadza?</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setQuantityConfirmed("yes")}
                    className={`rounded-md border px-3 py-1.5 text-sm transition ${
                      quantityConfirmed === "yes"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100"
                    }`}
                  >
                    Tak
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuantityConfirmed("no")}
                    className={`rounded-md border px-3 py-1.5 text-sm transition ${
                      quantityConfirmed === "no"
                        ? "border-rose-500 bg-rose-50 text-rose-700"
                        : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100"
                    }`}
                  >
                    Nie
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2">
                <p className="text-sm text-neutral-800">Czy cena sie zgadza?</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPriceConfirmed("yes")}
                    className={`rounded-md border px-3 py-1.5 text-sm transition ${
                      priceConfirmed === "yes"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100"
                    }`}
                  >
                    Tak
                  </button>
                  <button
                    type="button"
                    onClick={() => setPriceConfirmed("no")}
                    className={`rounded-md border px-3 py-1.5 text-sm transition ${
                      priceConfirmed === "no"
                        ? "border-rose-500 bg-rose-50 text-rose-700"
                        : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100"
                    }`}
                  >
                    Nie
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeRefreshConfirmationModal}
                className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 transition hover:bg-neutral-100"
              >
                Anuluj
              </button>

              {canConfirmRefresh ? (
                <button
                  type="button"
                  onClick={() => {
                    void (async () => {
                      const wasSuccessful = await runAction(
                        refreshModalState.listingId,
                        "refresh",
                      );
                      if (wasSuccessful) {
                        closeRefreshConfirmationModal();
                      }
                    })();
                  }}
                  className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 transition hover:bg-emerald-100"
                >
                  Przedluz
                </button>
              ) : null}

              {shouldGoToEdit ? (
                <Link
                  href={refreshModalState.editHref}
                  className={`rounded-md px-3 py-2 text-sm font-medium ${DARK_BLUE_CTA_CLASS}`}
                  onClick={() => {
                    closeRefreshConfirmationModal();
                  }}
                >
                  Przejdz do edycji ogloszenia
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {deleteModalState ? (
        <div
          className="fixed inset-0 z-[76] flex items-center justify-center bg-[rgba(2,6,23,0.4)] p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Potwierdzenie usuniecia ogloszenia"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeDeleteConfirmationModal();
            }
          }}
        >
          <div className="w-full max-w-lg rounded-xl border border-neutral-300 bg-white p-4 shadow-2xl">
            <div className="mb-4 grid gap-1">
              <h3 className="text-base font-semibold text-neutral-900">
                Czy na pewno usunac ogloszenie?
              </h3>
              <p className="text-sm text-neutral-600">
                Tej operacji nie mozna cofnac.
              </p>
            </div>

            <div className="grid gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-800">
              <p>
                <span className="font-medium">Kontener:</span>{" "}
                {deleteModalState.listingLabel}
              </p>
              <p>
                <span className="font-medium">Lokalizacja:</span>{" "}
                {deleteModalState.locationLabel}
              </p>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeDeleteConfirmationModal}
                disabled={isDeletingListing || isDeactivatingInsteadOfDelete}
                className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Anuluj
              </button>
              {deleteModalState.listingStatus !== LISTING_STATUS.CLOSED ? (
                <button
                  type="button"
                  onClick={() => {
                    void confirmDeactivateInsteadOfDelete();
                  }}
                  disabled={isDeletingListing || isDeactivatingInsteadOfDelete}
                  className="rounded-md border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-800 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isDeactivatingInsteadOfDelete ? "Dezaktywowanie..." : "Dezaktywuj"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  void confirmDeleteListing();
                }}
                disabled={isDeletingListing || isDeactivatingInsteadOfDelete}
                className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeletingListing ? "Usuwanie..." : "Usun ogloszenie"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isBulkModalOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(2,6,23,0.45)] p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-label="Multi Import"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeBulkModal();
            }
          }}
        >
          <div className="w-full max-w-2xl rounded-xl border border-neutral-300 bg-white p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-neutral-900">Multi Import</h3>
              <button
                type="button"
                onClick={() => {
                  closeBulkModal();
                }}
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs text-neutral-700 transition hover:bg-neutral-100"
              >
                Zamknij
              </button>
            </div>

            {canUseBulkImport ? (
              <>
                {bulkImportMode === "choose" ? (
                  <div className="grid gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
                    <p className="text-sm font-medium text-neutral-800">Co chcesz zrobic?</p>
                    <p className="text-sm text-neutral-600">
                      Wybierz sposob dodawania ogloszen: samodzielny Multi Import
                      albo zlecenie dla Concierge.
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => {
                          setBulkImportMode("self");
                        }}
                        className="inline-flex h-10 items-center justify-center rounded-md border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-800 transition hover:border-neutral-400 hover:bg-neutral-100"
                      >
                        Uzupelnie samodzielnie
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setBulkImportMode("concierge");
                        }}
                        className={`inline-flex h-10 items-center justify-center gap-1 rounded-md px-3 text-sm font-medium ${DARK_BLUE_CTA_CLASS}`}
                      >
                        <span>Zlec to nam</span>
                        <span aria-hidden="true" className="text-[#d5e7ff]">
                          |
                        </span>
                        <span className="font-semibold text-[#ffd89a]">ZA DARMO</span>
                      </button>
                    </div>
                  </div>
                ) : null}

                {bulkImportMode === "self" ? (
                  <div className="grid gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
                    <p className="text-sm text-neutral-700">
                      Pobierz szablon Excel, uzupelnij rekordy i wgraj plik XLSX lub XLS.
                      W arkuszu <strong>Slownik</strong> masz wszystkie dozwolone wartosci.
                      Zolte kolumny sa wymagane, a lokalizacja to jedno pole tekstowe.
                      Maksymalnie 250 rekordow na import.
                      Multiimport tworzy tylko oferty <strong>sprzedazy</strong>.
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

                    <div className="mt-1 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setBulkImportMode("choose");
                        }}
                        className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 transition hover:bg-neutral-100"
                      >
                        Wroc do wyboru
                      </button>
                      <button
                        type="button"
                        disabled={isBulkImporting}
                        onClick={() => {
                          void handleBulkImport();
                        }}
                        className={`rounded-md px-3 py-2 text-sm font-semibold ${SEARCH_GRADIENT_CTA_CLASS} disabled:cursor-not-allowed disabled:opacity-60`}
                      >
                        {isBulkImporting ? "Importowanie..." : "Importuj ogloszenia"}
                      </button>
                    </div>
                  </div>
                ) : null}

                {bulkImportMode === "concierge" ? (
                  <div className="grid gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
                    <p className="text-sm text-neutral-700">
                      Wolisz, zebysmy zrobili to za Ciebie? Nie ma problemu. Przeslij swoj{" "}
                      <strong>stock w dowolnym formacie</strong>, a zajmiemy sie
                      przygotowaniem i publikacja ogloszen.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex h-10 cursor-pointer items-center rounded-md border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100">
                        Wybierz plik
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
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setBulkImportMode("choose");
                        }}
                        className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 transition hover:bg-neutral-100"
                      >
                        Wroc do wyboru
                      </button>
                      <button
                        type="button"
                        disabled={isConciergeSubmitting}
                        onClick={() => {
                          void handleConciergeUpload();
                        }}
                        className={`rounded-md px-3 py-2 text-sm font-semibold ${SEARCH_GRADIENT_CTA_CLASS} disabled:cursor-not-allowed disabled:opacity-60`}
                      >
                        {isConciergeSubmitting ? "Wysylanie..." : "Wyslij do Concierge"}
                      </button>
                    </div>
                    <p className="text-xs text-neutral-500">
                      Maksymalny rozmiar pliku: {MAX_CONCIERGE_FILE_MB} MB.
                    </p>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="grid gap-4">
                <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
                  <p className="text-sm text-neutral-700">
                    Zaloz profil firmy, zeby skorzystac z Multi Importu.
                  </p>
                  <p className="mt-1 text-sm text-neutral-600">
                    Mozesz skorzystac z przygotowanego przez nas pliku Excel.
                  </p>
                  <p className="mt-1 text-sm font-medium uppercase tracking-wide text-neutral-500">
                    lub
                  </p>
                  <p className="mt-1 text-sm text-neutral-700">
                    <strong>Wyslij nam plik w dowolnym formacie i zrobimy to za Ciebie.</strong>
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
                </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

