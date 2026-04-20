"use client";

import type { ReactNode } from "react";
import type { ContainerModuleMessages } from "@/components/container-modules-i18n";

type ContactPublishModalProps = {
  isOpen: boolean;
  hasOwnedCompanyProfile: boolean;
  onClose: () => void;
  submitLabel: string;
  isSubmitting: boolean;
  isProcessingImages: boolean;
  isCreatePublishReady: boolean;
  createSubmitButtonClass: string;
  createSubmitInactiveButtonClass: string;
  onConfirm: () => void;
  publishAsCompanyToggle?: ReactNode;
  companyNameField: ReactNode;
  contactEmailField: ReactNode;
  contactPhoneField: ReactNode;
  messages: ContainerModuleMessages["dialogs"];
};

export function ContactPublishModal({
  isOpen,
  hasOwnedCompanyProfile,
  onClose,
  submitLabel,
  isSubmitting,
  isProcessingImages,
  isCreatePublishReady,
  createSubmitButtonClass,
  createSubmitInactiveButtonClass,
  onConfirm,
  publishAsCompanyToggle,
  companyNameField,
  contactEmailField,
  contactPhoneField,
  messages,
}: ContactPublishModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-[rgba(2,6,23,0.5)] p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label={messages.contactDialogAria}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-xl rounded-xl border border-neutral-700 bg-neutral-900 p-4 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-neutral-100">
            {messages.contactDialogTitle}
          </h3>
          <button
            type="button"
            className="rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:border-neutral-500"
            onClick={onClose}
          >
            {messages.close}
          </button>
        </div>

        <p className="mb-4 text-xs text-neutral-400">
          {messages.contactDialogHint}
        </p>

        <div className="grid gap-4">
          {hasOwnedCompanyProfile ? publishAsCompanyToggle : null}
          {companyNameField}
          {contactEmailField}
          {contactPhoneField}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-200 hover:border-neutral-500"
            onClick={onClose}
          >
            {messages.backToForm}
          </button>
          <button
            type="button"
            disabled={isSubmitting || isProcessingImages}
            className={
              isCreatePublishReady
                ? createSubmitButtonClass
                : createSubmitInactiveButtonClass
            }
            aria-disabled={!isCreatePublishReady}
            onClick={onConfirm}
          >
            {isSubmitting || isProcessingImages ? messages.saving : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

type PublishSuccessModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onGoToMine: () => void;
  messages: ContainerModuleMessages["dialogs"];
};

export function PublishSuccessModal({
  isOpen,
  onClose,
  onGoToMine,
  messages,
}: PublishSuccessModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center overflow-y-auto bg-[rgba(2,6,23,0.58)] p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label={messages.successDialogAria}
      onMouseDown={(event) => {
        if (event.target !== event.currentTarget) {
          return;
        }
        onClose();
      }}
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-xl border border-neutral-700 bg-neutral-900 p-5 shadow-2xl">
        <div aria-hidden="true" className="cb-success-burst">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
        <h3 className="relative z-10 text-base font-semibold text-emerald-700">
          {messages.successTitle}
        </h3>
        <p className="relative z-10 mt-2 text-sm text-neutral-300">
          {messages.successQuestion}
        </p>

        <div className="relative z-10 mt-5 grid gap-2">
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-md border border-neutral-400 bg-white px-4 text-sm font-medium text-neutral-700 transition hover:border-neutral-500"
            onClick={onGoToMine}
          >
            {messages.successGoToMine}
          </button>
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-md border border-neutral-300 bg-neutral-100 px-4 text-sm font-medium text-neutral-800 transition hover:bg-neutral-200"
            onClick={onClose}
          >
            {messages.successAddSimilar}
          </button>
        </div>
      </div>
    </div>
  );
}
