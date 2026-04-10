import type { AppMessages } from "@/lib/i18n";

type ExternalLinksModalProps = {
  open: boolean;
  messages: AppMessages["offerCreate"];
  draft: string;
  errorMessage?: string;
  onDraftChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
};

export function ExternalLinksModal({
  open,
  messages,
  draft,
  errorMessage,
  onDraftChange,
  onClose,
  onConfirm,
}: ExternalLinksModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto [&>div:not(.fixed)]:my-auto [&>div:not(.fixed)]:max-h-[calc(100dvh-2rem)] [&>div:not(.fixed)]:!overflow-y-auto p-4">
      <div
        className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-2xl">
        <h3 className="text-sm font-semibold text-slate-100">{messages.externalLinksTitle}</h3>
        <label className="mt-3 grid gap-1 text-xs">
          <span className="text-slate-300">{messages.externalLinksPlaceholder}</span>
          <input
            value={draft}
            onChange={(event) => {
              onDraftChange(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onConfirm();
              }
            }}
            placeholder={messages.externalLinksPlaceholder}
            autoFocus
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          />
        </label>
        {errorMessage ? <p className="mt-2 text-xs text-rose-300">{errorMessage}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500"
            onClick={onClose}
          >
            {messages.previewClose}
          </button>
          <button
            type="button"
            className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-medium text-slate-950 hover:bg-emerald-400"
            onClick={onConfirm}
          >
            + {messages.externalLinksAdd}
          </button>
        </div>
      </div>
    </div>
  );
}


