"use server";

import type { PostgrestError } from "@supabase/supabase-js";
import { buildUpdateStammdatenPayload } from "@/lib/mandanten/build-update-stammdaten-payload";
import type { UnternehmensStammdatenInput } from "@/lib/mandanten/unternehmens-stammdaten";
import { validateUnternehmensStammdaten } from "@/lib/mandanten/validate-unternehmens-stammdaten";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type UpdateMandantStammdatenActionResult =
  | { success: true }
  | { success: false; error: string; validationErrors?: string[] };

const USER_ERROR_MESSAGE =
  "Die Stammdaten konnten nicht gespeichert werden. Bitte versuchen Sie es erneut.";

function logSupabaseErrorInDevelopment(context: string, error: PostgrestError) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.error(`[updateMandantStammdatenAction] ${context}:`, {
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
  });
}

export async function updateMandantStammdatenAction(
  mandantenId: string,
  input: UnternehmensStammdatenInput,
): Promise<UpdateMandantStammdatenActionResult> {
  const validation = validateUnternehmensStammdaten(input);

  if (!validation.valid) {
    return {
      success: false,
      error: validation.errors[0] ?? USER_ERROR_MESSAGE,
      validationErrors: validation.errors,
    };
  }

  try {
    const supabase = createSupabaseAdminClient();
    const payload = buildUpdateStammdatenPayload(input);

    const { data, error } = await supabase
      .from("organizations")
      .update(payload)
      .eq("id", mandantenId)
      .select("id")
      .maybeSingle();

    if (error) {
      logSupabaseErrorInDevelopment("Supabase Update organizations", error);
      return { success: false, error: USER_ERROR_MESSAGE };
    }

    if (!data) {
      return { success: false, error: USER_ERROR_MESSAGE };
    }

    return { success: true };
  } catch (error) {
    if (process.env.NODE_ENV === "development" && error instanceof Error) {
      console.error(
        "[updateMandantStammdatenAction] Unerwarteter Fehler:",
        error.message,
      );
    }
    return { success: false, error: USER_ERROR_MESSAGE };
  }
}
