import { createSupabaseServerAuthClient } from "@/lib/supabase/server-auth";

import { readActiveMandantCookie } from "./active-mandant-cookie";
import { OperativeAuthError } from "./errors";
import { loadActiveMemberships } from "./load-active-memberships";
import { resolveMandantOrThrow } from "./resolve-mandant-context";
import type { ActiveMandantContext } from "./types";
import { requireAuthenticatedUser } from "./require-authenticated-user";

export type ActiveMandantContextResult = {
  context: ActiveMandantContext;
  /** Cookie-Nachzug nötig (nur bei genau einer aktiven Mitgliedschaft). */
  shouldPersistCookie: boolean;
};

/**
 * Server-only — liest Mandantenkontext; setzt **keinen** Cookie (Next.js Server Component Grenze).
 * Cookie-Initialisierung: Route Handler `/api/operative-auth/init-mandant` oder `switchActiveMandant`.
 */
export async function getActiveMandantContext(): Promise<ActiveMandantContextResult> {
  const { userId } = await requireAuthenticatedUser();
  const supabase = await createSupabaseServerAuthClient();
  const cookieMandantId = await readActiveMandantCookie();

  const { memberships, loadError } = await loadActiveMemberships(supabase, userId);

  if (loadError) {
    if (process.env.NODE_ENV === "development") {
      console.error("[operative-auth] Mitgliedschaften konnten nicht geladen werden.");
    }
    throw new OperativeAuthError("invalid_mandant_context");
  }

  const resolved = resolveMandantOrThrow(userId, memberships, cookieMandantId);
  return {
    context: resolved.context,
    shouldPersistCookie: resolved.shouldPersistCookie,
  };
}

/**
 * Wie getActiveMandantContext, wirft aber nicht bei fehlendem Cookie-Nachzug —
 * liefert nur den fachlichen Kontext (für Actions nach Cookie-Set).
 */
export async function getActiveMandantContextOrThrow(): Promise<ActiveMandantContext> {
  const { context } = await getActiveMandantContext();
  return context;
}
