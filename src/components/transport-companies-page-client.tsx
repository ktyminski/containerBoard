"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import maplibregl from "maplibre-gl";
import {
  applyBaseMapLanguage,
  MAP_STYLE_URL,
  POLAND_BOUNDS,
} from "@/components/map-shared";
import { SmartBackButton } from "@/components/smart-back-button";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { useToast } from "@/components/toast-provider";
import { usePageScrollLock } from "@/components/use-page-scroll-lock";
import { withLang, type AppLocale, type AppMessages } from "@/lib/i18n";
import type { TransportCompanyPublicItem } from "@/lib/transport-companies";

type TransportCompaniesPageClientProps = {
  locale: AppLocale;
  messages: AppMessages["transportCompaniesPage"];
  compareMessages: AppMessages["transportCompare"];
  initialItems: TransportCompanyPublicItem[];
  initialLocationLabel?: string | null;
  title?: string;
  subtitle?: string;
  isLoggedIn?: boolean;
  turnstileSiteKey?: string | null;
};

type SearchResponse = {
  items?: TransportCompanyPublicItem[];
  location?: {
    label: string;
    lat: number;
    lng: number;
  } | null;
  error?: string;
};

const INPUT_CLASS =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#166534] focus:ring-2 focus:ring-[#86efac]/35";
const GREEN_BUTTON_CLASS =
  "rounded-md border border-[#166534] bg-[#166534] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#14532d] disabled:cursor-not-allowed disabled:opacity-70";

function useIsDesktopMapViewport(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 640px)");
    const syncViewport = () => setIsDesktop(mediaQuery.matches);

    syncViewport();
    mediaQuery.addEventListener("change", syncViewport);

    return () => {
      mediaQuery.removeEventListener("change", syncViewport);
    };
  }, []);

  return isDesktop;
}

function formatDistanceValue(
  value: number | null,
  messages: AppMessages["transportCompare"],
): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return messages.distanceUnknown;
  }
  if (value < 1) {
    return messages.distanceUnderOneKm;
  }
  return `${value.toLocaleString("pl-PL")} km`;
}

function createCompanyPinElement(name: string): HTMLButtonElement {
  const element = document.createElement("button");
  element.type = "button";
  element.setAttribute("aria-label", name);
  element.title = name;
  element.style.cssText = [
    "position:absolute",
    "width:24px",
    "height:24px",
    "border:0",
    "padding:0",
    "background:transparent",
    "cursor:pointer",
  ].join(";");

  const dot = document.createElement("span");
  dot.style.cssText = [
    "position:absolute",
    "left:50%",
    "top:50%",
    "width:18px",
    "height:18px",
    "transform:translate(-50%,-50%)",
    "border-radius:999px",
    "border:2px solid #ffffff",
    "background:#f97316",
  ].join(";");

  const inner = document.createElement("span");
  inner.style.cssText = [
    "position:absolute",
    "left:50%",
    "top:50%",
    "width:6px",
    "height:6px",
    "transform:translate(-50%,-50%)",
    "border-radius:999px",
    "background:#ffedd5",
  ].join(";");

  dot.appendChild(inner);
  element.appendChild(dot);

  element.addEventListener("mouseenter", () => {
    dot.style.background = "#ea580c";
    dot.style.transform = "translate(-50%,-50%) scale(1.15)";
  });
  element.addEventListener("mouseleave", () => {
    dot.style.background = "#f97316";
    dot.style.transform = "translate(-50%,-50%)";
  });

  return element;
}

