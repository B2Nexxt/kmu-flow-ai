"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  CREATE_ANFRAGEEINGANG_SYSTEM_ERROR_MESSAGE,
  mapCreateAnfrageeingangRpcResult,
} from "@/lib/anfrageeingang/create-anfrageeingang-messages";
import {
  parseCreateAnfrageeingangFormData,
  validateCreateAnfrageeingangInput,
} from "@/lib/anfrageeingang/validate-create-anfrageeingang-input";
import { getActiveMandantContextOrThrow } from "@/lib/operative-auth/get-active-mandant-context";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type CreateAnfrageeingangActionState = {
  error?: string;
};

function logErrorInDevelopment(context: string, detail: unknown) {
  if (process.env.NODE_ENV === "development") {
    console.error(`[createAnfrageeingangAction] ${context}:`, detail);
  }
}

export async function createAnfrageeingangAction(
  _prevState: CreateAnfrageeingangActionState,
  formData: FormData,
): Promise<CreateAnfrageeingangActionState> {
  const validation = validateCreateAnfrageeingangInput(
    parseCreateAnfrageeingangFormData(formData),
  );

  if (!validation.valid) {
    return { error: validation.error };
  }

  let mandantId: string;

  try {
    const context = await getActiveMandantContextOrThrow();
    mandantId = context.mandantId;
  } catch (error) {
    logErrorInDevelopment("Mandantenkontext", error);
    return { error: CREATE_ANFRAGEEINGANG_SYSTEM_ERROR_MESSAGE };
  }

  let rpcOutcome;

  try {
    const supabase = createSupabaseAdminClient();
    const input = validation.input;

    const { data, error } = await supabase.rpc("create_anfrageeingang", {
      p_mandant_id: mandantId,
      p_kanal: input.kanal,
      p_betreff: input.betreff,
      p_rohinhalt: input.rohinhalt,
      p_absender_name: input.absender_name,
      p_absender_email: input.absender_email,
      p_absender_telefon: input.absender_telefon,
      p_empfangen_am: input.empfangen_am,
      p_strukturierte_daten: input.strukturierte_daten,
    });

    if (error) {
      logErrorInDevelopment("RPC-Fehler", {
        message: error.message,
        code: error.code,
      });
      return { error: CREATE_ANFRAGEEINGANG_SYSTEM_ERROR_MESSAGE };
    }

    rpcOutcome = mapCreateAnfrageeingangRpcResult(data);
  } catch (error) {
    logErrorInDevelopment("Unerwarteter Fehler", error);
    return { error: CREATE_ANFRAGEEINGANG_SYSTEM_ERROR_MESSAGE };
  }

  if (rpcOutcome.kind === "error") {
    return { error: rpcOutcome.message };
  }

  revalidatePath("/anfrageeingang");
  redirect(`/anfrageeingang/${rpcOutcome.anfrageeingangId}?hinweis=erstellt`);
}
