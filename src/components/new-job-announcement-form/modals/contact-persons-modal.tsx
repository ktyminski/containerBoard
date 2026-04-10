import type { AppMessages } from "@/lib/i18n";
import type { JobAnnouncementContactDraft } from "@/components/new-job-announcement-form/types";

type ContactPersonsModalProps = {
  isOpen: boolean;
  messages: AppMessages["announcementCreate"];
  draft: JobAnnouncementContactDraft;
  maxReached: boolean;
  errorMessage?: string;
  onClose: () => void;
  onDraftChange: (next: JobAnnouncementContactDraft) => void;
  onSubmitDraft: () => void;
  onClearError: () => void;
};

export function ContactPersonsModal({
  isOpen,
  messages,
  draft,
  maxReached,
  errorMessage,
  onClose,
  onDraftChange,
  onSubmitDraft,
  onClearError,
}: ContactPersonsModalProps) {
  if (!isOpen) {
    return null;
  }

  const updateDraft = (patch: Partial<JobAnnouncementContactDraft>) => {
    onClearError();
    onDraftChange({
      ...draft,
      ...patch,
    });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto [&>div:not(.fixed)]:my-auto [&>div:not(.fixed)]:max-h-[calc(100dvh-2rem)] [&>div:not(.fixed)]:!overflow-y-auto p-4">
      <div
        className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              {messages.contactPeopleTitle}
            </h3>
            <p className="mt-1 text-xs text-slate-400">{messages.contactPeopleHint}</p>
          </div>
          <button
            type="button"
            className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500"
            onClick={onClose}
          >
            {messages.requirementsModalClose}
          </button>
        </div>
        <div className="grid max-h-[60vh] gap-3 overflow-auto p-4 pr-5">
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={draft.name}
              onChange={(event) => {
                updateDraft({ name: event.target.value });
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onSubmitDraft();
                }
              }}
              placeholder={messages.contactPersonName}
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />
            <input
              value={draft.email}
              onChange={(event) => {
                updateDraft({ email: event.target.value });
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onSubmitDraft();
                }
              }}
              placeholder={messages.contactPersonEmail}
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />
            <input
              value={draft.phone}
              onChange={(event) => {
                updateDraft({ phone: event.target.value });
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onSubmitDraft();
                }
              }}
              placeholder={messages.contactPersonPhone}
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 sm:col-span-2"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              className="rounded-md bg-sky-500 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={maxReached}
              onClick={onSubmitDraft}
            >
              + {messages.contactPeopleAdd}
            </button>
          </div>
          {errorMessage ? (
            <p className="text-xs text-rose-300">{errorMessage}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}


