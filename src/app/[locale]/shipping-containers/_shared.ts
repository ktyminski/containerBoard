import { notFound } from "next/navigation";
import { SUPPORTED_LOCALES, type AppLocale } from "@/lib/i18n";
import type { ContainerSeoKind } from "@/lib/seo-containers";

export const CONTAINER_SEO_ROUTE_INTENTS = ["for-sale", "for-rent", "wanted"] as const;

export function resolveRouteLocale(input: string): AppLocale {
  const normalized = input.toLowerCase();
  return (SUPPORTED_LOCALES as readonly string[]).includes(normalized)
    ? (normalized as AppLocale)
    : notFound();
}

export function resolveContainerSeoRouteKind(input: string): ContainerSeoKind {
  if (input === "for-sale") {
    return "sell";
  }
  if (input === "for-rent") {
    return "rent";
  }
  if (input === "wanted") {
    return "buy";
  }
  notFound();
}
