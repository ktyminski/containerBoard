"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CompanyVerificationStatus } from "@/lib/company-verification";
import { withLang, type AppLocale, type AppMessages } from "@/lib/i18n";

type AdminCompanyItem = {
  id: string;
  name: string;
  slug: string;
  nip?: string;
  verificationStatus: CompanyVerificationStatus;
  isBlocked: boolean;
  isPremium: boolean;
  deletionRequest: {
    isRequested: boolean;
    reason?: string;
    requestedAt?: string;
  };
  createdAt: string;
  createdBy:
    | {
        id: string;
        name: string;
        email: string;
      }
    | null;
};

type AdminCompaniesResponse = {
  items?: AdminCompanyItem[];
  meta?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  error?: string;
};

type AdminCompaniesTableProps = {
  locale: AppLocale;
  messages: AppMessages["adminCompanies"];
  statusMessages: AppMessages["companyStatus"];
};

export function AdminCompaniesTable({
  locale,
  messages,
  statusMessages,
}: AdminCompaniesTableProps) {
  const [items, setItems] = useState<AdminCompanyItem[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [verificationFilter, setVerificationFilter] = useState<
    "all" | CompanyVerificationStatus
  >("all");
  const [blockFilter, setBlockFilter] = useState<"all" | "active" | "blocked">("all");
  const [sortBy, setSortBy] = useState<
    "createdAt" | "name" | "slug" | "verificationStatus"
  >("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [reasonPreview, setReasonPreview] = useState<{
    companyName: string;
    reason: string;
    requestedAt?: string;
  } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    companyId: string;
    companyName: string;
  } | null>(null);
  const hasLoadedRef = useRef(false);
  const [meta, setMeta] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });

  const loadCompanies = useCallback(async (options?: { keepData?: boolean }) => {
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
        verificationStatus: verificationFilter,
        blockStatus: blockFilter,
        sortBy,
        sortDir,
      });
      if (searchQuery.trim()) {
        params.set("q", searchQuery.trim());
      }
      const response = await fetch(`/api/admin/companies?${params.toString()}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as AdminCompaniesResponse;
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
    blockFilter,
    messages.failedLoad,
    messages.unknownError,
    page,
    pageSize,
    searchQuery,
    sortBy,
    sortDir,
    verificationFilter,
  ]);

  useEffect(() => {
    const keepData = hasLoadedRef.current;
    void loadCompanies({ keepData });
    hasLoadedRef.current = true;
  }, [loadCompanies]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearchQuery(searchInput.trim());
    }, 300);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [searchInput]);

  const updateBlock = async (companyId: string, isBlocked: boolean) => {
    setError(null);
    setUpdatingId(companyId);
    try {
      const response = await fetch("/api/admin/companies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "block", companyId, isBlocked }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(
          data.error ?? messages.failedUpdate.replace("{status}", String(response.status)),
        );
      }
      await loadCompanies({ keepData: true });
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : messages.unknownError);
    } finally {
      setUpdatingId(null);
    }
  };

  const updateVerification = async (
    companyId: string,
    verificationStatus: CompanyVerificationStatus,
  ) => {
    setError(null);
    setUpdatingId(companyId);
    try {
      const response = await fetch("/api/admin/companies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verification",
          companyId,
          verificationStatus,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(
          data.error ?? messages.failedUpdate.replace("{status}", String(response.status)),
        );
      }
      await loadCompanies({ keepData: true });
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : messages.unknownError);
    } finally {
      setUpdatingId(null);
    }
  };

  const updatePremium = async (companyId: string, isPremium: boolean) => {
    setError(null);
    setUpdatingId(companyId);
    try {
      const response = await fetch("/api/admin/companies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "premium", companyId, isPremium }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(
          data.error ?? messages.failedUpdate.replace("{status}", String(response.status)),
        );
      }
      await loadCompanies({ keepData: true });
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : messages.unknownError);
    } finally {
      setUpdatingId(null);
    }
  };

  const deleteCompany = async (companyId: string) => {
    setError(null);
    setUpdatingId(companyId);
    try {
      const response = await fetch("/api/admin/companies", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(
          data.error ?? messages.failedDelete.replace("{status}", String(response.status)),
        );
      }
      setDeleteConfirm(null);
      await loadCompanies({ keepData: true });
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : messages.unknownError);
    } finally {
      setUpdatingId(null);
    }
  };

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
            void loadCompanies({ keepData: true });
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
          {messages.verificationFilter}
          <select
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
            value={verificationFilter}
            onChange={(event) => {
              setVerificationFilter(
                event.target.value as "all" | CompanyVerificationStatus,
              );
              setPage(1);
            }}
          >
            <option value="all">{messages.allVerification}</option>
            <option value="verified">{statusMessages.verified}</option>
            <option value="not_verified">{statusMessages.not_verified}</option>
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
              setSortBy(
                event.target.value as
                  | "createdAt"
                  | "name"
                  | "slug"
                  | "verificationStatus",
              );
              setPage(1);
            }}
          >
            <option value="createdAt">{messages.sortCreated}</option>
            <option value="name">{messages.sortName}</option>
            <option value="slug">{messages.sortSlug}</option>
            <option value="verificationStatus">{messages.sortStatus}</option>
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
          <table className="w-full min-w-[1900px] table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[260px]" />
              <col className="w-[180px]" />
              <col className="w-[140px]" />
              <col className="w-[180px]" />
              <col className="w-[180px]" />
              <col className="w-[180px]" />
              <col className="w-[260px]" />
              <col className="w-[240px]" />
              <col className="w-[180px]" />
              <col className="w-[300px]" />
            </colgroup>
            <thead>
              <tr className="text-slate-400">
                <th className="pb-2">{messages.company}</th>
                <th className="pb-2">{messages.slug}</th>
                <th className="pb-2">{messages.nip}</th>
                <th className="pb-2">{messages.status}</th>
                <th className="pb-2">{messages.blockStatus}</th>
                <th className="pb-2">{messages.premiumStatus}</th>
                <th className="pb-2">{messages.deletionRequest}</th>
                <th className="pb-2">{messages.createdBy}</th>
                <th className="pb-2">{messages.createdAt}</th>
                <th className="pb-2">{messages.actions}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((company) => (
                <tr key={company.id} className="border-t border-slate-800 align-middle">
                  <td className="py-2 pr-3 text-slate-100">
                    <span className="inline-flex items-center gap-2">
                      <Link
                        href={withLang(`/companies/${company.slug}`, locale)}
                        target="_blank"
                        rel="noreferrer"
                        className="max-w-[210px] truncate text-sky-200 hover:text-sky-100 hover:underline"
                        title={company.name}
                      >
                        {company.name}
                      </Link>
                      {company.isBlocked ? (
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
                    <span className="block truncate" title={company.slug}>
                      {company.slug}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-slate-300">
                    <span className="block truncate" title={company.nip ?? "-"}>
                      {company.nip ?? "-"}
                    </span>
                  </td>
                  <td className="py-2">
                    <span
                      className={
                        company.verificationStatus === "verified"
                          ? "inline-flex min-w-[150px] justify-center rounded-md border border-emerald-700 bg-emerald-500/10 px-2 py-1 text-center text-xs text-emerald-200 whitespace-nowrap"
                          : "inline-flex min-w-[150px] justify-center rounded-md border border-amber-700 bg-amber-500/10 px-2 py-1 text-center text-xs text-amber-200 whitespace-nowrap"
                      }
                    >
                      {statusMessages[company.verificationStatus]}
                    </span>
                  </td>
                  <td className="py-2">
                    <span
                      className={
                        company.isBlocked
                          ? "inline-flex min-w-[150px] justify-center rounded-md border border-rose-700 bg-rose-500/10 px-2 py-1 text-center text-xs text-rose-200 whitespace-nowrap"
                          : "inline-flex min-w-[150px] justify-center rounded-md border border-emerald-700 bg-emerald-500/10 px-2 py-1 text-center text-xs text-emerald-200 whitespace-nowrap"
                      }
                    >
                      {company.isBlocked ? messages.blocked : messages.active}
                    </span>
                  </td>
                  <td className="py-2">
                    <span
                      className={
                        company.isPremium
                          ? "inline-flex min-w-[150px] justify-center rounded-md border border-amber-600 bg-amber-500/10 px-2 py-1 text-center text-xs text-amber-200 whitespace-nowrap"
                          : "inline-flex min-w-[150px] justify-center rounded-md border border-slate-700 bg-slate-800/60 px-2 py-1 text-center text-xs text-slate-300 whitespace-nowrap"
                      }
                    >
                      {company.isPremium ? messages.premium : messages.regular}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    {company.deletionRequest.isRequested ? (
                      <div className="grid gap-1">
                        <span className="inline-flex w-fit rounded-md border border-rose-700 bg-rose-500/10 px-2 py-1 text-xs text-rose-200">
                          {messages.deletionRequested}
                        </span>
                        {company.deletionRequest.reason ? (
                          <button
                            type="button"
                            className="w-fit cursor-pointer text-xs text-rose-200 underline underline-offset-2 hover:text-rose-100"
                            onClick={() => {
                              setReasonPreview({
                                companyName: company.name,
                                reason: company.deletionRequest.reason ?? "",
                                requestedAt: company.deletionRequest.requestedAt,
                              });
                            }}
                          >
                            {messages.previewDeletionReason}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-500">{messages.noDeletionReason}</span>
                        )}
                        {company.deletionRequest.requestedAt ? (
                          <span className="text-xs text-slate-500">
                            {messages.deletionRequestedAt}:{" "}
                            {new Date(company.deletionRequest.requestedAt).toLocaleString(locale)}
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <span className="inline-flex rounded-md border border-slate-700 bg-slate-800/60 px-2 py-1 text-xs text-slate-300">
                        {messages.deletionNotRequested}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-slate-300">
                    {company.createdBy ? (
                      <div>
                        <p className="truncate" title={company.createdBy.name}>
                          {company.createdBy.name}
                        </p>
                        <p className="truncate text-xs text-slate-500" title={company.createdBy.email}>
                          {company.createdBy.email}
                        </p>
                      </div>
                    ) : (
                      <span className="text-slate-500">{messages.noCreator}</span>
                    )}
                  </td>
                  <td className="py-2 text-slate-400">
                    {new Date(company.createdAt).toLocaleString(locale)}
                  </td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={
                          company.isBlocked
                            ? "min-w-[130px] rounded-md border border-emerald-700 px-2 py-1 text-center text-xs text-emerald-200 whitespace-nowrap hover:border-emerald-500 disabled:opacity-50"
                            : "min-w-[130px] rounded-md border border-rose-700 px-2 py-1 text-center text-xs text-rose-200 whitespace-nowrap hover:border-rose-500 disabled:opacity-50"
                        }
                        disabled={updatingId === company.id}
                        onClick={() => {
                          void updateBlock(company.id, !company.isBlocked);
                        }}
                      >
                        {company.isBlocked ? messages.unblockAction : messages.blockAction}
                      </button>
                      <button
                        type="button"
                        className={
                          company.verificationStatus === "verified"
                            ? "min-w-[150px] rounded-md border border-amber-700 px-2 py-1 text-center text-xs text-amber-200 whitespace-nowrap hover:border-amber-500 disabled:opacity-50"
                            : "min-w-[150px] rounded-md border border-emerald-700 px-2 py-1 text-center text-xs text-emerald-200 whitespace-nowrap hover:border-emerald-500 disabled:opacity-50"
                        }
                        disabled={updatingId === company.id}
                        onClick={() => {
                          void updateVerification(
                            company.id,
                            company.verificationStatus === "verified"
                              ? "not_verified"
                              : "verified",
                          );
                        }}
                      >
                        {company.verificationStatus === "verified"
                          ? messages.unverifyAction
                          : messages.verifyAction}
                      </button>
                      <button
                        type="button"
                        className={
                          company.isPremium
                            ? "min-w-[140px] rounded-md border border-slate-700 px-2 py-1 text-center text-xs text-slate-200 whitespace-nowrap hover:border-slate-500 disabled:opacity-50"
                            : "min-w-[140px] rounded-md border border-amber-700 px-2 py-1 text-center text-xs text-amber-200 whitespace-nowrap hover:border-amber-500 disabled:opacity-50"
                        }
                        disabled={updatingId === company.id}
                        onClick={() => {
                          void updatePremium(company.id, !company.isPremium);
                        }}
                      >
                        {company.isPremium
                          ? messages.unsetPremiumAction
                          : messages.setPremiumAction}
                      </button>
                      <button
                        type="button"
                        className="min-w-[110px] rounded-md border border-rose-700 px-2 py-1 text-center text-xs text-rose-200 whitespace-nowrap hover:border-rose-500 disabled:opacity-50"
                        disabled={updatingId === company.id}
                        onClick={() => {
                          setDeleteConfirm({
                            companyId: company.id,
                            companyName: company.name,
                          });
                        }}
                      >
                        {messages.deleteAction}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
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
      {reasonPreview ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto [&>div:not(.fixed)]:my-auto [&>div:not(.fixed)]:max-h-[calc(100dvh-2rem)] [&>div:not(.fixed)]:!overflow-y-auto bg-slate-950/80 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-xl rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
            <h3 className="text-base font-semibold text-slate-100">
              {messages.deletionReasonModalTitle.replace("{company}", reasonPreview.companyName)}
            </h3>
            {reasonPreview.requestedAt ? (
              <p className="mt-1 text-xs text-slate-400">
                {messages.deletionRequestedAt}:{" "}
                {new Date(reasonPreview.requestedAt).toLocaleString(locale)}
              </p>
            ) : null}
            <p className="mt-3 whitespace-pre-wrap rounded-md border border-slate-800 bg-slate-950 p-3 text-sm text-slate-200">
              {reasonPreview.reason || messages.noDeletionReason}
            </p>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                className="cursor-pointer rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-500"
                onClick={() => {
                  setReasonPreview(null);
                }}
              >
                {messages.closeDeletionReason}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {deleteConfirm ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto [&>div:not(.fixed)]:my-auto [&>div:not(.fixed)]:max-h-[calc(100dvh-2rem)] [&>div:not(.fixed)]:!overflow-y-auto bg-slate-950/75 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-2xl">
            <h3 className="text-sm font-semibold text-slate-100">
              {messages.confirmDeleteTitle}
            </h3>
            <p className="mt-2 text-xs leading-5 text-slate-300">
              {messages.confirmDeleteText.replace("{company}", deleteConfirm.companyName)}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500"
                onClick={() => {
                  setDeleteConfirm(null);
                }}
              >
                {messages.cancel}
              </button>
              <button
                type="button"
                className="rounded-md border border-rose-700 px-3 py-1.5 text-xs text-rose-200 hover:border-rose-500 disabled:cursor-not-allowed disabled:opacity-70"
                onClick={() => {
                  void deleteCompany(deleteConfirm.companyId);
                }}
                disabled={updatingId === deleteConfirm.companyId}
              >
                {messages.confirmDeleteButton}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}


