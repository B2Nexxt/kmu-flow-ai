import { parseEmpfangenAmInput } from "./format-datetime-local";
import { isAnfrageeingangKanal } from "./kanal-options";
import {
  CREATE_ANFRAGEEINGANG_DATUM_INVALID_MESSAGE,
  CREATE_ANFRAGEEINGANG_EMAIL_INVALID_MESSAGE,
  CREATE_ANFRAGEEINGANG_INHALT_REQUIRED_MESSAGE,
  CREATE_ANFRAGEEINGANG_KANAL_REQUIRED_MESSAGE,
} from "./create-anfrageeingang-messages";
import { validateEmail } from "@/lib/mandanten/validators";

export type CreateAnfrageeingangFormInput = {
  kanal: string;
  betreff: string;
  rohinhalt: string;
  absender_name: string;
  absender_email: string;
  absender_telefon: string;
  empfangen_am: string;
};

export type CreateAnfrageeingangValidatedInput = {
  kanal: string;
  betreff: string | null;
  rohinhalt: string | null;
  absender_name: string | null;
  absender_email: string | null;
  absender_telefon: string | null;
  empfangen_am: string | null;
};

export type CreateAnfrageeingangValidationResult =
  | { valid: true; input: CreateAnfrageeingangValidatedInput }
  | { valid: false; error: string };

function nullIfEmpty(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function parseCreateAnfrageeingangFormData(
  formData: FormData,
): CreateAnfrageeingangFormInput {
  return {
    kanal: String(formData.get("kanal") ?? ""),
    betreff: String(formData.get("betreff") ?? ""),
    rohinhalt: String(formData.get("rohinhalt") ?? ""),
    absender_name: String(formData.get("absender_name") ?? ""),
    absender_email: String(formData.get("absender_email") ?? ""),
    absender_telefon: String(formData.get("absender_telefon") ?? ""),
    empfangen_am: String(formData.get("empfangen_am") ?? ""),
  };
}

export function validateCreateAnfrageeingangInput(
  raw: CreateAnfrageeingangFormInput,
): CreateAnfrageeingangValidationResult {
  const kanal = raw.kanal.trim();

  if (!kanal || !isAnfrageeingangKanal(kanal)) {
    return { valid: false, error: CREATE_ANFRAGEEINGANG_KANAL_REQUIRED_MESSAGE };
  }

  const betreff = nullIfEmpty(raw.betreff);
  const rohinhalt = nullIfEmpty(raw.rohinhalt);
  const absender_name = nullIfEmpty(raw.absender_name);
  const absender_email = nullIfEmpty(raw.absender_email);
  const absender_telefon = nullIfEmpty(raw.absender_telefon);

  if (!betreff && !rohinhalt && !absender_name && !absender_email && !absender_telefon) {
    return { valid: false, error: CREATE_ANFRAGEEINGANG_INHALT_REQUIRED_MESSAGE };
  }

  if (absender_email) {
    const emailError = validateEmail(absender_email, { required: true });
    if (emailError) {
      return { valid: false, error: CREATE_ANFRAGEEINGANG_EMAIL_INVALID_MESSAGE };
    }
  }

  const empfangenParsed = parseEmpfangenAmInput(raw.empfangen_am);
  if (!empfangenParsed.ok) {
    return { valid: false, error: CREATE_ANFRAGEEINGANG_DATUM_INVALID_MESSAGE };
  }

  return {
    valid: true,
    input: {
      kanal,
      betreff,
      rohinhalt,
      absender_name,
      absender_email,
      absender_telefon,
      empfangen_am: empfangenParsed.iso,
    },
  };
}
