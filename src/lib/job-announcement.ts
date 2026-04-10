export const JOB_WORK_LOCATION_MODE = {
  BRANCH: "branch",
  ANYWHERE: "anywhere",
  MAP: "map",
  MANUAL: "manual",
} as const;

export const JOB_WORK_MODEL = {
  ON_SITE: "on_site",
  HYBRID: "hybrid",
  REMOTE: "remote",
} as const;

export const JOB_EMPLOYMENT_TYPE = {
  FULL_TIME: "full_time",
  PART_TIME: "part_time",
} as const;

export const JOB_CONTRACT_TYPE = {
  B2B: "b2b",
  EMPLOYMENT: "employment",
  MANDATE: "mandate",
  SPECIFIC_WORK: "specific_work",
  INTERNSHIP: "internship",
} as const;

export const JOB_RATE_PERIOD = {
  MONTHLY: "monthly",
  HOURLY: "hourly",
} as const;

export const JOB_ANNOUNCEMENT_PLAN_TIER = {
  BASIC: "basic",
  PLUS: "plus",
  PREMIUM: "premium",
} as const;

export const JOB_ANNOUNCEMENT_REQUIREMENT = {
  DRIVING_LICENSE_B: "driving_license_b",
  DRIVING_LICENSE_CE: "driving_license_ce",
  LOGISTICS_EXPERIENCE: "logistics_experience",
  SHIFT_WORK: "shift_work_readiness",
  TRAVEL_READINESS: "travel_readiness",
  COMPUTER_BASICS: "computer_basics",
  FORKLIFT_UDT: "forklift_udt",
  FOREIGN_LANGUAGE: "foreign_language",
  OWN_BUSINESS_B2B: "own_business_b2b",
} as const;

export const JOB_WORK_LOCATION_MODES = [
  JOB_WORK_LOCATION_MODE.BRANCH,
  JOB_WORK_LOCATION_MODE.ANYWHERE,
  JOB_WORK_LOCATION_MODE.MAP,
  JOB_WORK_LOCATION_MODE.MANUAL,
] as const;

export const JOB_WORK_MODELS = [
  JOB_WORK_MODEL.ON_SITE,
  JOB_WORK_MODEL.HYBRID,
  JOB_WORK_MODEL.REMOTE,
] as const;

export const JOB_EMPLOYMENT_TYPES = [
  JOB_EMPLOYMENT_TYPE.FULL_TIME,
  JOB_EMPLOYMENT_TYPE.PART_TIME,
] as const;

export const JOB_CONTRACT_TYPES = [
  JOB_CONTRACT_TYPE.B2B,
  JOB_CONTRACT_TYPE.EMPLOYMENT,
  JOB_CONTRACT_TYPE.MANDATE,
  JOB_CONTRACT_TYPE.SPECIFIC_WORK,
  JOB_CONTRACT_TYPE.INTERNSHIP,
] as const;

export const JOB_RATE_PERIODS = [
  JOB_RATE_PERIOD.MONTHLY,
  JOB_RATE_PERIOD.HOURLY,
] as const;

export const JOB_ANNOUNCEMENT_PLAN_TIERS = [
  JOB_ANNOUNCEMENT_PLAN_TIER.BASIC,
  JOB_ANNOUNCEMENT_PLAN_TIER.PLUS,
  JOB_ANNOUNCEMENT_PLAN_TIER.PREMIUM,
] as const;

export const JOB_ANNOUNCEMENT_REQUIREMENTS = [
  JOB_ANNOUNCEMENT_REQUIREMENT.DRIVING_LICENSE_B,
  JOB_ANNOUNCEMENT_REQUIREMENT.DRIVING_LICENSE_CE,
  JOB_ANNOUNCEMENT_REQUIREMENT.LOGISTICS_EXPERIENCE,
  JOB_ANNOUNCEMENT_REQUIREMENT.SHIFT_WORK,
  JOB_ANNOUNCEMENT_REQUIREMENT.TRAVEL_READINESS,
  JOB_ANNOUNCEMENT_REQUIREMENT.COMPUTER_BASICS,
  JOB_ANNOUNCEMENT_REQUIREMENT.FORKLIFT_UDT,
  JOB_ANNOUNCEMENT_REQUIREMENT.FOREIGN_LANGUAGE,
  JOB_ANNOUNCEMENT_REQUIREMENT.OWN_BUSINESS_B2B,
] as const;

export type JobWorkLocationMode = (typeof JOB_WORK_LOCATION_MODES)[number];
export type JobWorkModel = (typeof JOB_WORK_MODELS)[number];
export type JobEmploymentType = (typeof JOB_EMPLOYMENT_TYPES)[number];
export type JobContractType = (typeof JOB_CONTRACT_TYPES)[number];
export type JobRatePeriod = (typeof JOB_RATE_PERIODS)[number];
export type JobAnnouncementPlanTier = (typeof JOB_ANNOUNCEMENT_PLAN_TIERS)[number];
export type JobAnnouncementRequirement = (typeof JOB_ANNOUNCEMENT_REQUIREMENTS)[number];
