/**
 * Unit-Tests fachliche Zuordnungsbewertung auf der Detailseite.
 * Ausführen: npx tsx lib/anfrageeingang/format-zuordnungsbewertung.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { KUNDENDATEN_EMPTY_LABEL } from "./format-kundendaten";
import {
  mapAnfrageeingangZuordnungsbewertung,
  parseFehlendeAngaben,
  parseZuordnungsgrundPunkte,
  parseZuordnungskandidaten,
} from "./format-zuordnungsbewertung";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DETAIL_VIEW_PATH = join(
  __dirname,
  "../../app/(app)/(protected)/anfrageeingang/[id]/anfrageeingang-detail-view.tsx",
);

let passed = 0;

function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

test("Leerer Zustand ohne Bewertung", () => {
  const result = mapAnfrageeingangZuordnungsbewertung({
    confidence_score: null,
    zuordnungsstatus: "kein_treffer",
    vollstaendigkeitsstatus: "unbekannt",
    zuordnungsgrund: {},
    zuordnungskandidaten: [],
    fehlende_angaben: [],
  });
  assert.equal(result.isEmpty, true);
  assert.equal(result.confidenceLabel, KUNDENDATEN_EMPTY_LABEL);
});

test("Confidence als Prozentwert", () => {
  const result = mapAnfrageeingangZuordnungsbewertung({
    confidence_score: 0.82,
    zuordnungsstatus: "kein_treffer",
    vollstaendigkeitsstatus: "unbekannt",
    zuordnungsgrund: {},
    zuordnungskandidaten: [],
    fehlende_angaben: [],
  });
  assert.equal(result.confidenceLabel, "82,0 %");
});

test("Zuordnungsgrund als Klartextpunkte", () => {
  const punkte = parseZuordnungsgrundPunkte({
    merkmale: [
      { typ: "email", ergebnis: "uebereinstimmung" },
      { typ: "objektadresse", ergebnis: "teilweise_uebereinstimmung" },
    ],
  });
  assert.deepEqual(punkte, [
    "E-Mail stimmt überein",
    "Adresse stimmt teilweise überein",
  ]);
});

test("Fehlende Angaben fachlich", () => {
  assert.deepEqual(parseFehlendeAngaben(["telefon", { feld: "hausnummer" }]), [
    "Telefonnummer",
    "Hausnummer",
  ]);
});

test("Zuordnungskandidaten ohne IDs", () => {
  const kandidaten = parseZuordnungskandidaten([
    {
      kunde_id: "00000000-0000-4000-8000-000000000001",
      score: 0.91,
      name: "Muster GmbH",
      adresse: "Hauptstr. 1, 80331 München",
    },
    {
      gebaeude_id: "00000000-0000-4000-8000-000000000002",
      score: 0.75,
      bezeichnung: "Wohnhaus",
      objektadresse: "Nebenstr. 5, 80333 München",
    },
  ]);
  assert.equal(kandidaten.length, 2);
  assert.equal(kandidaten[0]?.typ, "Kunde");
  assert.equal(kandidaten[0]?.name, "Muster GmbH");
  assert.equal(kandidaten[0]?.confidenceLabel, "91,0 %");
  assert.equal(kandidaten[1]?.typ, "Gebäude");
  assert.doesNotMatch(JSON.stringify(kandidaten), /00000000/);
});

test("Detail-View ohne JSON-Ausgaben", () => {
  const source = readFileSync(DETAIL_VIEW_PATH, "utf8");
  assert.doesNotMatch(source, /<pre/);
  assert.doesNotMatch(source, /JSON\.stringify/);
  assert.doesNotMatch(source, /zuordnungsgrundJson/);
  assert.doesNotMatch(source, /JsonBlock/);
  assert.match(source, /Keine Zuordnungsbewertung vorhanden/);
});

console.log(`\n${passed} Tests bestanden.`);
