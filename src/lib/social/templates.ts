import { getContainerShortLabel } from "@/lib/container-listing-types";
import type { ContainerListingItem } from "@/lib/container-listings";

type SocialCaptionInput = {
  item: ContainerListingItem;
  listingUrl: string;
  dateKey: string;
};

const CONDITION_LABELS: Record<string, string> = {
  new: "nowy",
  one_trip: "one trip",
  cargo_worthy: "cargo worthy",
  wind_water_tight: "wind and water tight",
  as_is: "as-is",
};

function pickTemplate<T>(templates: T[], seed: string): T {
  const charTotal = Array.from(seed).reduce(
    (total, char) => total + char.charCodeAt(0),
    0,
  );
  return templates[charTotal % templates.length];
}

function getLocationLabel(item: ContainerListingItem): string {
  const city = item.locationAddressParts?.city?.trim() || item.locationCity?.trim();
  const country =
    item.locationAddressParts?.country?.trim() || item.locationCountry?.trim();
  if (city && country) {
    return `${city}, ${country}`;
  }
  return city || country || "podanej lokalizacji";
}

function getConditionLabel(item: ContainerListingItem): string {
  return CONDITION_LABELS[item.container.condition] ?? item.container.condition;
}

function getTransportLabel(item: ContainerListingItem): string | null {
  if (item.logisticsTransportAvailable && item.logisticsUnloadingAvailable) {
    return "Transport i rozladunek dostepne po uzgodnieniu.";
  }
  if (item.logisticsTransportAvailable) {
    return "Transport dostepny po uzgodnieniu.";
  }
  if (item.logisticsUnloadingAvailable) {
    return "Rozladunek/HDS dostepny po uzgodnieniu.";
  }
  return null;
}

function getPriceLabel(item: ContainerListingItem): string | null {
  const amount = item.pricing?.original.amount;
  const currency = item.pricing?.original.currency;
  if (typeof amount === "number" && Number.isFinite(amount) && currency) {
    const taxMode = item.pricing?.original.taxMode;
    const suffix = taxMode ? ` ${taxMode}` : "";
    return `${Math.round(amount).toLocaleString("pl-PL")} ${currency}${suffix}`;
  }
  if (typeof item.priceAmount === "number" && Number.isFinite(item.priceAmount)) {
    return `${Math.round(item.priceAmount).toLocaleString("pl-PL")} PLN`;
  }
  if (item.price?.trim()) {
    return item.price.trim();
  }
  return null;
}

function getCommonParts(input: SocialCaptionInput) {
  const label = getContainerShortLabel(input.item.container);
  const location = getLocationLabel(input.item);
  const condition = getConditionLabel(input.item);
  const transport = getTransportLabel(input.item);
  const price = getPriceLabel(input.item);
  const kind = input.item.type === "rent" ? "do wynajecia" : "na sprzedaz";

  return {
    label,
    location,
    condition,
    transport,
    price,
    kind,
  };
}

export function generateFacebookCaption(input: SocialCaptionInput): string {
  const parts = getCommonParts(input);
  const templates = [
    () =>
      [
        `Nowe ogloszenie na ContainerBoard: ${parts.label} ${parts.kind}.`,
        `Lokalizacja: ${parts.location}.`,
        `Stan: ${parts.condition}.`,
        parts.price ? `Cena: ${parts.price}.` : null,
        parts.transport,
        "",
        `Szczegoly: ${input.listingUrl}`,
      ],
    () =>
      [
        `${parts.label} dostepny w lokalizacji ${parts.location}.`,
        `Stan: ${parts.condition}.`,
        parts.transport,
        parts.price ? `Cena: ${parts.price}.` : "Cena do ustalenia.",
        "",
        input.listingUrl,
      ],
    () =>
      [
        `Oferta z ContainerBoard: ${parts.label}.`,
        `${parts.kind.charAt(0).toUpperCase()}${parts.kind.slice(1)} w lokalizacji ${parts.location}.`,
        parts.transport,
        "",
        `Zobacz ogloszenie: ${input.listingUrl}`,
      ],
  ];

  return pickTemplate(templates, `${input.item.id}:facebook:${input.dateKey}`)()
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

export function generateInstagramCaption(input: SocialCaptionInput): string {
  const parts = getCommonParts(input);
  const templates = [
    () =>
      [
        `${parts.label} ${parts.kind}`,
        `${parts.location} | ${parts.condition}`,
        parts.transport,
        "",
        "Szczegoly na ContainerBoard.eu",
        "",
        "#kontenery #kontenerymorskie #containerboard #shippingcontainers #logistyka",
      ],
    () =>
      [
        `Nowe ogloszenie: ${parts.label}`,
        `${parts.location}`,
        parts.price ? `Cena: ${parts.price}` : "Cena do ustalenia",
        "",
        "ContainerBoard.eu",
        "",
        "#kontener #kontenery #transport #magazyn #containerboard",
      ],
    () =>
      [
        `${parts.label} w lokalizacji ${parts.location}`,
        `Stan: ${parts.condition}`,
        parts.transport,
        "",
        "Pelne ogloszenie znajdziesz na ContainerBoard.eu",
        "",
        "#shippingcontainer #kontenerymorskie #hds #containerboard",
      ],
  ];

  return pickTemplate(templates, `${input.item.id}:instagram:${input.dateKey}`)()
    .filter((line): line is string => Boolean(line))
    .join("\n");
}
