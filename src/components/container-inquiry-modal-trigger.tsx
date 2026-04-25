"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ContainerInquiryForm } from "@/components/container-inquiry-form";
import { CopyLinkIcon } from "@/components/icons/copy-link-icon";
import { useToast } from "@/components/toast-provider";
import { usePageScrollLock } from "@/components/use-page-scroll-lock";
import { getMessages, resolveLocale } from "@/lib/i18n";

type InquiryIntent = "offer" | "negotiate";

type ContainerInquiryModalTriggerProps = {
  listingId: string;
  isPriceNegotiable: boolean;
  isLoggedIn: boolean;
  initialIsFavorite: boolean;
  turnstileSiteKey?: string | null;
  initialInquiryValues?: {
    buyerName?: string;
    buyerEmail?: string;
    buyerPhone?: string;
  };
  className?: string;
};

const GUEST_FAVORITES_STORAGE_KEY = "container-listing-favorites-v1";
const FAVORITE_SYNC_EVENT = "containerboard:favorite-changed";

function joinClassNames(...parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

function normalizeFavoriteListingIds(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const unique = new Set<string>();
  const output: string[] = [];
  for (const value of input) {
    if (typeof value !== "string") {
      continue;
    }
    const normalized = value.trim().toLowerCase();
    if (!/^[a-f0-9]{24}$/.test(normalized) || unique.has(normalized)) {
      continue;
    }
    unique.add(normalized);
    output.push(normalized);
  }
  return output;
}

function readGuestFavoriteListingIds(): string[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(GUEST_FAVORITES_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    return normalizeFavoriteListingIds(JSON.parse(raw));
  } catch {
    return [];
  }
}

function writeGuestFavoriteListingIds(ids: string[]): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(
      GUEST_FAVORITES_STORAGE_KEY,
      JSON.stringify(normalizeFavoriteListingIds(ids)),
    );
  } catch {
    // Ignore localStorage write failures in private mode.
  }
}

async function copyTextToClipboard(value: string): Promise<boolean> {
  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function"
  ) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Fallback below.
    }
  }

  if (typeof document === "undefined") {
    return false;
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    document.body.append(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  } catch {
    return false;
  }
}

