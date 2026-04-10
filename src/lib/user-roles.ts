export const USER_ROLE = {
  USER: "user",
  COMPANY_OWNER: "company_owner",
  MODERATOR: "moderator",
  ADMIN: "admin",
} as const;

export const USER_ROLES = [
  USER_ROLE.USER,
  USER_ROLE.COMPANY_OWNER,
  USER_ROLE.MODERATOR,
  USER_ROLE.ADMIN,
] as const;

export const USER_REGISTRATION_ROLES = [
  USER_ROLE.USER,
  USER_ROLE.COMPANY_OWNER,
] as const;

export type UserRole = (typeof USER_ROLES)[number];
export type UserRegistrationRole = (typeof USER_REGISTRATION_ROLES)[number];
