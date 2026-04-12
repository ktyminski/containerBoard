export function stripHtmlToPlainText(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getRichTextLength(value?: string): number {
  if (!value) {
    return 0;
  }

  return stripHtmlToPlainText(value).length;
}

export function hasRichTextContent(value?: string): boolean {
  return getRichTextLength(value) > 0;
}
