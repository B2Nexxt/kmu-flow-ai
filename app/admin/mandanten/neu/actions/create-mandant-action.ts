"use server";

import type { PostgrestError } from "@supabase/supabase-js";
import type { MandantenOnboardingData } from "@/app/admin/mandanten/neu/mandanten-onboarding-context";
import { buildOnboardingPayload } from "@/lib/mandanten/build-onboarding-payload";
import { validateFullOnboarding } from "@/lib/mandanten/validate-onboarding";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type CreateMandantActionResult =
  | { success: true; mandantenId: string }
  | { success: false; error: string; validationErrors?: string[] };

const USER_ERROR_MESSAGE =
  "Der Mandant konnte nicht angelegt werden. Bitte versuchen Sie es erneut.";

function logSupabaseErrorInDevelopment(context: string, error: PostgrestError) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.error(`[createMandantAction] ${context}:`, {
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
  });
}

export async function createMandantAction(
  data: MandantenOnboardingData,
): Promise<CreateMandantActionResult> {
  const validation = validateFullOnboarding(data);

  if (!validation.valid) {
    return {
      success: false,
      error: validation.errors[0] ?? USER_ERROR_MESSAGE,
      validationErrors: validation.errors,
    };
  }

  try {
    const supabase = createSupabaseAdminClient();
    const payload = buildOnboardingPayload(data);

    const { data: mandantenId, error } = await supabase.rpc(
      "create_mandant_onboarding",
      { payload },
    );

    if (error) {
      logSupabaseErrorInDevelopment("Supabase RPC create_mandant_onboarding", error);
      return { success: false, error: USER_ERROR_MESSAGE };
    }

    if (!mandantenId || typeof mandantenId !== "string") {
      if (process.env.NODE_ENV === "development") {
        console.error(
          "[createMandantAction] RPC lieferte keine gültige Mandanten-ID:",
          { type: typeof mandantenId, isNull: mandantenId == null },
        );
      }
      return { success: false, error: USER_ERROR_MESSAGE };
    }

    return { success: true, mandantenId };
  } catch (error) {
    if (process.env.NODE_ENV === "development" && error instanceof Error) {
      console.error("[createMandantAction] Unerwarteter Fehler:", error.message);
    }
    return { success: false, error: USER_ERROR_MESSAGE };
  }
}
