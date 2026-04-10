"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { MainMapMoreFiltersDialog, type MainMapMoreFiltersSection } from "@/components/main-map-modules/main-map-more-filters-dialog";

type MainMapMoreFiltersModalProps = {
  isClient: boolean;
  isOpen: boolean;
  title: string;
  subtitle: string;
  topContent?: ReactNode;
  clearLabel: string;
  cancelLabel: string;
  saveLabel: string;
  sections: MainMapMoreFiltersSection[];
  onClose: () => void;
  onClear: () => void;
  onSave: () => void;
};

export function MainMapMoreFiltersModal({
  isClient,
  isOpen,
  title,
  subtitle,
  topContent,
  clearLabel,
  cancelLabel,
  saveLabel,
  sections,
  onClose,
  onClear,
  onSave,
}: MainMapMoreFiltersModalProps) {
  if (!isClient || !isOpen) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto [&>div:not(.fixed)]:my-auto [&>div:not(.fixed)]:max-h-[calc(100dvh-2rem)] [&>div:not(.fixed)]:!overflow-y-auto p-4">
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
        aria-hidden="true"
        onClick={onClose}
      />
      <MainMapMoreFiltersDialog
        title={title}
        subtitle={subtitle}
        topContent={topContent}
        clearLabel={clearLabel}
        cancelLabel={cancelLabel}
        saveLabel={saveLabel}
        sections={sections}
        onClear={onClear}
        onCancel={onClose}
        onSave={onSave}
      />
    </div>,
    document.body,
  );
}

