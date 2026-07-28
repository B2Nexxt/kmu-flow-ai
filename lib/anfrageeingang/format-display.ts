import {
  getAnfrageeingangDringlichkeitLabel,
  getAnfrageeingangKanalLabel,
  getAnfrageeingangStatusLabel,
  getAnfrageeingangZuordnungsstatusLabel,
} from "./labels";
import type { AnfrageeingangListItem, AnfrageeingangListRow } from "./types";

const EMPFANGEN_AM_FORMATTER = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "short",
  timeStyle: "short",
});

export function formatAnfrageeingangEmpfangenAm(iso: string): string {
  return EMPFANGEN_AM_FORMATTER.format(new Date(iso));
}

export function formatAnfrageeingangAbsender(row: {
  absender_name: string | null;
  absender_email: string | null;
  absender_telefon: string | null;
}): string {
  const name = row.absender_name?.trim();
  if (name) return name;

  const email = row.absender_email?.trim();
  if (email) return email;

  const telefon = row.absender_telefon?.trim();
  if (telefon) return telefon;

  return "Unbekannt";
}

export function formatAnfrageeingangBetreff(betreff: string | null): string {
  const trimmed = betreff?.trim();
  return trimmed ? trimmed : "Ohne Betreff";
}

export function mapAnfrageeingangListRow(row: AnfrageeingangListRow): AnfrageeingangListItem {
  return {
    id: row.id,
    eingangsnummer: row.eingangsnummer,
    empfangenAmLabel: formatAnfrageeingangEmpfangenAm(row.empfangen_am),
    kanalLabel: getAnfrageeingangKanalLabel(row.kanal),
    absenderLabel: formatAnfrageeingangAbsender(row),
    betreffLabel: formatAnfrageeingangBetreff(row.betreff),
    statusLabel: getAnfrageeingangStatusLabel(row.status),
    zuordnungsstatusLabel: getAnfrageeingangZuordnungsstatusLabel(row.zuordnungsstatus),
    dringlichkeitLabel: getAnfrageeingangDringlichkeitLabel(row.dringlichkeit),
  };
}

/** Sortierung wie DB: empfangen_am DESC, dann created_at DESC (für Tests). */
export function sortAnfrageeingaengeForList<
  T extends { empfangen_am: string; created_at: string },
>(rows: T[]): T[] {
  return [...rows].sort((left, right) => {
    const byEmpfangen = right.empfangen_am.localeCompare(left.empfangen_am);
    if (byEmpfangen !== 0) return byEmpfangen;
    return right.created_at.localeCompare(left.created_at);
  });
}
