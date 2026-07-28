"use server";

import { createSupabaseServerAuthClient } from "@/lib/supabase/server-auth";

import { writeActiveMandantCookie } from "./active-mandant-cookie";
import { OperativeAuthError, type OperativeAuthErrorCode } from "./errors";
import { isOperativeRole } from "./types";
import { requireAuthenticatedUser } from "./require-authenticated-user";

export type SwitchActiveMandantResult =
  | { success: true }
  | { success: false; code: OperativeAuthErrorCode };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Server Action — aktiven Mandanten wechseln (Auswahl-UI /mandant-waehlen).
 * Verifiziert aktive Mitgliedschaft über Self-Read-RLS — kein Service Role.
 */
export async function switchActiveMandant(
  organizationId: string,
): Promise<SwitchActiveMandantResult> {
  if (!UUID_RE.test(organizationId)) {
    return { success: false, code: "invalid_mandant_context" };
  }

  try {
    const { userId } = await requireAuthenticatedUser();
    const supabase = await createSupabaseServerAuthClient();

    const { data, error } = await supabase
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", userId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (error || !data || !isOperativeRole(data.role)) {
      return { success: false, code: "invalid_mandant_context" };
    }

    await writeActiveMandantCookie(organizationId);
    return { success: true };
  } catch (error) {
    if (error instanceof OperativeAuthError) {
      return { success: false, code: error.code };
    }
    throw error;
  }
}
