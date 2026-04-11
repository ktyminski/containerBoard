"use client";

import Link from "next/link";
import { useState } from "react";
import { useToast } from "@/components/toast-provider";
import { withLang, type AppLocale, type AppMessages } from "@/lib/i18n";

type UserSettingsAssignedCompaniesProps = {
  locale: AppLocale;
  messages: AppMessages["settingsPage"];
  companies: Array<{
    id: string;
    name: string;
    slug: string;
    isBlocked: boolean;
  }>;
};

export function UserSettingsAssignedCompanies({
  locale,
  messages,
  companies,
}: UserSettingsAssignedCompaniesProps) {
  const toast = useToast();
  const [assignedCompanies, setAssignedCompanies] = useState(companies);
  const [confirmCompany, setConfirmCompany] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [pendingCompanyId, setPendingCompanyId] = useState<string | null>(null);

  const detachCompany = async (companyId: string) => {
    if (pendingCompanyId) {
      return;
    }

    setPendingCompanyId(companyId);
    try {
      const response = await fetch("/api/auth/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "detachCompany",
          companyId,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        toast.error(payload?.error ?? messages.detachCompanyUnknownError);
        return;
      }

      toast.success(messages.detachCompanySuccess);
      setAssignedCompanies((current) =>
        current.filter((company) => company.id !== companyId),
      );
    } catch {
      toast.error(messages.detachCompanyUnknownError);
    } finally {
      setPendingCompanyId(null);
      setConfirmCompany(null);
    }
  };

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <h2 className="text-lg font-semibold text-slate-100">{messages.assignedCompaniesTitle}</h2>
      <p className="mt-2 text-sm text-slate-300">{messages.assignedCompaniesHint}</p>
      {assignedCompanies.length > 0 ? (
        <ul className="mt-4 grid gap-2">
          {assignedCompanies.map((company) => (
            <li key={company.id} className="flex flex-wrap items-center gap-2">
              <Link
                href={withLang(`/companies/${company.slug}`, locale)}
                className={
                  company.isBlocked
                    ? "inline-flex items-center gap-2 rounded-md border border-rose-700 px-3 py-2 text-sm text-rose-200 hover:border-rose-500"
                    : "inline-flex items-center rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-500"
                }
              >
                {company.name}
                {company.isBlocked ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-300">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-rose-600 bg-rose-500/10 text-[11px] font-bold">
                      !
                    </span>
                    {messages.blockedCompanyBadge}
                  </span>
                ) : null}
              </Link>
              <button
                type="button"
                className="rounded-md border border-amber-700 px-3 py-2 text-xs text-amber-200 hover:border-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => {
                  setConfirmCompany({ id: company.id, name: company.name });
                }}
                disabled={pendingCompanyId !== null}
              >
                {pendingCompanyId === company.id
                  ? messages.detachingCompany
                  : messages.detachCompanyButton}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-slate-400">{messages.noCompanies}</p>
      )}

      {confirmCompany ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-[rgba(2,6,23,0.45)] p-4 backdrop-blur-[2px] [&>div:not(.fixed)]:my-auto [&>div:not(.fixed)]:max-h-[calc(100dvh-2rem)] [&>div:not(.fixed)]:!overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-2xl">
            <h3 className="text-sm font-semibold text-slate-100">
              {messages.detachCompanyConfirmTitle}
            </h3>
            <p className="mt-2 text-xs leading-5 text-slate-300">
              {messages.detachCompanyConfirmText.replace("{company}", confirmCompany.name)}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500"
                onClick={() => {
                  setConfirmCompany(null);
                }}
                disabled={pendingCompanyId !== null}
              >
                {messages.cancel}
              </button>
              <button
                type="button"
                className="rounded-md border border-amber-700 px-3 py-1.5 text-xs text-amber-200 hover:border-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => {
                  void detachCompany(confirmCompany.id);
                }}
                disabled={pendingCompanyId !== null}
              >
                {pendingCompanyId === confirmCompany.id
                  ? messages.detachingCompany
                  : messages.detachCompanyConfirmButton}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}


