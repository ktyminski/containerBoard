"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export const NAV_HISTORY_STACK_KEY = "containerboard:nav:stack";
const NAV_HISTORY_STACK_LIMIT = 50;

function buildCurrentHref(pathname: string, searchParams: ReturnType<typeof useSearchParams>): string {
  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function normalizeHrefForHistory(href: string): string {
  const [pathname, query = ""] = href.split("?");
  const search = new URLSearchParams(query);
  search.delete("lang");
  const normalizedQuery = search.toString();
  return normalizedQuery ? `${pathname}?${normalizedQuery}` : pathname;
}

export function InAppNavigationHistoryTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const currentHref = buildCurrentHref(pathname, searchParams);
    const normalizedCurrentHref = normalizeHrefForHistory(currentHref);
    try {
      const raw = window.sessionStorage.getItem(NAV_HISTORY_STACK_KEY);
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      const stack = Array.isArray(parsed)
        ? parsed.filter((entry): entry is string => typeof entry === "string")
        : [];
      const last = stack[stack.length - 1];
      const normalizedLastHref = last ? normalizeHrefForHistory(last) : null;

      if (!last || normalizedLastHref !== normalizedCurrentHref) {
        stack.push(currentHref);
        if (stack.length > NAV_HISTORY_STACK_LIMIT) {
          stack.splice(0, stack.length - NAV_HISTORY_STACK_LIMIT);
        }
        window.sessionStorage.setItem(NAV_HISTORY_STACK_KEY, JSON.stringify(stack));
        return;
      }

      if (last !== currentHref) {
        // Keep top entry in sync with latest query (including current lang),
        // but do not grow history for language-only URL changes.
        stack[stack.length - 1] = currentHref;
        window.sessionStorage.setItem(NAV_HISTORY_STACK_KEY, JSON.stringify(stack));
      }
    } catch {
      // Ignore storage access issues in restricted environments.
    }
  }, [pathname, searchParams]);

  return null;
}
