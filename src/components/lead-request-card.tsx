"use client";

import {
  CountryFlag,
  getTransportModeIcon,
  getTransportModeLabel,
  type LeadRequestBoardItem,
} from "@/components/lead-requests-board.shared";
import {
  LEAD_REQUEST_STATUS,
  LEAD_REQUEST_TYPE,
} from "@/lib/lead-request-types";
import type { AppMessages } from "@/lib/i18n";

export type LeadRequestCardItem = LeadRequestBoardItem & {
  createdAtLabel: string;
  expiresAtLabel: string;
};

type LeadRequestCardProps = {
  item: LeadRequestCardItem;
  activeTab: "all" | "mine";
  canSeeContact: boolean;
  messages: AppMessages["leadRequestsPage"];
  onShowDetails?: (item: LeadRequestCardItem) => void;
  onEdit?: (item: LeadRequestBoardItem) => void;
  onDelete?: (id: string) => void;
  variant?: "list" | "details";
};

export function LeadRequestCard({
  item,
  activeTab,
  canSeeContact,
  messages,
  onShowDetails,
  onEdit,
  onDelete,
  variant = "list",
}: LeadRequestCardProps) {
  const isDetailsVariant = variant === "details";
  const containerClass = isDetailsVariant
    ? "grid min-w-0 gap-3"
    : "grid min-w-0 gap-3 rounded-xl border border-slate-700 bg-slate-800/70 p-5 shadow-[0_10px_30px_rgba(15,23,42,0.18)]";

  return (
    <article className={containerClass}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-md border border-cyan-500/60 bg-cyan-500/15 px-2 py-1 text-xs font-semibold text-cyan-200">
            {item.leadType === LEAD_REQUEST_TYPE.TRANSPORT
              ? messages.typeTransport
              : messages.typeOther}
          </span>
          {activeTab === "mine" ? (
            <span
              className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${
                item.status === LEAD_REQUEST_STATUS.ACTIVE
                  ? "border-emerald-600/70 bg-emerald-500/10 text-emerald-200"
                  : item.status === LEAD_REQUEST_STATUS.EXPIRED
                    ? "border-amber-600/70 bg-amber-500/10 text-amber-200"
                    : "border-slate-600/70 bg-slate-500/10 text-slate-200"
              }`}
            >
              {item.status === LEAD_REQUEST_STATUS.ACTIVE
                ? messages.statusActive
                : item.status === LEAD_REQUEST_STATUS.EXPIRED
                  ? messages.statusExpired
                  : messages.statusPending}
            </span>
          ) : null}
        </div>
        <div className="grid w-full min-w-0 gap-1 text-left text-xs text-slate-400 sm:w-auto sm:text-right">
          <p>
            {messages.createdAtLabel}: {item.createdAtLabel}
          </p>
          <p>
            {messages.expiresAtLabel}: {item.expiresAtLabel}
          </p>
        </div>
      </div>

      {item.leadType === LEAD_REQUEST_TYPE.TRANSPORT ? (
        <div className="grid min-w-0 gap-2 md:flex md:flex-wrap md:items-stretch">
          <div className="w-full min-w-0 rounded-xl border border-sky-700/40 bg-sky-500/10 p-4 md:flex-[1_1_16rem]">
            <p className="mb-2 text-xs font-semibold tracking-wide text-sky-200 uppercase">
              {messages.routeLabel}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-slate-100">
              <div className="flex min-w-0 max-w-full flex-1 basis-full items-center gap-2 sm:basis-auto">
                <CountryFlag countryCode={item.originCountryCode} />
                <span className="min-w-0 flex-1 truncate font-medium">{item.originLocation || "-"}</span>
              </div>
              <p className="hidden text-xs text-slate-300 sm:block">{messages.routeSeparator}</p>
              <div className="flex min-w-0 max-w-full flex-1 basis-full items-center gap-2 sm:basis-auto">
                <CountryFlag countryCode={item.destinationCountryCode} />
                <span className="min-w-0 flex-1 truncate font-medium">{item.destinationLocation || "-"}</span>
              </div>
            </div>
          </div>
          <div className="flex w-full min-w-0 flex-col justify-center gap-2 rounded-lg border border-emerald-700/40 bg-emerald-500/10 px-3 py-2 md:w-[250px] md:flex-none">
            <p className="text-[11px] font-semibold tracking-wide text-emerald-200 uppercase">
              {messages.transportModeLabel}
            </p>
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-100">
              <span className="text-emerald-200">{getTransportModeIcon(item.transportMode)}</span>
              <span>{getTransportModeLabel(item.transportMode, messages)}</span>
            </div>
          </div>
        </div>
      ) : null}

      <p
        className={`text-sm leading-6 whitespace-pre-wrap break-words text-slate-100 ${
          isDetailsVariant ? "" : "overflow-hidden"
        }`}
        style={
          isDetailsVariant
            ? undefined
            : {
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: 3,
              }
        }
      >
        {item.description}
      </p>

      {item.isExpired ? <p className="text-xs text-amber-300">{messages.expiredHint}</p> : null}

      {isDetailsVariant ? (
        <div className="grid gap-2 rounded-lg border border-slate-700 bg-slate-900/70 p-3 text-sm md:grid-cols-2">
          <div>
            <p className="text-slate-400">{messages.phoneLabel}</p>
            {canSeeContact ? (
              <p className="mt-1 text-slate-100">{item.contactPhone || messages.noContactData}</p>
            ) : (
              <p className="mt-1 text-slate-500">{messages.contactHidden}</p>
            )}
          </div>
          <div>
            <p className="text-slate-400">{messages.emailLabel}</p>
            {canSeeContact ? (
              item.contactEmail ? (
                <a
                  href={`mailto:${item.contactEmail}`}
                  className="mt-1 inline-flex break-all text-sky-300 underline decoration-sky-500/60 underline-offset-4 hover:text-sky-200"
                >
                  {item.contactEmail}
                </a>
              ) : (
                <p className="mt-1 text-slate-100">{messages.noContactData}</p>
              )
            ) : (
              <p className="mt-1 text-slate-500">{messages.contactHidden}</p>
            )}
          </div>
        </div>
      ) : null}

      {variant === "list" ? (
        <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
          <button
            type="button"
            onClick={() => onShowDetails?.(item)}
            className="rounded-md border border-slate-600 px-3 py-1.5 text-slate-200 hover:border-slate-500"
          >
            {messages.detailsAction}
          </button>
          {activeTab === "mine" ? (
            <button
              type="button"
              onClick={() => onEdit?.(item)}
              className="rounded-md border border-slate-600 px-3 py-1.5 text-slate-200 hover:border-slate-500"
            >
              {messages.editAction}
            </button>
          ) : null}
          {activeTab === "mine" ? (
            <button
              type="button"
              onClick={() => onDelete?.(item.id)}
              className="rounded-md border border-slate-600 px-3 py-1.5 text-slate-200 hover:border-slate-500"
            >
              {messages.deleteAction}
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
