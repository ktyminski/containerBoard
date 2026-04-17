import sanitizeHtml from "sanitize-html";
import { hasRichTextContent } from "@/lib/listing-rich-text";

export const LISTING_DESCRIPTION_MAX_TEXT_LENGTH = 1000;
export const LISTING_DESCRIPTION_ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "u",
  "ul",
  "li",
  "div",
] as const;

function normalizeOrderedListsToUnordered(html: string): string {
  return html
    .replace(/<ol(\s[^>]*)?>/gi, (_match, attrs: string | undefined) => {
      return `<ul${attrs ?? ""}>`;
    })
    .replace(/<\/ol>/gi, "</ul>");
}

export function sanitizeListingDescriptionHtml(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const normalizedListsMarkup = normalizeOrderedListsToUnordered(trimmed);
  return sanitizeHtml(normalizedListsMarkup, {
    allowedTags: [...LISTING_DESCRIPTION_ALLOWED_TAGS],
    allowedAttributes: {},
  }).trim();
}

export function normalizeOptionalListingDescriptionHtml(
  value?: string,
): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || !hasRichTextContent(trimmed)) {
    return undefined;
  }

  const sanitized = sanitizeListingDescriptionHtml(trimmed);
  if (!sanitized || !hasRichTextContent(sanitized)) {
    return undefined;
  }

  return sanitized;
}

