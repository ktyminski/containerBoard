"use client";

import type { AppMessages } from "@/lib/i18n";

type LeadRequestsPaginationProps = {
  currentPage: number;
  totalPages: number;
  messages: AppMessages["leadRequestsPage"];
  onPageChange: (page: number) => void;
};

export function LeadRequestsPagination({
  currentPage,
  totalPages,
  messages,
  onPageChange,
}: LeadRequestsPaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <button
        type="button"
        onClick={() => {
          onPageChange(Math.max(1, currentPage - 1));
        }}
        disabled={currentPage <= 1}
        className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {messages.prevPage}
      </button>
      <span className="min-w-[72px] text-center text-sm text-slate-300">
        {currentPage} / {totalPages}
      </span>
      <button
        type="button"
        onClick={() => {
          onPageChange(Math.min(totalPages, currentPage + 1));
        }}
        disabled={currentPage >= totalPages}
        className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {messages.nextPage}
      </button>
    </div>
  );
}
