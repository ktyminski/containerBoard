import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ContainerDetailsContent } from "@/components/container-details-content";
import { ListDetailsOverlayFrame } from "@/components/list-details-overlay-frame";
import { getLocaleFromRequest, getMessages, LOCALE_COOKIE_NAME } from "@/lib/i18n";

type ListContainerOverlayPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function toSearchParams(
  params: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const output = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const resolved = typeof value === "string" ? value : value?.[0];
    if (resolved) {
      output.set(key, resolved);
    }
  }
  return output;
}

export default async function ListContainerOverlayPage({
  params,
  searchParams,
}: ListContainerOverlayPageProps) {
  const [{ id }, queryParams] = await Promise.all([params, searchParams]);
  const cookieStore = await cookies();
  const locale = getLocaleFromRequest({
    params: queryParams,
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
  });
  const messages = getMessages(locale).containerListings;
  if (id === "mine") {
    redirect("/containers/mine");
  }
  if (id === "new") {
    redirect("/containers/new");
  }
  const listParams = toSearchParams(queryParams);
  const listHref = listParams.toString() ? `/list?${listParams.toString()}` : "/list";

  return (
    <ListDetailsOverlayFrame
      listHref={listHref}
      closeLabel={messages.map.closePreview}
      preferHistoryBack
      animateOnMount={false}
    >
      <ContainerDetailsContent
        listingId={id}
        listHref={listHref}
        preferHistoryBack
        showRelatedListings={false}
      />
    </ListDetailsOverlayFrame>
  );
}
