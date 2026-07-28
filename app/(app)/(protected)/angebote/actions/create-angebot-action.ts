"use server";

import type { PostgrestError } from "@supabase/supabase-js";
import { buildCreateAngebotPayload } from "@/lib/angebote/build-create-angebot-payload";
import type { CreateAngebotInput } from "@/lib/angebote/create-angebot-input";
import { validateCreateAngebot } from "@/lib/angebote/validate-create-angebot";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type CreateAngebotActionResult =
  | { success: true; angebotId: string }
  | { success: false; error: string; validationErrors?: string[] };

const USER_ERROR_MESSAGE =
  "Das Angebot konnte nicht angelegt werden. Bitte versuchen Sie es erneut.";

function logSupabaseErrorInDevelopment(context: string, error: PostgrestError) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.error(`[createAngebotAction] ${context}:`, {
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
  });
}

export async function createAngebotAction(
  input: CreateAngebotInput,
): Promise<CreateAngebotActionResult> {
  const validation = validateCreateAngebot(input);

  if (!validation.valid) {
    return {
      success: false,
      error: validation.errors[0] ?? USER_ERROR_MESSAGE,
      validationErrors: validation.errors,
    };
  }

  try {
    const supabase = createSupabaseAdminClient();
    const payload = buildCreateAngebotPayload(input);

    const { data: angebotId, error } = await supabase.rpc("create_angebot", {
      payload,
    });

    if (error) {
      logSupabaseErrorInDevelopment("Supabase RPC create_angebot", error);
      return { success: false, error: USER_ERROR_MESSAGE };
    }

    if (!angebotId || typeof angebotId !== "string") {
      if (process.env.NODE_ENV === "development") {
        console.error(
          "[createAngebotAction] RPC lieferte keine gültige Angebots-ID:",
          { type: typeof angebotId, isNull: angebotId == null },
        );
      }
      return { success: false, error: USER_ERROR_MESSAGE };
    }

    return { success: true, angebotId };
  } catch (error) {
    if (process.env.NODE_ENV === "development" && error instanceof Error) {
      console.error("[createAngebotAction] Unerwarteter Fehler:", error.message);
    }
    return { success: false, error: USER_ERROR_MESSAGE };
  }
}
