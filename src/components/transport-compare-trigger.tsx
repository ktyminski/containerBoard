"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { useToast } from "@/components/toast-provider";
import { usePageScrollLock } from "@/components/use-page-scroll-lock";
import { withLocalePrefix, type AppLocale, type AppMessages } from "@/lib/i18n";

type TransportCompareLocation = {
  label: string;
  lat: number;
  lng: number;
};

type TransportCompanyResult = {
  id: string;
  name: string;
  description: string;
  services: Array<"transport" | "unloading">;
  terms: string;
  transportPrice: string;
  location: {
    label: string;
    city?: string;
    country?: string;
    lat: number;
    lng: number;
  };
  phone: string;
  email: string;
  distanceKm: number | null;
  pickupDistanceKm: number | null;
  deliveryDistanceKm: number | null;
  totalRouteDistanceKm: number | null;
};

type NearestTransportCompaniesResponse = {
  items?: TransportCompanyResult[];
  error?: string;
};

type GeocodeResponse = {
  item?: {
    lat: number;
    lng: number;
    shortLabel?: string;
    label: string;
  } | null;
  error?: string;
};

type TransportCompareTriggerProps = {
  locale: AppLocale;
  messages: AppMessages["transportCompare"];
  pickupLocation?: TransportCompareLocation | null;
  isLoggedIn?: boolean;
  turnstileSiteKey?: string | null;
  className?: string;
};

const INPUT_CLASS =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#166534] focus:ring-2 focus:ring-[#86efac]/35";
const TRANSPORT_PRIMARY_CLASS =
  "border-[#166534] bg-[#166534] text-white hover:bg-[#14532d]";
const TRANSPORT_SUBTLE_CLASS =
  "border-[#bbf7d0] bg-[#f0fdf4] text-[#14532d]";

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

