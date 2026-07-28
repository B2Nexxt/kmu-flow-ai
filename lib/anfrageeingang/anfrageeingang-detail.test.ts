/**
 * Unit-Tests Anfrageeingang-Detail (Loader-Logik, Mapping, Labels, Sicherheit).
 * Ausführen: npx tsx lib/anfrageeingang/anfrageeingang-detail.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  formatAnfrageeingangConfidenceScore,
  formatAnfrageeingangJsonValue,
  formatAnfrageeingangOptionalText,
  formatAnfrageeingangRohinhalt,
  isEmptyJsonObject,
  mapAnfrageeingangDetailRow,
  normalizeFehlendeAngaben,
} from "./format-detail";
import { getAnfrageeingangVollstaendigkeitLabel } from "./labels";
import { ANFRAGEEINGANG_DETAIL_SELECT } from "./load-anfrageeingang-detail";
import { isValidAnfrageeingangId } from "./validate-anfrageeingang-id";
import type { AnfrageeingangDetailRow } from "./types";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SAMPLE_ROW: AnfrageeingangDetailRow = {
  id: "11111111-1111-4111-8111-111111111111",
  eingangsnummer: "AE-2026-0001",
  kanal: "email",
  status: "neu",
  empfangen_am: "2026-07-28T14:30:00.000Z",
  zuletzt_bearbeitet_am: null,
  beendet_am: null,
  betreff: "Fenster undicht",
  rohinhalt: "Zeile 1\nZeile 2",
  strukturierte_daten: { gewerk: "Fenster" },
  absender_name: null,
  absender_email: "kunde@example.com",
  absender_telefon: null,
  zuordnungsstatus: "kein_treffer",
  zuordnungsgrund: { hinweis: "Kein Match" },
  zuordnungskandidaten: [],
  vollstaendigkeitsstatus: "unvollstaendig",
  fehlende_angaben: ["Adresse", { feld: "plz" }],
  confidence_score: 0.8543,
  dringlichkeit: "hoch",
  manuelle_pruefung_erforderlich: true,
  zugeordnet_kunde_id: null,
  zugeordnet_gebaeude_id: null,
  zugeordnet_einheit_id: null,
  zugeordneter_vorgang_id: "22222222-2222-4222-8222-222222222222",
  kanal_externe_id: null,
  konversation_id: null,
  parent_anfrageeingang_id: null,
  created_at: "2026-07-28T14:30:00.000Z",
  updated_at: "2026-07-28T14:30:00.000Z",
};

let passed = 0;

function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

test("T4 ungültige UUID wird abgelehnt", () => {
  assert.equal(isValidAnfrageeingangId("keine-uuid"), false);
  assert.equal(isValidAnfrageeingangId(""), false);
  assert.equal(isValidAnfrageeingangId(SAMPLE_ROW.id), true);
});

test("T6 Rohinhalt bleibt Text mit Zeilenumbrüchen", () => {
  assert.equal(formatAnfrageeingangRohinhalt("Zeile 1\nZeile 2"), "Zeile 1\nZeile 2");
});

test("T7 fehlender Rohinhalt zeigt Fallback", () => {
  assert.equal(formatAnfrageeingangRohinhalt(null), "Kein Inhalt vorhanden");
  assert.equal(formatAnfrageeingangRohinhalt("   "), "Kein Inhalt vorhanden");
});

test("T8 Absender-Fallback Nicht angegeben", () => {
  assert.equal(formatAnfrageeingangOptionalText(null), "Nicht angegeben");
  assert.equal(formatAnfrageeingangOptionalText("  Max  "), "Max");
});

test("T9 Vollständigkeitslabels", () => {
  assert.equal(getAnfrageeingangVollstaendigkeitLabel("unbekannt"), "Unbekannt");
  assert.equal(getAnfrageeingangVollstaendigkeitLabel("unvollstaendig"), "Unvollständig");
  assert.equal(
    getAnfrageeingangVollstaendigkeitLabel("ausreichend_fuer_rueckfrage"),
    "Ausreichend für Rückfrage",
  );
  assert.equal(
    getAnfrageeingangVollstaendigkeitLabel("ausreichend_fuer_vorgang"),
    "Ausreichend für Vorgang",
  );
  assert.equal(getAnfrageeingangVollstaendigkeitLabel("vollstaendig"), "Vollständig");
});

test("T10 JSON-Felder werden als formatiertes JSON dargestellt", () => {
  const json = formatAnfrageeingangJsonValue({ a: 1 });
  assert.match(json ?? "", /"a": 1/);
  assert.equal(formatAnfrageeingangJsonValue({}), null);
  assert.equal(formatAnfrageeingangJsonValue([]), null);
});

test("T11 fehlende Angaben werden fachlich normalisiert", () => {
  assert.deepEqual(normalizeFehlendeAngaben(["Adresse", { feld: "plz" }]), [
    "Adresse",
    "PLZ",
  ]);
});

test("T12 confidence_score als Prozentwert", () => {
  assert.equal(formatAnfrageeingangConfidenceScore(0.8543), "85,4 %");
  assert.equal(formatAnfrageeingangConfidenceScore(null), null);
});

test("T13 Zuordnungs-IDs nicht im ViewModel für Anzeige", () => {
  const detail = mapAnfrageeingangDetailRow(SAMPLE_ROW);
  assert.equal(detail.kundeZugeordnet, false);
  assert.equal(detail.vorgangZugeordnet, true);
  assert.equal(detail.canVerwerfen, false);
  assert.equal("zugeordneter_vorgang_id" in detail, false);
  assert.equal("zugeordnet_kunde_id" in detail, false);
});

test("T1 gültiger eigener Eingang wird gemappt", () => {
  const detail = mapAnfrageeingangDetailRow(SAMPLE_ROW);
  assert.equal(detail.eingangsnummer, "AE-2026-0001");
  assert.equal(detail.betreffLabel, "Fenster undicht");
  assert.equal(detail.statusLabel, "Neu");
  assert.equal(detail.manuellePruefungLabel, "Ja");
  assert.equal(detail.zuordnungsbewertung.isEmpty, false);
  assert.equal(detail.zuordnungsbewertung.confidenceLabel, "85,4 %");
  assert.deepEqual(detail.zuordnungsbewertung.grundPunkte, ["Kein Match"]);
  assert.ok(detail.zuordnungsbewertung.fehlendeAngabenItems.includes("Adresse"));
});

test("T15 Detail-Read nutzt authenticated SSR-Client, keine Service Role", () => {
  const source = readFileSync(join(__dirname, "load-anfrageeingang-detail.ts"), "utf8");
  assert.match(source, /createSupabaseServerAuthClient/);
  assert.match(source, /getActiveMandantContextOrThrow/);
  assert.match(source, /\.maybeSingle\(\)/);
  assert.match(source, /\.eq\("mandant_id", context\.mandantId\)/);
  assert.match(source, /\.eq\("aktiv", true\)/);
  assert.doesNotMatch(source, /createSupabaseAdminClient/);
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE/);
});

test("Detail-SELECT enthält Rohinhalt und JSON-Felder gezielt", () => {
  assert.match(ANFRAGEEINGANG_DETAIL_SELECT, /rohinhalt/);
  assert.match(ANFRAGEEINGANG_DETAIL_SELECT, /strukturierte_daten/);
  assert.match(ANFRAGEEINGANG_DETAIL_SELECT, /zuordnungskandidaten/);
});

console.log(`\n${passed} Tests bestanden.`);

console.log(`
Manuelle Browser-Checkliste:
  1. Liste → Eingangsnummer-Link öffnet /anfrageeingang/[id]
  2. Eigener aktiver Eingang → Detail sichtbar
  3. Fremde ID / fremder Mandant / archiviert (aktiv=false) → 404
  4. Ungültige UUID → 404
  5. Query-Fehler → neutrale Fehlermeldung (nicht 404)
  6. E-Mail/Telefon als mailto:/tel:-Links
  7. /admin unverändert
`);
