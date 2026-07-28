/**
 * Unit-Tests Kundendaten-Darstellung auf der Detailseite.
 * Ausführen: npx tsx lib/anfrageeingang/format-kundendaten.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  KUNDENDATEN_EMPTY_LABEL,
  mapAnfrageeingangKundendaten,
} from "./format-kundendaten";
import { mapAnfrageeingangDetailRow } from "./format-detail";
import { MANUELLE_ANFRAGE_FORMULARVERSION } from "./build-create-anfrageeingang-strukturierte-daten";
import type { AnfrageeingangDetailRow } from "./types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DETAIL_VIEW_PATH = join(
  __dirname,
  "../../app/(app)/(protected)/anfrageeingang/[id]/anfrageeingang-detail-view.tsx",
);

const BASE_ROW: AnfrageeingangDetailRow = {
  id: "11111111-1111-4111-8111-111111111111",
  eingangsnummer: "AE-2026-0001",
  kanal: "telefon",
  status: "neu",
  empfangen_am: "2026-07-28T14:30:00.000Z",
  zuletzt_bearbeitet_am: null,
  beendet_am: null,
  betreff: "Test",
  rohinhalt: "Inhalt",
  strukturierte_daten: {},
  absender_name: null,
  absender_email: null,
  absender_telefon: null,
  zuordnungsstatus: "kein_treffer",
  zuordnungsgrund: {},
  zuordnungskandidaten: [],
  vollstaendigkeitsstatus: "unbekannt",
  fehlende_angaben: [],
  confidence_score: null,
  dringlichkeit: "normal",
  manuelle_pruefung_erforderlich: false,
  zugeordnet_kunde_id: null,
  zugeordnet_gebaeude_id: null,
  zugeordnet_einheit_id: null,
  zugeordneter_vorgang_id: null,
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

test("Privatperson aus strukturierte_daten", () => {
  const kundendaten = mapAnfrageeingangKundendaten({
    strukturierte_daten: {
      formularversion: MANUELLE_ANFRAGE_FORMULARVERSION,
      anfragender: {
        typ: "privatperson",
        privatperson: {
          anrede: "frau",
          vorname: "Anna",
          nachname: "Müller",
          telefon: "089123",
          email: "anna@example.com",
        },
        adresse: {
          strasse: "Hauptstr.",
          hausnummer: "1",
          plz: "80331",
          ort: "München",
          land: "Deutschland",
        },
      },
    },
    absender_name: null,
    absender_email: null,
    absender_telefon: null,
  });
  assert.equal(kundendaten.layout, "privatperson");
  assert.equal(kundendaten.vorname, "Anna");
  assert.equal(kundendaten.anrede, "Frau");
  assert.equal(kundendaten.mobil.display, KUNDENDATEN_EMPTY_LABEL);
});

test("Unternehmen mit Ansprechpartner", () => {
  const kundendaten = mapAnfrageeingangKundendaten({
    strukturierte_daten: {
      formularversion: MANUELLE_ANFRAGE_FORMULARVERSION,
      anfragender: {
        typ: "unternehmen",
        unternehmen: {
          firmenname: "Muster GmbH",
          telefon: "089111",
          email: "info@muster.de",
        },
        ansprechpartner: {
          vorname: "Lisa",
          nachname: "Schmidt",
          mobil: "0170",
        },
      },
    },
    absender_name: null,
    absender_email: null,
    absender_telefon: null,
  });
  assert.equal(kundendaten.layout, "unternehmen");
  assert.equal(kundendaten.firmenname, "Muster GmbH");
  assert.equal(kundendaten.ansprechpartner?.vorname, "Lisa");
  assert.equal(kundendaten.ansprechpartner?.mobil.display, "0170");
});

test("Unbekannt aus strukturierte_daten", () => {
  const kundendaten = mapAnfrageeingangKundendaten({
    strukturierte_daten: {
      formularversion: MANUELLE_ANFRAGE_FORMULARVERSION,
      anfragender: {
        typ: "unbekannt",
        absender: { mobil: "01701234567" },
      },
    },
    absender_name: null,
    absender_email: null,
    absender_telefon: null,
  });
  assert.equal(kundendaten.layout, "unbekannt");
  assert.equal(kundendaten.mobil.display, "01701234567");
  assert.equal(kundendaten.name, KUNDENDATEN_EMPTY_LABEL);
});

test("Fallback auf Absender-Spalten", () => {
  const kundendaten = mapAnfrageeingangKundendaten({
    strukturierte_daten: {},
    absender_name: "Max Mustermann",
    absender_email: "max@example.com",
    absender_telefon: "089999",
  });
  assert.equal(kundendaten.layout, "fallback");
  assert.equal(kundendaten.name, "Max Mustermann");
  assert.equal(kundendaten.email.display, "max@example.com");
  assert.equal(kundendaten.telefon.display, "089999");
});

test("Fehlende Werte als —", () => {
  const kundendaten = mapAnfrageeingangKundendaten({
    strukturierte_daten: {
      formularversion: MANUELLE_ANFRAGE_FORMULARVERSION,
      anfragender: { typ: "privatperson", privatperson: { vorname: "Tom" } },
    },
    absender_name: null,
    absender_email: null,
    absender_telefon: null,
  });
  assert.equal(kundendaten.nachname, KUNDENDATEN_EMPTY_LABEL);
  assert.equal(kundendaten.strasse, KUNDENDATEN_EMPTY_LABEL);
});

test("Detail-View ohne Strukturierte-Daten-Bereich", () => {
  const source = readFileSync(DETAIL_VIEW_PATH, "utf8");
  assert.match(source, /title="Kundendaten"/);
  assert.doesNotMatch(source, /Strukturierte Daten/);
  assert.doesNotMatch(source, /strukturierteDatenJson/);
  assert.doesNotMatch(source, /<pre/);
  assert.doesNotMatch(source, /JSON\.stringify/);
});

test("Detail-Mapping enthält kundendaten", () => {
  const detail = mapAnfrageeingangDetailRow({
    ...BASE_ROW,
    strukturierte_daten: {
      formularversion: MANUELLE_ANFRAGE_FORMULARVERSION,
      anfragender: {
        typ: "unbekannt",
        absender: { name: "Anrufer" },
      },
    },
  });
  assert.equal(detail.kundendaten.layout, "unbekannt");
  assert.equal(detail.kundendaten.name, "Anrufer");
  assert.equal("strukturierteDatenJson" in detail, false);
});

console.log(`\n${passed} Tests bestanden.`);
