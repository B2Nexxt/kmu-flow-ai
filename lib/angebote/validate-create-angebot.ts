import type { CreateAngebotInput } from "@/lib/angebote/create-angebot-input";
import { validateEmail } from "@/lib/mandanten/validators";

export type CreateAngebotValidationResult = {
  valid: boolean;
  errors: string[];
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const ALLOWED_UST_SAETZE = new Set([0, 7, 19]);

function validateIsoDate(value: string, label: string): string | undefined {
  if (!ISO_DATE_REGEX.test(value)) {
    return `${label} muss im Format JJJJ-MM-TT vorliegen.`;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return `${label} ist ungültig.`;
  }

  return undefined;
}

function validatePosition(
  position: CreateAngebotInput["positionen"][number],
  index: number,
  seenPositionNrs: Set<number>,
): string[] {
  const errors: string[] = [];
  const label = `Position ${index + 1}`;

  if (!Number.isInteger(position.positionNr) || position.positionNr < 1) {
    errors.push(`${label}: Positionsnummer muss eine ganze Zahl ≥ 1 sein.`);
  } else if (seenPositionNrs.has(position.positionNr)) {
    errors.push(`${label}: Positionsnummer ${position.positionNr} ist doppelt.`);
  } else {
    seenPositionNrs.add(position.positionNr);
  }

  if (!position.bezeichnung.trim()) {
    errors.push(`${label}: Bitte geben Sie eine Bezeichnung an.`);
  }

  if (!Number.isFinite(position.menge) || position.menge <= 0) {
    errors.push(`${label}: Die Menge muss größer als 0 sein.`);
  }

  if (
    !Number.isInteger(position.einzelpreisNettoCents) ||
    position.einzelpreisNettoCents < 0
  ) {
    errors.push(`${label}: Der Einzelpreis muss in Cent als ganze Zahl ≥ 0 vorliegen.`);
  }

  const rabatt = position.rabattProzent ?? 0;
  if (!Number.isFinite(rabatt) || rabatt < 0 || rabatt > 100) {
    errors.push(`${label}: Der Rabatt muss zwischen 0 und 100 liegen.`);
  }

  if (!ALLOWED_UST_SAETZE.has(position.umsatzsteuerSatz)) {
    errors.push(`${label}: Der Umsatzsteuersatz muss 0, 7 oder 19 sein.`);
  }

  return errors;
}

export function validateCreateAngebot(
  input: CreateAngebotInput,
): CreateAngebotValidationResult {
  const errors: string[] = [];
  const organizationId = input.organizationId?.trim() ?? "";

  if (!organizationId) {
    errors.push("Bitte geben Sie eine Organization-ID an.");
  } else if (!UUID_REGEX.test(organizationId)) {
    errors.push("Die Organization-ID ist ungültig.");
  }

  if (!input.version?.empfaenger) {
    errors.push("Bitte geben Sie Empfängerdaten an.");
  } else {
    const empfaenger = input.version.empfaenger;

    if (!empfaenger.firmenname.trim()) {
      errors.push("Bitte geben Sie einen Firmennamen für den Empfänger an.");
    }

    const emailError = validateEmail(empfaenger.email ?? "", { required: false });
    if (emailError) errors.push(emailError);
  }

  if (input.version?.angebotDatum?.trim()) {
    const dateError = validateIsoDate(
      input.version.angebotDatum.trim(),
      "Das Angebotsdatum",
    );
    if (dateError) errors.push(dateError);
  }

  if (input.version?.gueltigBis?.trim()) {
    const dateError = validateIsoDate(
      input.version.gueltigBis.trim(),
      "Das Gültigkeitsdatum",
    );
    if (dateError) errors.push(dateError);
  }

  if (
    input.version?.angebotDatum?.trim() &&
    input.version?.gueltigBis?.trim()
  ) {
    if (input.version.gueltigBis.trim() < input.version.angebotDatum.trim()) {
      errors.push("Das Gültigkeitsdatum muss am oder nach dem Angebotsdatum liegen.");
    }
  }

  if (!Array.isArray(input.positionen) || input.positionen.length === 0) {
    errors.push("Bitte geben Sie mindestens eine Position an.");
  } else {
    const seenPositionNrs = new Set<number>();
    input.positionen.forEach((position, index) => {
      errors.push(...validatePosition(position, index, seenPositionNrs));
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
