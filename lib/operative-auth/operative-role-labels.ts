import type { OperativeRole } from "./types";

export const OPERATIVE_ROLE_LABELS: Record<OperativeRole, string> = {
  mandanten_admin: "Administrator",
  buero: "Büro",
  bauleiter: "Bauleitung",
  monteur: "Monteur",
};

export function getOperativeRoleLabel(role: OperativeRole): string {
  return OPERATIVE_ROLE_LABELS[role];
}

/** Fallback wenn Organisationsname über Join nicht lesbar ist. */
export const DEFAULT_ORGANIZATION_DISPLAY_NAME = "Handwerksbetrieb";

export function getOrganizationDisplayName(name: string | undefined): string {
  const trimmed = name?.trim();
  return trimmed ? trimmed : DEFAULT_ORGANIZATION_DISPLAY_NAME;
}
