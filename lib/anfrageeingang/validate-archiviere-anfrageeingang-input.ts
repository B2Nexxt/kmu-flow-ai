import { ARCHIVIERE_ANFRAGEEINGANG_NOT_FOUND_MESSAGE } from "./archiviere-anfrageeingang-messages";
import { isValidAnfrageeingangId } from "./validate-anfrageeingang-id";

export type ArchiviereAnfrageeingangInputValidation =
  | { valid: true; anfrageeingangId: string }
  | { valid: false; error: string };

export function validateArchiviereAnfrageeingangInput(
  anfrageeingangId: string,
): ArchiviereAnfrageeingangInputValidation {
  const normalizedId = anfrageeingangId.trim();

  if (!isValidAnfrageeingangId(normalizedId)) {
    return { valid: false, error: ARCHIVIERE_ANFRAGEEINGANG_NOT_FOUND_MESSAGE };
  }

  return { valid: true, anfrageeingangId: normalizedId };
}
