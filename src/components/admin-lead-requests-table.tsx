"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/toast-provider";
import type { AppLocale, AppMessages } from "@/lib/i18n";
import type { LeadRequestStatus, LeadRequestTransportMode, LeadRequestType } from "@/lib/lead-request-types";

type AdminLeadRequestItem = {
  id: string;
  leadType: LeadRequestType;
  transportMode: LeadRequestTransportMode | null;
  originLocation: string;
  destinationLocation: string;
  description: string;
  contactEmail: string | null;
  contactPhone: string | null;
  status: LeadRequestStatus;
  createdByName: string;
  createdByEmail: string;
  createdAt: string;
  expiresAt: string | null;
};

type AdminLeadRequestsResponse = {
  items?: AdminLeadRequestItem[];
  meta?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  error?: string;
};

type AdminLeadRequestsTableProps = {
  locale: AppLocale;
  messages: AppMessages["adminLeadRequests"];
  leadRequestsMessages: AppMessages["leadRequestsPage"];
};

function getLeadTypeLabel(
  leadType: LeadRequestType,
  messages: AppMessages["leadRequestsPage"],
): string {
  return leadType === "transport" ? messages.typeTransport : messages.typeOther;
}

function getTransportModeLabel(
  transportMode: LeadRequestTransportMode | null,
  messages: AppMessages["leadRequestsPage"],
): string {
  if (transportMode === "sea") {
    return messages.transportModeSea;
  }
  if (transportMode === "rail") {
    return messages.transportModeRail;
  }
  if (transportMode === "road") {
    return messages.transportModeRoad;
  }
  if (transportMode === "air") {
    return messages.transportModeAir;
  }
  return messages.transportModeAny;
}

function getStatusLabel(
  status: LeadRequestStatus,
  messages: AppMessages["leadRequestsPage"],
): string {
  if (status === "pending") {
    return messages.statusPending;
  }
  if (status === "expired") {
    return messages.statusExpired;
  }
  return messages.statusActive;
}

