"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { withLang, type AppLocale, type AppMessages } from "@/lib/i18n";

const COOKIE_NOTICE_STORAGE_KEY = "containerboard_cookie_notice_accepted_v1";
const COOKIE_NOTICE_EVENT = "containerboard-cookie-notice-change";

type AppCookieNoticeProps = {
  locale: AppLocale;
  messages: AppMessages["cookieNotice"];
  isLoggedIn: boolean;
};

function subscribeCookieNotice(onStoreChange: () => void): () => void {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(COOKIE_NOTICE_EVENT, onStoreChange as EventListener);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(COOKIE_NOTICE_EVENT, onStoreChange as EventListener);
  };
}

function getCookieNoticeAcceptedSnapshot(): boolean {
  try {
    return window.localStorage.getItem(COOKIE_NOTICE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function getCookieNoticeAcceptedServerSnapshot(): boolean {
  return false;
}

export function AppCookieNotice({ locale, messages, isLoggedIn }: AppCookieNoticeProps) {
  const isAccepted = useSyncExternalStore(
    subscribeCookieNotice,
    getCookieNoticeAcceptedSnapshot,
    getCookieNoticeAcceptedServerSnapshot,
  );
  const isVisible = !isLoggedIn && !isAccepted;

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-700 bg-slate-950/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-3 py-3 text-xs text-slate-300 sm:flex-row sm:items-center sm:justify-between">
        <p className="leading-relaxed">
          {messages.message}{" "}
          <Link
            href={withLang("/privacy-policy", locale)}
            className="text-sky-300 hover:text-sky-200"
          >
            {messages.privacyLink}
          </Link>
          ,{" "}
          <Link
            href={withLang("/terms", locale)}
            className="text-sky-300 hover:text-sky-200"
          >
            {messages.termsLink}
          </Link>{" "}
          {messages.and}{" "}
          <Link
            href={withLang("/cookies", locale)}
            className="text-sky-300 hover:text-sky-200"
          >
            {messages.cookiesLink}
          </Link>
          .
        </p>
        <button
          type="button"
          className="rounded-md bg-sky-500 px-3 py-1.5 text-xs font-medium text-slate-950 hover:bg-sky-400"
          onClick={() => {
            try {
              window.localStorage.setItem(COOKIE_NOTICE_STORAGE_KEY, "1");
              window.dispatchEvent(new Event(COOKIE_NOTICE_EVENT));
            } catch {
              // ignore storage write issues
            }
          }}
        >
          {messages.accept}
        </button>
      </div>
    </div>
  );
}
