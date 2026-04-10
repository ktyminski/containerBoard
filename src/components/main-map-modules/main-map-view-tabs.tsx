"use client";

import type { MainMapView } from "@/components/main-map-modules/shared";

type MainMapViewTabsProps = {
  tabs: ReadonlyArray<{ id: MainMapView; label: string }>;
  activeView: MainMapView;
  onTabChange: (view: MainMapView) => void;
};

function tabClass(isActive: boolean): string {
  return `rounded-md border px-3 py-1.5 text-sm transition ${
    isActive
      ? "border-sky-400/80 bg-sky-800 text-white shadow-[0_0_0_1px_rgba(125,211,252,0.35)]"
      : "border-sky-800/80 bg-sky-950/85 text-white hover:border-sky-600 hover:bg-sky-900"
  }`;
}

export function MainMapViewTabs({
  tabs,
  activeView,
  onTabChange,
}: MainMapViewTabsProps) {
  return (
    <div className="mt-3 mb-4 flex flex-wrap items-center justify-center gap-2 px-4">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={tabClass(activeView === tab.id)}
          onClick={() => {
            onTabChange(tab.id);
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