export function ContainerInquiryModalTrigger({
  listingId,
  isPriceNegotiable,
  isLoggedIn,
  initialIsFavorite,
  turnstileSiteKey,
  initialInquiryValues,
  className,
}: ContainerInquiryModalTriggerProps) {
  const locale = resolveLocale(
    typeof document === "undefined" ? "pl" : document.documentElement.lang || "pl",
  );
  const messages = getMessages(locale).inquiryForm;
  const toast = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [intent, setIntent] = useState<InquiryIntent>("offer");
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite);
  const [isPendingFavorite, setIsPendingFavorite] = useState(false);

  usePageScrollLock(isOpen);

  useEffect(() => {
    if (isLoggedIn) {
      setIsFavorite(initialIsFavorite);
      return;
    }
    const normalizedListingId = listingId.trim().toLowerCase();
    const guestFavoriteIds = readGuestFavoriteListingIds();
    setIsFavorite(guestFavoriteIds.includes(normalizedListingId));
  }, [initialIsFavorite, isLoggedIn, listingId]);

  useEffect(() => {
    const syncFavorites = (event: Event) => {
      const customEvent = event as CustomEvent<{
        listingId?: string;
        isFavorite?: boolean;
      }>;
      if (customEvent.detail?.listingId !== listingId) {
        return;
      }
      if (typeof customEvent.detail?.isFavorite === "boolean") {
        setIsFavorite(customEvent.detail.isFavorite);
      }
    };

    window.addEventListener(FAVORITE_SYNC_EVENT, syncFavorites as EventListener);
    return () => {
      window.removeEventListener(FAVORITE_SYNC_EVENT, syncFavorites as EventListener);
    };
  }, [listingId]);

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

  const openForIntent = (nextIntent: InquiryIntent) => {
    setIntent(nextIntent);
    setIsOpen(true);
  };

  const modalTitle = useMemo(() => {
    if (intent === "negotiate") {
      return messages.modalTitleNegotiate;
    }
    return messages.modalTitleOffer;
  }, [intent, messages.modalTitleNegotiate, messages.modalTitleOffer]);

  const notifyFavoriteSync = (nextIsFavorite: boolean) => {
    window.dispatchEvent(
      new CustomEvent(FAVORITE_SYNC_EVENT, {
        detail: {
          listingId,
          isFavorite: nextIsFavorite,
        },
      }),
    );
  };

  const handleCopyLink = async () => {
    if (typeof window === "undefined") {
      return;
    }
    const listingUrl = `${window.location.origin}/containers/${listingId}`;
    const copied = await copyTextToClipboard(listingUrl);
    if (copied) {
      toast.info(messages.copyLinkSuccess);
      return;
    }
    toast.error(messages.copyLinkError);
  };

  const handleToggleFavorite = async () => {
    if (isPendingFavorite) {
      return;
    }
    const normalizedListingId = listingId.trim().toLowerCase();

    if (!isLoggedIn) {
      const guestFavoriteIds = readGuestFavoriteListingIds();
      const nextGuestFavoriteIds = isFavorite
        ? guestFavoriteIds.filter((id) => id !== normalizedListingId)
        : Array.from(new Set([...guestFavoriteIds, normalizedListingId]));
      writeGuestFavoriteListingIds(nextGuestFavoriteIds);
      const nextIsFavorite = !isFavorite;
      setIsFavorite(nextIsFavorite);
      notifyFavoriteSync(nextIsFavorite);
      if (nextIsFavorite) {
        toast.success(messages.favoriteAdded);
      }
      return;
    }

    setIsPendingFavorite(true);
    const previous = isFavorite;
    const optimistic = !previous;
    setIsFavorite(optimistic);
    notifyFavoriteSync(optimistic);

    try {
      const response = await fetch(`/api/containers/${listingId}/favorite`, {
        method: previous ? "DELETE" : "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | { isFavorite?: boolean; error?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? messages.favoriteUpdateError);
      }

      const nextIsFavorite =
        typeof payload?.isFavorite === "boolean" ? payload.isFavorite : optimistic;
      setIsFavorite(nextIsFavorite);
      notifyFavoriteSync(nextIsFavorite);
      if (nextIsFavorite) {
        toast.success(messages.favoriteAdded);
      }
    } catch (error) {
      setIsFavorite(previous);
      notifyFavoriteSync(previous);
      toast.error(
        error instanceof Error
          ? error.message
          : messages.favoriteUpdateError,
      );
    } finally {
      setIsPendingFavorite(false);
    }
  };

  return (
    <>
      <div className={joinClassNames("flex flex-wrap items-center justify-end gap-2", className)}>
        <button
          type="button"
          onClick={handleCopyLink}
          className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100"
        >
          <span className="truncate">{messages.copyLink}</span>
          <CopyLinkIcon className="h-4 w-4 shrink-0" />
        </button>
        <button
          type="button"
          onClick={handleToggleFavorite}
          disabled={isPendingFavorite}
          className={joinClassNames(
            "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition",
            isFavorite
              ? "border-sky-700 bg-sky-700 text-white hover:bg-sky-600"
              : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100",
            isPendingFavorite ? "opacity-60" : undefined,
          )}
        >
          <span className="truncate">
            {isFavorite ? messages.favoriteActive : messages.favorite}
          </span>
          <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 shrink-0">
            <path
              d="M10 17.2 3.9 13a4.4 4.4 0 0 1-1.8-3.6A4.4 4.4 0 0 1 6.5 5a4.6 4.6 0 0 1 3.5 1.6A4.6 4.6 0 0 1 13.5 5a4.4 4.4 0 0 1 4.4 4.4A4.4 4.4 0 0 1 16.1 13L10 17.2Z"
              fill={isFavorite ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => openForIntent("offer")}
          className="inline-flex items-center gap-2 rounded-md border border-sky-700 bg-sky-700 px-3 py-2 text-sm font-medium text-white hover:bg-sky-600"
        >
          <span className="truncate">{messages.requestOffer}</span>
          <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 shrink-0">
            <path d="M3 10h10.5m0 0-3.75-3.75M13.5 10l-3.75 3.75" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {isPriceNegotiable ? (
          <button
            type="button"
            onClick={() => openForIntent("negotiate")}
            className="inline-flex items-center gap-2 rounded-md border border-rose-500 bg-gradient-to-r from-rose-500 to-fuchsia-500 px-3 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:from-rose-600 hover:to-fuchsia-600 active:translate-y-px"
          >
            <span className="truncate">{messages.negotiate}</span>
            <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 shrink-0">
              <path d="M6 6h9m0 0-2.5-2.5M15 6l-2.5 2.5M14 14H5m0 0 2.5 2.5M5 14l2.5-2.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ) : null}
      </div>

      {isOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0"
              style={{ zIndex: 2000 }}
              onClick={() => setIsOpen(false)}
            >
              <div
                className="absolute inset-0"
                style={{ backgroundColor: "rgba(10, 10, 10, 0.8)" }}
              />
              <div
                className="relative flex h-full items-center justify-center p-4"
                style={{ zIndex: 2001 }}
              >
                <div
                  className="w-full max-w-2xl rounded-md border border-neutral-300 bg-neutral-50 p-4 shadow-xl"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-neutral-900">{modalTitle}</h3>
                      <p className="text-sm text-neutral-600">{messages.modalSubtitle}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-600 hover:bg-neutral-100"
                    >
                      {messages.close}
                    </button>
                  </div>

                  <ContainerInquiryForm
                    listingId={listingId}
                    hideHeading
                    theme="light"
                    onSuccess={() => setIsOpen(false)}
                    submitLabel={messages.submitDefault}
                    initialValues={initialInquiryValues}
                    showOfferedPrice={intent === "negotiate"}
                    isLoggedIn={isLoggedIn}
                    turnstileSiteKey={turnstileSiteKey}
                  />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
