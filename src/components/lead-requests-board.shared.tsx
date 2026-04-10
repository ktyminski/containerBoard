"use client";

import { useEffect, useState } from "react";
import {
  LEAD_REQUEST_TRANSPORT_MODE,
  LEAD_REQUEST_TYPE,
  type LeadRequestStatus,
  type LeadRequestTransportMode,
  type LeadRequestType,
} from "@/lib/lead-request-types";
import type { AppLocale, AppMessages } from "@/lib/i18n";

export const LEAD_REQUESTS_PAGE_SIZE = 20;

export type LeadRequestBoardItem = {
  id: string;
  leadType: LeadRequestType;
  transportMode: LeadRequestTransportMode;
  originLocation: string;
  originCountryCode: string | null;
  destinationLocation: string;
  destinationCountryCode: string | null;
  status: LeadRequestStatus;
  description: string;
  contactEmail: string | null;
  contactPhone: string | null;
  createdAtIso: string;
  expiresAtIso: string | null;
  isExpired: boolean;
};

export type LeadRequestsPageData = {
  items: LeadRequestBoardItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type LeadRequestsBoardProps = {
  messages: AppMessages["leadRequestsPage"];
  locale: AppLocale;
  loginHref: string;
  isLoggedIn: boolean;
  currentUserEmail?: string | null;
  turnstileSiteKey?: string | null;
  creationLimit?: {
    isLimited: boolean;
    limit: number;
    windowHours: number;
  } | null;
  isBlocked: boolean;
  isEmailVerified: boolean;
  canManageRequests: boolean;
  initialTab?: "all" | "mine";
  sortOrder: "newest" | "oldest";
  hasMyRequests?: boolean;
  canSeeContact: boolean;
  keywordFilter: string;
  transportModeFilter: LeadRequestTransportMode[];
  originCountryFilter: string[];
  destinationCountryFilter: string[];
  initialAllPage: LeadRequestsPageData;
  initialMyPage: LeadRequestsPageData;
  intlLocale: string;
};

export type ModalMode = "create" | "edit";

export type LocationSuggestion = {
  label: string;
  countryCode: string | null;
};

type LocationSuggestionsState = {
  query: string;
  items: LocationSuggestion[];
};

type GeocodeSuggestionsResponse = {
  item?: {
    label: string;
    shortLabel?: string;
    countryCode?: string | null;
  } | null;
  items?: Array<{
    label: string;
    shortLabel?: string;
    countryCode?: string | null;
  }>;
  error?: string;
};

export type LeadRequestFormValues = {
  leadType: LeadRequestType;
  transportMode: LeadRequestTransportMode;
  originLocation: string;
  originCountryCode: string;
  destinationLocation: string;
  destinationCountryCode: string;
  description: string;
  contactPhone: string;
  contactEmail: string;
};

export type LeadRequestSubmitPayload = LeadRequestFormValues & {
  turnstileToken: string;
};

export class LeadRequestSubmitError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "LeadRequestSubmitError";
    this.code = code;
  }
}

export function getDefaultLeadRequestFormValues(
  currentUserEmail?: string | null,
): LeadRequestFormValues {
  return {
    leadType: LEAD_REQUEST_TYPE.TRANSPORT,
    transportMode: LEAD_REQUEST_TRANSPORT_MODE.ANY,
    originLocation: "",
    originCountryCode: "",
    destinationLocation: "",
    destinationCountryCode: "",
    description: "",
    contactPhone: "",
    contactEmail: currentUserEmail?.trim() ?? "",
  };
}

