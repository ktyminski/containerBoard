"use client";

import { useEffect } from "react";

type ContainerListingViewTrackerProps = {
  listingId: string;
  enabled: boolean;
};

export function ContainerListingViewTracker({
  listingId,
  enabled,
}: ContainerListingViewTrackerProps) {
  useEffect(() => {
    if (!enabled || !listingId) {
      return;
    }

    void fetch(`/api/containers/${listingId}/view`, {
      method: "POST",
      cache: "no-store",
      keepalive: true,
    }).catch(() => {
      // View tracking should never interrupt the listing details experience.
    });
  }, [enabled, listingId]);

  return null;
}
