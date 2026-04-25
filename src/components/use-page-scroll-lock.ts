"use client";

import { useEffect } from "react";

let activeScrollLocks = 0;
let previousBodyOverflow = "";
let previousBodyPaddingRight = "";

function getScrollbarWidth(): number {
  return Math.max(0, window.innerWidth - document.documentElement.clientWidth);
}

function shouldCompensateScrollbarWidth(): boolean {
  return window.matchMedia("(min-width: 640px)").matches;
}

function applyScrollLock(): void {
  const body = document.body;
  previousBodyOverflow = body.style.overflow;
  previousBodyPaddingRight = body.style.paddingRight;

  const scrollbarWidth = getScrollbarWidth();
  const computedPaddingRight = Number.parseFloat(
    window.getComputedStyle(body).paddingRight,
  );
  const safePaddingRight = Number.isFinite(computedPaddingRight) ? computedPaddingRight : 0;

  body.style.overflow = "hidden";
  if (scrollbarWidth > 0 && shouldCompensateScrollbarWidth()) {
    body.style.paddingRight = `${safePaddingRight + scrollbarWidth}px`;
  }
}

function releaseScrollLock(): void {
  const body = document.body;
  body.style.overflow = previousBodyOverflow;
  body.style.paddingRight = previousBodyPaddingRight;
}

function acquirePageScrollLock(): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  if (activeScrollLocks === 0) {
    applyScrollLock();
  }
  activeScrollLocks += 1;

  let released = false;
  return () => {
    if (released) {
      return;
    }
    released = true;
    activeScrollLocks = Math.max(0, activeScrollLocks - 1);
    if (activeScrollLocks === 0) {
      releaseScrollLock();
    }
  };
}

export function usePageScrollLock(isLocked: boolean): void {
  useEffect(() => {
    if (!isLocked) {
      return;
    }
    return acquirePageScrollLock();
  }, [isLocked]);
}
