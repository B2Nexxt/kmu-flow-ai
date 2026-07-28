"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { mapArchiviereAnfrageeingangRpcResult } from "@/lib/anfrageeingang/archiviere-anfrageeingang-messages";
import { ARCHIVIERE_ANFRAGEEINGANG_SYSTEM_ERROR_MESSAGE } from "@/lib/anfrageeingang/archiviere-anfrageeingang-messages";
import { validateArchiviereAnfrageeingangInput } from "@/lib/anfrageeingang/validate-archiviere-anfrageeingang-input";
import { getActiveMandantContextOrThrow } from "@/lib/operative-auth/get-active-mandant-context";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type ArchiviereAnfrageeingangActionState = {
  error?: string;
};

function logErrorInDevelopment(context: string, detail: unknown) {
  if (process.env.NODE_ENV === "development") {
    console.error(`[archiviereAnfrageeingangAction] ${context}:`, detail);
  }
}

export async function archiviereAnfrageeingangAction(
  _prevState: ArchiviereAnfrageeingangActionState,
  formData: FormData,
): Promise<ArchiviereAnfrageeingangActionState> {
  const anfrageeingangId = String(formData.get("anfrageeingangId") ?? "");

  const validation = validateArchiviereAnfrageeingangInput(anfrageeingangId);
  if (!validation.valid) {
    return { error: validation.error };
  }

  let mandantId: string;

  try {
    const context = await getActiveMandantContextOrThrow();
    mandantId = context.mandantId;
  } catch (error) {
    logErrorInDevelopment("Mandantenkontext", error);
    return { error: ARCHIVIERE_ANFRAGEEINGANG_SYSTEM_ERROR_MESSAGE };
  }

  let rpcOutcome;

  try {
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase.rpc("archiviere_anfrageeingang", {
      p_mandant_id: mandantId,
      p_anfrageeingang_id: validation.anfrageeingangId,
    });

    if (error) {
      logErrorInDevelopment("RPC-Fehler", {
        message: error.message,
        code: error.code,
      });
      return { error: ARCHIVIERE_ANFRAGEEINGANG_SYSTEM_ERROR_MESSAGE };
    }

    rpcOutcome = mapArchiviereAnfrageeingangRpcResult(data);
  } catch (error) {
    logErrorInDevelopment("Unerwarteter Fehler", error);
    return { error: ARCHIVIERE_ANFRAGEEINGANG_SYSTEM_ERROR_MESSAGE };
  }

  if (rpcOutcome.kind === "error") {
    return { error: rpcOutcome.message };
  }

  revalidatePath("/anfrageeingang");
  revalidatePath(`/anfrageeingang/${validation.anfrageeingangId}`);

  const hint =
    rpcOutcome.code === "already_archived" ? "bereits-archiviert" : "archiviert";
  redirect(`/anfrageeingang?hinweis=${hint}`);
}
