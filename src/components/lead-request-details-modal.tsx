"use client";

import { createPortal } from "react-dom";
import { LeadRequestCard, type LeadRequestCardItem } from "@/components/lead-request-card";
import type { AppMessages } from "@/lib/i18n";

type LeadRequestDetailsModalProps = {
  item: LeadRequestCardItem | null;
  activeTab: "all" | "mine";
  canSeeContact: boolean;
  messages: AppMessages["leadRequestsPage"];
  onClose: () => void;
};

export function LeadRequestDetailsModal({
  item,
  activeTab,
  canSeeContact,
  messages,
  onClose,
}: LeadRequestDetailsModalProps) {
  if (!item) {
    return null;
  }

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto [&>div:not(.fixed)]:my-auto [&>div:not(.fixed)]:max-h-[calc(100dvh-2rem)] [&>div:not(.fixed)]:!overflow-y-auto p-4">
      <div
        className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-4xl overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-100">{messages.detailsModalTitle}</h3>
          <button
            type="button"
            className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500"
            onClick={onClose}
          >
            {messages.modalClose}
          </button>
        </div>
        <div className="max-h-[80vh] overflow-y-auto p-4">
          <LeadRequestCard
            item={item}
            activeTab={activeTab}
            canSeeContact={canSeeContact}
            messages={messages}
            variant="details"
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}

