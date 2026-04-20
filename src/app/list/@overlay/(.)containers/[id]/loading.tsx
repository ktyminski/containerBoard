import { cookies } from "next/headers";
import { ListDetailsOverlayFrame } from "@/components/list-details-overlay-frame";
import { DetailsBackButton } from "@/components/details-back-button";
import { getLocaleFromRequest, getMessages, LOCALE_COOKIE_NAME } from "@/lib/i18n";

export default async function ListContainerOverlayLoading() {
  const cookieStore = await cookies();
  const locale = getLocaleFromRequest({
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
  });
  const pageMessages = getMessages(locale);
  const messages = pageMessages.containerModules;
  const listingMessages = pageMessages.containerListings;
  return (
    <ListDetailsOverlayFrame
      listHref="/list"
      closeLabel={listingMessages.map.closePreview}
      animateOnMount={false}
    >
      <div className="grid gap-4">
        <div className="flex items-center justify-between gap-2">
          <DetailsBackButton
            href="/list"
            label={messages.shared.backToList}
            className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-200 hover:border-neutral-500"
          />
        </div>

        <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 text-neutral-600">
          <span
            className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-500"
            aria-label={listingMessages.map.loadingDetailsAria}
          />
          <p className="text-sm">{listingMessages.map.loadingDetails}</p>
        </div>
      </div>
    </ListDetailsOverlayFrame>
  );
}
