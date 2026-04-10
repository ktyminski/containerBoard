"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { LeadRequestCard, type LeadRequestCardItem } from "@/components/lead-request-card";
import { LeadRequestDetailsModal } from "@/components/lead-request-details-modal";
import { LeadRequestFormModal } from "@/components/lead-request-form-modal";
import { LeadRequestsPagination } from "@/components/lead-requests-pagination";
import { useToast } from "@/components/toast-provider";
import { useLeadRequestsPage } from "@/components/use-lead-requests-page";
import {
  LeadRequestSubmitError,
  getDefaultLeadRequestFormValues,
  getLeadRequestFormValues,
  type LeadRequestBoardItem,
  type LeadRequestSubmitPayload,
  type LeadRequestsBoardProps,
} from "@/components/lead-requests-board.shared";
import { formatTemplate, LOCALE_HEADER_NAME, withLang } from "@/lib/i18n";
import {
  LEAD_REQUEST_STATUS,
  LEAD_REQUEST_TRANSPORT_MODE,
  LEAD_REQUEST_TYPE,
} from "@/lib/lead-request-types";

function LeadRequestsListLoader({ message }: { message: string }) {
  return (
    <div className="grid gap-3">
      <p className="text-sm text-slate-400">{message}</p>
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={`lead-request-loader-${index}`}
          className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
        >
          <div className="animate-pulse space-y-3">
            <div className="h-4 w-1/3 rounded bg-slate-700/80" />
            <div className="h-3 w-full rounded bg-slate-800/80" />
            <div className="h-3 w-5/6 rounded bg-slate-800/80" />
            <div className="h-3 w-2/3 rounded bg-slate-800/80" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function LeadRequestsBoard({
  messages,
  locale,
  loginHref,
  isLoggedIn,
  currentUserEmail,
  turnstileSiteKey,
  creationLimit,
  isBlocked,
  isEmailVerified,
  canManageRequests,
  initialTab = "all",
  sortOrder,
  hasMyRequests: hasMyRequestsOverride,
  canSeeContact,
  keywordFilter,
  transportModeFilter,
  originCountryFilter,
  destinationCountryFilter,
  initialAllPage,
  initialMyPage,
  intlLocale,
}: LeadRequestsBoardProps) {
  const router = useRouter();
  const toast = useToast();
  const hasMyRequests = hasMyRequestsOverride ?? initialMyPage.totalCount > 0;
  const hasMyRequestsTab = hasMyRequests && canManageRequests;
  const [activeTab, setActiveTab] = useState<"all" | "mine">(
    () => (initialTab === "mine" && hasMyRequestsTab ? "mine" : "all"),
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingItemDraft, setEditingItemDraft] = useState<LeadRequestBoardItem | null>(null);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExtending, setIsExtending] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [detailsItem, setDetailsItem] = useState<LeadRequestCardItem | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(1);
  const [localPatchedItems, setLocalPatchedItems] = useState<Record<string, LeadRequestBoardItem>>({});
  const [localRemovedIds, setLocalRemovedIds] = useState<Record<string, true>>({});

  useEffect(() => {
    if (activeTab === "mine" && !hasMyRequestsTab) {
      setActiveTab("all");
    }
  }, [activeTab, hasMyRequestsTab]);

  const { pageData, isLoading: isRemoteLoading, error: remoteError } = useLeadRequestsPage({
    activeTab,
    currentPage,
    sortOrder,
    keywordFilter,
    transportModeFilter,
    originCountryFilter,
    destinationCountryFilter,
    initialAllPage,
    initialMyPage,
    reloadKey,
    messages,
  });
  const localMutationScopeKey = useMemo(
    () =>
      JSON.stringify({
        activeTab,
        currentPage,
        sortOrder,
        keywordFilter: keywordFilter.trim(),
        transportModeFilter,
        originCountryFilter,
        destinationCountryFilter,
        reloadKey,
      }),
    [
      activeTab,
      currentPage,
      destinationCountryFilter,
      keywordFilter,
      originCountryFilter,
      reloadKey,
      sortOrder,
      transportModeFilter,
    ],
  );
  useEffect(() => {
    setLocalPatchedItems({});
    setLocalRemovedIds({});
  }, [localMutationScopeKey]);

  const visibleItems = useMemo(
    () =>
      pageData.items
        .map((item) => localPatchedItems[item.id] ?? item)
        .filter((item) => !localRemovedIds[item.id]),
    [localPatchedItems, localRemovedIds, pageData.items],
  );
  const totalPages = pageData.totalPages;
  const canSeeContactForCurrentTab = canSeeContact || activeTab === "mine";
  const editingItem =
    modalMode === "edit" && editingId
      ? editingItemDraft ??
        visibleItems.find((item) => item.id === editingId) ??
        null
      : null;
  const canCreate = canManageRequests;
  const creationLimitNotice =
    creationLimit?.isLimited
      ? formatTemplate(messages.creationLimitForAdd, {
          limit: creationLimit.limit,
          windowHours: creationLimit.windowHours,
        })
      : null;

  const formattedItems = useMemo(
    () =>
      visibleItems.map((item) => {
        const createdAt = new Date(item.createdAtIso);
        const expiresAt = item.expiresAtIso ? new Date(item.expiresAtIso) : null;
        return {
          ...item,
          createdAtLabel: createdAt.toLocaleDateString(intlLocale),
          expiresAtLabel: expiresAt ? expiresAt.toLocaleDateString(intlLocale) : "-",
        };
      }),
    [intlLocale, visibleItems],
  );
  const shouldShowListLoader = isRemoteLoading;
  const shouldShowEmptyState =
    !shouldShowListLoader &&
    !remoteError &&
    formattedItems.length === 0;

  useEffect(() => {
    setCurrentPage(1);
  }, [
    activeTab,
    destinationCountryFilter,
    keywordFilter,
    originCountryFilter,
    sortOrder,
    transportModeFilter,
  ]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const formInitialValues = useMemo(
    () =>
      modalMode === "edit" && editingItem
        ? getLeadRequestFormValues(editingItem)
        : getDefaultLeadRequestFormValues(currentUserEmail),
    [currentUserEmail, editingItem, modalMode],
  );

  const closeModal = () => {
    if (isExtending) {
      return;
    }
    setIsModalOpen(false);
    setEditingId(null);
    setEditingItemDraft(null);
    setModalMode("create");
  };

  const closeDetailsModal = () => {
    setDetailsItem(null);
  };

  const openCreateModal = () => {
    if (!isEmailVerified) {
      toast.warning(messages.emailVerificationRequiredForAdd);
      return;
    }
    if (creationLimit?.isLimited) {
      toast.warning(creationLimitNotice ?? messages.submitError);
      return;
    }

    setEditingId(null);
    setEditingItemDraft(null);
    setModalMode("create");
    setIsModalOpen(true);
  };

  const openEditModal = (item: LeadRequestBoardItem) => {
    setEditingId(item.id);
    setEditingItemDraft(item);
    setModalMode("edit");
    setIsModalOpen(true);
  };

  const openDetailsModal = (item: LeadRequestCardItem) => {
    setDetailsItem(item);
  };

  const handleFormSubmit = async ({
    turnstileToken,
    ...payload
  }: LeadRequestSubmitPayload) => {
    const isCreateMode = modalMode === "create";
    const requestId = isCreateMode ? null : editingId;
    const endpoint = isCreateMode ? "/api/lead-requests" : `/api/lead-requests/${editingId}`;
    const method = isCreateMode ? "POST" : "PATCH";
    const response = await fetch(endpoint, {
      method,
      headers: {
        "Content-Type": "application/json",
        [LOCALE_HEADER_NAME]: locale,
      },
      body: JSON.stringify({
        ...payload,
        turnstileToken: isCreateMode ? turnstileToken : "",
      }),
    });

    if (response.status === 429) {
      const ratePayload = (await response.json().catch(() => null)) as
        | { limit?: number; windowHours?: number }
        | null;
      const limit = ratePayload?.limit ?? creationLimit?.limit ?? 5;
      const windowHours = ratePayload?.windowHours ?? creationLimit?.windowHours ?? 48;
      throw new LeadRequestSubmitError(
        formatTemplate(messages.creationLimitForAdd, {
          limit,
          windowHours,
        }),
      );
    }

    if (!response.ok) {
      const errorPayload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (errorPayload?.error === "TURNSTILE_REQUIRED" || errorPayload?.error === "TURNSTILE_FAILED") {
        throw new LeadRequestSubmitError(messages.turnstileRequired, errorPayload.error);
      }
      if (errorPayload?.error === "ORIGIN_GEOCODE_FAILED") {
        throw new LeadRequestSubmitError(messages.originLocationGeocodeError, errorPayload.error);
      }
      if (errorPayload?.error === "DESTINATION_GEOCODE_FAILED") {
        throw new LeadRequestSubmitError(
          messages.destinationLocationGeocodeError,
          errorPayload.error,
        );
      }
      throw new LeadRequestSubmitError(
        modalMode === "create" ? messages.submitError : messages.saveError,
      );
    }

    toast.success(isCreateMode ? messages.submitSuccess : messages.saveSuccess);
    setIsModalOpen(false);
    setEditingId(null);
    setEditingItemDraft(null);
    setModalMode("create");

    if (isCreateMode) {
      setReloadKey((value) => value + 1);
      setActiveTab("mine");
      setCurrentPage(1);
      router.push(withLang("/maps/lead-requests?tab=mine", locale));
      return;
    }

    if (requestId && editingItem) {
      const isTransportRequest = payload.leadType === LEAD_REQUEST_TYPE.TRANSPORT;
      const normalizedItem: LeadRequestBoardItem = {
        ...editingItem,
        leadType: payload.leadType,
        transportMode: isTransportRequest
          ? payload.transportMode
          : LEAD_REQUEST_TRANSPORT_MODE.ANY,
        originLocation: isTransportRequest ? payload.originLocation.trim() : "",
        originCountryCode: isTransportRequest
          ? (payload.originCountryCode.trim().toUpperCase() || null)
          : null,
        destinationLocation: isTransportRequest ? payload.destinationLocation.trim() : "",
        destinationCountryCode: isTransportRequest
          ? (payload.destinationCountryCode.trim().toUpperCase() || null)
          : null,
        description: payload.description.trim(),
        contactEmail: payload.contactEmail.trim() || null,
        contactPhone: payload.contactPhone.trim() || null,
      };

      setLocalPatchedItems((current) => ({
        ...current,
        [requestId]: normalizedItem,
      }));
      if (detailsItem?.id === requestId) {
        setDetailsItem({
          ...detailsItem,
          ...normalizedItem,
        });
      }
    }
  };

  const openDeleteModal = (id: string) => {
    setDeleteTargetId(id);
  };

  const closeDeleteModal = () => {
    if (isDeleting) {
      return;
    }
    setDeleteTargetId(null);
  };

  const handleDelete = async () => {
    if (!deleteTargetId) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/lead-requests/${deleteTargetId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error(messages.deleteError);
      }
      toast.success(messages.deleteSuccess);
      if (editingId === deleteTargetId) {
        setIsModalOpen(false);
        setEditingId(null);
        setEditingItemDraft(null);
        setModalMode("create");
      }
      if (detailsItem?.id === deleteTargetId) {
        setDetailsItem(null);
      }
      setDeleteTargetId(null);
      setLocalRemovedIds((current) => ({
        ...current,
        [deleteTargetId]: true,
      }));
      setLocalPatchedItems((current) => {
        const next = { ...current };
        delete next[deleteTargetId];
        return next;
      });
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : messages.deleteError);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExtend = async () => {
    if (!editingId) {
      return;
    }

    setIsExtending(true);
    try {
      const response = await fetch(`/api/lead-requests/${editingId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          [LOCALE_HEADER_NAME]: locale,
        },
        body: JSON.stringify({ action: "extend" }),
      });
      if (!response.ok) {
        throw new Error(messages.extendError);
      }

      toast.success(messages.extendSuccess);
      if (editingItem) {
        const now = new Date();
        const nextExpiresAt = new Date(now);
        nextExpiresAt.setDate(nextExpiresAt.getDate() + 14);
        const nextItem: LeadRequestBoardItem = {
          ...editingItem,
          status: LEAD_REQUEST_STATUS.ACTIVE,
          isExpired: false,
          expiresAtIso: nextExpiresAt.toISOString(),
        };
        setLocalPatchedItems((current) => ({
          ...current,
          [editingItem.id]: nextItem,
        }));
        if (detailsItem?.id === editingItem.id) {
          setDetailsItem({
            ...detailsItem,
            ...nextItem,
          });
        }
      }
      setIsModalOpen(false);
      setEditingId(null);
      setEditingItemDraft(null);
      setModalMode("create");
    } catch (extendError) {
      toast.error(extendError instanceof Error ? extendError.message : messages.extendError);
    } finally {
      setIsExtending(false);
    }
  };

  return (
    <section className="grid min-w-0 gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-slate-800 bg-slate-900/60 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`rounded-md px-3 py-1.5 text-sm ${
              activeTab === "all"
                ? "bg-slate-100 text-slate-900"
                : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            {messages.tabAll}
          </button>
          {hasMyRequestsTab ? (
            <button
              type="button"
              onClick={() => setActiveTab("mine")}
              className={`rounded-md px-3 py-1.5 text-sm ${
                activeTab === "mine"
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              {messages.tabMine}
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
          {canCreate ? (
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400"
            >
              <span>{messages.openCreateModal}</span>
            </button>
          ) : isBlocked ? (
            <p className="text-sm text-rose-200">{messages.blockedUserNotice}</p>
          ) : (
            <Link
              href={loginHref}
              className="text-sm text-sky-300 underline decoration-sky-500/60 underline-offset-4 hover:text-sky-200"
            >
              {messages.loginToAdd}
            </Link>
          )}
        </div>
      </div>

      {remoteError ? (
        <p className="rounded-xl border border-amber-700/50 bg-amber-500/10 p-4 text-sm text-amber-200">
          {remoteError}
        </p>
      ) : null}

      {shouldShowListLoader ? (
        <LeadRequestsListLoader message={messages.loadingList} />
      ) : (
        <>
          <LeadRequestsPagination
            currentPage={currentPage}
            totalPages={totalPages}
            messages={messages}
            onPageChange={setCurrentPage}
          />

          {shouldShowEmptyState ? (
            <p className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 text-sm text-slate-400">
              {activeTab === "all" ? messages.empty : messages.emptyMine}
            </p>
          ) : (
            <div className="grid gap-3">
              {formattedItems.map((item) => (
                <LeadRequestCard
                  key={item.id}
                  item={item}
                  activeTab={activeTab}
                  canSeeContact={canSeeContactForCurrentTab}
                  messages={messages}
                  onShowDetails={openDetailsModal}
                  onEdit={openEditModal}
                  onDelete={openDeleteModal}
                />
              ))}
            </div>
          )}

          <LeadRequestsPagination
            currentPage={currentPage}
            totalPages={totalPages}
            messages={messages}
            onPageChange={setCurrentPage}
          />
        </>
      )}

      <LeadRequestFormModal
        isOpen={isModalOpen}
        mode={modalMode}
        messages={messages}
        intlLocale={intlLocale}
        initialValues={formInitialValues}
        editingItem={editingItem}
        turnstileSiteKey={turnstileSiteKey}
        isExtending={isExtending}
        onClose={closeModal}
        onSubmit={handleFormSubmit}
        onExtend={handleExtend}
      />

      <LeadRequestDetailsModal
        item={detailsItem}
        activeTab={activeTab}
        canSeeContact={canSeeContactForCurrentTab}
        messages={messages}
        onClose={closeDetailsModal}
      />

      {deleteTargetId && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto [&>div:not(.fixed)]:my-auto [&>div:not(.fixed)]:max-h-[calc(100dvh-2rem)] [&>div:not(.fixed)]:!overflow-y-auto p-4">
              <div
                className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm"
                onClick={closeDeleteModal}
                aria-hidden="true"
              />
              <div className="relative z-10 w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-2xl">
                <h3 className="text-sm font-semibold text-slate-100">{messages.deleteAction}</h3>
                <p className="mt-2 text-sm text-slate-300">{messages.deleteConfirm}</p>
                <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeDeleteModal}
                    disabled={isDeleting}
                    className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {messages.modalClose}
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="rounded-md border border-rose-700 bg-rose-500/10 px-3 py-2 text-sm text-rose-200 hover:border-rose-500 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isDeleting ? messages.saving : messages.deleteAction}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}

