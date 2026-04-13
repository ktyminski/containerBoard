import { ContainerDetailsContent } from "@/components/container-details-content";
import { ListDetailsOverlayFrame } from "@/components/list-details-overlay-frame";

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
  const listParams = toSearchParams(queryParams);
  const listHref = listParams.toString() ? `/list?${listParams.toString()}` : "/list";

  return (
    <ListDetailsOverlayFrame listHref={listHref} preferHistoryBack animateOnMount={false}>
      <ContainerDetailsContent
        listingId={id}
        listHref={listHref}
        preferHistoryBack
      />
    </ListDetailsOverlayFrame>
  );
}
