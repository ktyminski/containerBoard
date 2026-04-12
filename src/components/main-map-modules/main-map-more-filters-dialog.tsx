"use client";

import { useState, type ReactNode } from "react";

export type MainMapMoreFiltersOption = {
  value: string;
  label: string;
};

export type MainMapMoreFiltersOptionGroup = {
  id: string;
  title: string;
  options: MainMapMoreFiltersOption[];
  emptyMessage?: string;
};

export type MainMapMoreFiltersSection = {
  id: string;
  title: string;
  options: MainMapMoreFiltersOption[];
  groups?: MainMapMoreFiltersOptionGroup[];
  activeFiltersLabel?: string;
  selectedValues: string[];
  onToggle: (value: string) => void;
  emptyMessage?: string;
};

type MainMapMoreFiltersDialogProps = {
  title: string;
  subtitle: string;
  topContent?: ReactNode;
  clearLabel: string;
  cancelLabel: string;
  saveLabel: string;
  sections: MainMapMoreFiltersSection[];
  onClear: () => void;
  onCancel: () => void;
  onSave: () => void;
};

export function MainMapMoreFiltersDialog({
  title,
  subtitle,
  topContent,
  clearLabel,
  cancelLabel,
  saveLabel,
  sections,
  onClear,
  onCancel,
  onSave,
}: MainMapMoreFiltersDialogProps) {
  const [collapsedSections, setCollapsedSections] = useState<
    Record<string, boolean>
  >({
    "company-specializations": true,
  });

  function toggleSection(sectionId: string) {
    setCollapsedSections((current) => ({
      ...current,
      [sectionId]: !current[sectionId],
    }));
  }

  return (
    <div className="relative z-10 my-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-neutral-700 bg-neutral-900 shadow-2xl">
      <div className="shrink-0 border-b border-neutral-800 px-4 py-3">
        <p className="text-sm font-semibold text-neutral-100">{title}</p>
        <p className="mt-1 text-xs text-neutral-400">{subtitle}</p>
      </div>

      {topContent ? (
        <div className="shrink-0 border-b border-neutral-800 px-4 py-3 lg:hidden">
          {topContent}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div
          className={`grid items-start gap-4 p-4 ${sections.length > 1 ? "md:grid-cols-2" : ""}`}
        >
          {sections.map((section) => {
            const isSpecializationsSection =
              section.id === "company-specializations";
            const isCollapsed =
              isSpecializationsSection && collapsedSections[section.id];

            return (
              <div
                key={section.id}
                className={`grid self-start gap-2 p-3 rounded-lg border border-neutral-800 bg-neutral-950/60 ${
                  section.groups && section.groups.length > 0
                    ? "md:col-span-2"
                    : ""
                }`}
              >
                {isSpecializationsSection ? (
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 rounded-md p-3 px-2 py-1 text-left transition-colors"
                    aria-expanded={!isCollapsed}
                    onClick={() => toggleSection(section.id)}
                  >
                    <span className="text-sm font-medium text-neutral-200">
                      {section.title}
                    </span>
                    <span className="flex items-center gap-2 text-xs text-neutral-400">
                      <span>
                        {section.activeFiltersLabel ?? "Active filters"}:{" "}
                        {section.selectedValues.length}
                      </span>
                      <svg
                        className={`h-4 w-4 shrink-0 text-neutral-500 transition-transform ${
                          isCollapsed ? "rotate-0" : "rotate-180"
                        }`}
                        viewBox="0 0 20 20"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M5 7.5L10 12.5L15 7.5"
                          stroke="currentColor"
                          strokeWidth="1.75"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </button>
                ) : (
                  <p className="text-sm font-medium text-neutral-200">
                    {section.title}
                  </p>
                )}
                {!isCollapsed ? (
                  section.groups && section.groups.length > 0 ? (
                    <div className="grid gap-3">
                      {section.groups.map((group) => (
                        <div
                          key={`${section.id}-${group.id}`}
                          className="grid gap-2 rounded-md border border-neutral-800/80 bg-neutral-950/70 p-2.5"
                        >
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                            {group.title}
                          </p>
                          {group.options.length > 0 ? (
                            <div className="grid gap-1.5 sm:grid-cols-2">
                              {group.options.map((option) => (
                                <label
                                  key={`${section.id}-${group.id}-${option.value}`}
                                  className="flex cursor-pointer items-center gap-2 px-1.5 py-1 text-sm text-neutral-300"
                                >
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 shrink-0 cursor-pointer rounded border-neutral-600 bg-neutral-950 text-sky-500 accent-sky-400 [color-scheme:dark]"
                                    checked={section.selectedValues.includes(
                                      option.value,
                                    )}
                                    onChange={() => {
                                      section.onToggle(option.value);
                                    }}
                                  />
                                  <span>{option.label}</span>
                                </label>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-neutral-500">
                              {group.emptyMessage ??
                                section.emptyMessage ??
                                "-"}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : section.options.length > 0 ? (
                    section.options.map((option) => (
                      <label
                        key={`${section.id}-${option.value}`}
                        className="flex cursor-pointer items-center gap-2 text-sm text-neutral-300"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 shrink-0 cursor-pointer rounded border-neutral-600 bg-neutral-950 text-sky-500 accent-sky-400 [color-scheme:dark]"
                          checked={section.selectedValues.includes(
                            option.value,
                          )}
                          onChange={() => {
                            section.onToggle(option.value);
                          }}
                        />
                        <span>{option.label}</span>
                      </label>
                    ))
                  ) : (
                    <p className="text-xs text-neutral-500">
                      {section.emptyMessage ?? "-"}
                    </p>
                  )
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="shrink-0 flex items-center justify-between border-t border-neutral-800 px-4 py-3">
        <button
          type="button"
          className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-200 hover:border-neutral-500"
          onClick={onClear}
        >
          {clearLabel}
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-200 hover:border-neutral-500"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="rounded-md bg-sky-500 px-3 py-2 text-sm font-medium text-neutral-950 hover:bg-sky-400"
            onClick={onSave}
          >
            {saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

