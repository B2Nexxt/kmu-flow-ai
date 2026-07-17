"use server";

import type { PostgrestError } from "@supabase/supabase-js";
import { buildUpdateAngebotEntwurfPayload } from "@/lib/angebote/build-update-angebot-entwurf-payload";
import type { UpdateAngebotEntwurfInput } from "@/lib/angebote/update-angebot-entwurf-input";
import {
  UPDATE_ANGEBOT_ENTWURF_USER_ERROR_MESSAGE,
  VERSION_CONFLICT_ERROR_MESSAGE,
  isVersionConflictError,
  type UpdateAngebotEntwurfActionResult,
} from "@/lib/angebote/update-angebot-entwurf-action-result";
import { validateUpdateAngebotEntwurf } from "@/lib/angebote/validate-update-angebot-entwurf";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

function logSupabaseErrorInDevelopment(context: string, error: PostgrestError) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.error(`[updateAngebotEntwurfAction] ${context}:`, {
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
  });
}

export async function updateAngebotEntwurfAction(
  input: UpdateAngebotEntwurfInput,
): Promise<UpdateAngebotEntwurfActionResult> {
  const validation = validateUpdateAngebotEntwurf(input);

  if (!validation.valid) {
    return {
      success: false,
      error: validation.errors[0] ?? UPDATE_ANGEBOT_ENTWURF_USER_ERROR_MESSAGE,
      validationErrors: validation.errors,
    };
  }

  try {
    const supabase = createSupabaseAdminClient();
    const payload = buildUpdateAngebotEntwurfPayload(input);

    const { error } = await supabase.rpc("update_angebot_entwurf", {
      payload,
    });

    if (error) {
      logSupabaseErrorInDevelopment("Supabase RPC update_angebot_entwurf", error);

      if (isVersionConflictError(error.message)) {
        return {
          success: false,
          error: VERSION_CONFLICT_ERROR_MESSAGE,
          conflict: true,
        };
      }

      return { success: false, error: UPDATE_ANGEBOT_ENTWURF_USER_ERROR_MESSAGE };
    }

    return { success: true };
  } catch (error) {
    if (process.env.NODE_ENV === "development" && error instanceof Error) {
      console.error(
        "[updateAngebotEntwurfAction] Unerwarteter Fehler:",
        error.message,
      );
    }
    return { success: false, error: UPDATE_ANGEBOT_ENTWURF_USER_ERROR_MESSAGE };
  }
}
