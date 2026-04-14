import { redirect } from "next/navigation";

type MapsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function toUrlSearchParams(params: Record<string, string | string[] | undefined>): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        search.append(key, item);
      }
      continue;
    }
    search.set(key, value);
  }

  const serialized = search.toString();
  return serialized ? `?${serialized}` : "";
}

export default async function MapsPage({ searchParams }: MapsPageProps) {
  const params = await searchParams;
  redirect(`/list${toUrlSearchParams(params)}`);
}
