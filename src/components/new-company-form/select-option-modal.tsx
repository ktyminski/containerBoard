"use client";

import type { UseFormRegister } from "react-hook-form";
import type { NewCompanyFormValues } from "@/components/new-company-form/types";

type SelectOptionModalProps = {
  isOpen: boolean;
  title: string;
  subtitle: string;
  closeLabel: string;
  options: Array<{ value: string; label: string }>;
  register: UseFormRegister<NewCompanyFormValues>;
  fieldName: "benefits" | "communicationLanguages" | "specializations";
  onClose: () => void;
};

export function SelectOptionModal({
  isOpen,
  title,
  subtitle,
  closeLabel,
  options,
  register,
  fieldName,
  onClose,
}: SelectOptionModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto [&>div:not(.fixed)]:my-auto [&>div:not(.fixed)]:max-h-[calc(100dvh-2rem)] [&>div:not(.fixed)]:!overflow-y-auto bg-slate-950/80 p-4">
      <div className="w-full max-w-3xl rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
            <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
          </div>
          <button
            type="button"
            className="cursor-pointer rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500"
            onClick={onClose}
          >
            {closeLabel}
          </button>
        </div>
        <div className="mt-4 grid max-h-[60vh] gap-2 overflow-auto pr-1 sm:grid-cols-2">
          {options.map((option) => (
            <label
              key={option.value}
              className="flex items-start gap-2 rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            >
              <input
                type="checkbox"
                value={option.value}
                className="mt-0.5 h-4 w-4 rounded border-slate-500 bg-slate-800 text-sky-400 accent-sky-400 focus:ring-sky-500 [color-scheme:dark]"
                {...register(fieldName)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}


