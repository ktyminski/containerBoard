export const COMPANY_VERIFICATION_STATUSES = [
  "verified",
  "not_verified",
] as const;

export type CompanyVerificationStatus =
  (typeof COMPANY_VERIFICATION_STATUSES)[number];

export const COMPANY_VERIFICATION_STATUS = {
  VERIFIED: "verified" as CompanyVerificationStatus,
  NOT_VERIFIED: "not_verified" as CompanyVerificationStatus,
};

export function normalizeCompanyVerificationStatus(
  value: string | undefined | null,
): CompanyVerificationStatus {
  return value === COMPANY_VERIFICATION_STATUS.VERIFIED
    ? COMPANY_VERIFICATION_STATUS.VERIFIED
    : COMPANY_VERIFICATION_STATUS.NOT_VERIFIED;
}
