export const JOB_CONTRACT_TYPES = [
  "b2b",
  "employment",
  "mandate",
  "specific_work",
  "internship",
] as const;

export type JobContractType = (typeof JOB_CONTRACT_TYPES)[number];

export const JOB_WORK_MODELS = ["on_site", "hybrid", "remote"] as const;
export type JobWorkModel = (typeof JOB_WORK_MODELS)[number];

export const JOB_EMPLOYMENT_TYPES = ["full_time", "part_time"] as const;
export type JobEmploymentType = (typeof JOB_EMPLOYMENT_TYPES)[number];

export const JOB_RATE_PERIOD = {
  HOURLY: "hourly",
  MONTHLY: "monthly",
} as const;

export type JobRatePeriod = (typeof JOB_RATE_PERIOD)[keyof typeof JOB_RATE_PERIOD];
