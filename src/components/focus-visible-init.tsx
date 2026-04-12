"use client";

import { useEffect } from "react";

export function FocusVisibleInit() {
  useEffect(() => {
    const root = document.documentElement;

    const enableKeyboardFocus = (event: KeyboardEvent) => {
      if (event.key === "Tab") {
        root.classList.add("user-is-tabbing");
      }
    };

    const disableKeyboardFocus = () => {
      root.classList.remove("user-is-tabbing");
    };

    window.addEventListener("keydown", enableKeyboardFocus, true);
    window.addEventListener("pointerdown", disableKeyboardFocus, true);

    return () => {
      window.removeEventListener("keydown", enableKeyboardFocus, true);
      window.removeEventListener("pointerdown", disableKeyboardFocus, true);
    };
  }, []);

  return null;
}
