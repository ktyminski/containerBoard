import { sanitizeJobDescriptionHtml } from "@/components/job-description-editor";
import { normalizeExternalLink } from "@/lib/external-links";
import { buildShortAddressLabelFromParts } from "@/lib/geocode-address";
import type { AppMessages } from "@/lib/i18n";
import { OFFER_TYPE } from "@/lib/offer-type";
import { stripHtmlToPlainText } from "@/lib/rich-text";
import type { OfferCompany, OfferFormValues } from "@/components/new-offer-form/types";

export type OfferFieldErrorKey =
  | "offerType"
  | "branchId"
  | "title"
  | "description"
  | "tags"
  | "externalLinks";

export type OfferFieldErrors = Partial<Record<OfferFieldErrorKey, string>>;

type OfferMessages = AppMessages["offerCreate"];

export function dedupeNonEmpty(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed) {
      continue;
    }
    const normalized = trimmed.toLowerCase();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      output.push(trimmed);
    }
  }
  return output;
}

function normalizeTagValue(raw: string): string | null {
  const normalized = raw.trim().replace(/,+$/g, "").toLowerCase();
  return normalized || null;
}

export function normalizeTags(values: string[]): string[] {
  return dedupeNonEmpty(values.map((item) => normalizeTagValue(item)));
}

function normalizeExternalLinks(values: string[]): {
  links: string[];
  hasInvalidValue: boolean;
} {
  const unique = new Map<string, string>();
  let hasInvalidValue = false;

  for (const value of values) {
    const normalized = normalizeExternalLink(value);
    if (!normalized) {
      hasInvalidValue = true;
      continue;
    }

    const key = normalized.toLowerCase();
    if (!unique.has(key)) {
      unique.set(key, normalized);
    }
  }

  return {
    links: Array.from(unique.values()),
    hasInvalidValue,
  };
}

export function resolveDefaultOfferValues(input: {
  companies: OfferCompany[];
  initialValues?: Partial<OfferFormValues>;
}): OfferFormValues {
  const { companies, initialValues } = input;
  const defaultCompany = companies[0] ?? null;
  const requestedCompanyId = initialValues?.companyId?.trim() ?? "";
  const selectedCompany =
    companies.find((company) => company.id === requestedCompanyId) ?? defaultCompany;
  const requestedBranchId = initialValues?.branchId?.trim() ?? "";
  const hasRequestedBranch = Boolean(
    requestedBranchId &&
      selectedCompany?.branches.some((branch) => branch.id === requestedBranchId),
  );
  const externalLinks = normalizeExternalLinks(initialValues?.externalLinks ?? []).links;

  return {
    companyId: selectedCompany?.id ?? "",
    offerType: initialValues?.offerType ?? OFFER_TYPE.COOPERATION,
    branchId: hasRequestedBranch
      ? requestedBranchId
      : selectedCompany?.branches[0]?.id ?? "",
    title: initialValues?.title ?? "",
    description: initialValues?.description ?? "",
    tags: normalizeTags(initialValues?.tags ?? []),
    externalLinks,
  };
}

export function resolveSelectedCompany(
  companies: OfferCompany[],
  selectedCompanyId?: string,
): OfferCompany | null {
  if (companies.length === 0) {
    return null;
  }
  return (
    companies.find((company) => company.id === selectedCompanyId) ??
    companies[0] ??
    null
  );
}

export function resolveSelectedBranch(
  company: OfferCompany | null,
  selectedBranchId?: string,
): OfferCompany["branches"][number] | null {
  if (!company) {
    return null;
  }
  return (
    company.branches.find((branch) => branch.id === selectedBranchId) ??
    company.branches[0] ??
    null
  );
}

export function getBranchAddressLabel(
  branch: OfferCompany["branches"][number] | null,
): string {
  if (!branch) {
    return "-";
  }
  return (
    buildShortAddressLabelFromParts({
      parts: branch.addressParts,
      fallbackLabel: branch.addressText,
    }) ||
    branch.addressText ||
    "-"
  );
}

export function validateOfferForSubmit(
  values: OfferFormValues,
  messages: OfferMessages,
): {
  fieldErrors: OfferFieldErrors;
  payload: OfferFormValues;
} {
  const fieldErrors: OfferFieldErrors = {};
  const trimmedTitle = values.title.trim();
  const normalizedDescription = sanitizeJobDescriptionHtml(values.description);
  const plainDescription = stripHtmlToPlainText(normalizedDescription);
  const normalizedTags = normalizeTags(values.tags);
  const normalizedExternalLinks = normalizeExternalLinks(values.externalLinks);

  if (!values.offerType) {
    fieldErrors.offerType = messages.offerTypeRequired;
  }
  if (!values.branchId.trim()) {
    fieldErrors.branchId = messages.branchRequired;
  }
  if (trimmedTitle.length < 3 || trimmedTitle.length > 180) {
    fieldErrors.title = messages.titleLengthError;
  }
  if (plainDescription.length < 20 || plainDescription.length > 5_000) {
    fieldErrors.description = messages.descriptionLengthError;
  }
  if (
    normalizedTags.length > 20 ||
    normalizedTags.some((tag) => tag.length === 0 || tag.length > 40)
  ) {
    fieldErrors.tags = messages.validationError;
  }
  if (
    values.externalLinks.length > 10 ||
    normalizedExternalLinks.hasInvalidValue ||
    normalizedExternalLinks.links.some((link) => link.length > 600)
  ) {
    fieldErrors.externalLinks = messages.externalLinksInvalid;
  }

  return {
    fieldErrors,
    payload: {
      companyId: values.companyId.trim(),
      offerType: values.offerType,
      branchId: values.branchId.trim(),
      title: trimmedTitle,
      description: normalizedDescription,
      tags: normalizedTags,
      externalLinks: normalizedExternalLinks.links,
    },
  };
}

export function getOfferSubmitErrorMessage(input: {
  apiError?: string;
  apiIssues?: string[];
  messages: OfferMessages;
  fallback: string;
}): string {
  const { apiError = "", apiIssues = [], messages, fallback } = input;

  if (apiError === "Invalid externalLinks value") {
    return messages.externalLinksInvalid;
  }

  if (
    apiError === "description is too short after sanitization" ||
    apiError === "description is too long after sanitization"
  ) {
    return messages.descriptionLengthError;
  }

  if (
    apiError === "Selected branch is invalid" ||
    apiError === "Selected branch has no coordinates"
  ) {
    return messages.branchRequired;
  }

  if (apiError === "Validation failed" || apiError === "Invalid payload" || apiIssues.length > 0) {
    return messages.validationError;
  }

  return apiError || fallback;
}
