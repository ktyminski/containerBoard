"use client";

import { useState } from "react";
import type { AppMessages } from "@/lib/i18n";
import type { MailPreviewCase } from "@/lib/mail-preview-cases";

type AdminMailPreviewsPanelProps = {
  messages: AppMessages["adminMailPreviews"];
  previewCases: MailPreviewCase[];
  initialTemplateId?: string;
};

function resolveInitialCase(
  previewCases: MailPreviewCase[],
  initialTemplateId?: string,
): MailPreviewCase | null {
  if (previewCases.length === 0) {
    return null;
  }

  return (
    previewCases.find((previewCase) => previewCase.id === initialTemplateId) ??
    previewCases[0]
  );
}

export function AdminMailPreviewsPanel({
  messages,
  previewCases,
  initialTemplateId,
}: AdminMailPreviewsPanelProps) {
  const initialCase = resolveInitialCase(previewCases, initialTemplateId);
  const [selectedCaseId, setSelectedCaseId] = useState(initialCase?.id ?? "");

  const selectedCase =
    previewCases.find((previewCase) => previewCase.id === selectedCaseId) ??
    initialCase;

  if (!selectedCase) {
    return null;
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-3">
        <p className="px-2 pb-2 text-xs uppercase tracking-[0.12em] text-neutral-400">
          {messages.templates}
        </p>
        <nav className="flex flex-col gap-1">
          {previewCases.map((previewCase) => {
            const isActive = previewCase.id === selectedCase.id;
            return (
              <button
                key={previewCase.id}
                type="button"
                onClick={() => {
                  setSelectedCaseId(previewCase.id);
                }}
                className={[
                  "rounded-md border px-3 py-2 text-left text-sm transition",
                  isActive
                    ? "border-sky-500/60 bg-sky-500/10 text-sky-200"
                    : "border-neutral-800 text-neutral-300 hover:border-neutral-600 hover:text-neutral-100",
                ].join(" ")}
              >
                <span className="block font-medium">{previewCase.label}</span>
                <span className="mt-0.5 block text-xs text-neutral-400">
                  {previewCase.description}
                </span>
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-col gap-4">
        <article className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-neutral-400">
            {messages.subject}
          </p>
          <p className="mt-1 text-lg font-semibold text-neutral-100">
            {selectedCase.content.subject}
          </p>
          <p className="mt-3 text-xs uppercase tracking-[0.12em] text-neutral-400">
            {messages.mockedRecipient}
          </p>
          <p className="mt-1 text-sm text-neutral-300">{selectedCase.mockedRecipient}</p>
        </article>

        <article className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
          <p className="mb-3 text-xs uppercase tracking-[0.12em] text-neutral-400">
            {messages.html}
          </p>
          <div className="overflow-hidden rounded-lg border border-neutral-700 bg-white">
            <iframe
              title={messages.frameTitle.replace("{label}", selectedCase.label)}
              sandbox=""
              srcDoc={selectedCase.content.html}
              className="h-[760px] w-full"
            />
          </div>
        </article>

        <article className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
          <p className="mb-3 text-xs uppercase tracking-[0.12em] text-neutral-400">
            {messages.textVersion}
          </p>
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-neutral-700 bg-neutral-950 p-3 text-xs leading-6 text-neutral-200">
            {selectedCase.content.text}
          </pre>
        </article>
      </div>
    </section>
  );
}
