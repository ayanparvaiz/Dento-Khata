// Single source of truth for role names (SQLite stores these as strings).
export const ROLES = {
  ADMIN: 'ADMIN',
  DENTIST: 'DENTIST',
  RECEPTIONIST: 'RECEPTIONIST',
  ASSISTANT: 'ASSISTANT',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ALL_ROLES: Role[] = Object.values(ROLES);
