"use client";

import { useState } from "react";
import { AdminContainersTable } from "@/components/admin-containers-table";
import { AdminUsersTable } from "@/components/admin-users-table";
import type { AppLocale, AppMessages } from "@/lib/i18n";

type AdminTabKey = "containers" | "users";

type AdminPanelTabsProps = {
  locale: AppLocale;
  initialTab?: string;
  usersMessages: AppMessages["adminUsers"];
  roleMessages: AppMessages["roles"];
};

const ADMIN_TABS: AdminTabKey[] = ["containers", "users"];
const TAB_LABELS: Record<AdminTabKey, string> = {
  containers: "Kontenery",
  users: "Uzytkownicy",
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
                  ? "rounded-md border border-sky-500 bg-sky-500/15 px-3 py-1.5 text-sm font-medium text-sky-100"
                  : "rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-300 hover:border-neutral-500 hover:text-neutral-100"
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
    </section>
  );
}

