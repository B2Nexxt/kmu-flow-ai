import {
  isAnrede,
  normalizeAuftraggeberTyp,
  type Anrede,
  type AuftraggeberTyp,
} from "./auftraggeber-options";
import {
  buildCreateAnfrageeingangStrukturierteDaten,
  type AdresseKontakt,
  type AnsprechpartnerKontakt,
  type PrivatpersonKontakt,
  type UnbekanntKontakt,
  type UnternehmenKontakt,
} from "./build-create-anfrageeingang-strukturierte-daten";
import {
  CREATE_ANFRAGEEINGANG_DATUM_INVALID_MESSAGE,
  CREATE_ANFRAGEEINGANG_EMAIL_INVALID_MESSAGE,
  CREATE_ANFRAGEEINGANG_INHALT_REQUIRED_MESSAGE,
  CREATE_ANFRAGEEINGANG_KANAL_REQUIRED_MESSAGE,
} from "./create-anfrageeingang-messages";
import { parseEmpfangenAmInput } from "./format-datetime-local";
import { isAnfrageeingangKanal } from "./kanal-options";
import { mapCreateAnfrageeingangAbsender } from "./map-create-anfrageeingang-absender";
import { validateEmail } from "@/lib/mandanten/validators";

export type CreateAnfrageeingangFormInput = {
  kanal: string;
  betreff: string;
  rohinhalt: string;
  empfangen_am: string;
  auftraggeber_typ: string;
  unbekannt: UnbekanntKontakt;
  privatperson: PrivatpersonKontakt;
  privatpersonAdresse: AdresseKontakt;
  unternehmen: UnternehmenKontakt;
  unternehmenAdresse: AdresseKontakt;
  ansprechpartner: AnsprechpartnerKontakt;
};

export type CreateAnfrageeingangValidatedInput = {
  kanal: string;
  betreff: string | null;
  rohinhalt: string | null;
  empfangen_am: string | null;
  auftraggeberTyp: AuftraggeberTyp;
  strukturierte_daten: Record<string, unknown>;
  absender_name: string | null;
  absender_email: string | null;
  absender_telefon: string | null;
};

export type CreateAnfrageeingangValidationResult =
  | { valid: true; input: CreateAnfrageeingangValidatedInput }
  | { valid: false; error: string };

function nullIfEmpty(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "");
}

function parseAdresse(prefix: string, formData: FormData): AdresseKontakt {
  return {
    strasse: nullIfEmpty(field(formData, `${prefix}_strasse`)),
    hausnummer: nullIfEmpty(field(formData, `${prefix}_hausnummer`)),
    plz: nullIfEmpty(field(formData, `${prefix}_plz`)),
    ort: nullIfEmpty(field(formData, `${prefix}_ort`)),
  };
}

export function parseCreateAnfrageeingangFormData(
  formData: FormData,
): CreateAnfrageeingangFormInput {
  const anredeRaw = nullIfEmpty(field(formData, "pp_anrede"));

  return {
    kanal: field(formData, "kanal"),
    betreff: field(formData, "betreff"),
    rohinhalt: field(formData, "rohinhalt"),
    empfangen_am: field(formData, "empfangen_am"),
    auftraggeber_typ: field(formData, "auftraggeber_typ"),
    unbekannt: {
      name: nullIfEmpty(field(formData, "uk_name")),
      telefon: nullIfEmpty(field(formData, "uk_telefon")),
      mobil: nullIfEmpty(field(formData, "uk_mobil")),
      email: nullIfEmpty(field(formData, "uk_email")),
    },
    privatperson: {
      anrede: anredeRaw && isAnrede(anredeRaw) ? anredeRaw : null,
      vorname: nullIfEmpty(field(formData, "pp_vorname")),
      nachname: nullIfEmpty(field(formData, "pp_nachname")),
      telefon: nullIfEmpty(field(formData, "pp_telefon")),
      mobil: nullIfEmpty(field(formData, "pp_mobil")),
      email: nullIfEmpty(field(formData, "pp_email")),
    },
    privatpersonAdresse: parseAdresse("pp", formData),
    unternehmen: {
      firmenname: nullIfEmpty(field(formData, "un_firmenname")),
      telefon: nullIfEmpty(field(formData, "un_telefon")),
      email: nullIfEmpty(field(formData, "un_email")),
    },
    unternehmenAdresse: parseAdresse("un", formData),
    ansprechpartner: {
      vorname: nullIfEmpty(field(formData, "ap_vorname")),
      nachname: nullIfEmpty(field(formData, "ap_nachname")),
      telefon: nullIfEmpty(field(formData, "ap_telefon")),
      mobil: nullIfEmpty(field(formData, "ap_mobil")),
      email: nullIfEmpty(field(formData, "ap_email")),
    },
  };
}

