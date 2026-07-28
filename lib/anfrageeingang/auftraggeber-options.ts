export const AUFTRAGGEBER_TYP_VALUES = [
  "unbekannt",
  "privatperson",
  "unternehmen",
] as const;

export type AuftraggeberTyp = (typeof AUFTRAGGEBER_TYP_VALUES)[number];

export const DEFAULT_AUFTRAGGEBER_TYP: AuftraggeberTyp = "unbekannt";

export const AUFTRAGGEBER_TYP_LABELS: Record<AuftraggeberTyp, string> = {
  unbekannt: "Unbekannt",
  privatperson: "Privatperson",
  unternehmen: "Unternehmen",
};

export const ANREDE_VALUES = ["frau", "herr", "divers", "keine_angabe"] as const;

export type Anrede = (typeof ANREDE_VALUES)[number];

export const ANREDE_LABELS: Record<Anrede, string> = {
  frau: "Frau",
  herr: "Herr",
  divers: "Divers",
  keine_angabe: "Keine Angabe",
};

export function isAuftraggeberTyp(value: string): value is AuftraggeberTyp {
  return (AUFTRAGGEBER_TYP_VALUES as readonly string[]).includes(value);
}

export function isAnrede(value: string): value is Anrede {
  return (ANREDE_VALUES as readonly string[]).includes(value);
}

export function normalizeAuftraggeberTyp(value: string): AuftraggeberTyp {
  const trimmed = value.trim();
  if (trimmed && isAuftraggeberTyp(trimmed)) {
    return trimmed;
  }
  return DEFAULT_AUFTRAGGEBER_TYP;
}
