import type { AppMessages } from "@/lib/i18n";

type PlanSelectionModalProps = {
  isOpen: boolean;
  messages: AppMessages["announcementCreate"];
  onClose: () => void;
  onChooseBasic: () => void;
};

export function PlanSelectionModal({
  isOpen,
  messages,
  onClose,
  onChooseBasic,
}: PlanSelectionModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto [&>div:not(.fixed)]:my-auto [&>div:not(.fixed)]:max-h-[calc(100dvh-2rem)] [&>div:not(.fixed)]:!overflow-y-auto p-4">
      <div
        className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-3xl overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
              {messages.formSubmit}
            </p>
            <h3 className="text-sm font-semibold text-slate-100">
              {messages.planStepTitle}
            </h3>
          </div>
          <button
            type="button"
            className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500"
            onClick={onClose}
          >
            {messages.requirementsModalClose}
          </button>
        </div>

        <div className="grid gap-3 p-4 md:grid-cols-3">
          <article className="rounded-xl border border-emerald-700/70 bg-emerald-950/20 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-emerald-300">
              {messages.planBasicName}
            </p>
            <p className="mt-2 text-sm text-emerald-100/90">
              {messages.planBasicDescription}
            </p>
            <button
              type="button"
              className="mt-4 rounded-md bg-emerald-500 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400"
              onClick={onChooseBasic}
            >
              {messages.planChoose}
            </button>
          </article>

          <article className="rounded-xl border border-slate-700 bg-slate-900/80 p-4 opacity-80">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-200">
                {messages.planPlusName}
              </p>
              <span className="rounded-md border border-amber-700 px-2 py-1 text-[10px] text-amber-200">
                {messages.planUnavailable}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-300">
              {messages.planPlusDescription}
            </p>
          </article>

          <article className="rounded-xl border border-slate-700 bg-slate-900/80 p-4 opacity-80">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-200">
                {messages.planPremiumName}
              </p>
              <span className="rounded-md border border-amber-700 px-2 py-1 text-[10px] text-amber-200">
                {messages.planUnavailable}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-300">
              {messages.planPremiumDescription}
            </p>
          </article>
        </div>
      </div>
    </div>
  );
}


