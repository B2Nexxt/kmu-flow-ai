"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { mapVerwerfeAnfrageeingangRpcResult } from "@/lib/anfrageeingang/verwerfe-anfrageeingang-messages";
import { validateVerwerfeAnfrageeingangInput } from "@/lib/anfrageeingang/validate-verwerfe-anfrageeingang-input";
import { VERWERFE_ANFRAGEEINGANG_SYSTEM_ERROR_MESSAGE } from "@/lib/anfrageeingang/verwerfe-anfrageeingang-messages";
import { getActiveMandantContextOrThrow } from "@/lib/operative-auth/get-active-mandant-context";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type VerwerfeAnfrageeingangActionState = {
  error?: string;
};

const QUELLE_MANUELL = "manuell";

function logErrorInDevelopment(context: string, detail: unknown) {
  if (process.env.NODE_ENV === "development") {
    console.error(`[verwerfeAnfrageeingangAction] ${context}:`, detail);
  }
}

export async function verwerfeAnfrageeingangAction(
  _prevState: VerwerfeAnfrageeingangActionState,
  formData: FormData,
): Promise<VerwerfeAnfrageeingangActionState> {
  const anfrageeingangId = String(formData.get("anfrageeingangId") ?? "");
  const grund = String(formData.get("grund") ?? "");

  const validation = validateVerwerfeAnfrageeingangInput(anfrageeingangId, grund);
  if (!validation.valid) {
    return { error: validation.error };
  }

  let mandantId: string;

  try {
    const context = await getActiveMandantContextOrThrow();
    mandantId = context.mandantId;
  } catch (error) {
    logErrorInDevelopment("Mandantenkontext", error);
    return { error: VERWERFE_ANFRAGEEINGANG_SYSTEM_ERROR_MESSAGE };
  }

  let rpcOutcome;

  try {
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase.rpc("verwerfe_anfrageeingang", {
      p_mandant_id: mandantId,
      p_anfrageeingang_id: validation.anfrageeingangId,
      p_grund: validation.grund,
      p_quelle: QUELLE_MANUELL,
    });

    if (error) {
      logErrorInDevelopment("RPC-Fehler", {
        message: error.message,
        code: error.code,
      });
      return { error: VERWERFE_ANFRAGEEINGANG_SYSTEM_ERROR_MESSAGE };
    }

    rpcOutcome = mapVerwerfeAnfrageeingangRpcResult(data);
  } catch (error) {
    logErrorInDevelopment("Unerwarteter Fehler", error);
    return { error: VERWERFE_ANFRAGEEINGANG_SYSTEM_ERROR_MESSAGE };
  }

  if (rpcOutcome.kind === "error") {
    return { error: rpcOutcome.message };
  }

  revalidatePath("/anfrageeingang");
  revalidatePath(`/anfrageeingang/${validation.anfrageeingangId}`);

  const hint =
    rpcOutcome.code === "already_discarded" ? "bereits-verworfen" : "verworfen";
  redirect(`/anfrageeingang/${validation.anfrageeingangId}?hinweis=${hint}`);
}
