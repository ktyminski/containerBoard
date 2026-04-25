"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useToast } from "@/components/toast-provider";
import { SelectWithChevron } from "@/components/ui/select-with-chevron";
import { formatTemplate, type AppMessages } from "@/lib/i18n";

type AdminBulkImportCompanyOption = {
  id: string;
  name: string;
};

type BulkUploadResponse = {
  createdCount?: number;
  failedCount?: number;
  totalRows?: number;
  maxRows?: number;
  failures?: Array<{
    rowNumber: number;
    error: string;
  }>;
  error?: string;
  message?: string;
};

type AdminBulkImportPanelProps = {
  companies: AdminBulkImportCompanyOption[];
  moduleMessages: AppMessages["containerModules"];
  usersMessages: AppMessages["adminUsers"];
};

const ADMIN_BUTTON_CLASS =
  "inline-flex h-10 items-center justify-center rounded-md border border-neutral-600 bg-neutral-800/90 px-3 text-sm font-medium text-neutral-100 transition hover:border-neutral-500 hover:bg-neutral-700/90 disabled:cursor-not-allowed disabled:opacity-50";

export function AdminBulkImportPanel({
  companies,
  moduleMessages,
  usersMessages,
}: AdminBulkImportPanelProps) {
  const toast = useToast();
  const messages = moduleMessages.myListings;
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkReport, setBulkReport] = useState<BulkUploadResponse | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const templateHref = useMemo(() => {
    if (!selectedCompanyId) {
      return "";
    }
    const params = new URLSearchParams({ adminCompanyId: selectedCompanyId });
    return `/api/containers/bulk/template?${params.toString()}`;
  }, [selectedCompanyId]);

  async function handleBulkImport() {
    if (!selectedCompanyId) {
      toast.error(usersMessages.selectCompany);
      return;
    }
    if (!bulkFile) {
      toast.error(messages.selectExcelFirst);
      return;
    }

    const filename = bulkFile.name.trim().toLowerCase();
    if (!filename.endsWith(".xlsx") && !filename.endsWith(".xls")) {
      toast.error(messages.excelOnly);
      return;
    }

    setIsImporting(true);
    try {
      const formData = new FormData();
      formData.set("file", bulkFile);
      formData.set("adminCompanyId", selectedCompanyId);

      const response = await fetch("/api/containers/bulk", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json().catch(() => null)) as BulkUploadResponse | null;
      if (!response.ok) {
        throw new Error(
          data?.error ??
            data?.message ??
            formatTemplate(messages.bulkImportErrorWithStatus, {
              status: response.status,
            }),
        );
      }

      setBulkReport(data ?? null);
      const createdCount = data?.createdCount ?? 0;
      const failedCount = data?.failedCount ?? 0;
      if (createdCount > 0) {
        toast.success(formatTemplate(messages.bulkCreated, { count: createdCount }));
      }
      if (failedCount > 0) {
        toast.warning(formatTemplate(messages.bulkFailedRows, { count: failedCount }));
      }
      if (createdCount === 0 && failedCount === 0) {
        toast.warning(messages.bulkNoRows);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : messages.bulkImportError);
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
      <div className="grid gap-4">
        <div className="grid gap-1">
          <h2 className="text-lg font-semibold text-neutral-100">
            {messages.bulkModalTitle}
          </h2>
          <p className="text-sm text-neutral-300">{messages.bulkSelfDescriptionIntro}</p>
          <p className="text-sm text-neutral-300">{messages.bulkSupportLine}</p>
          <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-300">
            <span>{messages.bulkPhotosSupportLine}</span>
            <Link
              href="/contact"
              className="inline-flex items-center text-sm font-medium text-sky-300 underline underline-offset-4 transition hover:text-sky-200"
            >
              {messages.bulkConciergeButton}
            </Link>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end">
          <label className="grid gap-1">
            <span className="text-sm font-medium text-neutral-200">
              {usersMessages.selectCompany}
            </span>
            <SelectWithChevron
              value={selectedCompanyId}
              onChange={(event) => {
                setSelectedCompanyId(event.target.value);
                setBulkReport(null);
              }}
              wrapperClassName="w-full"
              className="border-neutral-700 bg-neutral-950 text-neutral-100"
            >
              <option value="">{usersMessages.selectCompany}</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </SelectWithChevron>
          </label>

          <button
            type="button"
            disabled={!selectedCompanyId}
            onClick={() => {
              if (!templateHref) {
                toast.error(usersMessages.selectCompany);
                return;
              }
              window.location.href = templateHref;
            }}
            className={ADMIN_BUTTON_CLASS}
          >
            {messages.downloadExcelTemplate}
          </button>

          <label className={`${ADMIN_BUTTON_CLASS} cursor-pointer`}>
            <input
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setBulkFile(file);
                setBulkReport(null);
              }}
            />
            {messages.chooseFile}
          </label>
        </div>

        <p className="text-sm text-neutral-400">
          {bulkFile ? bulkFile.name : messages.noFileSelected}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              void handleBulkImport();
            }}
            disabled={isImporting}
            className={ADMIN_BUTTON_CLASS}
          >
            {isImporting ? messages.importing : messages.importListings}
          </button>
        </div>

        {bulkReport ? (
          <div className="rounded-md border border-neutral-800 bg-neutral-950/70 p-3 text-sm text-neutral-200">
            <p className="font-medium">
              {formatTemplate(messages.importedSummary, {
                created: bulkReport.createdCount ?? 0,
                total: bulkReport.totalRows ?? 0,
              })}
            </p>
            {(bulkReport.failedCount ?? 0) > 0 ? (
              <ul className="mt-2 grid gap-1 text-rose-200">
                {(bulkReport.failures ?? []).slice(0, 10).map((failure) => (
                  <li key={`${failure.rowNumber}-${failure.error}`}>
                    {formatTemplate(messages.rowError, {
                      row: failure.rowNumber,
                      error: failure.error,
                    })}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