export function AdminLeadRequestsTable({
  locale,
  messages,
  leadRequestsMessages,
}: AdminLeadRequestsTableProps) {
  const toast = useToast();
  const [items, setItems] = useState<AdminLeadRequestItem[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [leadTypeFilter, setLeadTypeFilter] = useState<LeadRequestType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<LeadRequestStatus | "all">("all");
  const [sortBy, setSortBy] = useState<"createdAt" | "expiresAt" | "leadType" | "status">("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);
  const [meta, setMeta] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });

  const loadLeadRequests = useCallback(async (options?: { keepData?: boolean }) => {
    setError(null);
    if (options?.keepData) {
      setIsRefreshing(true);
    } else {
      setIsInitialLoading(true);
    }
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        leadType: leadTypeFilter,
        status: statusFilter,
        sortBy,
        sortDir,
      });
      if (searchQuery.trim()) {
        params.set("q", searchQuery.trim());
      }
      const response = await fetch(`/api/admin/lead-requests?${params.toString()}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as AdminLeadRequestsResponse;
      if (!response.ok) {
        throw new Error(
          data.error ?? messages.failedLoad.replace("{status}", String(response.status)),
        );
      }
      setItems(data.items ?? []);
      setMeta(
        data.meta ?? {
          page,
          pageSize,
          total: data.items?.length ?? 0,
          totalPages: 1,
        },
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : messages.unknownError);
    } finally {
      setIsInitialLoading(false);
      setIsRefreshing(false);
    }
  }, [
    leadTypeFilter,
    messages.failedLoad,
    messages.unknownError,
    page,
    pageSize,
    searchQuery,
    sortBy,
    sortDir,
    statusFilter,
  ]);

  useEffect(() => {
    const keepData = hasLoadedRef.current;
    void loadLeadRequests({ keepData });
    hasLoadedRef.current = true;
  }, [loadLeadRequests]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearchQuery(searchInput.trim());
    }, 300);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [searchInput]);

  async function handleDelete(item: AdminLeadRequestItem) {
    if (!window.confirm(messages.confirmDeleteText.replace("{id}", item.id))) {
      return;
    }

    setDeletingId(item.id);
    try {
      const response = await fetch(`/api/lead-requests/${item.id}`, { method: "DELETE" });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? messages.deleteError);
      }
      toast.success(messages.deleteSuccess);
      await loadLeadRequests({ keepData: true });
    } catch (actionError) {
      toast.error(actionError instanceof Error ? actionError.message : messages.deleteError);
    } finally {
      setDeletingId(null);
    }
  }

  if (isInitialLoading && items.length === 0) {
    return <p className="text-sm text-slate-300">{messages.loading}</p>;
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-100">{messages.title}</h2>
        <button
          type="button"
          className="rounded-md border border-slate-700 px-3 py-1 text-sm text-slate-200 hover:border-slate-500"
          onClick={() => {
            void loadLeadRequests({ keepData: true });
          }}
          disabled={isRefreshing}
        >
          {messages.refresh}
        </button>
      </div>
      <div className="mb-3 grid gap-2 md:grid-cols-2 xl:grid-cols-6">
        <label className="text-xs text-slate-300">
          {messages.searchLabel}
          <input
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
            placeholder={messages.searchPlaceholder}
            value={searchInput}
            onChange={(event) => {
              setSearchInput(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <label className="text-xs text-slate-300">
          {messages.typeFilter}
          <select
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
            value={leadTypeFilter}
            onChange={(event) => {
              setLeadTypeFilter(event.target.value as LeadRequestType | "all");
              setPage(1);
            }}
          >
            <option value="all">{messages.allTypes}</option>
            <option value="transport">{leadRequestsMessages.typeTransport}</option>
            <option value="other">{leadRequestsMessages.typeOther}</option>
          </select>
        </label>
        <label className="text-xs text-slate-300">
          {messages.statusFilter}
          <select
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as LeadRequestStatus | "all");
              setPage(1);
            }}
          >
            <option value="all">{messages.allStatuses}</option>
            <option value="pending">{leadRequestsMessages.statusPending}</option>
            <option value="active">{leadRequestsMessages.statusActive}</option>
            <option value="expired">{leadRequestsMessages.statusExpired}</option>
          </select>
        </label>
        <label className="text-xs text-slate-300">
          {messages.sortBy}
          <select
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
            value={sortBy}
            onChange={(event) => {
              setSortBy(event.target.value as "createdAt" | "expiresAt" | "leadType" | "status");
              setPage(1);
            }}
          >
            <option value="createdAt">{messages.sortCreated}</option>
            <option value="expiresAt">{messages.sortExpires}</option>
            <option value="leadType">{messages.sortType}</option>
            <option value="status">{messages.sortStatus}</option>
          </select>
        </label>
        <label className="text-xs text-slate-300">
          {messages.sortDir}
          <select
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
            value={sortDir}
            onChange={(event) => {
              setSortDir(event.target.value as "asc" | "desc");
              setPage(1);
            }}
          >
            <option value="desc">{messages.sortDesc}</option>
            <option value="asc">{messages.sortAsc}</option>
          </select>
        </label>
        <label className="text-xs text-slate-300">
          {messages.pageSize}
          <select
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </label>
      </div>
      {error ? <p className="mb-3 text-sm text-red-300">{error}</p> : null}
      {isRefreshing ? <p className="mb-3 text-xs text-slate-400">{messages.loading}</p> : null}
      {items.length === 0 ? (
        <p className="text-sm text-slate-400">{messages.noResults}</p>
      ) : (
        <div className="overflow-auto">
          <table className="w-full min-w-[1480px] table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[180px]" />
              <col className="w-[260px]" />
              <col className="w-[340px]" />
              <col className="w-[220px]" />
              <col className="w-[130px]" />
              <col className="w-[240px]" />
              <col className="w-[170px]" />
              <col className="w-[170px]" />
              <col className="w-[120px]" />
            </colgroup>
            <thead>
              <tr className="text-slate-400">
                <th className="pb-2">{messages.type}</th>
                <th className="pb-2">{messages.route}</th>
                <th className="pb-2">{messages.description}</th>
                <th className="pb-2">{messages.contact}</th>
                <th className="pb-2">{messages.status}</th>
                <th className="pb-2">{messages.author}</th>
                <th className="pb-2">{messages.createdAt}</th>
                <th className="pb-2">{messages.expiresAt}</th>
                <th className="pb-2">{messages.actions}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const route =
                  item.leadType === "transport" && (item.originLocation || item.destinationLocation)
                    ? `${item.originLocation || messages.noRoute} ${leadRequestsMessages.routeSeparator} ${item.destinationLocation || messages.noRoute}`
                    : messages.noRoute;
                const contact = [item.contactEmail, item.contactPhone].filter(Boolean).join(" / ");
                const author = [item.createdByName, item.createdByEmail].filter(Boolean).join(" / ");
                return (
                  <tr key={item.id} className="border-t border-slate-800 align-middle">
                    <td className="py-2 pr-3 text-slate-300">
                      <div className="flex flex-col gap-1">
                        <span className="rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-100">
                          {getLeadTypeLabel(item.leadType, leadRequestsMessages)}
                        </span>
                        {item.leadType === "transport" ? (
                          <span className="text-xs text-slate-400">
                            {getTransportModeLabel(item.transportMode, leadRequestsMessages)}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="py-2 pr-3 text-slate-300">
                      <span className="block truncate" title={route}>
                        {route}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-slate-100">
                      <span className="block truncate" title={item.description}>
                        {item.description}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-slate-300">
                      <span className="block truncate" title={contact || leadRequestsMessages.noContactData}>
                        {contact || leadRequestsMessages.noContactData}
                      </span>
                    </td>
                    <td className="py-2">
                      <span
                        className={
                          item.status === "active"
                            ? "inline-flex min-w-[110px] justify-center rounded-md border border-emerald-700 bg-emerald-500/10 px-2 py-1 text-center text-xs text-emerald-200 whitespace-nowrap"
                            : item.status === "pending"
                              ? "inline-flex min-w-[110px] justify-center rounded-md border border-amber-700 bg-amber-500/10 px-2 py-1 text-center text-xs text-amber-200 whitespace-nowrap"
                              : "inline-flex min-w-[110px] justify-center rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-center text-xs text-slate-200 whitespace-nowrap"
                        }
                      >
                        {getStatusLabel(item.status, leadRequestsMessages)}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-slate-300">
                      <span className="block truncate" title={author || messages.unknownUser}>
                        {author || messages.unknownUser}
                      </span>
                    </td>
                    <td className="py-2 text-slate-400">
                      {new Date(item.createdAt).toLocaleString(locale)}
                    </td>
                    <td className="py-2 text-slate-400">
                      {item.expiresAt ? new Date(item.expiresAt).toLocaleString(locale) : "-"}
                    </td>
                    <td className="py-2">
                      <button
                        type="button"
                        className="rounded-md border border-rose-700 px-2 py-1 text-xs text-rose-200 hover:border-rose-500 disabled:opacity-50"
                        disabled={deletingId === item.id}
                        onClick={() => {
                          void handleDelete(item);
                        }}
                      >
                        {messages.deleteAction}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-xs text-slate-400">
          {messages.pageInfo
            .replace("{page}", String(meta.page))
            .replace("{totalPages}", String(meta.totalPages))
            .replace("{total}", String(meta.total))}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:border-slate-500 disabled:opacity-50"
            disabled={page <= 1}
            onClick={() => {
              setPage((current) => Math.max(1, current - 1));
            }}
          >
            {messages.prevPage}
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:border-slate-500 disabled:opacity-50"
            disabled={page >= meta.totalPages}
            onClick={() => {
              setPage((current) => Math.min(meta.totalPages, current + 1));
            }}
          >
            {messages.nextPage}
          </button>
        </div>
      </div>
    </section>
  );
}
