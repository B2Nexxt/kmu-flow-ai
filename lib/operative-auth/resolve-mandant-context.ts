import { OperativeAuthError } from "./errors";
import type { ActiveMandantContext, ActiveMembership, OperativeRole } from "./types";

export type ResolveMandantSuccess = {
  ok: true;
  context: ActiveMandantContext;
  /** Einzige aktive Mitgliedschaft — Cookie soll serverseitig nachgezogen werden. */
  shouldPersistCookie: boolean;
};

export type ResolveMandantFailure = {
  ok: false;
  code:
    | "no_membership"
    | "inactive_membership"
    | "invalid_mandant_context"
    | "mandant_selection_required";
};

export type ResolveMandantResult = ResolveMandantSuccess | ResolveMandantFailure;

/**
 * Reine Mandantenauflösung (testbar ohne Supabase).
 * memberships: nur aktive Zeilen (RLS liefert bereits aktiv=true).
 */
export function resolveActiveMandantContext(
  userId: string,
  memberships: ActiveMembership[],
  cookieMandantId: string | null,
): ResolveMandantResult {
  if (memberships.length === 0) {
    return { ok: false, code: "no_membership" };
  }

  if (memberships.length === 1) {
    const membership = memberships[0]!;
    const shouldPersistCookie =
      cookieMandantId === null || cookieMandantId !== membership.organizationId;

    return {
      ok: true,
      context: toContext(userId, membership),
      shouldPersistCookie,
    };
  }

  if (cookieMandantId === null) {
    return { ok: false, code: "mandant_selection_required" };
  }

  const selected = memberships.find((m) => m.organizationId === cookieMandantId);
  if (!selected) {
    return { ok: false, code: "invalid_mandant_context" };
  }

  return {
    ok: true,
    context: toContext(userId, selected),
    shouldPersistCookie: false,
  };
}

export function resolveMandantOrThrow(
  userId: string,
  memberships: ActiveMembership[],
  cookieMandantId: string | null,
): ResolveMandantSuccess {
  const result = resolveActiveMandantContext(userId, memberships, cookieMandantId);
  if (!result.ok) {
    throw new OperativeAuthError(result.code);
  }
  return result;
}

function toContext(userId: string, membership: ActiveMembership): ActiveMandantContext {
  return {
    userId,
    mandantId: membership.organizationId,
    role: membership.role,
    organizationName: membership.organizationName,
  };
}

export function assertOperativeRole(
  context: ActiveMandantContext,
  allowedRoles: OperativeRole[],
): void {
  if (!allowedRoles.includes(context.role)) {
    throw new OperativeAuthError("forbidden");
  }
}
