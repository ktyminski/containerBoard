"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { NAV_HISTORY_STACK_KEY } from "@/components/in-app-navigation-history-tracker";

type SmartBackButtonProps = {
  label: string;
  preferredHref?: string;
  fallbackHref?: string;
  hideWhenNoHistory?: boolean;
  className?: string;
};

function normalizeHrefForHistory(href: string): string {
  const [pathname, query = ""] = href.split("?");
  const search = new URLSearchParams(query);
  search.delete("lang");
  const normalizedQuery = search.toString();
  return normalizedQuery ? `${pathname}?${normalizedQuery}` : pathname;
}

function getSameOriginReferrerHref(): string | null {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return null;
  }

  const rawReferrer = document.referrer?.trim();
  if (!rawReferrer) {
    return null;
  }

  try {
    const referrerUrl = new URL(rawReferrer);
    if (referrerUrl.origin !== window.location.origin) {
      return null;
    }

    return `${referrerUrl.pathname}${referrerUrl.search}`;
  } catch {
    return null;
  }
}

export function SmartBackButton({
  label,
  preferredHref,
  fallbackHref,
  hideWhenNoHistory = false,
  className,
}: SmartBackButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentHref = useMemo(() => {
    const query = searchParams.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

  const getInternalBackTarget = (current: string): string | null => {
    if (typeof window === "undefined") {
      return null;
    }

    try {
      const raw = window.sessionStorage.getItem(NAV_HISTORY_STACK_KEY);
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      const stack = Array.isArray(parsed)
        ? parsed.filter((entry): entry is string => typeof entry === "string")
        : [];
      if (stack.length === 0) {
        return null;
      }
      const normalizedCurrent = normalizeHrefForHistory(current);
      for (let index = stack.length - 1; index >= 0; index -= 1) {
        const candidate = stack[index];
        if (!candidate) {
          continue;
        }
        if (normalizeHrefForHistory(candidate) === normalizedCurrent) {
          continue;
        }
        return candidate;
      }
      return null;
    } catch {
      return null;
    }
  };

  const internalTargetHref = useMemo(() => {
    const target = getInternalBackTarget(currentHref);
    return target &&
      normalizeHrefForHistory(target) !== normalizeHrefForHistory(currentHref)
      ? target
      : null;
  }, [currentHref]);

  const referrerTargetHref = useMemo(() => {
    const target = getSameOriginReferrerHref();
    return target &&
      normalizeHrefForHistory(target) !== normalizeHrefForHistory(currentHref)
      ? target
      : null;
  }, [currentHref]);

  const preferredTargetHref = useMemo(() => {
    const target = preferredHref?.trim();
    return target &&
      normalizeHrefForHistory(target) !== normalizeHrefForHistory(currentHref)
      ? target
      : null;
  }, [currentHref, preferredHref]);

  const handleClick = () => {
    if (preferredTargetHref) {
      router.push(preferredTargetHref);
      return;
    }

    const currentFromWindow =
      typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}`
        : currentHref;
    const currentReferrerTarget = getSameOriginReferrerHref();
    if (
      currentReferrerTarget &&
      normalizeHrefForHistory(currentReferrerTarget) !==
        normalizeHrefForHistory(currentFromWindow)
    ) {
      router.push(currentReferrerTarget);
      return;
    }

    const target = getInternalBackTarget(currentFromWindow);
    if (
      target &&
      normalizeHrefForHistory(target) !== normalizeHrefForHistory(currentFromWindow)
    ) {
      router.push(target);
      return;
    }

    if (internalTargetHref) {
      router.push(internalTargetHref);
      return;
    }

    if (!fallbackHref) {
      return;
    }

    if (typeof window === "undefined") {
      router.push(fallbackHref);
      return;
    }

    router.push(fallbackHref);
  };

  if (
    hideWhenNoHistory &&
    !preferredTargetHref &&
    !internalTargetHref &&
    !referrerTargetHref
  ) {
    return null;
  }

  return (
    <button type="button" className={className} onClick={handleClick}>
      <span aria-hidden="true">&larr;</span>
      {label}
    </button>
  );
}
