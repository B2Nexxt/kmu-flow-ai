"use server";

import type { PostgrestError } from "@supabase/supabase-js";
import type { AnsprechpartnerInput } from "@/lib/mandanten/ansprechpartner-input";
import { buildContacts } from "@/lib/mandanten/build-onboarding-payload";
import { validateAnsprechpartner } from "@/lib/mandanten/validate-onboarding";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type UpdateMandantAnsprechpartnerActionResult =
  | { success: true }
  | { success: false; error: string; validationErrors?: string[] };

const USER_ERROR_MESSAGE =
  "Die Ansprechpartner konnten nicht gespeichert werden. Bitte versuchen Sie es erneut.";

function logSupabaseErrorInDevelopment(context: string, error: PostgrestError) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.error(`[updateMandantAnsprechpartnerAction] ${context}:`, {
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
  });
}

export async function updateMandantAnsprechpartnerAction(
  mandantenId: string,
  input: AnsprechpartnerInput,
): Promise<UpdateMandantAnsprechpartnerActionResult> {
  const validationErrors = validateAnsprechpartner(input);

  if (validationErrors.length > 0) {
    return {
      success: false,
      error: validationErrors[0] ?? USER_ERROR_MESSAGE,
      validationErrors,
    };
  }

  try {
    const supabase = createSupabaseAdminClient();
    const contacts = buildContacts(input);

    const { data: organizationId, error } = await supabase.rpc(
      "replace_organization_contacts",
      {
        p_organization_id: mandantenId,
        p_contacts: contacts,
      },
    );

    if (error) {
      logSupabaseErrorInDevelopment(
        "Supabase RPC replace_organization_contacts",
        error,
      );
      return { success: false, error: USER_ERROR_MESSAGE };
    }

    if (!organizationId || typeof organizationId !== "string") {
      if (process.env.NODE_ENV === "development") {
        console.error(
          "[updateMandantAnsprechpartnerAction] RPC lieferte keine gültige Organization-ID:",
          { type: typeof organizationId, isNull: organizationId == null },
        );
      }
      return { success: false, error: USER_ERROR_MESSAGE };
    }

    return { success: true };
  } catch (error) {
    if (process.env.NODE_ENV === "development" && error instanceof Error) {
      console.error(
        "[updateMandantAnsprechpartnerAction] Unerwarteter Fehler:",
        error.message,
      );
    }
    return { success: false, error: USER_ERROR_MESSAGE };
  }
}
