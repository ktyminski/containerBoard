"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { CompanyOperatingArea } from "@/lib/company-operating-area";
import type { AppLocale, AppMessages } from "@/lib/i18n";
import type { CompanyCommunicationLanguage } from "@/types/company-communication-language";

const CompaniesMap = dynamic(
  () => import("@/components/companies-map").then((module) => module.CompaniesMap),
  { ssr: false },
);

type HomeMapPreviewMapProps = {
  locale: AppLocale;
  messages: AppMessages["map"];
  verifiedLabel: AppMessages["companyStatus"]["verified"];
  operatingAreaLabels: AppMessages["mapModules"]["filters"]["operatingAreas"];
  specializationLabels: AppMessages["companyCreate"]["specializationsOptions"];
  operatingAreas?: CompanyOperatingArea[];
  communicationLanguages?: CompanyCommunicationLanguage[];
};

export function HomeMapPreviewMap({
  locale,
  messages,
  verifiedLabel,
  operatingAreaLabels,
  specializationLabels,
  operatingAreas,
  communicationLanguages,
}: HomeMapPreviewMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isVisible) {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    if (!("IntersectionObserver" in window)) {
      const timer = globalThis.setTimeout(() => {
        setIsVisible(true);
      }, 0);
      return () => {
        globalThis.clearTimeout(timer);
      };
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "240px 0px" },
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [isVisible]);

  return (
    <div ref={containerRef} className="relative h-full w-full">
      {isVisible ? (
        <CompaniesMap
          locale={locale}
          messages={messages}
          verifiedLabel={verifiedLabel}
          operatingAreaLabels={operatingAreaLabels}
          specializationLabels={specializationLabels}
          operatingAreas={operatingAreas}
          communicationLanguages={communicationLanguages}
          mapOnly
          isActive
        />
      ) : (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-neutral-900/95">
          <div
            className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-500 border-t-sky-400"
            aria-label={messages.loading}
            role="status"
          />
        </div>
      )}
    </div>
  );
}

