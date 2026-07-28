"use server";

import { redirect } from "next/navigation";

import {
  mapMandantSelectionError,
  MANDANT_SELECTION_INVALID_CHOICE_MESSAGE,
  MANDANT_SELECTION_TECHNICAL_ERROR_MESSAGE,
} from "@/lib/operative-auth/mandant-selection-messages";
import { switchActiveMandant } from "@/lib/operative-auth/switch-active-mandant";

export type SelectMandantActionState = {
  error?: string;
};

export async function selectActiveMandantAction(
  _prevState: SelectMandantActionState,
  formData: FormData,
): Promise<SelectMandantActionState> {
  const organizationId = String(formData.get("organizationId") ?? "").trim();

  if (!organizationId) {
    return { error: MANDANT_SELECTION_INVALID_CHOICE_MESSAGE };
  }

  try {
    const result = await switchActiveMandant(organizationId);

    if (!result.success) {
      return { error: mapMandantSelectionError(result.code) };
    }
  } catch {
    return { error: MANDANT_SELECTION_TECHNICAL_ERROR_MESSAGE };
  }

  redirect("/dashboard");
}
