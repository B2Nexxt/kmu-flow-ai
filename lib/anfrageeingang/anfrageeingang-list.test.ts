/**
 * Unit-Tests Anfrageeingang-Liste (Mapping, Labels, Sortierung, Read-Sicherheit).
 * Ausführen: npx tsx lib/anfrageeingang/anfrageeingang-list.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  formatAnfrageeingangAbsender,
  formatAnfrageeingangBetreff,
  mapAnfrageeingangListRow,
  sortAnfrageeingaengeForList,
} from "./format-display";
import {
  getAnfrageeingangDringlichkeitLabel,
  getAnfrageeingangKanalLabel,
  getAnfrageeingangStatusLabel,
  getAnfrageeingangZuordnungsstatusLabel,
} from "./labels";
import {
  ANFRAGEEINGANG_KPI_STATUS,
  ANFRAGEEINGANG_LIST_LIMIT,
  ANFRAGEEINGANG_LIST_SELECT,
} from "./load-anfrageeingaenge";

const __dirname = dirname(fileURLToPath(import.meta.url));

let passed = 0;

function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

test("T7 Absender-Fallback: Name → E-Mail → Telefon → Unbekannt", () => {
  assert.equal(
    formatAnfrageeingangAbsender({
      absender_name: "  Max Mustermann ",
      absender_email: "a@b.de",
      absender_telefon: "030",
    }),
    "Max Mustermann",
  );
  assert.equal(
    formatAnfrageeingangAbsender({
      absender_name: null,
      absender_email: "a@b.de",
      absender_telefon: "030",
    }),
    "a@b.de",
  );
  assert.equal(
    formatAnfrageeingangAbsender({
      absender_name: "  ",
      absender_email: null,
      absender_telefon: "030123",
    }),
    "030123",
  );
  assert.equal(
    formatAnfrageeingangAbsender({
      absender_name: null,
      absender_email: null,
      absender_telefon: null,
    }),
    "Unbekannt",
  );
});

test("T8 Betreff-Fallback", () => {
  assert.equal(formatAnfrageeingangBetreff("  Fenster  "), "Fenster");
  assert.equal(formatAnfrageeingangBetreff(null), "Ohne Betreff");
  assert.equal(formatAnfrageeingangBetreff("   "), "Ohne Betreff");
});

test("T9 Status-, Zuordnungs- und Dringlichkeits-Labels", () => {
  assert.equal(getAnfrageeingangStatusLabel("neu"), "Neu");
  assert.equal(getAnfrageeingangStatusLabel("wartet_auf_informationen"), "Wartet auf Informationen");
  assert.equal(getAnfrageeingangStatusLabel("zur_manuellen_pruefung"), "Manuelle Prüfung");
  assert.equal(getAnfrageeingangStatusLabel("bereit_fuer_vorgang"), "Bereit für Vorgang");
  assert.equal(getAnfrageeingangStatusLabel("in_vorgang_ueberfuehrt"), "In Vorgang überführt");
  assert.equal(getAnfrageeingangZuordnungsstatusLabel("moeglicher_treffer"), "Möglicher Treffer");
  assert.equal(getAnfrageeingangZuordnungsstatusLabel("nicht_erforderlich"), "Nicht erforderlich");
  assert.equal(getAnfrageeingangDringlichkeitLabel("dringend"), "Dringend");
  assert.equal(getAnfrageeingangKanalLabel("email"), "E-Mail");
});

test("T6 Sortierung empfangen_am DESC, created_at DESC", () => {
  const sorted = sortAnfrageeingaengeForList([
    { id: "1", empfangen_am: "2026-01-01T10:00:00Z", created_at: "2026-01-01T09:00:00Z" },
    { id: "2", empfangen_am: "2026-01-02T10:00:00Z", created_at: "2026-01-02T09:00:00Z" },
    { id: "3", empfangen_am: "2026-01-02T10:00:00Z", created_at: "2026-01-02T11:00:00Z" },
  ]);
  assert.deepEqual(
    sorted.map((row) => row.id),
    ["3", "2", "1"],
  );
});

test("Listen-SELECT enthält keine Rohinhalte", () => {
  assert.equal(ANFRAGEEINGANG_LIST_SELECT.includes("rohinhalt"), false);
  assert.equal(ANFRAGEEINGANG_LIST_SELECT.includes("strukturierte_daten"), false);
  assert.equal(ANFRAGEEINGANG_LIST_SELECT.includes("zuordnungskandidaten"), false);
  assert.equal(ANFRAGEEINGANG_LIST_LIMIT, 100);
});

test("KPI-Status-Mapping deckt V1-Karten ab", () => {
  assert.equal(ANFRAGEEINGANG_KPI_STATUS.neu, "neu");
  assert.equal(ANFRAGEEINGANG_KPI_STATUS.manuellePruefung, "zur_manuellen_pruefung");
  assert.equal(ANFRAGEEINGANG_KPI_STATUS.wartetAufInformationen, "wartet_auf_informationen");
  assert.equal(ANFRAGEEINGANG_KPI_STATUS.bereitFuerVorgang, "bereit_fuer_vorgang");
});

test("T10 mapAnfrageeingangListRow liefert Display-Felder", () => {
  const item = mapAnfrageeingangListRow({
    id: "id-1",
    eingangsnummer: "AE-2026-0001",
    empfangen_am: "2026-07-28T14:30:00.000Z",
    kanal: "email",
    absender_name: null,
    absender_email: "kunde@example.com",
    absender_telefon: null,
    betreff: null,
    status: "neu",
    zuordnungsstatus: "kein_treffer",
    dringlichkeit: "normal",
    manuelle_pruefung_erforderlich: false,
  });
  assert.equal(item.eingangsnummer, "AE-2026-0001");
  assert.equal(item.absenderLabel, "kunde@example.com");
  assert.equal(item.betreffLabel, "Ohne Betreff");
  assert.equal(item.statusLabel, "Neu");
  assert.match(item.empfangenAmLabel, /\d/);
});

test("T12 Read nutzt authenticated SSR-Client, keine Service Role", () => {
  const source = readFileSync(join(__dirname, "load-anfrageeingaenge.ts"), "utf8");
  assert.match(source, /createSupabaseServerAuthClient/);
  assert.match(source, /getActiveMandantContextOrThrow/);
  assert.doesNotMatch(source, /createSupabaseAdminClient/);
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE/);
  assert.match(source, /\.eq\("mandant_id", mandantId\)/);
  assert.match(source, /\.eq\("aktiv", true\)/);
});

console.log(`\n${passed} Tests bestanden.`);

console.log(`
Manuelle Prüfung (Route Guards — T1, T2):
  1. /anfrageeingang ohne Login → Redirect /login
  2. Eingeloggt ohne Membership → /kein-zugang
  3. Gültiger Mandant → eigene Zeilen sichtbar; fremde/archivierte nicht (RLS + aktiv=true)
  4. Query-Fehler simulieren → neutrale Meldung, kein SQL in UI
  5. /admin unverändert
`);
