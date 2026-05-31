// Two roles only. ADMIN has every permission; ASSISTANT only what the admin grants.
export const ROLES = {
  ADMIN: 'ADMIN',
  ASSISTANT: 'ASSISTANT',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];
export const ALL_ROLES: Role[] = Object.values(ROLES);

// Capabilities an admin can grant to an assistant (coarse, per-module actions).
// Viewing is always allowed for a logged-in user; these gate create/edit actions.
export const CAPABILITIES: { key: string; label: string }[] = [
  { key: 'patients.manage', label: 'Add / edit patients' },
  { key: 'medical.manage', label: 'Edit medical history' },
  { key: 'charting.manage', label: 'Dental charting' },
  { key: 'treatment.manage', label: 'Treatment plans' },
  { key: 'billing.manage', label: 'Billing & payments' },
  { key: 'prescriptions.manage', label: 'Prescriptions' },
  { key: 'imaging.manage', label: 'Imaging upload' },
  { key: 'notes.manage', label: 'Clinical notes' },
  { key: 'appointments.manage', label: 'Appointments' },
  { key: 'reports.view', label: 'Reports' },
];
export const CAP_KEYS = CAPABILITIES.map((c) => c.key);
