"use client";

import Link from "next/link";
import { memo, useCallback, useEffect, useState } from "react";
import {
  getContainerConditionLabel,
  getContainerShortLabelLocalized,
  getSortOptions,
  getListingKindLabel,
  type ContainerListingsMessages,
} from "@/components/container-listings-i18n";
import {
  type ContainerModuleMessages,
  toIntlLocale,
} from "@/components/container-modules-i18n";
import { ContainerPhotoWithPlaceholder } from "@/components/container-photo-with-placeholder";
import { CopyLinkIcon } from "@/components/icons/copy-link-icon";
import { useToast } from "@/components/toast-provider";
import { SelectWithChevron } from "@/components/ui/select-with-chevron";
import { getSortParams } from "@/components/container-listings-utils";
import { type SortPreset } from "@/components/container-listings-shared";
import { formatTemplate, type AppLocale } from "@/lib/i18n";
import { type ContainerListingItem } from "@/lib/container-listings";
import {
  LISTING_STATUS,
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

function getListingPriceLabel(
  item: ContainerListingItem,
  locale: AppLocale,
  messages: ContainerModuleMessages["myListings"],
): string {
  const originalAmount = item.pricing?.original.amount;
  const originalCurrency = item.pricing?.original.currency;
  if (
    typeof originalAmount === "number" &&
    Number.isFinite(originalAmount) &&
    originalCurrency
  ) {
    return `${Math.round(originalAmount).toLocaleString(toIntlLocale(locale))} ${originalCurrency}`;
  }

  if (typeof item.priceAmount === "number" && Number.isFinite(item.priceAmount)) {
    return `${Math.round(item.priceAmount).toLocaleString(toIntlLocale(locale))} PLN`;
  }

  return messages.priceOnRequest;
}

function getListingLocationLabel(
  item: ContainerListingItem,
  messages: ContainerModuleMessages["myListings"],
): string {
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
  const locationLabel = baseLabel || messages.locationUnavailable;
  const extraCount = Math.max(0, (item.locations?.length ?? 0) - 1);

  if (extraCount <= 0) {
    return locationLabel;
  }

  return formatTemplate(messages.extraLocations, { label: locationLabel, count: extraCount });
}

const STATUS_BADGE_CLASS: Record<"active" | "expired" | "closed", string> = {
  active: "rounded-md border border-emerald-300 bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800",
  expired: "rounded-md border border-amber-300 bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800",
  closed: "rounded-md border border-neutral-300 bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-700",
};

const LISTING_TYPE_BADGE_CLASS = {
  sell: "rounded-md border border-sky-300 bg-sky-100 px-2 py-1 text-xs font-medium text-sky-800",
  rent: "rounded-md border border-violet-300 bg-violet-100 px-2 py-1 text-xs font-medium text-violet-800",
  buy: "rounded-md border border-neutral-300 bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-700",
};

type ListingAction = "close" | "refresh" | "delete";

type MyContainerListingRowProps = {
  item: ContainerListingItem;
  locale: AppLocale;
  messages: ContainerModuleMessages["myListings"];
  listingMessages: ContainerListingsMessages;
  darkBlueCtaClass: string;
  onCopyListingUrl: (listingId: string) => Promise<void>;
  onRunAction: (id: string, action: ListingAction) => Promise<boolean>;
  onOpenRefreshConfirmationModal: (item: ContainerListingItem) => void;
  onOpenDeleteConfirmationModal: (item: ContainerListingItem) => void;
};

const MyContainerListingRow = memo(function MyContainerListingRow({
  item,
  locale,
  messages,
  listingMessages,
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
      <div className="flex flex-col gap-4 sm:grid sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
        <div className="relative h-32 w-32 shrink-0 sm:self-start">
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
            <h2 className="min-w-0 text-lg font-semibold text-neutral-900">
              {getContainerShortLabelLocalized(listingMessages, item.container)}{" "}
              <span className="text-base font-medium text-neutral-500">
                | {getContainerConditionLabel(listingMessages, item.container.condition)}
              </span>
            </h2>
            <div className="grid min-w-0 justify-items-start gap-1 sm:justify-items-end">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span className={STATUS_BADGE_CLASS[item.status]}>
                  {messages.statusLabels[item.status]}
                </span>
                <span className={LISTING_TYPE_BADGE_CLASS[item.type]}>
                  {getListingKindLabel(listingMessages, item.type)}
                </span>
              </div>
              <p className="text-xs text-neutral-500">
                {messages.expiresLabel}:{" "}
                {new Date(item.expiresAt).toLocaleDateString(toIntlLocale(locale))}
              </p>
            </div>
          </div>

          <div className="mt-2 text-sm text-neutral-700">
            <p className="font-semibold text-amber-600">
              {getListingPriceLabel(item, locale, messages)}
            </p>
            <p>{getListingLocationLabel(item, messages)}</p>
            <p>
              {messages.quantityLabel}: {item.quantity}
            </p>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  void onCopyListingUrl(item.id);
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-neutral-300 bg-white text-neutral-700 transition-colors hover:border-neutral-400 hover:bg-neutral-100"
                aria-label={messages.copyUrlAria}
                title={messages.copyUrl}
              >
                <CopyLinkIcon className="h-4 w-4" />
              </button>
              <Link
                href={`/containers/${item.id}`}
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-700 transition-colors hover:border-neutral-400 hover:bg-neutral-100"
              >
                {messages.details}
              </Link>
              <Link
                href={`/containers/${item.id}/edit`}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${darkBlueCtaClass}`}
                >
                {messages.edit}
              </Link>
            </div>
            <div className="flex min-w-0 flex-wrap items-center justify-start gap-2 sm:justify-end">
              {item.status !== LISTING_STATUS.CLOSED ? (
                <button
                  type="button"
                  onClick={() => {
                    void onRunAction(item.id, "close");
                  }}
                  className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm text-amber-800 transition-colors hover:bg-amber-50"
                >
                  {messages.deactivate}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  onOpenRefreshConfirmationModal(item);
                }}
                className="rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-sm text-emerald-800 transition-colors hover:bg-emerald-50"
              >
                {messages.refreshThirtyDays}
              </button>
              <button
                type="button"
                onClick={() => {
                  onOpenDeleteConfirmationModal(item);
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-neutral-300 bg-neutral-100 text-neutral-500 transition-colors hover:border-neutral-400 hover:bg-neutral-200 hover:text-neutral-600"
                aria-label={messages.deleteAria}
                title={messages.delete}
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

export function MyContainerListings(input?: {
  canUseBulkImport?: boolean;
  locale?: AppLocale;
  messages?: ContainerModuleMessages;
  listingMessages?: ContainerListingsMessages;
}) {
  const canUseBulkImport = input?.canUseBulkImport ?? true;
  const locale = input?.locale ?? "pl";
  const moduleMessages = input?.messages;
  const listingMessages = input?.listingMessages;
  if (!moduleMessages || !listingMessages) {
    throw new Error("Missing localization messages for MyContainerListings");
  }
  const messages = moduleMessages.myListings;
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
        throw new Error(
          data.error ?? `${listingMessages.board.apiErrorPrefix} (${response.status})`,
        );
      }

      setItems(data.items ?? []);
      setTotalPages(data.meta?.totalPages ?? 1);
      const resolvedPage = data.meta?.page ?? page;
      setPage((current) => (current === resolvedPage ? current : resolvedPage));
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : messages.loadError,
      );
    } finally {
      setIsLoading(false);
    }
  }, [messages.loadError, page, pageSize, sortPreset, status]);

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
      toast.error(messages.bulkNeedsCompany);
      return;
    }
    if (!bulkFile) {
      toast.error(messages.selectExcelFirst);
      return;
    }

    const filename = bulkFile.name.trim().toLowerCase();
    if (!filename.endsWith(".xlsx") && !filename.endsWith(".xls")) {
      toast.error(messages.excelOnly);
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
          data?.error ??
            data?.message ??
            formatTemplate(messages.bulkImportErrorWithStatus, {
              status: response.status,
            }),
        );
      }

      setBulkReport(data ?? null);
      const createdCount = data?.createdCount ?? 0;
      const failedCount = data?.failedCount ?? 0;
      if (createdCount > 0) {
        toast.success(formatTemplate(messages.bulkCreated, { count: createdCount }));
        await loadMine();
      }
      if (failedCount > 0) {
        toast.warning(formatTemplate(messages.bulkFailedRows, { count: failedCount }));
      }
      if (createdCount === 0 && failedCount === 0) {
        toast.warning(messages.bulkNoRows);
      }
    } catch (importError) {
      toast.error(
        importError instanceof Error ? importError.message : messages.bulkImportError,
      );
    } finally {
      setIsBulkImporting(false);
    }
  }

  async function handleConciergeUpload() {
    if (!canUseBulkImport) {
      toast.error(messages.conciergeNeedsCompany);
      return;
    }
    if (!conciergeFile) {
      toast.error(messages.selectStockFirst);
      return;
    }
    if (conciergeFile.size > MAX_CONCIERGE_FILE_MB * 1024 * 1024) {
      toast.error(
        formatTemplate(messages.conciergeMaxFileSize, {
          count: MAX_CONCIERGE_FILE_MB,
        }),
      );
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
          data?.error ??
            data?.message ??
            formatTemplate(messages.conciergeErrorWithStatus, {
              status: response.status,
            }),
        );
      }

      const nextReport = data ?? null;
      setConciergeReport(nextReport);
      setConciergeFile(null);
      setConciergeNote("");
      toast.success(messages.conciergeSent);
      if (nextReport?.warning) {
        toast.warning(nextReport.warning);
      }
    } catch (conciergeError) {
      toast.error(
        conciergeError instanceof Error
          ? conciergeError.message
          : messages.conciergeSendError,
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
        throw new Error(data?.error ?? messages.actionError);
      }

      toast.success(
        action === "close"
          ? messages.actionClosed
          : action === "refresh"
            ? messages.actionRefreshed
            : messages.actionDeleted,
      );
      await loadMine();
      return true;
    } catch (actionError) {
      toast.error(actionError instanceof Error ? actionError.message : messages.genericError);
      return false;
    }
  }, [loadMine, messages.actionClosed, messages.actionDeleted, messages.actionError, messages.actionRefreshed, messages.genericError, toast]);

  const copyListingUrl = useCallback(async (listingId: string) => {
    const listingUrl = `${window.location.origin}/containers/${listingId}`;
    try {
      await navigator.clipboard.writeText(listingUrl);
      toast.success(messages.copySuccess);
    } catch {
      toast.error(messages.copyError);
    }
  }, [messages.copyError, messages.copySuccess, toast]);

  const openRefreshConfirmationModal = useCallback((item: ContainerListingItem) => {
    setRefreshModalState({
      listingId: item.id,
      editHref: `/containers/${item.id}/edit?reactivate=1`,
      listingLabel: getContainerShortLabelLocalized(listingMessages, item.container),
      quantity: item.quantity,
      priceLabel: getListingPriceLabel(item, locale, messages),
    });
    setQuantityConfirmed("yes");
    setPriceConfirmed("yes");
  }, [listingMessages, locale, messages]);

  const closeRefreshConfirmationModal = useCallback(() => {
    setRefreshModalState(null);
    setQuantityConfirmed(null);
    setPriceConfirmed(null);
  }, []);

  const openDeleteConfirmationModal = useCallback((item: ContainerListingItem) => {
    setDeleteModalState({
      listingId: item.id,
      listingLabel: getContainerShortLabelLocalized(listingMessages, item.container),
      locationLabel: getListingLocationLabel(item, messages),
      listingStatus: item.status,
    });
  }, [listingMessages, messages]);

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
          {messages.previous}
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
          {messages.next}
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
          <h1 className="text-2xl font-semibold text-neutral-900">{messages.title}</h1>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <SelectWithChevron
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as "all" | "active" | "expired" | "closed");
              setPage(1);
            }}
            wrapperClassName="w-[170px]"
          >
            <option value="all">{messages.statusAll}</option>
            <option value="active">{messages.statusFilters.active}</option>
            <option value="expired">{messages.statusFilters.expired}</option>
            <option value="closed">{messages.statusFilters.closed}</option>
          </SelectWithChevron>
          <SelectWithChevron
            value={sortPreset}
            onChange={(event) => {
              setSortPreset(event.target.value as SortPreset);
              setPage(1);
            }}
            wrapperClassName="w-[205px]"
          >
            {getSortOptions(listingMessages).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectWithChevron>
          <Link
            href="/containers/new"
            className={`inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-medium ${DARK_BLUE_CTA_CLASS}`}
          >
            <span>{messages.addListing}</span>
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
            <span>{messages.bulkImport}</span>
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
                aria-label={messages.loadingAria}
              />
              <span className="text-sm font-medium">{messages.loading}</span>
            </div>
          </div>
        ) : null}

        {!isLoading && items.length === 0 ? (
          <div className="flex min-h-[220px] items-center justify-center px-4 text-center">
            <p className="text-xl font-medium text-neutral-400 sm:text-2xl">
              {messages.empty}
            </p>
          </div>
        ) : null}

        <ul className="space-y-3">
          {items.map((item) => (
            <MyContainerListingRow
              key={item.id}
              item={item}
              locale={locale}
              messages={messages}
              listingMessages={listingMessages}
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
          {messages.wantToBuy}
        </Link>
      </div>

      {refreshModalState ? (
        <div
          className="fixed inset-0 z-[75] flex items-center justify-center bg-[rgba(2,6,23,0.4)] p-4"
          role="dialog"
          aria-modal="true"
          aria-label={messages.refreshDialogAria}
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
                  {messages.refreshDialogTitle}
                </h3>
                <p className="text-sm text-neutral-600">
                  {messages.refreshDialogText}
                </p>
              </div>
              <button
                type="button"
                onClick={closeRefreshConfirmationModal}
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs text-neutral-700 transition hover:bg-neutral-100"
              >
                {moduleMessages.shared.close}
              </button>
            </div>

            <div className="grid gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
              <p className="text-sm text-neutral-800">
                <span className="font-medium">{messages.containerLabel}:</span>{" "}
                {refreshModalState.listingLabel}
              </p>
              <p className="text-sm text-neutral-800">
                <span className="font-medium">{messages.quantityLabel}:</span>{" "}
                {refreshModalState.quantity}
              </p>
              <p className="text-sm text-neutral-800">
                <span className="font-medium">{messages.priceLabel}:</span>{" "}
                {refreshModalState.priceLabel}
              </p>
            </div>

            <div className="mt-4 grid gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2">
                <p className="text-sm text-neutral-800">{messages.confirmQuantity}</p>
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
                    {messages.yes}
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
                    {messages.no}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2">
                <p className="text-sm text-neutral-800">{messages.confirmPrice}</p>
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
                    {messages.yes}
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
                    {messages.no}
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
                {moduleMessages.shared.cancel}
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
                  {messages.refresh}
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
                  {messages.goToEdit}
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
          aria-label={messages.deleteDialogAria}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeDeleteConfirmationModal();
            }
          }}
        >
          <div className="w-full max-w-lg rounded-xl border border-neutral-300 bg-white p-4 shadow-2xl">
            <div className="mb-4 grid gap-1">
              <h3 className="text-base font-semibold text-neutral-900">
                {messages.deleteDialogTitle}
              </h3>
              <p className="text-sm text-neutral-600">
                {messages.deleteDialogText}
              </p>
            </div>

            <div className="grid gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-800">
              <p>
                <span className="font-medium">{messages.containerLabel}:</span>{" "}
                {deleteModalState.listingLabel}
              </p>
              <p>
                <span className="font-medium">{messages.locationLabel}:</span>{" "}
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
                {messages.cancel}
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
                  {isDeactivatingInsteadOfDelete ? messages.deactivating : messages.deactivate}
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
                {isDeletingListing ? messages.deleting : messages.deleteListingButton}
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
          aria-label={messages.bulkModalAria}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeBulkModal();
            }
          }}
        >
          <div className="w-full max-w-2xl rounded-xl border border-neutral-300 bg-white p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-neutral-900">
                {messages.bulkModalTitle}
              </h3>
              <button
                type="button"
                onClick={() => {
                  closeBulkModal();
                }}
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs text-neutral-700 transition hover:bg-neutral-100"
              >
                {messages.close}
              </button>
            </div>

            {canUseBulkImport ? (
              <>
                {bulkImportMode === "choose" ? (
                  <div className="grid gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
                    <p className="text-sm font-medium text-neutral-800">
                      {messages.bulkChooseTitle}
                    </p>
                    <p className="text-sm text-neutral-600">
                      {messages.bulkChooseDescription}
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => {
                          setBulkImportMode("self");
                        }}
                        className="inline-flex h-10 items-center justify-center rounded-md border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-800 transition hover:border-neutral-400 hover:bg-neutral-100"
                      >
                        {messages.bulkSelfButton}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setBulkImportMode("concierge");
                        }}
                        className={`inline-flex h-10 items-center justify-center gap-1 rounded-md px-3 text-sm font-medium ${DARK_BLUE_CTA_CLASS}`}
                      >
                        <span>{messages.bulkConciergeButton}</span>
                        <span aria-hidden="true" className="text-[#d5e7ff]">
                          |
                        </span>
                        <span className="font-semibold text-[#ffd89a]">
                          {messages.freeBadge}
                        </span>
                      </button>
                    </div>
                  </div>
                ) : null}

                {bulkImportMode === "self" ? (
                  <div className="grid gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
                    <p className="text-sm text-neutral-700">
                      {messages.bulkSelfDescription}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href="/api/containers/bulk/template"
                        download
                        className="inline-flex h-10 items-center rounded-md border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
                      >
                        {messages.downloadExcelTemplate}
                      </a>
                      <label className="inline-flex h-10 cursor-pointer items-center rounded-md border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100">
                        {messages.chooseFile}
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
                          {messages.noFileSelected}
                        </span>
                      )}
                    </div>

                    {bulkReport ? (
                      <div className="rounded-md border border-neutral-200 bg-white p-3">
                        <p className="text-sm text-neutral-800">
                          {formatTemplate(messages.importedSummary, {
                            created: bulkReport.createdCount ?? 0,
                            total: bulkReport.totalRows ?? 0,
                          })}
                        </p>
                        {(bulkReport.failedCount ?? 0) > 0 ? (
                          <div className="mt-2 grid gap-1 text-xs text-red-800">
                            {(bulkReport.failures ?? []).slice(0, 10).map((failure) => (
                              <p key={`${failure.rowNumber}-${failure.error}`}>
                                {formatTemplate(messages.rowError, {
                                  row: failure.rowNumber,
                                  error: failure.error,
                                })}
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
                        {messages.backToChoice}
                      </button>
                      <button
                        type="button"
                        disabled={isBulkImporting}
                        onClick={() => {
                          void handleBulkImport();
                        }}
                        className={`rounded-md px-3 py-2 text-sm font-semibold ${SEARCH_GRADIENT_CTA_CLASS} disabled:cursor-not-allowed disabled:opacity-60`}
                      >
                        {isBulkImporting ? messages.importing : messages.importListings}
                      </button>
                    </div>
                  </div>
                ) : null}

                {bulkImportMode === "concierge" ? (
                  <div className="grid gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
                    <p className="text-sm text-neutral-700">
                      {messages.conciergeDescription}
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
                        {messages.conciergeNoteLabel}
                      </span>
                      <textarea
                        rows={3}
                        value={conciergeNote}
                        onChange={(event) => {
                          setConciergeNote(event.target.value);
                        }}
                        className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
                        placeholder={messages.conciergeNotePlaceholder}
                        maxLength={2000}
                      />
                    </label>
                    {conciergeReport ? (
                      <div className="rounded-md border border-neutral-200 bg-white p-3">
                        <p className="text-sm text-neutral-800">
                          {messages.conciergeSaved}
                        </p>
                        <p className="text-xs text-neutral-500">
                          {messages.fileLabel}: {conciergeReport.filename ?? "-"}
                        </p>
                        {conciergeReport.createdAt ? (
                          <p className="text-xs text-neutral-500">
                            {messages.dateLabel}:{" "}
                            {new Date(conciergeReport.createdAt).toLocaleString(toIntlLocale(locale))}
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
                        {messages.backToChoice}
                      </button>
                      <button
                        type="button"
                        disabled={isConciergeSubmitting}
                        onClick={() => {
                          void handleConciergeUpload();
                        }}
                        className={`rounded-md px-3 py-2 text-sm font-semibold ${SEARCH_GRADIENT_CTA_CLASS} disabled:cursor-not-allowed disabled:opacity-60`}
                      >
                        {isConciergeSubmitting ? messages.sending : messages.sendToConcierge}
                      </button>
                    </div>
                    <p className="text-xs text-neutral-500">
                      {formatTemplate(messages.maxFileSize, {
                        count: MAX_CONCIERGE_FILE_MB,
                      })}
                    </p>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="grid gap-4">
                <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
                  <p className="text-sm text-neutral-700">
                    {messages.bulkNoCompanyLineOne}
                  </p>
                  <p className="mt-1 text-sm text-neutral-600">
                    {messages.bulkNoCompanyLineTwo}
                  </p>
                  <p className="mt-1 text-sm font-medium uppercase tracking-wide text-neutral-500">
                    {messages.or}
                  </p>
                  <p className="mt-1 text-sm text-neutral-700">
                    <strong>{messages.bulkNoCompanyConcierge}</strong>
                  </p>
                  <div className="mt-3 flex items-center justify-end">
                    <Link
                      href="/companies/new"
                      className={`inline-flex h-10 items-center rounded-md px-3 text-sm font-medium ${DARK_BLUE_CTA_CLASS}`}
                    >
                      {messages.createCompanyProfile}
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

