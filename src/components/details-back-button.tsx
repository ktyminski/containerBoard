"use client";

import { useRouter } from "next/navigation";
import { useListDetailsOverlayClose } from "@/components/list-details-overlay-frame";

type DetailsBackButtonProps = {
  href: string;
  className?: string;
  preferHistoryBack?: boolean;
  label: string;
};

export function DetailsBackButton({
  href,
  className,
  preferHistoryBack = false,
  label,
}: DetailsBackButtonProps) {
  const router = useRouter();
  const overlayClose = useListDetailsOverlayClose();

  return (
    <button
      type="button"
      onClick={() => {
        if (overlayClose) {
          overlayClose();
          return;
        }
        if (preferHistoryBack && typeof window !== "undefined" && window.history.length > 1) {
          router.back();
          return;
        }
        router.push(href);
      }}
      className={className}
    >
      <span className="inline-flex items-center gap-2">
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M15 18 9 12l6-6" />
        </svg>
        <span>{label}</span>
      </span>
    </button>
  );
}
