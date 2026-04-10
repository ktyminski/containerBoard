export const COMPANY_BENEFITS = [
  "private_medical_care",
  "life_or_accident_insurance",
  "sports_card",
  "performance_bonus",
  "attendance_bonus",
  "employee_referral_program",
  "flexible_schedule",
  "paid_overtime",
  "trainings_and_development",
  "certification_funding",
  "modern_fleet_or_equipment",
  "employee_parking",
  "meal_subsidy_or_canteen",
  "stable_employment",
  "integration_events",
] as const;

export type CompanyBenefit = (typeof COMPANY_BENEFITS)[number];
