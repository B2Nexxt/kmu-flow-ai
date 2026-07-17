import type { UnternehmensStammdatenInput } from "@/lib/mandanten/unternehmens-stammdaten";
import { isValidMandantStatus } from "@/lib/mandanten/mandant-status";
import { validateEmail } from "@/lib/mandanten/validators";

export type UnternehmensStammdatenValidationResult = {
  valid: boolean;
  errors: string[];
};

export function validateUnternehmensStammdaten(
  input: UnternehmensStammdatenInput,
): UnternehmensStammdatenValidationResult {
  const errors: string[] = [];

  if (!isValidMandantStatus(input.status)) {
    errors.push("Der gewählte Status ist ungültig.");
  }

  if (!input.firmenname.trim()) {
    errors.push("Bitte geben Sie einen Firmennamen an.");
  }
  if (!input.rechtsform.trim()) {
    errors.push("Bitte geben Sie eine Rechtsform an.");
  }
  if (!input.strasse.trim()) {
    errors.push("Bitte geben Sie Straße und Hausnummer an.");
  }
  if (!input.plz.trim()) {
    errors.push("Bitte geben Sie eine Postleitzahl an.");
  }
  if (!input.ort.trim()) {
    errors.push("Bitte geben Sie einen Ort an.");
  }
  if (!input.land.trim()) {
    errors.push("Bitte geben Sie ein Land an.");
  }

  const emailError = validateEmail(input.email, { required: false });
  if (emailError) {
    errors.push(emailError);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
