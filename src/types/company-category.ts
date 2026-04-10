export const COMPANY_CATEGORIES = [
  "warehouse",
  "transport",
  "freight-forwarding",
  "logistics",
  "staffing-agency",
  "other",
] as const;

export type CompanyCategory = (typeof COMPANY_CATEGORIES)[number];

export function normalizeCompanyCategory(
  value: string | undefined,
): CompanyCategory {
  if (!value) {
    return "other";
  }

  return COMPANY_CATEGORIES.includes(value as CompanyCategory)
    ? (value as CompanyCategory)
    : "other";
}
