"use client";

import Link from "next/link";
import { useState } from "react";
import { PublicationRowActions } from "@/components/publication-row-actions";

type CompanyPanelPublicationItemProps = {
  entity: "announcements" | "offers";
  itemId: string;
  title: string;
  createdAtLabel: string;
  isPublished: boolean;
  publishedStatusLabel: string;
  suspendedStatusLabel: string;
  createdLabel: string;
  openHref: string;
  openLabel: string;
  editHref: string;
  editLabel: string;
  publishLabel: string;
  suspendLabel: string;
  deleteLabel: string;
  publishSuccessMessage: string;
  suspendSuccessMessage: string;
  deleteSuccessMessage: string;
  confirmDeleteText: string;
  unknownError: string;
  showActions: boolean;
  typeBadgeLabel?: string;
};

export function CompanyPanelPublicationItem({
  entity,
  itemId,
  title,
  createdAtLabel,
  isPublished,
  publishedStatusLabel,
  suspendedStatusLabel,
  createdLabel,
  openHref,
  openLabel,
  editHref,
  editLabel,
  publishLabel,
  suspendLabel,
  deleteLabel,
  publishSuccessMessage,
  suspendSuccessMessage,
  deleteSuccessMessage,
  confirmDeleteText,
  unknownError,
  showActions,
  typeBadgeLabel,
}: CompanyPanelPublicationItemProps) {
  const [currentIsPublished, setCurrentIsPublished] = useState(isPublished);
  const [isDeleted, setIsDeleted] = useState(false);

  if (isDeleted) {
    return null;
  }

  return (
    <article className="min-w-0 rounded-md border border-slate-800 bg-slate-900/70 px-3 py-2">
      {typeBadgeLabel ? (
        <div className="flex items-start justify-between gap-2 overflow-hidden">
          <div className="min-w-0 flex-1 overflow-hidden">
            <p
              className="w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold leading-tight text-slate-100"
              title={title}
            >
              {title}
            </p>
          </div>
          <span className="inline-flex shrink-0 rounded-md border border-cyan-500/60 bg-cyan-500/15 px-2 py-0.5 text-[11px] font-semibold text-cyan-200">
            {typeBadgeLabel}
          </span>
        </div>
      ) : (
        <div className="min-w-0 overflow-hidden">
          <p
            className="w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold leading-tight text-slate-100"
            title={title}
          >
            {title}
          </p>
        </div>
      )}
      <div className="mt-1 flex justify-end text-[11px]">
        <p className="min-w-0 text-right text-slate-400">
          <span className={currentIsPublished ? "text-slate-400" : "font-medium text-amber-300"}>
            {currentIsPublished ? publishedStatusLabel : suspendedStatusLabel}
          </span>
          {" - "}
          <span>
            {createdLabel}: {createdAtLabel}
          </span>
        </p>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center justify-end gap-2 text-xs">
        <Link href={openHref} className="text-slate-300 hover:text-slate-100">
          {openLabel}
        </Link>
        <Link href={editHref} className="text-slate-300 hover:text-slate-100">
          {editLabel}
        </Link>
        {showActions ? (
          <PublicationRowActions
            entity={entity}
            itemId={itemId}
            isPublished={currentIsPublished}
            publishLabel={publishLabel}
            suspendLabel={suspendLabel}
            deleteLabel={deleteLabel}
            publishSuccessMessage={publishSuccessMessage}
            suspendSuccessMessage={suspendSuccessMessage}
            deleteSuccessMessage={deleteSuccessMessage}
            confirmDeleteText={confirmDeleteText}
            unknownError={unknownError}
            tone="muted"
            refreshOnSuccess={false}
            onStatusChanged={async (nextPublished) => {
              setCurrentIsPublished(nextPublished);
            }}
            onDeleted={async () => {
              setIsDeleted(true);
            }}
          />
        ) : null}
      </div>
    </article>
  );
}
