export const COMPANY_SPECIALIZATIONS = [
  "domestic-transport",
  "international-transport",
  "refrigerated-transport",
  "adr-transport",
  "oversize-transport",
  "express-transport",
  "container-transport",
  "intermodal-transport",
  "full-truckload",
  "less-than-truckload",
  "last-mile-delivery",
  "ecommerce-fulfillment",
  "contract-logistics",
  "cross-docking",
  "customs-clearance",
  "port-logistics",
  "air-freight",
  "sea-freight",
  "rail-freight",
  "temperature-controlled-storage",
  "automotive-logistics",
  "pharma-logistics",
  "heavy-cargo",
  "project-cargo",
  "tanker-transport",
  "livestock-transport",
  "hazardous-storage",
  "bonded-warehouse",
  "returns-handling",
  "pallet-distribution",
] as const;

export type CompanySpecialization = (typeof COMPANY_SPECIALIZATIONS)[number];

export function normalizeCompanySpecializations(
  values: string[] | undefined,
): CompanySpecialization[] {
  if (!values || values.length === 0) {
    return [];
  }

  const allowed = new Set<string>(COMPANY_SPECIALIZATIONS);
  return Array.from(
    new Set(
      values.filter(
        (value): value is CompanySpecialization => allowed.has(value),
      ),
    ),
  );
}