export function getLeadRequestFormValues(item: LeadRequestBoardItem): LeadRequestFormValues {
  const isTransportRequest = item.leadType === LEAD_REQUEST_TYPE.TRANSPORT;

  return {
    leadType: item.leadType,
    transportMode: isTransportRequest ? item.transportMode : LEAD_REQUEST_TRANSPORT_MODE.ANY,
    originLocation: isTransportRequest ? item.originLocation : "",
    originCountryCode: isTransportRequest ? (item.originCountryCode ?? "") : "",
    destinationLocation: isTransportRequest ? item.destinationLocation : "",
    destinationCountryCode: isTransportRequest ? (item.destinationCountryCode ?? "") : "",
    description: item.description,
    contactPhone: item.contactPhone ?? "",
    contactEmail: item.contactEmail ?? "",
  };
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function getTransportModeLabel(
  mode: LeadRequestTransportMode,
  messages: AppMessages["leadRequestsPage"],
): string {
  if (mode === LEAD_REQUEST_TRANSPORT_MODE.SEA) {
    return messages.transportModeSea;
  }
  if (mode === LEAD_REQUEST_TRANSPORT_MODE.RAIL) {
    return messages.transportModeRail;
  }
  if (mode === LEAD_REQUEST_TRANSPORT_MODE.ROAD) {
    return messages.transportModeRoad;
  }
  if (mode === LEAD_REQUEST_TRANSPORT_MODE.AIR) {
    return messages.transportModeAir;
  }
  return messages.transportModeAny;
}

export function getTransportModeIcon(mode: LeadRequestTransportMode) {
  if (mode === LEAD_REQUEST_TRANSPORT_MODE.SEA) {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M6 15h10.5a2 2 0 0 0 1.6-.8l1.4-1.9H9.8a2 2 0 0 1-1.7-.9L6.8 9.2H5.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 8.5h6l2.2 3.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3 18c1 .9 2 1.3 3 1.3s2-.4 3-1.3c1 .9 2 1.3 3 1.3s2-.4 3-1.3c1 .9 2 1.3 3 1.3s2-.4 3-1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (mode === LEAD_REQUEST_TRANSPORT_MODE.RAIL) {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="6" y="3" width="12" height="12" rx="2" />
        <path d="M9 7h6M9 11h6M7 19h10M9 15l-2 4M15 15l2 4" />
      </svg>
    );
  }
  if (mode === LEAD_REQUEST_TRANSPORT_MODE.AIR) {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 13l18-7-5.5 8.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10.5 12.5l3 7-2 .8-3-5.2-3.9 1.4-1.1-1.1 3.2-2.7-2.1-3.6 1.6-.7 4.3 3.1z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (mode === LEAD_REQUEST_TRANSPORT_MODE.ROAD) {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="9" width="11" height="6" rx="1.5" />
        <path d="M14 11h3l2 2.2V15h-5z" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="7.5" cy="17.5" r="1.5" />
        <circle cx="17.5" cy="17.5" r="1.5" />
        <path d="M5 15v1h1M19 15v1h-1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a15 15 0 010 18M12 3a15 15 0 000 18" />
    </svg>
  );
}

export function CountryFlag({ countryCode }: { countryCode?: string | null }) {
  const normalizedCode = countryCode?.trim().toLowerCase();
  if (!normalizedCode || normalizedCode.length !== 2) {
    return (
      <span className="inline-flex h-5 w-7 items-center justify-center rounded border border-slate-600 bg-slate-800 text-[10px] font-semibold text-slate-300">
        --
      </span>
    );
  }

  return (
    <span
      role="img"
      aria-label={normalizedCode.toUpperCase()}
      className="inline-block h-5 w-7 rounded border border-slate-600 bg-slate-800 bg-cover bg-center bg-no-repeat"
      style={{
        backgroundImage: `url(https://flagcdn.com/${normalizedCode}.svg)`,
      }}
    />
  );
}

export function useLocationSuggestions(query: string, lang: string): LocationSuggestion[] {
  const [state, setState] = useState<LocationSuggestionsState>({
    query: "",
    items: [],
  });
  const trimmedQuery = query.trim();

  useEffect(() => {
    if (trimmedQuery.length < 3) {
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch(
            `/api/geocode?q=${encodeURIComponent(trimmedQuery)}&lang=${encodeURIComponent(lang)}&limit=5`,
            { signal: controller.signal },
          );
          const payload = (await response.json().catch(() => null)) as GeocodeSuggestionsResponse | null;
          if (!response.ok || payload?.error) {
            setState({
              query: trimmedQuery,
              items: [],
            });
            return;
          }

          const merged = [...(payload?.items ?? []), ...(payload?.item ? [payload.item] : [])];
          const uniqueByLabel = new Map<string, LocationSuggestion>();
          for (const row of merged) {
            const label = row.label?.trim();
            if (!label) {
              continue;
            }
            const key = label.toLowerCase();
            if (!uniqueByLabel.has(key)) {
              uniqueByLabel.set(key, {
                label,
                countryCode: row.countryCode?.trim().toUpperCase() ?? null,
              });
            }
          }
          setState({
            query: trimmedQuery,
            items: Array.from(uniqueByLabel.values()),
          });
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") {
            return;
          }
          setState({
            query: trimmedQuery,
            items: [],
          });
        }
      })();
    }, 250);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [trimmedQuery, lang]);

  return trimmedQuery.length < 3 || state.query !== trimmedQuery ? [] : state.items;
}

export function resolveCountryCodeFromSuggestions(
  value: string,
  suggestions: LocationSuggestion[],
): string {
  const normalizedValue = value.trim().toLowerCase();
  if (!normalizedValue) {
    return "";
  }
  const matched = suggestions.find(
    (suggestion) => suggestion.label.trim().toLowerCase() === normalizedValue,
  );
  return matched?.countryCode?.toUpperCase() ?? "";
}
