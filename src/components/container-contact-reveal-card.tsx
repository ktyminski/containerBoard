"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

type ContainerContactRevealCardProps = {
  listingId: string;
  contactEmail: string;
  contactPhone?: string;
  isOwnerOrAdmin: boolean;
  initialRevealCount: number;
  labels: {
    title: string;
    email: string;
    phone: string;
    hiddenTitle: string;
    hiddenHint: string;
    revealButton: string;
    loading: string;
    ownerStatsLabel: string;
  };
};

const CONTACT_REVEAL_SESSION_KEY_PREFIX = "container-contact-reveal:v1:";

function getSessionStorageKey(listingId: string): string {
  return `${CONTACT_REVEAL_SESSION_KEY_PREFIX}${listingId}`;
}

export function ContainerContactRevealCard({
  listingId,
  contactEmail,
  contactPhone,
  isOwnerOrAdmin,
  initialRevealCount,
  labels,
}: ContainerContactRevealCardProps) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [revealCount, setRevealCount] = useState(initialRevealCount);
  const hasSubmittedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const wasAlreadyTracked =
      window.sessionStorage.getItem(getSessionStorageKey(listingId)) === "1";
    if (wasAlreadyTracked) {
      hasSubmittedRef.current = true;
    }
  }, [listingId]);

  const revealContact = async () => {
    if (isRevealed) {
      return;
    }

    setIsRevealed(true);

    if (isOwnerOrAdmin || hasSubmittedRef.current) {
      return;
    }

    hasSubmittedRef.current = true;
    setIsSubmitting(true);
    let wasTracked = false;

    try {
      const response = await fetch(`/api/containers/${listingId}/contact-reveal`, {
        method: "POST",
      });
      const data = (await response.json().catch(() => null)) as
        | { count?: number }
        | null;

      if (typeof data?.count === "number" && Number.isFinite(data.count)) {
        setRevealCount(Math.max(0, Math.trunc(data.count)));
        wasTracked = true;
      }
    } catch {
      hasSubmittedRef.current = false;
    } finally {
      if (wasTracked && typeof window !== "undefined") {
        window.sessionStorage.setItem(getSessionStorageKey(listingId), "1");
      }
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    void revealContact();
  };

  return (
    <section className="mt-4 rounded-md border border-sky-200 bg-sky-50/80 p-4 text-sm text-neutral-700">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-sm font-semibold text-neutral-800">
          {labels.title}
        </h2>
        {isOwnerOrAdmin ? (
          <p className="text-xs text-neutral-500">
            {labels.ownerStatsLabel}:{" "}
            <span className="font-semibold text-neutral-800">{revealCount}</span>
          </p>
        ) : null}
      </div>

      {isRevealed ? (
        <div className="mt-3 grid gap-2">
          <p>
            {labels.email}:{" "}
            <a
              className="text-sky-700 hover:text-sky-600"
              href={`mailto:${contactEmail}`}
            >
              {contactEmail}
            </a>
          </p>
          {contactPhone ? (
            <p>
              {labels.phone}:{" "}
              <a
                className="text-sky-700 hover:text-sky-600"
                href={`tel:${contactPhone.replace(/\s+/g, "")}`}
              >
                {contactPhone}
              </a>
            </p>
          ) : null}
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            void revealContact();
          }}
          onKeyDown={handleKeyDown}
          className="mt-3 cursor-pointer rounded-md border border-dashed border-sky-300 bg-white/80 px-4 py-4 transition hover:border-sky-400 hover:bg-white focus:outline-none focus:ring-2 focus:ring-sky-300"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="grid gap-1">
              <p className="font-medium text-neutral-900">{labels.hiddenTitle}</p>
              <p className="text-sm text-neutral-600">{labels.hiddenHint}</p>
            </div>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                void revealContact();
              }}
              className="inline-flex h-10 items-center justify-center rounded-md border border-sky-700 bg-sky-700 px-4 text-sm font-medium text-white transition hover:bg-sky-600"
            >
              {isSubmitting ? labels.loading : labels.revealButton}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
