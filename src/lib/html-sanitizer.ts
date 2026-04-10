import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = ["p", "h2", "h3", "strong", "em", "ul", "ol", "li", "a", "br"];
const ALLOWED_ATTRIBUTES: sanitizeHtml.IOptions["allowedAttributes"] = {
  a: ["href", "target", "rel"],
};

function normalizeAnchorTag(
  tagName: string,
  attribs: Record<string, string>,
): sanitizeHtml.Tag {
  const href = (attribs.href ?? "").trim();

  return {
    tagName,
    attribs: {
      href,
      target: "_blank",
      rel: "noopener noreferrer nofollow",
    },
  };
}

export function sanitizeRichTextHtml(input: string): string {
  const html = input.trim();
  if (!html) {
    return "";
  }

  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: {
      a: ["http", "https", "mailto"],
    },
    disallowedTagsMode: "discard",
    transformTags: {
      a: normalizeAnchorTag,
    },
  }).trim();
}
