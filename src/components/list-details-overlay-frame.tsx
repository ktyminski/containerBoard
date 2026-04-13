"use client";

import {
  createContext,
  useEffect,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { usePageScrollLock } from "@/components/use-page-scroll-lock";

const OVERLAY_CLOSE_ANIMATION_MS = 280;

const ListDetailsOverlayCloseContext = createContext<(() => void) | null>(null);

export function useListDetailsOverlayClose(): (() => void) | null {
  return useContext(ListDetailsOverlayCloseContext);
}

type ListDetailsOverlayFrameProps = {
  listHref: string;
  preferHistoryBack?: boolean;
  animateOnMount?: boolean;
  children: ReactNode;
};

export function ListDetailsOverlayFrame({
  listHref,
  preferHistoryBack = true,
  animateOnMount = true,
  children,
}: ListDetailsOverlayFrameProps) {
  usePageScrollLock(true);

  const router = useRouter();
  const [isClosing, setIsClosing] = useState(false);
  const closeTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  const requestClose = useCallback(() => {
    if (isClosing) {
      return;
    }
    setIsClosing(true);

    closeTimeoutRef.current = window.setTimeout(() => {
      if (preferHistoryBack && window.history.length > 1) {
        router.back();
        return;
      }
      router.push(listHref, { scroll: false });
    }, OVERLAY_CLOSE_ANIMATION_MS);
  }, [isClosing, listHref, preferHistoryBack, router]);

  const panelClassName = useMemo(
    () =>
      [
        "cb-overlay-panel-shell h-full w-full max-w-5xl overflow-y-auto",
        isClosing ? "cb-overlay-panel-exit" : animateOnMount ? "cb-overlay-panel-enter" : "",
      ].join(" "),
    [animateOnMount, isClosing],
  );

  return (
    <section className="fixed inset-x-0 bottom-0 top-16 z-[35]">
      <div className="relative z-10 flex h-full justify-end overflow-hidden">
        <button
          type="button"
          onClick={requestClose}
          onWheel={(event) => {
            event.preventDefault();
          }}
          aria-label="Zamknij podglad ogloszenia"
          className="h-full flex-1"
        />
        <ListDetailsOverlayCloseContext.Provider value={requestClose}>
          <div className={panelClassName}>
            <div className="px-4 py-6 sm:px-6">{children}</div>
          </div>
        </ListDetailsOverlayCloseContext.Provider>
      </div>
    </section>
  );
}
