import { KUNDENDATEN_EMPTY_LABEL } from "./format-kundendaten";
import {
  getAnfrageeingangVollstaendigkeitLabel,
  getAnfrageeingangZuordnungsstatusLabel,
} from "./labels";

export type ZuordnungskandidatDisplay = {
  typ: string;
  name: string;
  adresse: string;
  confidenceLabel: string;
};

export type AnfrageeingangZuordnungsbewertungDisplay = {
  isEmpty: boolean;
  confidenceLabel: string;
  zuordnungsstatusLabel: string;
  vollstaendigkeitsstatusLabel: string;
  fehlendeAngabenItems: string[];
  grundPunkte: string[];
  kandidaten: ZuordnungskandidatDisplay[];
};

const MERKMAL_TYP_LABELS: Record<string, string> = {
  email: "E-Mail",
  telefon: "Telefonnummer",
  objektadresse: "Adresse",
  einheit_bezeichnung: "Einheit",
  name: "Name",
};

const ERGEBNIS_LABELS: Record<string, string> = {
  uebereinstimmung: "stimmt überein",
  teilweise_uebereinstimmung: "stimmt teilweise überein",
  kein_treffer: "kein Treffer",
  widerspruch: "Widerspruch",
};

const KANDIDAT_TYP_LABELS: Record<string, string> = {
  kunde: "Kunde",
  gebaeude: "Gebäude",
  einheit: "Einheit",
};

const FEHLENDE_ANGABEN_LABELS: Record<string, string> = {
  telefon: "Telefonnummer",
  telefonnummer: "Telefonnummer",
  mobil: "Mobilnummer",
  hausnummer: "Hausnummer",
  plz: "PLZ",
  ansprechpartner: "Ansprechpartner",
  objektadresse: "Objektadresse",
  adresse: "Adresse",
  kundenname: "Kundenname",
  kontaktmoglichkeit: "Kontaktmöglichkeit",
  gebaeude: "Gebäude",
  einheit: "Einheit",
  anliegen: "Anliegen",
  email: "E-Mail-Adresse",
  name: "Name",
};

function isEmptyJsonObject(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value as Record<string, unknown>).length === 0
  );
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function humanizeKey(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (FEHLENDE_ANGABEN_LABELS[normalized]) {
    return FEHLENDE_ANGABEN_LABELS[normalized];
  }
  return normalized
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatConfidenceScore(score: number | null): string {
  if (score === null || score === undefined) {
    return KUNDENDATEN_EMPTY_LABEL;
  }
  return `${(score * 100).toFixed(1).replace(".", ",")} %`;
}

function formatMerkmal(item: unknown): string | null {
  if (!item || typeof item !== "object") return null;
  const merkmal = item as Record<string, unknown>;
  const typ = readString(merkmal.typ);
  const ergebnis = readString(merkmal.ergebnis);
  if (!typ || !ergebnis) return null;

  const typLabel = MERKMAL_TYP_LABELS[typ] ?? humanizeKey(typ);
  const ergebnisLabel = ERGEBNIS_LABELS[ergebnis] ?? humanizeKey(ergebnis);
  return `${typLabel} ${ergebnisLabel}`;
}

function formatWiderspruch(item: unknown): string | null {
  if (!item || typeof item !== "object") return null;
  const widerspruch = item as Record<string, unknown>;
  const beschreibung = readString(widerspruch.beschreibung);
  if (beschreibung) {
    return humanizeKey(beschreibung);
  }
  const typ = readString(widerspruch.typ);
  return typ ? `Widerspruch: ${humanizeKey(typ)}` : null;
}

function formatAdresseValue(value: unknown): string | null {
  if (typeof value === "string") {
    return readString(value);
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const adresse = value as Record<string, unknown>;
  const parts = [
    readString(adresse.strasse),
    readString(adresse.hausnummer),
    readString(adresse.plz),
    readString(adresse.ort),
  ].filter((part): part is string => Boolean(part));

  if (parts.length === 0) {
    return readString(adresse.adresse) ?? readString(adresse.objektadresse);
  }

  const strasseHausnummer = [parts[0], parts[1]].filter(Boolean).join(" ");
  const plzOrt = [parts[2], parts[3]].filter(Boolean).join(" ");
  return [strasseHausnummer, plzOrt].filter(Boolean).join(", ") || null;
}

function inferKandidatTyp(item: Record<string, unknown>, fallback?: string): string {
  if (fallback) return fallback;
  const typ = readString(item.typ);
  if (typ) {
    return KANDIDAT_TYP_LABELS[typ] ?? humanizeKey(typ);
  }
  if (item.einheit_id) return "Einheit";
  if (item.gebaeude_id && !item.kunde_id) return "Gebäude";
  if (item.kunde_id) return "Kunde";
  return KUNDENDATEN_EMPTY_LABEL;
}

function parseKandidatItem(
  item: unknown,
  fallbackTyp?: string,
): ZuordnungskandidatDisplay | null {
  if (!item || typeof item !== "object") return null;
  const kandidat = item as Record<string, unknown>;
  const score =
    typeof kandidat.score === "number"
      ? kandidat.score
      : typeof kandidat.confidence === "number"
        ? kandidat.confidence
        : null;
  const name =
    readString(kandidat.name) ??
    readString(kandidat.bezeichnung) ??
    readString(kandidat.kundenname) ??
    readString(kandidat.firmenname);
  const adresse =
    formatAdresseValue(kandidat.adresse) ??
    formatAdresseValue(kandidat.objektadresse) ??
    formatAdresseValue(kandidat.anschrift);

  const typ = inferKandidatTyp(kandidat, fallbackTyp);

  if (
    typ === KUNDENDATEN_EMPTY_LABEL &&
    !name &&
    !adresse &&
    score === null
  ) {
    return null;
  }

  return {
    typ,
    name: name ?? KUNDENDATEN_EMPTY_LABEL,
    adresse: adresse ?? KUNDENDATEN_EMPTY_LABEL,
    confidenceLabel: formatConfidenceScore(score),
  };
}

export function parseZuordnungskandidaten(value: unknown): ZuordnungskandidatDisplay[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .map((item) => parseKandidatItem(item))
      .filter((item): item is ZuordnungskandidatDisplay => item !== null);
  }

  if (typeof value === "object") {
    const grouped = value as Record<string, unknown>;
    const results: ZuordnungskandidatDisplay[] = [];

    for (const [key, fallbackTyp] of [
      ["kunden", "Kunde"],
      ["gebaeude", "Gebäude"],
      ["einheiten", "Einheit"],
    ] as const) {
      const entries = grouped[key];
      if (!Array.isArray(entries)) continue;
      for (const item of entries) {
        const parsed = parseKandidatItem(item, fallbackTyp);
        if (parsed) results.push(parsed);
      }
    }

    return results;
  }

  return [];
}

export function parseZuordnungsgrundPunkte(value: unknown): string[] {
  if (isEmptyJsonObject(value)) return [];

  const grund = value as Record<string, unknown>;
  const punkte: string[] = [];

  const hinweis = readString(grund.hinweis);
  if (hinweis) {
    punkte.push(hinweis);
  }

  if (Array.isArray(grund.merkmale)) {
    for (const merkmal of grund.merkmale) {
      const line = formatMerkmal(merkmal);
      if (line) punkte.push(line);
    }
  }

  if (Array.isArray(grund.widersprueche)) {
    for (const widerspruch of grund.widersprueche) {
      const line = formatWiderspruch(widerspruch);
      if (line) punkte.push(line);
    }
  }

  return punkte;
}

function parseFehlendeAngabeItem(item: unknown): string | null {
  if (typeof item === "string") {
    const trimmed = item.trim();
    return trimmed ? humanizeKey(trimmed) : null;
  }

  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return null;
  }

  const entry = item as Record<string, unknown>;
  const schluessel =
    readString(entry.schluessel) ??
    readString(entry.feld) ??
    readString(entry.key) ??
    readString(entry.name);

  return schluessel ? humanizeKey(schluessel) : null;
}

