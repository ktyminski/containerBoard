"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AppLocale, AppMessages } from "@/lib/i18n";
import { USER_ROLES, type UserRole } from "@/lib/user-roles";

type PublicUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isBlocked: boolean;
  isEmailVerified: boolean;
  createdAt: string;
  companies: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
};

type UsersResponse = {
  items: PublicUser[];
  meta?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  availableCompanies?: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
  error?: string;
};

type AdminUsersTableProps = {
  locale: AppLocale;
  messages: AppMessages["adminUsers"];
  roleMessages: AppMessages["roles"];
};

export function AdminUsersTable({
  locale,
  messages,
  roleMessages,
}: AdminUsersTableProps) {
  const [items, setItems] = useState<PublicUser[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignUserId, setAssignUserId] = useState<string>("");
  const [assignCompanyId, setAssignCompanyId] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [blockFilter, setBlockFilter] = useState<"all" | "active" | "blocked">("all");
  const [sortBy, setSortBy] = useState<"createdAt" | "name" | "email" | "role">("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const hasLoadedRef = useRef(false);
  const [meta, setMeta] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });
  const [availableCompanies, setAvailableCompanies] = useState<
    Array<{ id: string; name: string; slug: string }>
  >([]);
  const [removeConfirm, setRemoveConfirm] = useState<{
    userId: string;
    userName: string;
    companyId: string;
    companyName: string;
  } | null>(null);

  const loadUsers = useCallback(async (options?: { keepData?: boolean }) => {
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
        role: roleFilter,
        blockStatus: blockFilter,
        sortBy,
        sortDir,
      });
      if (searchQuery.trim()) {
        params.set("q", searchQuery.trim());
      }
      const response = await fetch(`/api/admin/users?${params.toString()}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as UsersResponse;
      if (!response.ok) {
        throw new Error(
          data.error ?? messages.failedLoad.replace("{status}", String(response.status)),
        );
      }
      setItems(data.items ?? []);
      setAvailableCompanies(data.availableCompanies ?? []);
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
    blockFilter,
    messages.failedLoad,
    messages.unknownError,
    page,
    pageSize,
    roleFilter,
    searchQuery,
    sortBy,
    sortDir,
  ]);

  useEffect(() => {
    const keepData = hasLoadedRef.current;
    void loadUsers({ keepData });
    hasLoadedRef.current = true;
  }, [loadUsers]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearchQuery(searchInput.trim());
    }, 300);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [searchInput]);

  const updateRole = async (userId: string, role: UserRole) => {
    setError(null);
    setUpdatingId(userId);
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(
          data.error ?? messages.failedUpdate.replace("{status}", String(response.status)),
        );
      }
      await loadUsers({ keepData: true });
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : messages.unknownError);
    } finally {
      setUpdatingId(null);
    }
  };

  const updateBlock = async (userId: string, isBlocked: boolean) => {
    setError(null);
    setUpdatingId(userId);
    try {
      const response = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, isBlocked }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(
          data.error ?? messages.failedUpdate.replace("{status}", String(response.status)),
        );
      }
      await loadUsers({ keepData: true });
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : messages.unknownError);
    } finally {
      setUpdatingId(null);
    }
  };

  const removeAssignment = async (userId: string, companyId: string) => {
    setError(null);
    setUpdatingId(userId);
    try {
      const response = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, companyId }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(
          data.error ?? messages.failedRemove.replace("{status}", String(response.status)),
        );
      }
      await loadUsers({ keepData: true });
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : messages.unknownError);
    } finally {
      setUpdatingId(null);
      setRemoveConfirm(null);
    }
  };

  const openAssignModal = () => {
    if (items.length === 0 || availableCompanies.length === 0) {
      return;
    }
    setAssignUserId(items[0].id);
    setAssignCompanyId(availableCompanies[0].id);
    setIsAssignModalOpen(true);
  };

  const assignCompany = async () => {
    if (!assignUserId || !assignCompanyId) {
      return;
    }

    setError(null);
    setUpdatingId(assignUserId);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: assignUserId, companyId: assignCompanyId }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(
          data.error ?? messages.failedAssign.replace("{status}", String(response.status)),
        );
      }
      await loadUsers({ keepData: true });
      setIsAssignModalOpen(false);
      setAssignUserId("");
      setAssignCompanyId("");
    } catch (assignError) {
      setError(assignError instanceof Error ? assignError.message : messages.unknownError);
    } finally {
      setUpdatingId(null);
    }
  };

  if (isInitialLoading && items.length === 0) {
    return <p className="text-sm text-slate-300">{messages.loading}</p>;
  }

  return (
    <>
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-100">{messages.title}</h2>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-md border border-sky-700 px-3 py-1 text-sm text-sky-200 hover:border-sky-500 disabled:opacity-50"
            disabled={items.length === 0 || availableCompanies.length === 0}
            onClick={openAssignModal}
          >
            {messages.assignCompany}
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-700 px-3 py-1 text-sm text-slate-200 hover:border-slate-500"
            onClick={() => {
              void loadUsers({ keepData: true });
            }}
            disabled={isRefreshing}
          >
            {messages.refresh}
          </button>
        </div>
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
          {messages.roleFilter}
          <select
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
            value={roleFilter}
            onChange={(event) => {
              setRoleFilter(event.target.value as UserRole | "all");
              setPage(1);
            }}
          >
            <option value="all">{messages.allRoles}</option>
            {USER_ROLES.map((role) => (
              <option key={role} value={role}>
                {roleMessages[role]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-300">
          {messages.blockFilter}
          <select
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
            value={blockFilter}
            onChange={(event) => {
              setBlockFilter(event.target.value as "all" | "active" | "blocked");
              setPage(1);
            }}
          >
            <option value="all">{messages.allBlocks}</option>
            <option value="active">{messages.active}</option>
            <option value="blocked">{messages.blocked}</option>
          </select>
        </label>
        <label className="text-xs text-slate-300">
          {messages.sortBy}
          <select
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
            value={sortBy}
            onChange={(event) => {
              setSortBy(event.target.value as "createdAt" | "name" | "email" | "role");
              setPage(1);
            }}
          >
            <option value="createdAt">{messages.sortCreated}</option>
            <option value="name">{messages.sortName}</option>
            <option value="email">{messages.sortEmail}</option>
            <option value="role">{messages.sortRole}</option>
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
      {availableCompanies.length === 0 ? (
        <p className="mb-3 text-xs text-slate-400">{messages.noAvailableCompanies}</p>
      ) : null}
      {error ? <p className="mb-3 text-sm text-red-300">{error}</p> : null}
      {isRefreshing ? <p className="mb-3 text-xs text-slate-400">{messages.loading}</p> : null}
      {items.length === 0 ? (
        <p className="mb-3 text-sm text-slate-400">{messages.noResults}</p>
      ) : null}
      <div className="overflow-auto">
        <table className="w-full min-w-[1380px] table-fixed text-left text-sm">
          <colgroup>
            <col className="w-[220px]" />
            <col className="w-[240px]" />
            <col className="w-[170px]" />
            <col className="w-[280px]" />
            <col className="w-[140px]" />
            <col className="w-[180px]" />
            <col className="w-[180px]" />
            <col className="w-[320px]" />
          </colgroup>
          <thead>
            <tr className="text-slate-400">
              <th className="pb-2">{messages.name}</th>
              <th className="pb-2">{messages.email}</th>
              <th className="pb-2">{messages.emailVerification}</th>
              <th className="pb-2">{messages.companies}</th>
              <th className="pb-2">{messages.role}</th>
              <th className="pb-2">{messages.blockStatus}</th>
              <th className="pb-2">{messages.created}</th>
              <th className="pb-2">{messages.actions}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((user) => (
              <tr key={user.id} className="border-t border-slate-800 align-middle">
                <td className="py-2 pr-3 text-slate-100">
                  <span className="inline-flex items-center gap-2">
                    <span className="max-w-[170px] truncate" title={user.name}>
                      {user.name}
                    </span>
                    {user.isBlocked ? (
                      <span
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-rose-600 bg-rose-500/10 text-[11px] font-bold text-rose-300"
                        title={messages.blocked}
                        aria-label={messages.blocked}
                      >
                        !
                      </span>
                    ) : null}
                  </span>
                </td>
                <td className="py-2 pr-3 text-slate-300">
                  <span className="block truncate" title={user.email}>
                    {user.email}
                  </span>
                </td>
                <td className="py-2 pr-3">
                  <span
                    className={
                      user.isEmailVerified
                        ? "inline-flex min-w-[140px] justify-center rounded-md border border-emerald-700 bg-emerald-500/10 px-2 py-1 text-center text-xs text-emerald-200 whitespace-nowrap"
                        : "inline-flex min-w-[140px] justify-center rounded-md border border-amber-700 bg-amber-500/10 px-2 py-1 text-center text-xs text-amber-200 whitespace-nowrap"
                    }
                  >
                    {user.isEmailVerified ? messages.emailVerified : messages.emailNotVerified}
                  </span>
                </td>
                <td className="py-2 pr-3 text-slate-300">
                  {user.companies.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {user.companies.map((company) => (
                        <div
                          key={company.id}
                          className="flex items-center gap-1 rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-200"
                          title={company.slug}
                        >
                          <span>{company.name}</span>
                          <button
                            type="button"
                            className="rounded border border-rose-700 px-1 text-[10px] text-rose-200 hover:border-rose-500 disabled:opacity-50"
                            disabled={updatingId === user.id}
                            onClick={() => {
                              setRemoveConfirm({
                                userId: user.id,
                                userName: user.name,
                                companyId: company.id,
                                companyName: company.name,
                              });
                            }}
                            aria-label={messages.removeAssignment}
                          >
                            x
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-slate-500">{messages.noCompanies}</span>
                  )}
                </td>
                <td className="py-2">
                  <span className="rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-200">
                    {roleMessages[user.role]}
                  </span>
                </td>
                <td className="py-2">
                  <span
                    className={
                      user.isBlocked
                        ? "inline-flex min-w-[150px] justify-center rounded-md border border-rose-700 bg-rose-500/10 px-2 py-1 text-center text-xs text-rose-200 whitespace-nowrap"
                        : "inline-flex min-w-[150px] justify-center rounded-md border border-emerald-700 bg-emerald-500/10 px-2 py-1 text-center text-xs text-emerald-200 whitespace-nowrap"
                    }
                  >
                    {user.isBlocked ? messages.blocked : messages.active}
                  </span>
                </td>
                <td className="py-2 text-slate-400">
                  {new Date(user.createdAt).toLocaleString(locale)}
                </td>
                <td className="py-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={
                        user.isBlocked
                          ? "min-w-[120px] rounded-md border border-emerald-700 px-2 py-1 text-center text-xs text-emerald-200 whitespace-nowrap hover:border-emerald-500 disabled:opacity-50"
                          : "min-w-[120px] rounded-md border border-rose-700 px-2 py-1 text-center text-xs text-rose-200 whitespace-nowrap hover:border-rose-500 disabled:opacity-50"
                      }
                      disabled={updatingId === user.id}
                      onClick={() => {
                        void updateBlock(user.id, !user.isBlocked);
                      }}
                    >
                      {user.isBlocked ? messages.unblockAction : messages.blockAction}
                    </button>
                    {USER_ROLES.map((role) => (
                      <button
                        key={role}
                        type="button"
                        className="min-w-[96px] rounded-md border border-slate-700 px-2 py-1 text-center text-xs text-slate-200 whitespace-nowrap hover:border-slate-500 disabled:opacity-50"
                        disabled={updatingId === user.id || user.role === role}
                        onClick={() => {
                          void updateRole(user.id, role);
                        }}
                      >
                        {roleMessages[role]}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
      </div>
      {isAssignModalOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto [&>div:not(.fixed)]:my-auto [&>div:not(.fixed)]:max-h-[calc(100dvh-2rem)] [&>div:not(.fixed)]:!overflow-y-auto bg-slate-950/75 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-2xl">
            <h3 className="text-sm font-semibold text-slate-100">{messages.assignCompanyTitle}</h3>
            <div className="mt-3 space-y-3">
              <label className="block text-xs text-slate-300">
                {messages.selectUser}
                <select
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
                  value={assignUserId}
                  onChange={(event) => {
                    setAssignUserId(event.target.value);
                  }}
                >
                  {items.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-slate-300">
                {messages.selectCompany}
                <select
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
                  value={assignCompanyId}
                  onChange={(event) => {
                    setAssignCompanyId(event.target.value);
                  }}
                >
                  {availableCompanies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500"
                onClick={() => {
                  setIsAssignModalOpen(false);
                }}
              >
                {messages.cancel}
              </button>
              <button
                type="button"
                className="rounded-md border border-sky-700 px-3 py-1.5 text-xs text-sky-200 hover:border-sky-500 disabled:cursor-not-allowed disabled:opacity-70"
                onClick={() => {
                  void assignCompany();
                }}
                disabled={!assignUserId || !assignCompanyId || updatingId === assignUserId}
              >
                {messages.confirm}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {removeConfirm ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto [&>div:not(.fixed)]:my-auto [&>div:not(.fixed)]:max-h-[calc(100dvh-2rem)] [&>div:not(.fixed)]:!overflow-y-auto bg-slate-950/75 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-2xl">
            <h3 className="text-sm font-semibold text-slate-100">{messages.confirmRemoveTitle}</h3>
            <p className="mt-2 text-xs leading-5 text-slate-300">
              {messages.confirmRemoveText
                .replace("{company}", removeConfirm.companyName)
                .replace("{user}", removeConfirm.userName)}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500"
                onClick={() => {
                  setRemoveConfirm(null);
                }}
              >
                {messages.cancel}
              </button>
              <button
                type="button"
                className="rounded-md border border-rose-700 px-3 py-1.5 text-xs text-rose-200 hover:border-rose-500 disabled:cursor-not-allowed disabled:opacity-70"
                onClick={() => {
                  void removeAssignment(removeConfirm.userId, removeConfirm.companyId);
                }}
                disabled={updatingId === removeConfirm.userId}
              >
                {messages.confirm}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}


