"use server";

import type { PostgrestError } from "@supabase/supabase-js";
import {
  FREIGEBEN_ANGEBOT_USER_ERROR_MESSAGE,
  type FreigebenAngebotActionResult,
} from "@/lib/angebote/freigeben-angebot-action-result";
import { validateFreigebenAngebot } from "@/lib/angebote/validate-freigeben-angebot";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

function logSupabaseErrorInDevelopment(context: string, error: PostgrestError) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.error(`[freigebenAngebotAction] ${context}:`, {
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
  });
}

export async function freigebenAngebotAction(
  angebotId: string,
): Promise<FreigebenAngebotActionResult> {
  const validation = validateFreigebenAngebot(angebotId);

  if (!validation.valid) {
    return {
      success: false,
      error: validation.errors[0] ?? FREIGEBEN_ANGEBOT_USER_ERROR_MESSAGE,
      validationErrors: validation.errors,
    };
  }

  try {
    const supabase = createSupabaseAdminClient();

    const { data: angebotsnummer, error } = await supabase.rpc("freigeben_angebot", {
      p_angebot_id: angebotId.trim(),
    });

    if (error) {
      logSupabaseErrorInDevelopment("Supabase RPC freigeben_angebot", error);
      return { success: false, error: FREIGEBEN_ANGEBOT_USER_ERROR_MESSAGE };
    }

    if (!angebotsnummer || typeof angebotsnummer !== "string") {
      if (process.env.NODE_ENV === "development") {
        console.error(
          "[freigebenAngebotAction] RPC lieferte keine gültige Angebotsnummer:",
          { type: typeof angebotsnummer, isNull: angebotsnummer == null },
        );
      }
      return { success: false, error: FREIGEBEN_ANGEBOT_USER_ERROR_MESSAGE };
    }

    return { success: true, angebotsnummer };
  } catch (error) {
    if (process.env.NODE_ENV === "development" && error instanceof Error) {
      console.error("[freigebenAngebotAction] Unerwarteter Fehler:", error.message);
    }
    return { success: false, error: FREIGEBEN_ANGEBOT_USER_ERROR_MESSAGE };
  }
}