export function TransportCompareTrigger({
  locale,
  messages,
  pickupLocation,
  isLoggedIn = false,
  turnstileSiteKey = null,
  className = "",
}: TransportCompareTriggerProps) {
  const toast = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [pickupInput, setPickupInput] = useState(pickupLocation?.label ?? "");
  const [deliveryInput, setDeliveryInput] = useState("");
  const [results, setResults] = useState<TransportCompanyResult[] | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<TransportCompanyResult | null>(
    null,
  );
  const [inquiryPhone, setInquiryPhone] = useState("");
  const [inquiryEmail, setInquiryEmail] = useState("");
  const [inquiryMessage, setInquiryMessage] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileRefreshKey, setTurnstileRefreshKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [inquiryError, setInquiryError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingInquiry, setIsSendingInquiry] = useState(false);

  usePageScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const canUsePrefilledPickup = useMemo(
    () =>
      pickupLocation &&
      pickupInput.trim().toLocaleLowerCase() ===
        pickupLocation.label.trim().toLocaleLowerCase(),
    [pickupInput, pickupLocation],
  );

  const resolveTypedLocation = async (
    query: string,
  ): Promise<{ lat: number; lng: number; label: string } | null> => {
    const params = new URLSearchParams({
      q: query,
      lang: locale,
      limit: "1",
    });
    const response = await fetch(`/api/geocode?${params.toString()}`, {
      cache: "no-store",
    });
    const data = (await response.json()) as GeocodeResponse;
    if (!response.ok || !data.item) {
      return null;
    }
    return {
      lat: data.item.lat,
      lng: data.item.lng,
      label: data.item.shortLabel || data.item.label,
    };
  };

  const submit = async () => {
    setError(null);
    setResults(null);
    setSelectedCompany(null);
    const pickupQuery = pickupInput.trim();
    const deliveryQuery = deliveryInput.trim();
    if (pickupQuery.length < 3 || deliveryQuery.length < 3) {
      setError(messages.errors.locationsRequired);
      return;
    }

    setIsLoading(true);
    try {
      const pickup =
        canUsePrefilledPickup && pickupLocation
          ? {
              lat: pickupLocation.lat,
              lng: pickupLocation.lng,
              label: pickupLocation.label,
            }
          : await resolveTypedLocation(pickupQuery);
      const delivery = await resolveTypedLocation(deliveryQuery);
      if (!pickup || !delivery) {
        throw new Error(messages.errors.geocodeFailed);
      }

      const response = await fetch("/api/transport-companies/nearest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup,
          delivery,
          locale,
        }),
      });
      const data = (await response.json()) as NearestTransportCompaniesResponse;
      if (!response.ok) {
        throw new Error(data.error ?? messages.errors.searchFailed);
      }
      setResults(data.items ?? []);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : messages.errors.searchFailed,
      );
    } finally {
      setIsLoading(false);
    }
  };

  const resetInquiryForm = () => {
    setInquiryPhone("");
    setInquiryEmail("");
    setInquiryMessage("");
    setInquiryError(null);
    setTurnstileToken("");
    setTurnstileRefreshKey((current) => current + 1);
  };

  const submitInquiry = async () => {
    if (!selectedCompany) {
      return;
    }

    const email = inquiryEmail.trim();
    const phone = inquiryPhone.trim();
    const message = inquiryMessage.trim();
    setInquiryError(null);
    if (!email && !phone) {
      setInquiryError(messages.inquiryErrors.contactRequired);
      return;
    }
    if (message.length < 10) {
      setInquiryError(messages.inquiryErrors.messageMinLength);
      return;
    }
    if (!isLoggedIn && turnstileSiteKey && !turnstileToken) {
      setInquiryError(messages.inquiryErrors.robotCheck);
      return;
    }

    setIsSendingInquiry(true);
    try {
      const response = await fetch("/api/transport-companies/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: selectedCompany.id,
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
          throw new Error(messages.inquiryErrors.robotCheck);
        }
        if (response.status === 429) {
          throw new Error(messages.inquiryErrors.rateLimited);
        }
        const details = Array.isArray(data?.issues) ? ` (${data.issues.join(", ")})` : "";
        throw new Error((data?.error ?? messages.inquiryErrors.sendFailed) + details);
      }

      resetInquiryForm();
      toast.success(messages.inquirySent);
    } catch (submitError) {
      setInquiryError(
        submitError instanceof Error
          ? submitError.message
          : messages.inquiryErrors.sendFailed,
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
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`inline-flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm transition hover:border-[#86efac] hover:bg-[#dcfce7] ${TRANSPORT_SUBTLE_CLASS} ${className}`}
      >
        <span>
          <span className="font-semibold">{messages.ctaLead}</span>{" "}
          <span className="text-[#166534]">{messages.ctaText}</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold uppercase text-[#166534]">
          {messages.ctaAction}
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
        </span>
      </button>

      {isOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[2000] flex items-center justify-center overflow-y-auto bg-[rgba(2,6,23,0.45)] p-4 backdrop-blur-[2px]"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  setIsOpen(false);
                }
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="transport-compare-title"
                className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-auto rounded-md border border-neutral-300 bg-neutral-50 shadow-2xl"
              >
                <div className="flex items-start justify-between gap-4 border-b border-neutral-200 p-4">
                  <div>
                    <h2
                      id="transport-compare-title"
                      className="text-lg font-semibold text-neutral-900"
                    >
                      {messages.modalTitle}
                    </h2>
                    <p className="mt-1 text-sm text-neutral-600">{messages.modalSubtitle}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-700 hover:bg-neutral-100"
                  >
                    {messages.close}
                  </button>
                </div>

                <div className="grid gap-4 p-4">
                  {selectedCompany ? (
                    <div className="grid gap-4">
                      <div className="flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => setSelectedCompany(null)}
                          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100"
                        >
                          {messages.backToResults}
                        </button>
                        <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${TRANSPORT_SUBTLE_CLASS}`}>
                          {messages.totalDistanceLabel}:{" "}
                          {formatDistanceValue(
                            selectedCompany.totalRouteDistanceKm,
                            messages,
                          )}
                        </span>
                      </div>

                      <article className="rounded-md border border-neutral-300 bg-white p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-semibold text-neutral-900">
                              {selectedCompany.name}
                            </h3>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {selectedCompany.services.map((service) => (
                                <span
                                  key={`${selectedCompany.id}-details-${service}`}
                                  className="rounded-md border border-[#bbf7d0] bg-[#f0fdf4] px-2 py-1 text-xs text-[#14532d]"
                                >
                                  {service === "transport"
                                    ? messages.serviceTransport
                                    : messages.serviceUnloading}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700 sm:grid-cols-2">
                          <p>
                            <span className="font-medium text-neutral-900">
                              {messages.pickupDistanceLabel}:
                            </span>{" "}
                            {formatDistanceValue(
                              selectedCompany.pickupDistanceKm,
                              messages,
                            )}
                          </p>
                          <p>
                            <span className="font-medium text-neutral-900">
                              {messages.deliveryDistanceLabel}:
                            </span>{" "}
                            {formatDistanceValue(
                              selectedCompany.deliveryDistanceKm,
                              messages,
                            )}
                          </p>
                        </div>

                        {selectedCompany.transportPrice ? (
                          <section className="mt-4">
                            <h4 className="text-sm font-semibold text-neutral-900">
                              {messages.priceLabel}
                            </h4>
                            <p className="mt-1 text-sm text-neutral-700">
                              {selectedCompany.transportPrice}
                            </p>
                          </section>
                        ) : null}

                        {selectedCompany.description ? (
                          <section className="mt-4">
                            <h4 className="text-sm font-semibold text-neutral-900">
                              {messages.descriptionLabel}
                            </h4>
                            <p className="mt-1 text-sm leading-6 text-neutral-700">
                              {selectedCompany.description}
                            </p>
                          </section>
                        ) : null}

                        {selectedCompany.terms ? (
                          <section className="mt-4">
                            <h4 className="text-sm font-semibold text-neutral-900">
                              {messages.termsLabel}
                            </h4>
                            <p className="mt-1 text-sm leading-6 text-neutral-700">
                              {selectedCompany.terms}
                            </p>
                          </section>
                        ) : null}

                        <section className="mt-4 grid gap-3 border-t border-neutral-200 pt-4 text-sm text-neutral-700">
                          <p>
                            <span className="font-medium text-neutral-900">
                              {messages.locationLabel}:
                            </span>{" "}
                            {selectedCompany.location.label}
                          </p>
                          <div className="flex flex-wrap gap-3">
                            <a
                              className="text-[#166534] underline underline-offset-2"
                              href={`mailto:${selectedCompany.email}`}
                            >
                              {selectedCompany.email}
                            </a>
                            {selectedCompany.phone ? (
                              <a
                                className="text-[#166534] underline underline-offset-2"
                                href={`tel:${selectedCompany.phone}`}
                              >
                                {selectedCompany.phone}
                              </a>
                            ) : null}
                          </div>
                        </section>

                        <section className="mt-4 grid gap-3 border-t border-neutral-200 pt-4">
                          <h4 className="text-sm font-semibold text-neutral-900">
                            {messages.inquiryTitle}
                          </h4>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="grid gap-1 text-sm font-medium text-neutral-700">
                              {messages.inquiryPhoneLabel}
                              <input
                                className={INPUT_CLASS}
                                type="tel"
                                value={inquiryPhone}
                                onChange={(event) => setInquiryPhone(event.target.value)}
                              />
                            </label>
                            <label className="grid gap-1 text-sm font-medium text-neutral-700">
                              {messages.inquiryEmailLabel}
                              <input
                                className={INPUT_CLASS}
                                type="email"
                                value={inquiryEmail}
                                onChange={(event) => setInquiryEmail(event.target.value)}
                              />
                            </label>
                          </div>
                          <label className="grid gap-1 text-sm font-medium text-neutral-700">
                            {messages.inquiryMessageLabel}
                            <textarea
                              className={INPUT_CLASS}
                              rows={4}
                              value={inquiryMessage}
                              onChange={(event) => setInquiryMessage(event.target.value)}
                              placeholder={messages.inquiryMessagePlaceholder}
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
                              type="button"
                              onClick={submitInquiry}
                              disabled={isSendingInquiry}
                              className={`rounded-md border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 ${TRANSPORT_PRIMARY_CLASS}`}
                            >
                              {isSendingInquiry
                                ? messages.inquirySending
                                : messages.inquirySubmit}
                            </button>
                          </div>
                        </section>
                      </article>
                    </div>
                  ) : (
                    <>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="grid gap-1 text-sm font-medium text-neutral-700">
                          {messages.pickupLabel}
                      <input
                        className={INPUT_CLASS}
                        value={pickupInput}
                        onChange={(event) => setPickupInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void submit();
                          }
                        }}
                        placeholder={messages.pickupPlaceholder}
                      />
                        </label>
                        <label className="grid gap-1 text-sm font-medium text-neutral-700">
                          {messages.deliveryLabel}
                      <input
                        className={INPUT_CLASS}
                        value={deliveryInput}
                        onChange={(event) => setDeliveryInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void submit();
                          }
                        }}
                        placeholder={messages.deliveryPlaceholder}
                      />
                        </label>
                      </div>

                      {error ? (
                        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                          {error}
                        </p>
                      ) : null}

                      <div className="flex items-center justify-between gap-3">
                        <Link
                          href={withLocalePrefix("/transport-companies", locale)}
                          className="text-xs font-medium text-neutral-500 underline underline-offset-2 transition hover:text-[#166534]"
                          onClick={() => setIsOpen(false)}
                        >
                          {messages.allCompaniesLink}
                        </Link>
                        <button
                          type="button"
                          onClick={submit}
                          disabled={isLoading}
                          className={`rounded-md border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 ${TRANSPORT_PRIMARY_CLASS}`}
                        >
                          {isLoading ? messages.searching : messages.searchButton}
                        </button>
                      </div>

                      {results ? (
                        <div className="grid gap-3 border-t border-neutral-200 pt-4">
                          <h3 className="text-sm font-semibold text-neutral-900">
                            {messages.resultsTitle}
                          </h3>
                          {results.length === 0 ? (
                            <p className="text-sm text-neutral-600">{messages.emptyResults}</p>
                          ) : null}
                          {results.map((item) => (
                            <article
                              key={item.id}
                              className="rounded-md border border-neutral-300 bg-white p-3"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="font-semibold text-neutral-900">{item.name}</p>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {item.services.map((service) => (
                                      <span
                                        key={`${item.id}-${service}`}
                                        className="rounded-md border border-[#bbf7d0] bg-[#f0fdf4] px-2 py-1 text-xs text-[#14532d]"
                                      >
                                        {service === "transport"
                                          ? messages.serviceTransport
                                          : messages.serviceUnloading}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${TRANSPORT_SUBTLE_CLASS}`}>
                                  {messages.totalDistanceLabel}:{" "}
                                  {formatDistanceValue(item.totalRouteDistanceKm, messages)}
                                </span>
                              </div>

                              <div className="mt-3 grid gap-1 text-xs text-neutral-600 sm:grid-cols-2">
                                <p>
                                  <span className="font-medium text-neutral-800">
                                    {messages.pickupDistanceLabel}:
                                  </span>{" "}
                                  {formatDistanceValue(item.pickupDistanceKm, messages)}
                                </p>
                                <p>
                                  <span className="font-medium text-neutral-800">
                                    {messages.deliveryDistanceLabel}:
                                  </span>{" "}
                                  {formatDistanceValue(item.deliveryDistanceKm, messages)}
                                </p>
                              </div>

                              {item.transportPrice ? (
                                <p className="mt-3 text-sm text-neutral-700">
                                  <span className="font-medium">{messages.priceLabel}:</span>{" "}
                                  {item.transportPrice}
                                </p>
                              ) : null}

                              <div className="mt-3 flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => setSelectedCompany(item)}
                                  className="inline-flex items-center gap-1 rounded-md border border-[#166534] bg-white px-3 py-1.5 text-sm font-semibold text-[#166534] transition hover:bg-[#dcfce7]"
                                >
                                  {messages.detailsButton}
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
                          ))}
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