export function parseFehlendeAngaben(value: unknown): string[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .map(parseFehlendeAngabeItem)
      .filter((item): item is string => Boolean(item));
  }

  if (typeof value === "object") {
    const container = value as Record<string, unknown>;
    if (Array.isArray(container.eintraege)) {
      return parseFehlendeAngaben(container.eintraege);
    }
  }

  return [];
}

function hasZuordnungsbewertung(input: {
  confidence_score: number | null;
  zuordnungsstatus: string;
  vollstaendigkeitsstatus: string;
  zuordnungsgrund: unknown;
  zuordnungskandidaten: unknown;
  fehlende_angaben: unknown;
}): boolean {
  if (input.confidence_score !== null && input.confidence_score !== undefined) {
    return true;
  }
  if (input.zuordnungsstatus !== "kein_treffer") {
    return true;
  }
  if (input.vollstaendigkeitsstatus !== "unbekannt") {
    return true;
  }
  if (parseFehlendeAngaben(input.fehlende_angaben).length > 0) {
    return true;
  }
  if (parseZuordnungsgrundPunkte(input.zuordnungsgrund).length > 0) {
    return true;
  }
  if (parseZuordnungskandidaten(input.zuordnungskandidaten).length > 0) {
    return true;
  }
  return false;
}

export function mapAnfrageeingangZuordnungsbewertung(input: {
  confidence_score: number | null;
  zuordnungsstatus: string;
  vollstaendigkeitsstatus: string;
  zuordnungsgrund: unknown;
  zuordnungskandidaten: unknown;
  fehlende_angaben: unknown;
}): AnfrageeingangZuordnungsbewertungDisplay {
  const fehlendeAngabenItems = parseFehlendeAngaben(input.fehlende_angaben);
  const grundPunkte = parseZuordnungsgrundPunkte(input.zuordnungsgrund);
  const kandidaten = parseZuordnungskandidaten(input.zuordnungskandidaten);

  return {
    isEmpty: !hasZuordnungsbewertung(input),
    confidenceLabel: formatConfidenceScore(input.confidence_score),
    zuordnungsstatusLabel: getAnfrageeingangZuordnungsstatusLabel(input.zuordnungsstatus),
    vollstaendigkeitsstatusLabel: getAnfrageeingangVollstaendigkeitLabel(
      input.vollstaendigkeitsstatus,
    ),
    fehlendeAngabenItems,
    grundPunkte,
    kandidaten,
  };
}
