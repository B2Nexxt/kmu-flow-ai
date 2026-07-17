import type { AngebotAkte } from "@/lib/angebote/get-angebot-akte";
import type { UpdateAngebotEntwurfInput } from "@/lib/angebote/update-angebot-entwurf-input";

export type EntwurfFormPositionRow = {
  id: string;
  bezeichnung: string;
  beschreibung: string;
  menge: string;
  einheit: string;
  einzelpreisNetto: string;
  rabattProzent: string;
  umsatzsteuerSatz: 0 | 7 | 19;
};

export type EntwurfFormEmpfaenger = {
  firmenname: string;
  rechtsform: string;
  ansprechpartner: string;
  strasse: string;
  hausnummer: string;
  plz: string;
  ort: string;
  land: string;
  email: string;
  telefon: string;
  umsatzsteuerId: string;
};

export type EntwurfFormState = {
  angebotDatum: string;
  gueltigBis: string;
  betreff: string;
  einleitungstext: string;
  schlusstext: string;
  empfaenger: EntwurfFormEmpfaenger;
  positionen: EntwurfFormPositionRow[];
};

function formatEuroFromCents(cents: number) {
  return (cents / 100).toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function emptyString(value: string | null | undefined) {
  return value?.trim() ?? "";
}

export function createEmptyEntwurfPosition(): EntwurfFormPositionRow {
  return {
    id: crypto.randomUUID(),
    bezeichnung: "",
    beschreibung: "",
    menge: "1",
    einheit: "Stk.",
    einzelpreisNetto: "",
    rabattProzent: "0",
    umsatzsteuerSatz: 19,
  };
}

export function mapAkteToEntwurfForm(akte: AngebotAkte): EntwurfFormState {
  const empfaenger = akte.version.empfaenger;

  return {
    angebotDatum: akte.version.angebotDatum,
    gueltigBis: akte.version.gueltigBis,
    betreff: emptyString(akte.version.betreff),
    einleitungstext: emptyString(akte.version.einleitungstext),
    schlusstext: emptyString(akte.version.schlusstext),
    empfaenger: {
      firmenname: empfaenger.firmenname,
      rechtsform: emptyString(empfaenger.rechtsform),
      ansprechpartner: emptyString(empfaenger.ansprechpartner),
      strasse: emptyString(empfaenger.strasse),
      hausnummer: emptyString(empfaenger.hausnummer),
      plz: emptyString(empfaenger.plz),
      ort: emptyString(empfaenger.ort),
      land: emptyString(empfaenger.land),
      email: emptyString(empfaenger.email),
      telefon: emptyString(empfaenger.telefon),
      umsatzsteuerId: emptyString(empfaenger.umsatzsteuerId),
    },
    positionen:
      akte.positionen.length > 0
        ? akte.positionen.map((position) => ({
            id: crypto.randomUUID(),
            bezeichnung: position.bezeichnung,
            beschreibung: emptyString(position.beschreibung),
            menge: String(position.menge),
            einheit: position.einheit,
            einzelpreisNetto: formatEuroFromCents(position.einzelpreisNettoCents),
            rabattProzent: String(position.rabattProzent),
            umsatzsteuerSatz: position.umsatzsteuerSatz as 0 | 7 | 19,
          }))
        : [createEmptyEntwurfPosition()],
  };
}

export function parseNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const cleaned = trimmed.replace(/[€\s]/g, "");

  if (cleaned.includes(",")) {
    const normalized = cleaned.replace(/\./g, "").replace(",", ".");
    const num = Number(normalized);
    return Number.isNaN(num) ? null : num;
  }

  const num = Number(cleaned);
  return Number.isNaN(num) ? null : num;
}

export function parseEuroToCents(value: string): number | null {
  const num = parseNumber(value);
  if (num === null || num < 0) return null;
  return Math.round(num * 100);
}

export function buildUpdateInputFromForm(
  akte: AngebotAkte,
  form: EntwurfFormState,
): UpdateAngebotEntwurfInput {
  return {
    angebotId: akte.id,
    versionUpdatedAt: akte.version.updatedAt,
    version: {
      angebotDatum: form.angebotDatum,
      gueltigBis: form.gueltigBis,
      betreff: form.betreff,
      einleitungstext: form.einleitungstext,
      schlusstext: form.schlusstext,
      empfaenger: {
        firmenname: form.empfaenger.firmenname,
        rechtsform: form.empfaenger.rechtsform || undefined,
        ansprechpartner: form.empfaenger.ansprechpartner || undefined,
        strasse: form.empfaenger.strasse || undefined,
        hausnummer: form.empfaenger.hausnummer || undefined,
        plz: form.empfaenger.plz || undefined,
        ort: form.empfaenger.ort || undefined,
        land: form.empfaenger.land || undefined,
        email: form.empfaenger.email || undefined,
        telefon: form.empfaenger.telefon || undefined,
        umsatzsteuerId: form.empfaenger.umsatzsteuerId || undefined,
      },
    },
    positionen: form.positionen.map((position, index) => ({
      positionNr: index + 1,
      bezeichnung: position.bezeichnung,
      beschreibung: position.beschreibung || undefined,
      menge: parseNumber(position.menge) ?? 0,
      einheit: position.einheit || undefined,
      einzelpreisNettoCents: parseEuroToCents(position.einzelpreisNetto) ?? -1,
      rabattProzent: parseNumber(position.rabattProzent) ?? 0,
      umsatzsteuerSatz: position.umsatzsteuerSatz,
    })),
  };
}

export function formPositionToAktePosition(
  position: EntwurfFormPositionRow,
  positionNr: number,
) {
  const menge = parseNumber(position.menge);
  const einzelpreisNettoCents = parseEuroToCents(position.einzelpreisNetto);
  const rabattProzent = parseNumber(position.rabattProzent) ?? 0;

  if (
    menge === null ||
    menge <= 0 ||
    einzelpreisNettoCents === null ||
    einzelpreisNettoCents < 0
  ) {
    return null;
  }

  return {
    positionNr,
    bezeichnung: position.bezeichnung,
    beschreibung: position.beschreibung || null,
    menge,
    einheit: position.einheit || "Stk.",
    einzelpreisNettoCents,
    rabattProzent,
    umsatzsteuerSatz: position.umsatzsteuerSatz,
  };
}
