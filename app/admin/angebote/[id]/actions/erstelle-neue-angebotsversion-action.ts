"use server";

import type { PostgrestError } from "@supabase/supabase-js";
import {
  ERSTELLE_NEUE_ANGEBOTSVERSION_USER_ERROR_MESSAGE,
  type ErstelleNeueAngebotsversionActionResult,
} from "@/lib/angebote/erstelle-neue-angebotsversion-action-result";
import { validateErstelleNeueAngebotsversion } from "@/lib/angebote/validate-erstelle-neue-angebotsversion";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

function logSupabaseErrorInDevelopment(context: string, error: PostgrestError) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.error(`[erstelleNeueAngebotsversionAction] ${context}:`, {
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
  });
}

export async function erstelleNeueAngebotsversionAction(
  angebotId: string,
): Promise<ErstelleNeueAngebotsversionActionResult> {
  const validation = validateErstelleNeueAngebotsversion(angebotId);

  if (!validation.valid) {
    return {
      success: false,
      error: validation.errors[0] ?? ERSTELLE_NEUE_ANGEBOTSVERSION_USER_ERROR_MESSAGE,
      validationErrors: validation.errors,
    };
  }

  try {
    const supabase = createSupabaseAdminClient();
    const normalizedAngebotId = angebotId.trim();

    const { data: versionId, error } = await supabase.rpc(
      "erstelle_neue_angebotsversion",
      {
        p_angebot_id: normalizedAngebotId,
      },
    );

    if (error) {
      logSupabaseErrorInDevelopment("Supabase RPC erstelle_neue_angebotsversion", error);
      return {
        success: false,
        error: ERSTELLE_NEUE_ANGEBOTSVERSION_USER_ERROR_MESSAGE,
      };
    }

    if (!versionId || typeof versionId !== "string") {
      if (process.env.NODE_ENV === "development") {
        console.error(
          "[erstelleNeueAngebotsversionAction] RPC lieferte keine gültige Versions-ID:",
          { type: typeof versionId, isNull: versionId == null },
        );
      }
      return {
        success: false,
        error: ERSTELLE_NEUE_ANGEBOTSVERSION_USER_ERROR_MESSAGE,
      };
    }

    const { data: version, error: versionError } = await supabase
      .from("angebot_versionen")
      .select("version_nr")
      .eq("id", versionId)
      .maybeSingle();

    if (versionError || !version) {
      if (versionError) {
        logSupabaseErrorInDevelopment("Versionsabfrage nach RPC", versionError);
      }
      return { success: true, versionId, versionNr: 0 };
    }

    return {
      success: true,
      versionId,
      versionNr: version.version_nr,
    };
  } catch (error) {
    if (process.env.NODE_ENV === "development" && error instanceof Error) {
      console.error(
        "[erstelleNeueAngebotsversionAction] Unerwarteter Fehler:",
        error.message,
      );
    }
    return {
      success: false,
      error: ERSTELLE_NEUE_ANGEBOTSVERSION_USER_ERROR_MESSAGE,
    };
  }
}
