import {
  VERWERFE_ANFRAGEEINGANG_NOT_FOUND_MESSAGE,
  VERWERFE_ANFRAGEEINGANG_VALIDATION_MESSAGE,
} from "./verwerfe-anfrageeingang-messages";
import { isValidAnfrageeingangId } from "./validate-anfrageeingang-id";

export type VerwerfeAnfrageeingangInputValidation =
  | { valid: true; anfrageeingangId: string; grund: string }
  | { valid: false; error: string };

export function validateVerwerfeAnfrageeingangInput(
  anfrageeingangId: string,
  grund: string,
): VerwerfeAnfrageeingangInputValidation {
  const normalizedId = anfrageeingangId.trim();
  const normalizedGrund = grund.trim();

  if (!isValidAnfrageeingangId(normalizedId)) {
    return { valid: false, error: VERWERFE_ANFRAGEEINGANG_NOT_FOUND_MESSAGE };
  }

  if (!normalizedGrund) {
    return { valid: false, error: VERWERFE_ANFRAGEEINGANG_VALIDATION_MESSAGE };
  }

  return {
    valid: true,
    anfrageeingangId: normalizedId,
    grund: normalizedGrund,
  };
}