function validateEmailIfPresent(email: string | null): string | null {
  if (!email) return null;
  return validateEmail(email, { required: true })
    ? CREATE_ANFRAGEEINGANG_EMAIL_INVALID_MESSAGE
    : null;
}

function hasMindestinhalt(
  betreff: string | null,
  rohinhalt: string | null,
  auftraggeberTyp: AuftraggeberTyp,
  raw: CreateAnfrageeingangFormInput,
): boolean {
  if (betreff || rohinhalt) return true;

  if (auftraggeberTyp === "unbekannt") {
    const k = raw.unbekannt;
    return Boolean(k.name || k.telefon || k.mobil || k.email);
  }

  if (auftraggeberTyp === "privatperson") {
    const p = raw.privatperson;
    return Boolean(
      p.vorname ||
        p.nachname ||
        p.telefon ||
        p.mobil ||
        p.email,
    );
  }

  const u = raw.unternehmen;
  const ap = raw.ansprechpartner;
  return Boolean(
    u.firmenname ||
      u.telefon ||
      u.email ||
      ap.vorname ||
      ap.nachname ||
      ap.telefon ||
      ap.mobil ||
      ap.email,
  );
}

function pickActiveKontakt(
  auftraggeberTyp: AuftraggeberTyp,
  raw: CreateAnfrageeingangFormInput,
): {
  unbekannt?: UnbekanntKontakt;
  privatperson?: PrivatpersonKontakt;
  privatpersonAdresse?: AdresseKontakt;
  unternehmen?: UnternehmenKontakt;
  unternehmenAdresse?: AdresseKontakt;
  ansprechpartner?: AnsprechpartnerKontakt;
} {
  switch (auftraggeberTyp) {
    case "privatperson":
      return {
        privatperson: raw.privatperson,
        privatpersonAdresse: raw.privatpersonAdresse,
      };
    case "unternehmen":
      return {
        unternehmen: raw.unternehmen,
        unternehmenAdresse: raw.unternehmenAdresse,
        ansprechpartner: raw.ansprechpartner,
      };
    default:
      return { unbekannt: raw.unbekannt };
  }
}

function collectEmailsToValidate(
  auftraggeberTyp: AuftraggeberTyp,
  raw: CreateAnfrageeingangFormInput,
): string[] {
  if (auftraggeberTyp === "unbekannt") {
    return raw.unbekannt.email ? [raw.unbekannt.email] : [];
  }
  if (auftraggeberTyp === "privatperson") {
    return raw.privatperson.email ? [raw.privatperson.email] : [];
  }
  const emails: string[] = [];
  if (raw.unternehmen.email) emails.push(raw.unternehmen.email);
  if (raw.ansprechpartner.email) emails.push(raw.ansprechpartner.email);
  return emails;
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
  const auftraggeberTyp = normalizeAuftraggeberTyp(raw.auftraggeber_typ);

  if (!hasMindestinhalt(betreff, rohinhalt, auftraggeberTyp, raw)) {
    return { valid: false, error: CREATE_ANFRAGEEINGANG_INHALT_REQUIRED_MESSAGE };
  }

  for (const email of collectEmailsToValidate(auftraggeberTyp, raw)) {
    const emailError = validateEmailIfPresent(email);
    if (emailError) {
      return { valid: false, error: emailError };
    }
  }

  const empfangenParsed = parseEmpfangenAmInput(raw.empfangen_am);
  if (!empfangenParsed.ok) {
    return { valid: false, error: CREATE_ANFRAGEEINGANG_DATUM_INVALID_MESSAGE };
  }

  const kontakt = pickActiveKontakt(auftraggeberTyp, raw);
  const strukturierte_daten = buildCreateAnfrageeingangStrukturierteDaten({
    auftraggeberTyp,
    ...kontakt,
  });
  const absender = mapCreateAnfrageeingangAbsender({
    auftraggeberTyp,
    ...kontakt,
  });

  return {
    valid: true,
    input: {
      kanal,
      betreff,
      rohinhalt,
      empfangen_am: empfangenParsed.iso,
      auftraggeberTyp,
      strukturierte_daten,
      absender_name: absender.absender_name,
      absender_email: absender.absender_email,
      absender_telefon: absender.absender_telefon,
    },
  };
}
