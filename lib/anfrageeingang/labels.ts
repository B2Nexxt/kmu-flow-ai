import type {
  AnfrageeingangDringlichkeit,
  AnfrageeingangKanal,
  AnfrageeingangStatus,
  AnfrageeingangVollstaendigkeitsstatus,
  AnfrageeingangZuordnungsstatus,
} from "./types";

export const ANFRAGEEINGANG_STATUS_LABELS: Record<AnfrageeingangStatus, string> = {
  neu: "Neu",
  analysiert: "Analysiert",
  wartet_auf_informationen: "Wartet auf Informationen",
  zur_manuellen_pruefung: "Manuelle Prüfung",
  bereit_fuer_vorgang: "Bereit für Vorgang",
  in_vorgang_ueberfuehrt: "In Vorgang überführt",
  verworfen: "Verworfen",
};

export const ANFRAGEEINGANG_ZUORDNUNGSSTATUS_LABELS: Record<
  AnfrageeingangZuordnungsstatus,
  string
> = {
  kein_treffer: "Kein Treffer",
  eindeutig: "Eindeutig",
  moeglicher_treffer: "Möglicher Treffer",
  mehrere_treffer: "Mehrere Treffer",
  konflikt: "Konflikt",
  bestaetigt: "Bestätigt",
  nicht_erforderlich: "Nicht erforderlich",
};

export const ANFRAGEEINGANG_DRINGLICHKEIT_LABELS: Record<
  AnfrageeingangDringlichkeit,
  string
> = {
  niedrig: "Niedrig",
  normal: "Normal",
  hoch: "Hoch",
  dringend: "Dringend",
};

export const ANFRAGEEINGANG_KANAL_LABELS: Record<AnfrageeingangKanal, string> = {
  telefon: "Telefon",
  email: "E-Mail",
  kontaktformular: "Kontaktformular",
  whatsapp: "WhatsApp",
  sms: "SMS",
  persoenlich: "Persönlich",
  empfehlung: "Empfehlung",
  sonstiges: "Sonstiges",
};

export const ANFRAGEEINGANG_VOLLSTAENDIGKEIT_LABELS: Record<
  AnfrageeingangVollstaendigkeitsstatus,
  string
> = {
  unbekannt: "Unbekannt",
  unvollstaendig: "Unvollständig",
  ausreichend_fuer_rueckfrage: "Ausreichend für Rückfrage",
  ausreichend_fuer_vorgang: "Ausreichend für Vorgang",
  vollstaendig: "Vollständig",
};

function fallbackLabel(value: string): string {
  return value.replaceAll("_", " ");
}

export function getAnfrageeingangStatusLabel(status: string): string {
  return (
    ANFRAGEEINGANG_STATUS_LABELS[status as AnfrageeingangStatus] ??
    fallbackLabel(status)
  );
}

export function getAnfrageeingangZuordnungsstatusLabel(status: string): string {
  return (
    ANFRAGEEINGANG_ZUORDNUNGSSTATUS_LABELS[
      status as AnfrageeingangZuordnungsstatus
    ] ?? fallbackLabel(status)
  );
}

export function getAnfrageeingangDringlichkeitLabel(dringlichkeit: string): string {
  return (
    ANFRAGEEINGANG_DRINGLICHKEIT_LABELS[dringlichkeit as AnfrageeingangDringlichkeit] ??
    fallbackLabel(dringlichkeit)
  );
}

export function getAnfrageeingangKanalLabel(kanal: string): string {
  return (
    ANFRAGEEINGANG_KANAL_LABELS[kanal as AnfrageeingangKanal] ?? fallbackLabel(kanal)
  );
}

export function getAnfrageeingangVollstaendigkeitLabel(status: string): string {
  return (
    ANFRAGEEINGANG_VOLLSTAENDIGKEIT_LABELS[
      status as AnfrageeingangVollstaendigkeitsstatus
    ] ?? fallbackLabel(status)
  );
}
