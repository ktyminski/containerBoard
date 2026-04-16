"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { formatTemplate, LOCALE_HEADER_NAME, resolveLocale, type AppMessages } from "@/lib/i18n";

export type ToastVariant = "success" | "info" | "warning" | "error";

type ToastInput = {
  message: string;
  variant?: ToastVariant;
  durationMs?: number;
};

type ToastRecord = {
  id: string;
  message: string;
  variant: ToastVariant;
  durationMs: number;
};

type ToastContextValue = {
  showToast: (input: ToastInput) => void;
  dismissToast: (id: string) => void;
  success: (message: string, durationMs?: number) => void;
  info: (message: string, durationMs?: number) => void;
  warning: (message: string, durationMs?: number) => void;
  error: (message: string, durationMs?: number) => void;
};

const DEFAULT_DURATION_MS = 4200;
const MAX_TOASTS = 5;
const RATE_LIMIT_TOAST_COOLDOWN_MS = 5000;

const TOAST_VARIANT_STYLE: Record<ToastVariant, string> = {
  success:
    "border-[#14532d] bg-emerald-950/85 text-emerald-100 shadow-emerald-950/30",
  info: "border-sky-700/80 bg-sky-950/85 text-sky-100 shadow-sky-950/30",
  warning:
    "border-amber-700/80 bg-amber-950/85 text-amber-100 shadow-amber-950/30",
  error: "border-rose-700/80 bg-rose-950/85 text-rose-100 shadow-rose-950/30",
};

const ToastContext = createContext<ToastContextValue | null>(null);

function createToastId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getRateLimitToastMessage(
  messages: AppMessages["common"],
  retryAfterSeconds: number | null,
): string {
  const hasRetry = Number.isFinite(retryAfterSeconds) && retryAfterSeconds !== null;

  return hasRetry
    ? formatTemplate(messages.rateLimitRetry, { seconds: retryAfterSeconds })
    : messages.rateLimitWait;
}

function withLocaleApiHeaders(
  input: RequestInfo | URL,
  init?: RequestInit,
): [RequestInfo | URL, RequestInit | undefined] {
  const requestUrl =
    typeof input === "string" || input instanceof URL
      ? new URL(String(input), window.location.origin)
      : new URL(input.url);
  const isApiRequest =
    requestUrl.origin === window.location.origin &&
    requestUrl.pathname.startsWith("/api/");
  if (!isApiRequest) {
    return [input, init];
  }

  const headers = new Headers(
    input instanceof Request ? input.headers : undefined,
  );
  if (init?.headers) {
    const initHeaders = new Headers(init.headers);
    for (const [key, value] of initHeaders.entries()) {
      headers.set(key, value);
    }
  }

  const locale = resolveLocale(document.documentElement.lang || "pl");
  headers.set(LOCALE_HEADER_NAME, locale);
  if (!headers.has("accept-language")) {
    headers.set("accept-language", locale);
  }

  return [input, { ...init, headers }];
}

export function ToastProvider({
  children,
  messages,
}: {
  children: React.ReactNode;
  messages: AppMessages["common"];
}) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const lastRateLimitToastAtRef = useRef(0);

  const dismissToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (input: ToastInput) => {
      const message = input.message.trim();
      if (!message) {
        return;
      }

      const id = createToastId();
      const nextToast: ToastRecord = {
        id,
        message,
        variant: input.variant ?? "info",
        durationMs: input.durationMs ?? DEFAULT_DURATION_MS,
      };

      setToasts((current) => {
        const trimmed = current.slice(-(MAX_TOASTS - 1));
        return [...trimmed, nextToast];
      });

      const timer = setTimeout(() => {
        dismissToast(id);
      }, nextToast.durationMs);
      timersRef.current.set(id, timer);
    },
    [dismissToast],
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (...args) => {
      const [requestInput, requestInit] = withLocaleApiHeaders(args[0], args[1]);
      const response = await originalFetch(requestInput, requestInit);

      if (response.status !== 429) {
        return response;
      }

      try {
        const payload = (await response.clone().json()) as { error?: string } | null;
        if (payload?.error !== "Rate limit exceeded") {
          return response;
        }
      } catch {
        return response;
      }

      const now = Date.now();
      if (now - lastRateLimitToastAtRef.current < RATE_LIMIT_TOAST_COOLDOWN_MS) {
        return response;
      }

      const retryAfterHeader = response.headers.get("Retry-After");
      const retryAfterSeconds = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : null;
      showToast({
        variant: "warning",
        message: getRateLimitToastMessage(messages, Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : null),
      });
      lastRateLimitToastAtRef.current = now;
      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [showToast, messages]);

  const value = useMemo<ToastContextValue>(
    () => ({
      showToast,
      dismissToast,
      success: (message, durationMs) =>
        showToast({ message, variant: "success", durationMs }),
      info: (message, durationMs) =>
        showToast({ message, variant: "info", durationMs }),
      warning: (message, durationMs) =>
        showToast({ message, variant: "warning", durationMs }),
      error: (message, durationMs) =>
        showToast({ message, variant: "error", durationMs }),
    }),
    [dismissToast, showToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-[4.5rem] z-[120] flex justify-end px-3 sm:px-4">
        <div className="flex w-full max-w-md flex-col gap-2.5">
          {toasts.map((toast) => (
            <article
              key={toast.id}
              role={toast.variant === "error" ? "alert" : "status"}
              aria-live={toast.variant === "error" ? "assertive" : "polite"}
              className={`pointer-events-auto rounded-md border px-4 py-3 shadow-xl backdrop-blur ${TOAST_VARIANT_STYLE[toast.variant]}`}
            >
              <p className="min-w-0 text-[15px] leading-6 whitespace-pre-line">{toast.message}</p>
            </article>
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}