function TransportCompaniesMap({
  locale,
  items,
  compareMessages,
  onOpenDetails,
}: {
  locale: AppLocale;
  items: TransportCompanyPublicItem[];
  compareMessages: AppMessages["transportCompare"];
  onOpenDetails: (item: TransportCompanyPublicItem) => void;
}) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const points = useMemo(
    () =>
      items.filter(
        (item) =>
          typeof item.location.lat === "number" &&
          Number.isFinite(item.location.lat) &&
          typeof item.location.lng === "number" &&
          Number.isFinite(item.location.lng),
      ),
    [items],
  );

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE_URL,
      center: [19.1451, 51.9194],
      zoom: 5,
      maxZoom: 18,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.on("load", () => {
      applyBaseMapLanguage(map, locale);
    });

    mapRef.current = map;

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [locale]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    if (points.length === 0) {
      if (map.loaded()) {
        map.fitBounds(POLAND_BOUNDS, { padding: 36, duration: 350 });
      }
      return;
    }

    const bounds = new maplibregl.LngLatBounds();
    for (const item of points) {
      const marker = new maplibregl.Marker({
        element: createCompanyPinElement(item.name),
        anchor: "center",
      })
        .setLngLat([item.location.lng, item.location.lat])
        .setPopup(
          new maplibregl.Popup({
            offset: 28,
            closeButton: false,
          }).setDOMContent(createMapPopupContent(item, compareMessages, onOpenDetails)),
        )
        .addTo(map);
      markersRef.current.push(marker);
      bounds.extend([item.location.lng, item.location.lat]);
    }

    const fitMap = () => {
      if (points.length === 1) {
        map.easeTo({
          center: [points[0].location.lng, points[0].location.lat],
          zoom: 9,
          duration: 350,
        });
        return;
      }
      map.fitBounds(bounds, {
        padding: { top: 44, right: 44, bottom: 44, left: 44 },
        maxZoom: 10,
        duration: 350,
      });
    };

    if (map.loaded()) {
      fitMap();
    } else {
      map.once("load", fitMap);
    }
  }, [compareMessages, onOpenDetails, points]);

  return (
    <section className="overflow-hidden rounded-md border border-neutral-300 bg-white shadow-sm">
      <div ref={mapContainerRef} className="h-[360px] w-full sm:h-[430px]" />
    </section>
  );
}

function TransportCompanyCard({
  item,
  compareMessages,
  onOpenDetails,
}: {
  item: TransportCompanyPublicItem;
  compareMessages: AppMessages["transportCompare"];
  onOpenDetails: (item: TransportCompanyPublicItem) => void;
}) {
  return (
    <article className="rounded-md border border-neutral-300 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-neutral-900">{item.name}</h2>
          <p className="mt-1 text-sm text-neutral-600">{item.location.label}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {item.services.map((service) => (
              <span
                key={`${item.id}-${service}`}
                className="rounded-md border border-[#bbf7d0] bg-[#f0fdf4] px-2 py-1 text-xs font-medium text-[#14532d]"
              >
                {service === "transport"
                  ? compareMessages.serviceTransport
                  : compareMessages.serviceUnloading}
              </span>
            ))}
          </div>
        </div>
        {typeof item.pickupDistanceKm === "number" ? (
          <span className="w-fit rounded-md border border-[#bbf7d0] bg-[#f0fdf4] px-2 py-1 text-xs font-semibold text-[#14532d]">
            {formatDistanceValue(item.pickupDistanceKm, compareMessages)}
          </span>
        ) : null}
      </div>

      {item.transportPrice ? (
        <p className="mt-4 text-sm text-neutral-700">
          <span className="font-semibold text-neutral-900">
            {compareMessages.priceLabel}:
          </span>{" "}
          {item.transportPrice}
        </p>
      ) : null}

      <div className="mt-4 flex justify-end border-t border-neutral-200 pt-4">
        <button
          type="button"
          onClick={() => onOpenDetails(item)}
          className="inline-flex items-center gap-1 rounded-md border border-[#166534] bg-white px-3 py-1.5 text-sm font-semibold text-[#166534] transition hover:bg-[#dcfce7]"
        >
          {compareMessages.detailsButton}
          <svg
            viewBox="0 0 20 20"
            aria-hidden="true"
            className="h-3.5 w-3.5"
            fill="none"
          >
            <path
              d="M4 10h10.5m0 0L11 6.5M14.5 10 11 13.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </article>
  );
}

function createMapPopupContent(
  item: TransportCompanyPublicItem,
  compareMessages: AppMessages["transportCompare"],
  onOpenDetails: (item: TransportCompanyPublicItem) => void,
): HTMLDivElement {
  const root = document.createElement("div");
  root.className = "grid gap-2 text-sm";

  const name = document.createElement("p");
  name.className = "font-semibold text-neutral-900";
  name.textContent = item.name;
  root.appendChild(name);

  const location = document.createElement("p");
  location.className = "text-neutral-600";
  location.textContent = item.location.label;
  root.appendChild(location);

  if (typeof item.pickupDistanceKm === "number") {
    const distance = document.createElement("p");
    distance.className = "text-[#166534]";
    distance.textContent = formatDistanceValue(item.pickupDistanceKm, compareMessages);
    root.appendChild(distance);
  }

  const button = document.createElement("button");
  button.type = "button";
  button.className =
    "mt-1 rounded-md border border-[#166534] bg-white px-2.5 py-1 text-xs font-semibold text-[#166534] hover:bg-[#dcfce7]";
  button.textContent = compareMessages.detailsButton;
  button.addEventListener("click", () => onOpenDetails(item));
  root.appendChild(button);

  return root;
}

