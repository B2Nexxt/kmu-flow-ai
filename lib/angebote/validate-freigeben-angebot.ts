export type FreigebenAngebotValidationResult = {
  valid: boolean;
  errors: string[];
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateFreigebenAngebot(
  angebotId: string,
): FreigebenAngebotValidationResult {
  const errors: string[] = [];
  const normalizedAngebotId = angebotId?.trim() ?? "";

  if (!normalizedAngebotId) {
    errors.push("Bitte geben Sie eine Angebots-ID an.");
  } else if (!UUID_REGEX.test(normalizedAngebotId)) {
    errors.push("Die Angebots-ID ist ungültig.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
