import type { UseFormRegister } from "react-hook-form";
import type { AppMessages } from "@/lib/i18n";
import type { JobAnnouncementFormValues } from "@/components/new-job-announcement-form/types";

type RequirementsModalProps = {
  isOpen: boolean;
  messages: AppMessages["announcementCreate"];
  requirementOptions: Array<{ value: string; label: string }>;
  register: UseFormRegister<JobAnnouncementFormValues>;
  onClose: () => void;
};

export function RequirementsModal({
  isOpen,
  messages,
  requirementOptions,
  register,
  onClose,
}: RequirementsModalProps) {
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
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              {messages.requirementsModalTitle}
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
        <div className="grid max-h-[60vh] gap-2 overflow-auto p-4 pr-5 sm:grid-cols-2">
          {requirementOptions.map((requirement) => (
            <label
              key={requirement.value}
              className="flex items-start gap-2 rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            >
              <input
                type="checkbox"
                value={requirement.value}
                className="mt-0.5 h-4 w-4 rounded border-slate-500 bg-slate-800 text-sky-400 accent-sky-400 focus:ring-sky-500 [color-scheme:dark]"
                {...register("requirements")}
              />
              <span>{requirement.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}


