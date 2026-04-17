"use client";

import { useState } from "react";
import { AdminConciergeRequestsTable } from "@/components/admin-concierge-requests-table";
import { AdminCompaniesTable } from "@/components/admin-companies-table";
import { AdminContainersTable } from "@/components/admin-containers-table";
import { AdminUsersTable } from "@/components/admin-users-table";
import type { AppLocale, AppMessages } from "@/lib/i18n";

type AdminTabKey = "containers" | "users" | "companies" | "concierge";

type AdminPanelTabsProps = {
  locale: AppLocale;
  initialTab?: string;
  usersMessages: AppMessages["adminUsers"];
  companiesMessages: AppMessages["adminCompanies"];
  companyStatusMessages: AppMessages["companyStatus"];
  roleMessages: AppMessages["roles"];
};

const ADMIN_TABS: AdminTabKey[] = ["containers", "users", "companies", "concierge"];
const TAB_LABELS: Record<AdminTabKey, string> = {
  containers: "Kontenery",
  users: "Uzytkownicy",
  companies: "Firmy",
  concierge: "Concierge",
};

function resolveAdminTab(value?: string): AdminTabKey {
  return ADMIN_TABS.includes(value as AdminTabKey)
    ? (value as AdminTabKey)
    : "containers";
}

export function AdminPanelTabs({
  locale,
  initialTab,
  usersMessages,
  companiesMessages,
  companyStatusMessages,
  roleMessages,
}: AdminPanelTabsProps) {
  const [activeTab, setActiveTab] = useState<AdminTabKey>(resolveAdminTab(initialTab));

  return (
    <section className="min-w-0 rounded-xl border border-neutral-800 bg-neutral-900/40 p-3">
      <div className="mb-4 flex flex-wrap gap-2">
        {ADMIN_TABS.map((tab) => {
          const isActive = tab === activeTab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setActiveTab(tab);
              }}
              className={
                isActive
                  ? "rounded-md border border-sky-400 bg-sky-700/35 px-3 py-1.5 text-sm font-medium text-sky-100 shadow-[0_0_0_1px_rgba(56,189,248,0.2)]"
                  : "rounded-md border border-neutral-600 bg-neutral-800/90 px-3 py-1.5 text-sm text-neutral-100 hover:border-neutral-500 hover:bg-neutral-700/90"
              }
            >
              {TAB_LABELS[tab]}
            </button>
          );
        })}
      </div>

      {activeTab === "containers" ? <AdminContainersTable locale={locale} /> : null}
      {activeTab === "users" ? (
        <AdminUsersTable locale={locale} messages={usersMessages} roleMessages={roleMessages} />
      ) : null}
      {activeTab === "companies" ? (
        <AdminCompaniesTable
          locale={locale}
          messages={companiesMessages}
          statusMessages={companyStatusMessages}
        />
      ) : null}
      {activeTab === "concierge" ? <AdminConciergeRequestsTable locale={locale} /> : null}
    </section>
  );
}

