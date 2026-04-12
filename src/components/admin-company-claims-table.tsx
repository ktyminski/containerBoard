"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { AppLocale, AppMessages } from "@/lib/i18n";
import { withLang } from "@/lib/i18n";
import type { UserRole } from "@/lib/user-roles";

type ClaimItem = {
  id: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
  };
  company: {
    id: string;
    name: string;
    slug: string;
  };
};

type ClaimsResponse = {
  items: ClaimItem[];
  error?: string;
};

type AdminCompanyClaimsTableProps = {
  locale: AppLocale;
  messages: AppMessages["adminCompanyClaims"];
  roleMessages: AppMessages["roles"];
};

export function AdminCompanyClaimsTable({
  locale,
  messages,
  roleMessages,
}: AdminCompanyClaimsTableProps) {
  const [items, setItems] = useState<ClaimItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [approveConfirm, setApproveConfirm] = useState<{
    claimId: string;
    userName: string;
    companyName: string;
  } | null>(null);

  const loadClaims = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/company-claims", { cache: "no-store" });
      const data = (await response.json()) as ClaimsResponse;
      if (!response.ok) {
        throw new Error(
          data.error ?? messages.failedLoad.replace("{status}", String(response.status)),
        );
      }
      setItems(data.items ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : messages.unknownError);
    } finally {
      setIsLoading(false);
    }
  }, [messages.failedLoad, messages.unknownError]);

  useEffect(() => {
    void loadClaims();
  }, [loadClaims]);

  const decideClaim = async (claimId: string, action: "approve" | "reject") => {
    setError(null);
    setUpdatingId(claimId);
    try {
      const response = await fetch("/api/admin/company-claims", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimId, action }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(
          data.error ?? messages.failedUpdate.replace("{status}", String(response.status)),
        );
      }
      await loadClaims();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : messages.unknownError);
    } finally {
      setUpdatingId(null);
    }
  };

  if (isLoading) {
    return <p className="text-sm text-neutral-300">{messages.loading}</p>;
  }

  return (
    <>
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-100">{messages.title}</h2>
        <button
          type="button"
          className="rounded-md border border-neutral-700 px-3 py-1 text-sm text-neutral-200 hover:border-neutral-500"
          onClick={() => {
            void loadClaims();
          }}
        >
          {messages.refresh}
        </button>
      </div>

      {error ? <p className="mb-3 text-sm text-red-300">{error}</p> : null}
      {items.length === 0 ? (
        <p className="text-sm text-neutral-400">{messages.empty}</p>
      ) : (
        <div className="overflow-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="text-neutral-400">
                <th className="pb-2">{messages.company}</th>
                <th className="pb-2">{messages.requester}</th>
                <th className="pb-2">{messages.role}</th>
                <th className="pb-2">{messages.created}</th>
                <th className="pb-2">{messages.actions}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((claim) => (
                <tr key={claim.id} className="border-t border-neutral-800 align-middle">
                  <td className="py-2 text-neutral-100">
                    <Link
                      href={withLang(`/companies/${claim.company.slug}`, locale)}
                      className="hover:text-sky-300"
                    >
                      {claim.company.name}
                    </Link>
                  </td>
                  <td className="py-2 text-neutral-300">
                    <p>{claim.user.name}</p>
                    <p className="text-xs text-neutral-400">{claim.user.email}</p>
                  </td>
                  <td className="py-2">
                    <span className="rounded-md bg-neutral-800 px-2 py-1 text-xs text-neutral-200">
                      {roleMessages[claim.user.role]}
                    </span>
                  </td>
                  <td className="py-2 text-neutral-400">
                    {new Date(claim.createdAt).toLocaleString(locale)}
                  </td>
                  <td className="py-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="rounded-md border border-emerald-700 px-2 py-1 text-xs text-emerald-200 hover:border-emerald-500 disabled:opacity-50"
                        disabled={updatingId === claim.id}
                        onClick={() => {
                          setApproveConfirm({
                            claimId: claim.id,
                            userName: claim.user.name,
                            companyName: claim.company.name,
                          });
                        }}
                      >
                        {messages.approve}
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-rose-700 px-2 py-1 text-xs text-rose-200 hover:border-rose-500 disabled:opacity-50"
                        disabled={updatingId === claim.id}
                        onClick={() => {
                          void decideClaim(claim.id, "reject");
                        }}
                      >
                        {messages.reject}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </div>
      {approveConfirm ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto [&>div:not(.fixed)]:my-auto [&>div:not(.fixed)]:max-h-[calc(100dvh-2rem)] [&>div:not(.fixed)]:!overflow-y-auto bg-neutral-950/75 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-neutral-700 bg-neutral-900 p-4 shadow-2xl">
            <h3 className="text-sm font-semibold text-neutral-100">{messages.confirmApproveTitle}</h3>
            <p className="mt-2 text-xs leading-5 text-neutral-300">
              {messages.confirmApproveText
                .replace("{company}", approveConfirm.companyName)
                .replace("{user}", approveConfirm.userName)}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:border-neutral-500"
                onClick={() => {
                  setApproveConfirm(null);
                }}
              >
                {messages.cancel}
              </button>
              <button
                type="button"
                className="rounded-md border border-emerald-700 px-3 py-1.5 text-xs text-emerald-200 hover:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-70"
                onClick={() => {
                  const claimId = approveConfirm.claimId;
                  setApproveConfirm(null);
                  void decideClaim(claimId, "approve");
                }}
                disabled={updatingId === approveConfirm.claimId}
              >
                {messages.confirm}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}



