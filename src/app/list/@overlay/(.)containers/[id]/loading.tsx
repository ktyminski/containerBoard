import { ListDetailsOverlayFrame } from "@/components/list-details-overlay-frame";
import { DetailsBackButton } from "@/components/details-back-button";

export default function ListContainerOverlayLoading() {
  return (
    <ListDetailsOverlayFrame listHref="/list" animateOnMount={false}>
      <div className="grid gap-4">
        <div className="flex items-center justify-between gap-2">
          <DetailsBackButton
            href="/list"
            className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-200 hover:border-neutral-500"
          />
        </div>

        <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 text-neutral-600">
          <span
            className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-500"
            aria-label="Ladowanie szczegolow ogloszenia"
          />
          <p className="text-sm">Ladowanie szczegolow ogloszenia...</p>
        </div>
      </div>
    </ListDetailsOverlayFrame>
  );
}
