export const COMPANY_OPERATING_AREA = {
  LOCAL: "local",
  POLAND: "poland",
  EU: "eu",
  INTERNATIONAL: "international",
} as const;

export const COMPANY_OPERATING_AREAS = [
  COMPANY_OPERATING_AREA.LOCAL,
  COMPANY_OPERATING_AREA.POLAND,
  COMPANY_OPERATING_AREA.EU,
  COMPANY_OPERATING_AREA.INTERNATIONAL,
] as const;

export type CompanyOperatingArea = (typeof COMPANY_OPERATING_AREAS)[number];

export function normalizeCompanyOperatingArea(
  value: string | undefined | null,
): CompanyOperatingArea {
  if (!value) {
    return COMPANY_OPERATING_AREA.LOCAL;
  }
  return COMPANY_OPERATING_AREAS.includes(value as CompanyOperatingArea)
    ? (value as CompanyOperatingArea)
    : COMPANY_OPERATING_AREA.LOCAL;
}
