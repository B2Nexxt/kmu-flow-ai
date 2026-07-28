import { canShowVerwerfeAnfrageeingangAction } from "./can-verwerfe-anfrageeingang";
import { formatAnfrageeingangBetreff, formatAnfrageeingangEmpfangenAm } from "./format-display";
import {
  getAnfrageeingangDringlichkeitLabel,
  getAnfrageeingangKanalLabel,
  getAnfrageeingangStatusLabel,
  getAnfrageeingangVollstaendigkeitLabel,
  getAnfrageeingangZuordnungsstatusLabel,
} from "./labels";
import type { AnfrageeingangDetailRow, AnfrageeingangDetailViewModel } from "./types";

export function formatAnfrageeingangOptionalDate(iso: string | null): string {
  if (!iso) return "Nicht angegeben";
  return formatAnfrageeingangEmpfangenAm(iso);
}

export function formatAnfrageeingangOptionalText(value: string | null): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "Nicht angegeben";
}

export function formatAnfrageeingangRohinhalt(value: string | null): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "Kein Inhalt vorhanden";
}

export function formatAnfrageeingangJaNein(value: boolean): string {
  return value ? "Ja" : "Nein";
}

export function formatAnfrageeingangConfidenceScore(
  score: number | null,
): string | null {
  if (score === null || score === undefined) return null;
  return `${(score * 100).toFixed(1).replace(".", ",")} %`;
}

export function isEmptyJsonObject(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value as Record<string, unknown>).length === 0
  );
}

export function isEmptyJsonArray(value: unknown): boolean {
  return Array.isArray(value) && value.length === 0;
}

export function formatAnfrageeingangJsonValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (isEmptyJsonObject(value) || isEmptyJsonArray(value)) return null;
  return JSON.stringify(value, null, 2);
}

export function normalizeFehlendeAngaben(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) return [];
  return value.map((item) =>
    typeof item === "string" ? item : JSON.stringify(item, null, 2),
  );
}

export function mapAnfrageeingangDetailRow(
  row: AnfrageeingangDetailRow,
): AnfrageeingangDetailViewModel {
  const fehlendeAngabenItems = normalizeFehlendeAngaben(row.fehlende_angaben);
  const strukturierteDatenEmpty = isEmptyJsonObject(row.strukturierte_daten);

  return {
    id: row.id,
    status: row.status,
    canVerwerfen: canShowVerwerfeAnfrageeingangAction({
      status: row.status,
      vorgangZugeordnet: row.zugeordneter_vorgang_id !== null,
      aktiv: true,
    }),
    eingangsnummer: row.eingangsnummer,
    betreffLabel: formatAnfrageeingangBetreff(row.betreff),
    statusLabel: getAnfrageeingangStatusLabel(row.status),
    dringlichkeitLabel: getAnfrageeingangDringlichkeitLabel(row.dringlichkeit),
    kanalLabel: getAnfrageeingangKanalLabel(row.kanal),
    empfangenAmLabel: formatAnfrageeingangEmpfangenAm(row.empfangen_am),
    zuletztBearbeitetAmLabel: formatAnfrageeingangOptionalDate(row.zuletzt_bearbeitet_am),
    beendetAmLabel: formatAnfrageeingangOptionalDate(row.beendet_am),
    rohinhaltLabel: formatAnfrageeingangRohinhalt(row.rohinhalt),
    absenderNameLabel: formatAnfrageeingangOptionalText(row.absender_name),
    absenderEmail: row.absender_email?.trim() || null,
    absenderTelefon: row.absender_telefon?.trim() || null,
    zuordnungsstatusLabel: getAnfrageeingangZuordnungsstatusLabel(row.zuordnungsstatus),
    vollstaendigkeitsstatusLabel: getAnfrageeingangVollstaendigkeitLabel(
      row.vollstaendigkeitsstatus,
    ),
    manuellePruefungLabel: formatAnfrageeingangJaNein(row.manuelle_pruefung_erforderlich),
    confidenceScoreLabel: formatAnfrageeingangConfidenceScore(row.confidence_score),
    strukturierteDatenJson: strukturierteDatenEmpty
      ? null
      : formatAnfrageeingangJsonValue(row.strukturierte_daten),
    strukturierteDatenEmpty,
    zuordnungsgrundJson: formatAnfrageeingangJsonValue(row.zuordnungsgrund),
    zuordnungskandidatenJson: formatAnfrageeingangJsonValue(row.zuordnungskandidaten),
    fehlendeAngabenItems,
    fehlendeAngabenEmpty: fehlendeAngabenItems.length === 0,
    kundeZugeordnet: row.zugeordnet_kunde_id !== null,
    gebaeudeZugeordnet: row.zugeordnet_gebaeude_id !== null,
    einheitZugeordnet: row.zugeordnet_einheit_id !== null,
    vorgangZugeordnet: row.zugeordneter_vorgang_id !== null,
  };
}