function TransportCompanyDetailsModal({
  item,
  compareMessages,
  isLoggedIn,
  turnstileSiteKey,
  onClose,
}: {
  item: TransportCompanyPublicItem;
  compareMessages: AppMessages["transportCompare"];
  isLoggedIn: boolean;
  turnstileSiteKey: string | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const [inquiryPhone, setInquiryPhone] = useState("");
  const [inquiryEmail, setInquiryEmail] = useState("");
  const [inquiryMessage, setInquiryMessage] = useState("");
  const [inquiryError, setInquiryError] = useState<string | null>(null);
  const [isSendingInquiry, setIsSendingInquiry] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileRefreshKey, setTurnstileRefreshKey] = useState(0);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const resetInquiryForm = () => {
    setInquiryPhone("");
    setInquiryEmail("");
    setInquiryMessage("");
    setInquiryError(null);
    setTurnstileToken("");
    setTurnstileRefreshKey((current) => current + 1);
  };

  const submitInquiry = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const email = inquiryEmail.trim();
    const phone = inquiryPhone.trim();
    const message = inquiryMessage.trim();
    setInquiryError(null);

    if (!email && !phone) {
      setInquiryError(compareMessages.inquiryErrors.contactRequired);
      return;
    }
    if (message.length < 10) {
      setInquiryError(compareMessages.inquiryErrors.messageMinLength);
      return;
    }
    if (!isLoggedIn && turnstileSiteKey && !turnstileToken) {
      setInquiryError(compareMessages.inquiryErrors.robotCheck);
      return;
    }

    setIsSendingInquiry(true);
    try {
      const response = await fetch("/api/transport-companies/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: item.id,
          email,
          phone,
          message,
          turnstileToken: !isLoggedIn ? turnstileToken : undefined,
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | { error?: string; issues?: string[] }
        | null;

      if (!response.ok) {
        if (data?.error === "TURNSTILE_REQUIRED" || data?.error === "TURNSTILE_FAILED") {
          throw new Error(compareMessages.inquiryErrors.robotCheck);
        }
        if (response.status === 429) {
          throw new Error(compareMessages.inquiryErrors.rateLimited);
        }
        const details = Array.isArray(data?.issues) ? ` (${data.issues.join(", ")})` : "";
        throw new Error((data?.error ?? compareMessages.inquiryErrors.sendFailed) + details);
      }

      resetInquiryForm();
      toast.success(compareMessages.inquirySent);
    } catch (submitError) {
      setInquiryError(
        submitError instanceof Error
          ? submitError.message
          : compareMessages.inquiryErrors.sendFailed,
      );
    } finally {
      if (!isLoggedIn && turnstileSiteKey) {
        setTurnstileToken("");
        setTurnstileRefreshKey((current) => current + 1);
      }
      setIsSendingInquiry(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center overflow-y-auto bg-[rgba(2,6,23,0.45)] p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <article
        role="dialog"
        aria-modal="true"
        aria-labelledby="transport-company-details-title"
        className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-auto rounded-md border border-neutral-300 bg-neutral-50 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-neutral-200 p-4">
          <div>
            <h2
              id="transport-company-details-title"
              className="text-lg font-semibold text-neutral-900"
            >
              {item.name}
            </h2>
            <p className="mt-1 text-sm text-neutral-600">{item.location.label}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-700 hover:bg-neutral-100"
          >
            {compareMessages.close}
          </button>
        </div>

        <div className="grid gap-4 p-4">
          <div className="flex flex-wrap gap-2">
            {item.services.map((service) => (
              <span
                key={`${item.id}-details-${service}`}
                className="rounded-md border border-[#bbf7d0] bg-[#f0fdf4] px-2 py-1 text-xs font-medium text-[#14532d]"
              >
                {service === "transport"
                  ? compareMessages.serviceTransport
                  : compareMessages.serviceUnloading}
              </span>
            ))}
          </div>

          <div className="grid gap-2 rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-700 sm:grid-cols-2">
            <p>
              <span className="font-medium text-neutral-900">
                {compareMessages.locationLabel}:
              </span>{" "}
              {item.location.label}
            </p>
            {typeof item.pickupDistanceKm === "number" ? (
              <p>
                <span className="font-medium text-neutral-900">
                  {compareMessages.pickupDistanceLabel}:
                </span>{" "}
                {formatDistanceValue(item.pickupDistanceKm, compareMessages)}
              </p>
            ) : null}
          </div>

          {item.transportPrice ? (
            <section>
              <h3 className="text-sm font-semibold text-neutral-900">
                {compareMessages.priceLabel}
              </h3>
              <p className="mt-1 text-sm text-neutral-700">{item.transportPrice}</p>
            </section>
          ) : null}

          {item.description ? (
            <section>
              <h3 className="text-sm font-semibold text-neutral-900">
                {compareMessages.descriptionLabel}
              </h3>
              <p className="mt-1 text-sm leading-6 text-neutral-700">
                {item.description}
              </p>
            </section>
          ) : null}

          {item.terms ? (
            <section>
              <h3 className="text-sm font-semibold text-neutral-900">
                {compareMessages.termsLabel}
              </h3>
              <p className="mt-1 text-sm leading-6 text-neutral-700">{item.terms}</p>
            </section>
          ) : null}

          <section className="grid gap-3 border-t border-neutral-200 pt-4 text-sm">
            <h3 className="text-sm font-semibold text-neutral-900">
              {compareMessages.inquiryTitle}
            </h3>
            <div className="flex flex-wrap gap-3">
              {item.email ? (
                <a
                  className="font-medium text-[#166534] underline underline-offset-2"
                  href={`mailto:${item.email}`}
                >
                  {item.email}
                </a>
              ) : null}
              {item.phone ? (
                <a
                  className="font-medium text-[#166534] underline underline-offset-2"
                  href={`tel:${item.phone}`}
                >
                  {item.phone}
                </a>
              ) : null}
            </div>

            <form onSubmit={submitInquiry} className="grid gap-3 pt-2">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-sm font-medium text-neutral-700">
                  {compareMessages.inquiryPhoneLabel}
                  <input
                    className={INPUT_CLASS}
                    type="tel"
                    value={inquiryPhone}
                    onChange={(event) => setInquiryPhone(event.target.value)}
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium text-neutral-700">
                  {compareMessages.inquiryEmailLabel}
                  <input
                    className={INPUT_CLASS}
                    type="email"
                    value={inquiryEmail}
                    onChange={(event) => setInquiryEmail(event.target.value)}
                  />
                </label>
              </div>
              <label className="grid gap-1 text-sm font-medium text-neutral-700">
                {compareMessages.inquiryMessageLabel}
                <textarea
                  className={INPUT_CLASS}
                  rows={4}
                  value={inquiryMessage}
                  onChange={(event) => setInquiryMessage(event.target.value)}
                  placeholder={compareMessages.inquiryMessagePlaceholder}
                />
              </label>
              {!isLoggedIn && turnstileSiteKey ? (
                <TurnstileWidget
                  siteKey={turnstileSiteKey}
                  onTokenChange={setTurnstileToken}
                  refreshKey={turnstileRefreshKey}
                />
              ) : null}
              {inquiryError ? (
                <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                  {inquiryError}
                </p>
              ) : null}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSendingInquiry}
                  className={GREEN_BUTTON_CLASS}
                >
                  {isSendingInquiry
                    ? compareMessages.inquirySending
                    : compareMessages.inquirySubmit}
                </button>
              </div>
            </form>
          </section>
        </div>
      </article>
    </div>
  );
}

export function TransportCompaniesPageClient({
  locale,
  messages,
  compareMessages,
  initialItems,
  initialLocationLabel = null,
  title = messages.title,
  isLoggedIn = false,
  turnstileSiteKey = null,
}: TransportCompaniesPageClientProps) {
  const [locationInput, setLocationInput] = useState("");
  const [items, setItems] = useState(initialItems);
  const [resolvedLocationLabel, setResolvedLocationLabel] = useState<string | null>(
    initialLocationLabel,
  );
  const [selectedCompany, setSelectedCompany] =
    useState<TransportCompanyPublicItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMobileMapVisible, setIsMobileMapVisible] = useState(false);
  const isDesktopMapViewport = useIsDesktopMapViewport();
  const shouldRenderMap = isDesktopMapViewport || isMobileMapVisible;
  usePageScrollLock(selectedCompany !== null);

  const search = async () => {
    const location = locationInput.trim();
    setError(null);
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ locale });
      if (location) {
        params.set("location", location);
      }
      const response = await fetch(`/api/transport-companies?${params.toString()}`, {
        cache: "no-store",
      });
      const data = (await response.json().catch(() => null)) as SearchResponse | null;
      if (!response.ok) {
        if (data?.error === "LOCATION_NOT_FOUND") {
          throw new Error(messages.locationNotFound);
        }
        throw new Error(messages.loadError);
      }
      setItems(data?.items ?? []);
      setResolvedLocationLabel(data?.location?.label ?? null);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : messages.loadError);
    } finally {
      setIsLoading(false);
    }
  };

  const clearSearch = async () => {
    setLocationInput("");
    setResolvedLocationLabel(initialLocationLabel);
    setError(null);
    setItems(initialItems);
  };

  return (
    <main className="w-full bg-neutral-100 text-neutral-900">
      <section className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-6 sm:px-6">
        <SmartBackButton
          label={messages.backToList}
          fallbackHref={withLang("/list", locale)}
          className="inline-flex w-fit items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-100"
        />

        <div className="rounded-md border border-neutral-300 bg-white p-4 shadow-sm">
          <h1 className="mb-4 text-center text-2xl font-semibold text-neutral-950 sm:text-3xl">
            {title}
          </h1>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
            <label className="grid gap-1 text-sm font-medium text-neutral-700">
              {messages.locationLabel}
              <input
                className={INPUT_CLASS}
                value={locationInput}
                onChange={(event) => setLocationInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void search();
                  }
                }}
                placeholder={messages.locationPlaceholder}
              />
            </label>
            <button
              type="button"
              onClick={search}
              disabled={isLoading}
              className={GREEN_BUTTON_CLASS}
            >
              {isLoading ? messages.searching : messages.searchButton}
            </button>
            <button
              type="button"
              onClick={clearSearch}
              disabled={isLoading}
              className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {messages.clearButton}
            </button>
          </div>
          {resolvedLocationLabel ? (
            <p className="mt-3 text-sm text-neutral-600">
              {messages.resolvedLocationPrefix}{" "}
              <span className="font-medium text-neutral-900">
                {resolvedLocationLabel}
              </span>
            </p>
          ) : null}
          {error ? (
            <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {error}
            </p>
          ) : null}
        </div>

        {!isDesktopMapViewport && !isMobileMapVisible ? (
          <button
            type="button"
            onClick={() => setIsMobileMapVisible(true)}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-[#166534] bg-white px-4 py-2 text-sm font-semibold text-[#166534] transition hover:bg-[#dcfce7] sm:hidden"
          >
            <span>{messages.showMapButton}</span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path
                d="M9 18l-6 3V6l6-3 6 3 6-3v15l-6 3-6-3z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M9 3v15M15 6v15"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        ) : null}

        {shouldRenderMap ? (
          <TransportCompaniesMap
            locale={locale}
            items={items}
            compareMessages={compareMessages}
            onOpenDetails={setSelectedCompany}
          />
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-neutral-900">
            {resolvedLocationLabel ? messages.nearestTitle : messages.allTitle}
          </h2>
          <span className="text-sm text-neutral-500">
            {messages.resultsCount.replace("{count}", String(items.length))}
          </span>
        </div>

        {items.length > 0 ? (
          <div className="grid gap-3">
            {items.map((item) => (
              <TransportCompanyCard
                key={item.id}
                item={item}
                compareMessages={compareMessages}
                onOpenDetails={setSelectedCompany}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-neutral-300 bg-white p-8 text-center">
            <p className="text-sm text-neutral-600">{messages.empty}</p>
          </div>
        )}

        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
          <span>{messages.joinInfo} </span>
          <Link
            href={withLang("/contact", locale)}
            className="font-semibold text-[#166534] underline-offset-4 transition hover:underline"
          >
            {messages.joinContactLink}
          </Link>
        </div>
      </section>

      {selectedCompany ? (
        <TransportCompanyDetailsModal
          item={selectedCompany}
          compareMessages={compareMessages}
          isLoggedIn={isLoggedIn}
          turnstileSiteKey={turnstileSiteKey}
          onClose={() => setSelectedCompany(null)}
        />
      ) : null}
    </main>
  );
}
