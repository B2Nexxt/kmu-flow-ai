export const OPERATIVE_ROLES = [
  "mandanten_admin",
  "buero",
  "bauleiter",
  "monteur",
] as const;

export type OperativeRole = (typeof OPERATIVE_ROLES)[number];

export type ActiveMandantContext = {
  userId: string;
  mandantId: string;
  role: OperativeRole;
  organizationName?: string;
};

export type ActiveMembership = {
  organizationId: string;
  role: OperativeRole;
  organizationName?: string;
};

export function isOperativeRole(value: string): value is OperativeRole {
  return (OPERATIVE_ROLES as readonly string[]).includes(value);
}
