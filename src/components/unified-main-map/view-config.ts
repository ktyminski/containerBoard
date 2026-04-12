import type { AppMessages } from "@/lib/i18n";
import type { ActiveMapView } from "@/components/unified-main-map/types";

export type UnifiedMapViewConfig = {
  spinnerTopBorderClass: string;
  borderHoverClass: string;
};

export const UNIFIED_MAP_VIEW_CONFIG: Record<ActiveMapView, UnifiedMapViewConfig> = {
  offers: {
    spinnerTopBorderClass: "border-t-amber-300",
    borderHoverClass: "hover:border-amber-300/60",
  },
  companies: {
    spinnerTopBorderClass: "border-t-sky-400",
    borderHoverClass: "hover:border-sky-400/60",
  },
};

export function resolveTooManyResultsLabel(input: {
  activeMapView: ActiveMapView;
  offersMessages: AppMessages["mapModules"]["offers"];
  mapMessages: AppMessages["map"];
}): string {
  if (input.activeMapView === "offers") {
    return input.offersMessages.tooManyResults;
  }
  return input.mapMessages.tooManyResults;
}
