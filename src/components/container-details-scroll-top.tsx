"use client";

import { useEffect } from "react";

type ContainerDetailsScrollTopProps = {
  listingId: string;
};

export function ContainerDetailsScrollTop({ listingId }: ContainerDetailsScrollTopProps) {
  useEffect(() => {
    const overlayPanel = document.querySelector(".cb-overlay-panel-shell");
    if (overlayPanel instanceof HTMLElement) {
      overlayPanel.scrollTo({ top: 0, left: 0, behavior: "auto" });
      return;
    }

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [listingId]);

  return null;
}

