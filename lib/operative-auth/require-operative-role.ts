import { assertOperativeRole } from "./resolve-mandant-context";
import { getActiveMandantContextOrThrow } from "./get-active-mandant-context";
import type { ActiveMandantContext, OperativeRole } from "./types";

/**
 * Server-only — Mandantenkontext + Rollenprüfung gegen DB-Mitgliedschaft.
 */
export async function requireOperativeRole(
  allowedRoles: OperativeRole[],
): Promise<ActiveMandantContext> {
  const context = await getActiveMandantContextOrThrow();
  assertOperativeRole(context, allowedRoles);
  return context;
}
