"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { withLang, type AppLocale, type AppMessages } from "@/lib/i18n";
import {
  JOB_ANNOUNCEMENT_PLAN_TIERS,
  type JobAnnouncementPlanTier,
} from "@/lib/job-announcement";
import { PublicationRowActions } from "@/components/publication-row-actions";

type AdminAnnouncementItem = {
  id: string;
  companyName: string;
  companySlug: string;
  title: string;
  locationLabel: string;
  planTier: JobAnnouncementPlanTier;
  isPublished: boolean;
  createdAt: string;
};

type AdminAnnouncementsResponse = {
  items?: AdminAnnouncementItem[];
  meta?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  error?: string;
};

type AdminAnnouncementsTableProps = {
  locale: AppLocale;
  messages: AppMessages["adminAnnouncements"];
  planMessages: AppMessages["mapModules"]["announcements"]["plans"];
};

export function AdminAnnouncementsTable({
  locale,
  messages,
  planMessages,
}: AdminAnnouncementsTableProps) {
  const [items, setItems] = useState<AdminAnnouncementItem[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [planFilter, setPlanFilter] = useState<JobAnnouncementPlanTier | "all">("all");
  const [publishFilter, setPublishFilter] = useState<
    "all" | "published" | "unpublished"
  >("all");
  const [sortBy, setSortBy] = useState<
    "createdAt" | "title" | "companyName" | "planTier"
  >("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const hasLoadedRef = useRef(false);
  const [meta, setMeta] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });

  const loadAnnouncements = useCallback(async (options?: { keepData?: boolean }) => {
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
        planTier: planFilter,
        publishStatus: publishFilter,
        sortBy,
        sortDir,
      });
      if (searchQuery.trim()) {
        params.set("q", searchQuery.trim());
      }
      const response = await fetch(`/api/admin/announcements?${params.toString()}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as AdminAnnouncementsResponse;
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
    messages.failedLoad,
    messages.unknownError,
    page,
    pageSize,
    planFilter,
    publishFilter,
    searchQuery,
    sortBy,
    sortDir,
  ]);

  useEffect(() => {
    const keepData = hasLoadedRef.current;
    void loadAnnouncements({ keepData });
    hasLoadedRef.current = true;
  }, [loadAnnouncements]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearchQuery(searchInput.trim());
    }, 300);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [searchInput]);

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
            void loadAnnouncements({ keepData: true });
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
          {messages.planFilter}
          <select
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
            value={planFilter}
            onChange={(event) => {
              setPlanFilter(event.target.value as JobAnnouncementPlanTier | "all");
              setPage(1);
            }}
          >
            <option value="all">{messages.allPlans}</option>
            {JOB_ANNOUNCEMENT_PLAN_TIERS.map((planTier) => (
              <option key={planTier} value={planTier}>
                {planMessages[planTier]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-300">
          {messages.publishFilter}
          <select
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
            value={publishFilter}
            onChange={(event) => {
              setPublishFilter(event.target.value as "all" | "published" | "unpublished");
              setPage(1);
            }}
          >
            <option value="all">{messages.allPublishStatuses}</option>
            <option value="published">{messages.published}</option>
            <option value="unpublished">{messages.unpublished}</option>
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
                  | "title"
                  | "companyName"
                  | "planTier",
              );
              setPage(1);
            }}
          >
            <option value="createdAt">{messages.sortCreated}</option>
            <option value="title">{messages.sortTitle}</option>
            <option value="companyName">{messages.sortCompany}</option>
            <option value="planTier">{messages.sortPlan}</option>
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
          <table className="w-full min-w-[1240px] table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[320px]" />
              <col className="w-[240px]" />
              <col className="w-[130px]" />
              <col className="w-[230px]" />
              <col className="w-[130px]" />
              <col className="w-[170px]" />
              <col className="w-[230px]" />
            </colgroup>
            <thead>
              <tr className="text-slate-400">
                <th className="pb-2">{messages.announcement}</th>
                <th className="pb-2">{messages.company}</th>
                <th className="pb-2">{messages.plan}</th>
                <th className="pb-2">{messages.location}</th>
                <th className="pb-2">{messages.publishStatus}</th>
                <th className="pb-2">{messages.createdAt}</th>
                <th className="pb-2">{messages.actions}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((announcement) => (
                <tr key={announcement.id} className="border-t border-slate-800 align-middle">
                  <td className="py-2 pr-3 text-slate-100">
                    <span className="block truncate" title={announcement.title}>
                      {announcement.title}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-slate-300">
                    <span className="block truncate" title={announcement.companyName}>
                      {announcement.companyName}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-slate-300">
                    <span className="rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-200">
                      {planMessages[announcement.planTier]}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-slate-300">
                    <span className="block truncate" title={announcement.locationLabel}>
                      {announcement.locationLabel}
                    </span>
                  </td>
                  <td className="py-2">
                    <span
                      className={
                        announcement.isPublished
                          ? "inline-flex min-w-[120px] justify-center rounded-md border border-emerald-700 bg-emerald-500/10 px-2 py-1 text-center text-xs text-emerald-200 whitespace-nowrap"
                          : "inline-flex min-w-[120px] justify-center rounded-md border border-amber-700 bg-amber-500/10 px-2 py-1 text-center text-xs text-amber-200 whitespace-nowrap"
                      }
                    >
                      {announcement.isPublished ? messages.published : messages.unpublished}
                    </span>
                  </td>
                  <td className="py-2 text-slate-400">
                    {new Date(announcement.createdAt).toLocaleString(locale)}
                  </td>
                  <td className="py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={withLang(`/announcements/${announcement.id}`, locale)}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-md border border-sky-700 px-2 py-1 text-xs text-sky-200 hover:border-sky-500"
                      >
                        {messages.openAnnouncement}
                      </Link>
                      <Link
                        href={withLang(`/companies/${announcement.companySlug}`, locale)}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:border-slate-500"
                      >
                        {messages.openCompany}
                      </Link>
                      <PublicationRowActions
                        entity="announcements"
                        itemId={announcement.id}
                        isPublished={announcement.isPublished}
                        publishLabel={messages.publishAction}
                        suspendLabel={messages.suspendAction}
                        deleteLabel={messages.deleteAction}
                        publishSuccessMessage={messages.publishSuccess}
                        suspendSuccessMessage={messages.suspendSuccess}
                        deleteSuccessMessage={messages.deleteSuccess}
                        confirmDeleteText={messages.confirmDeleteText.replace(
                          "{title}",
                          announcement.title,
                        )}
                        unknownError={messages.unknownError}
                        onChanged={async () => {
                          await loadAnnouncements({ keepData: true });
                        }}
                      />
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
    </section>
  );
}
