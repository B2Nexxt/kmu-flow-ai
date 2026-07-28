/**
 * Unit-Tests manuelle Anlage Anfrageeingang (Validierung, JSON, Absender-Mapping).
 * Ausführen: npx tsx lib/anfrageeingang/create-anfrageeingang.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildCreateAnfrageeingangStrukturierteDaten,
  DEFAULT_ADRESSE_LAND,
  MANUELLE_ANFRAGE_FORMULARVERSION,
} from "./build-create-anfrageeingang-strukturierte-daten";
import {
  CREATE_ANFRAGEEINGANG_EMAIL_INVALID_MESSAGE,
  CREATE_ANFRAGEEINGANG_INHALT_REQUIRED_MESSAGE,
  CREATE_ANFRAGEEINGANG_KANAL_REQUIRED_MESSAGE,
  CREATE_ANFRAGEEINGANG_SUCCESS_MESSAGE,
  CREATE_ANFRAGEEINGANG_SYSTEM_ERROR_MESSAGE,
  getAnfrageeingangDetailCreateHintMessage,
  mapCreateAnfrageeingangRpcResult,
} from "./create-anfrageeingang-messages";
import { mapCreateAnfrageeingangAbsender } from "./map-create-anfrageeingang-absender";
import {
  parseCreateAnfrageeingangFormData,
  validateCreateAnfrageeingangInput,
} from "./validate-create-anfrageeingang-input";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ACTION_PATH = join(
  __dirname,
  "../../app/(app)/(protected)/anfrageeingang/neu/actions/create-anfrageeingang-action.ts",
);
const FORM_PATH = join(
  __dirname,
  "../../app/(app)/(protected)/anfrageeingang/neu/neue-anfrage-form.tsx",
);
const MIGRATION_PATH = join(
  __dirname,
  "../../supabase/migrations/20260717440000_create_anfrageeingang_strukturierte_daten_v1.sql",
);

const VALID_ID = "11111111-1111-4111-8111-111111111111";

let passed = 0;

function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

function formInput(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  fd.set("kanal", overrides.kanal ?? "telefon");
  fd.set("betreff", overrides.betreff ?? "");
  fd.set("rohinhalt", overrides.rohinhalt ?? "");
  fd.set("empfangen_am", overrides.empfangen_am ?? "");
  fd.set("auftraggeber_typ", overrides.auftraggeber_typ ?? "unbekannt");
  fd.set("uk_name", overrides.uk_name ?? "");
  fd.set("uk_telefon", overrides.uk_telefon ?? "");
  fd.set("uk_mobil", overrides.uk_mobil ?? "");
  fd.set("uk_email", overrides.uk_email ?? "");
  fd.set("pp_anrede", overrides.pp_anrede ?? "");
  fd.set("pp_vorname", overrides.pp_vorname ?? "");
  fd.set("pp_nachname", overrides.pp_nachname ?? "");
  fd.set("pp_strasse", overrides.pp_strasse ?? "");
  fd.set("pp_hausnummer", overrides.pp_hausnummer ?? "");
  fd.set("pp_plz", overrides.pp_plz ?? "");
  fd.set("pp_ort", overrides.pp_ort ?? "");
  fd.set("pp_telefon", overrides.pp_telefon ?? "");
  fd.set("pp_mobil", overrides.pp_mobil ?? "");
  fd.set("pp_email", overrides.pp_email ?? "");
  fd.set("un_firmenname", overrides.un_firmenname ?? "");
  fd.set("un_strasse", overrides.un_strasse ?? "");
  fd.set("un_hausnummer", overrides.un_hausnummer ?? "");
  fd.set("un_plz", overrides.un_plz ?? "");
  fd.set("un_ort", overrides.un_ort ?? "");
  fd.set("un_telefon", overrides.un_telefon ?? "");
  fd.set("un_email", overrides.un_email ?? "");
  fd.set("ap_vorname", overrides.ap_vorname ?? "");
  fd.set("ap_nachname", overrides.ap_nachname ?? "");
  fd.set("ap_telefon", overrides.ap_telefon ?? "");
  fd.set("ap_mobil", overrides.ap_mobil ?? "");
  fd.set("ap_email", overrides.ap_email ?? "");
  return parseCreateAnfrageeingangFormData(fd);
}

test("1 Eingangskanal leer abgelehnt", () => {
  const result = validateCreateAnfrageeingangInput(
    formInput({ kanal: "", betreff: "Test" }),
  );
  assert.equal(result.valid, false);
  if (!result.valid) {
    assert.equal(result.error, CREATE_ANFRAGEEINGANG_KANAL_REQUIRED_MESSAGE);
  }
});

test("2 gültiger Eingangskanal akzeptiert", () => {
  const result = validateCreateAnfrageeingangInput(
    formInput({ kanal: "whatsapp", betreff: "Foto" }),
  );
  assert.equal(result.valid, true);
});

test("3 vollständig leere Anfrage abgelehnt", () => {
  const result = validateCreateAnfrageeingangInput(formInput());
  assert.equal(result.valid, false);
  if (!result.valid) {
    assert.equal(result.error, CREATE_ANFRAGEEINGANG_INHALT_REQUIRED_MESSAGE);
  }
});

test("4 nur Betreff speicherbar", () => {
  const result = validateCreateAnfrageeingangInput(
    formInput({ betreff: "Bitte zurückrufen" }),
  );
  assert.equal(result.valid, true);
});

test("5 nur Inhalt speicherbar", () => {
  const result = validateCreateAnfrageeingangInput(
    formInput({ rohinhalt: "Kunde bittet um Rückruf" }),
  );
  assert.equal(result.valid, true);
});

test("6 nur Absender-E-Mail speicherbar", () => {
  const result = validateCreateAnfrageeingangInput(
    formInput({ uk_email: "kunde@example.com" }),
  );
  assert.equal(result.valid, true);
});

test("7 unbekannt mit Inhalt speicherbar", () => {
  const result = validateCreateAnfrageeingangInput(
    formInput({ rohinhalt: "Bitte rufen Sie uns an.", uk_email: "a@b.de" }),
  );
  assert.equal(result.valid, true);
});

test("8 unbekannt ohne Name speicherbar", () => {
  const result = validateCreateAnfrageeingangInput(
    formInput({ rohinhalt: "Rohrbruch", uk_mobil: "01701234567" }),
  );
  assert.equal(result.valid, true);
});

test("9 Privatperson mit Teilangaben speicherbar", () => {
  const result = validateCreateAnfrageeingangInput(
    formInput({
      auftraggeber_typ: "privatperson",
      pp_vorname: "Max",
    }),
  );
  assert.equal(result.valid, true);
});

test("10 Privatperson nur Vorname speicherbar", () => {
  const result = validateCreateAnfrageeingangInput(
    formInput({
      auftraggeber_typ: "privatperson",
      pp_vorname: "Anna",
    }),
  );
  assert.equal(result.valid, true);
});

test("11 Privatperson nur Nachname speicherbar", () => {
  const result = validateCreateAnfrageeingangInput(
    formInput({
      auftraggeber_typ: "privatperson",
      pp_nachname: "Müller",
    }),
  );
  assert.equal(result.valid, true);
});

test("12 Privatperson mit Vor- und Nachname speicherbar", () => {
  const result = validateCreateAnfrageeingangInput(
    formInput({
      auftraggeber_typ: "privatperson",
      pp_vorname: "Max",
      pp_nachname: "Müller",
      rohinhalt: "Fenster",
    }),
  );
  assert.equal(result.valid, true);
  if (result.valid) {
    assert.equal(result.input.absender_name, "Max Müller");
  }
});

test("13 Unternehmen nur mit Firmenname speicherbar", () => {
  const result = validateCreateAnfrageeingangInput(
    formInput({
      auftraggeber_typ: "unternehmen",
      un_firmenname: "Muster GmbH",
    }),
  );
  assert.equal(result.valid, true);
  if (result.valid) {
    assert.equal(result.input.absender_name, "Muster GmbH");
  }
});

test("14 Unternehmen ohne Firmenname, aber mit Inhalt speicherbar", () => {
  const result = validateCreateAnfrageeingangInput(
    formInput({
      auftraggeber_typ: "unternehmen",
      rohinhalt: "Heizung defekt",
    }),
  );
  assert.equal(result.valid, true);
});

test("15 Ansprechpartner nur Vorname speicherbar", () => {
  const result = validateCreateAnfrageeingangInput(
    formInput({
      auftraggeber_typ: "unternehmen",
      ap_vorname: "Lisa",
    }),
  );
  assert.equal(result.valid, true);
});

test("16 Ansprechpartner nur Nachname speicherbar", () => {
  const result = validateCreateAnfrageeingangInput(
    formInput({
      auftraggeber_typ: "unternehmen",
      ap_nachname: "Schmidt",
    }),
  );
  assert.equal(result.valid, true);
});

test("17 Unternehmen mit vollständigem Ansprechpartner speicherbar", () => {
  const result = validateCreateAnfrageeingangInput(
    formInput({
      auftraggeber_typ: "unternehmen",
      un_firmenname: "Muster GmbH",
      ap_vorname: "Lisa",
      ap_nachname: "Schmidt",
      ap_mobil: "01709998888",
      ap_email: "lisa@muster.de",
    }),
  );
  assert.equal(result.valid, true);
  if (result.valid) {
    assert.equal(result.input.absender_name, "Lisa Schmidt");
    assert.equal(result.input.absender_email, "lisa@muster.de");
    assert.equal(result.input.absender_telefon, "01709998888");
  }
});

test("18 ungültige private E-Mail abgelehnt", () => {
  const result = validateCreateAnfrageeingangInput(
    formInput({
      auftraggeber_typ: "privatperson",
      pp_email: "keine-email",
      pp_vorname: "Max",
    }),
  );
  assert.equal(result.valid, false);
  if (!result.valid) {
    assert.equal(result.error, CREATE_ANFRAGEEINGANG_EMAIL_INVALID_MESSAGE);
  }
});

test("19 ungültige Unternehmens-E-Mail abgelehnt", () => {
  const result = validateCreateAnfrageeingangInput(
    formInput({
      auftraggeber_typ: "unternehmen",
      un_email: "ungueltig",
      un_firmenname: "X",
    }),
  );
  assert.equal(result.valid, false);
});

test("20 ungültige Ansprechpartner-E-Mail abgelehnt", () => {
  const result = validateCreateAnfrageeingangInput(
    formInput({
      auftraggeber_typ: "unternehmen",
      ap_email: "ungueltig",
      ap_vorname: "A",
    }),
  );
  assert.equal(result.valid, false);
});

test("21 strukturierte_daten unbekannt korrekt", () => {
  const json = buildCreateAnfrageeingangStrukturierteDaten({
    auftraggeberTyp: "unbekannt",
    unbekannt: {
      name: "Unbekannt",
      telefon: null,
      mobil: "01701",
      email: null,
    },
  });
  assert.equal(json.formularversion, MANUELLE_ANFRAGE_FORMULARVERSION);
  const anfragender = json.anfragender as Record<string, unknown>;
  assert.equal(anfragender.typ, "unbekannt");
  assert.deepEqual(anfragender.absender, {
    name: "Unbekannt",
    mobil: "01701",
  });
  assert.equal(anfragender.privatperson, undefined);
});

test("22 strukturierte_daten Privatperson korrekt", () => {
  const json = buildCreateAnfrageeingangStrukturierteDaten({
    auftraggeberTyp: "privatperson",
    privatperson: {
      anrede: "frau",
      vorname: "Anna",
      nachname: "Müller",
      telefon: null,
      mobil: null,
      email: "a@b.de",
    },
    privatpersonAdresse: {
      strasse: "Hauptstr.",
      hausnummer: "1",
      plz: "80331",
      ort: "München",
    },
  });
  const anfragender = json.anfragender as Record<string, Record<string, unknown>>;
  assert.equal(anfragender.typ, "privatperson");
  assert.equal(anfragender.privatperson.vorname, "Anna");
  assert.equal(anfragender.adresse.land, DEFAULT_ADRESSE_LAND);
});

test("23 strukturierte_daten Unternehmen korrekt", () => {
  const json = buildCreateAnfrageeingangStrukturierteDaten({
    auftraggeberTyp: "unternehmen",
    unternehmen: {
      firmenname: "Muster GmbH",
      telefon: "089123",
      email: "info@muster.de",
    },
    ansprechpartner: {
      vorname: "Tom",
      nachname: "Meier",
      telefon: null,
      mobil: "0170",
      email: "tom@muster.de",
    },
    unternehmenAdresse: {
      strasse: "Industrieweg",
      hausnummer: "5",
      plz: "80331",
      ort: "München",
    },
  });
  const anfragender = json.anfragender as Record<string, Record<string, unknown>>;
  assert.equal(anfragender.unternehmen.firmenname, "Muster GmbH");
  assert.equal(anfragender.ansprechpartner.mobil, "0170");
  assert.equal(anfragender.adresse.land, DEFAULT_ADRESSE_LAND);
});

test("24 Absender-Mapping unbekannt korrekt", () => {
  const mapped = mapCreateAnfrageeingangAbsender({
    auftraggeberTyp: "unbekannt",
    unbekannt: {
      name: "Kunde",
      telefon: "089",
      mobil: "0170",
      email: "a@b.de",
    },
  });
  assert.equal(mapped.absender_name, "Kunde");
  assert.equal(mapped.absender_telefon, "0170");
  assert.equal(mapped.absender_email, "a@b.de");
});

test("25 Absender-Mapping Privatperson korrekt", () => {
  const mapped = mapCreateAnfrageeingangAbsender({
    auftraggeberTyp: "privatperson",
    privatperson: {
      anrede: null,
      vorname: "Max",
      nachname: "Müller",
      telefon: "089",
      mobil: null,
      email: "max@example.com",
    },
  });
  assert.equal(mapped.absender_name, "Max Müller");
  assert.equal(mapped.absender_telefon, "089");
});

test("26 Absender-Mapping Unternehmen mit Ansprechpartner korrekt", () => {
  const mapped = mapCreateAnfrageeingangAbsender({
    auftraggeberTyp: "unternehmen",
    unternehmen: {
      firmenname: "Muster GmbH",
      telefon: "089111",
      email: "info@muster.de",
    },
    ansprechpartner: {
      vorname: "Lisa",
      nachname: "Schmidt",
      telefon: null,
      mobil: "0170",
      email: "lisa@muster.de",
    },
  });
  assert.equal(mapped.absender_name, "Lisa Schmidt");
  assert.equal(mapped.absender_email, "lisa@muster.de");
  assert.equal(mapped.absender_telefon, "0170");
});

test("27 Absender-Mapping Unternehmen ohne Ansprechpartner korrekt", () => {
  const mapped = mapCreateAnfrageeingangAbsender({
    auftraggeberTyp: "unternehmen",
    unternehmen: {
      firmenname: "Muster GmbH",
      telefon: "089111",
      email: "info@muster.de",
    },
  });
  assert.equal(mapped.absender_name, "Muster GmbH");
  assert.equal(mapped.absender_email, "info@muster.de");
  assert.equal(mapped.absender_telefon, "089111");
});

test("28 Felder der nicht gewählten Variante werden nicht gespeichert", () => {
  const result = validateCreateAnfrageeingangInput(
    formInput({
      auftraggeber_typ: "unbekannt",
      betreff: "Test",
      pp_vorname: "Soll ignoriert werden",
      un_firmenname: "Auch ignoriert",
    }),
  );
  assert.equal(result.valid, true);
  if (result.valid) {
    const anfragender = result.input.strukturierte_daten.anfragender as Record<
      string,
      unknown
    >;
    assert.equal(anfragender.typ, "unbekannt");
    assert.equal(anfragender.privatperson, undefined);
    assert.equal(anfragender.unternehmen, undefined);
  }
});

test("29 keine Kunden-/Adress-/Gebäude-RPC in Action", () => {
  const source = readFileSync(ACTION_PATH, "utf8");
  assert.match(source, /create_anfrageeingang/);
  assert.doesNotMatch(source, /create_vorlaeufiger_kunde/);
  assert.doesNotMatch(source, /kunden/);
  assert.doesNotMatch(source, /gebaeude/);
});

test("30 mandant_id nur aus Serverkontext", () => {
  const source = readFileSync(ACTION_PATH, "utf8");
  assert.match(source, /getActiveMandantContextOrThrow/);
  assert.match(source, /p_mandant_id:\s*mandantId/);
  assert.doesNotMatch(source, /formData\.get\("mandant_id"\)/);
});

test("31 RPC-Migration additiv mit p_strukturierte_daten", () => {
  const migration = readFileSync(MIGRATION_PATH, "utf8");
  assert.match(migration, /p_strukturierte_daten jsonb default '\{\}'::jsonb/);
  assert.match(migration, /vollstaendigkeitsstatus,\s*\n\s*dringlichkeit,\s*\n\s*manuelle_pruefung_erforderlich/);
  assert.match(migration, /'unbekannt'/);
  assert.match(migration, /false,/);
  assert.doesNotMatch(migration, /p_vollstaendigkeitsstatus/);
});

test("32 Action übergibt p_strukturierte_daten serverseitig", () => {
  const source = readFileSync(ACTION_PATH, "utf8");
  assert.match(source, /p_strukturierte_daten:\s*input\.strukturierte_daten/);
  assert.doesNotMatch(source, /formData\.get\("strukturierte_daten"\)/);
});

test("33 Formular ohne Kanal-Default", () => {
  const form = readFileSync(FORM_PATH, "utf8");
  assert.match(form, /Bitte auswählen/);
  assert.match(form, /defaultValue=""/);
  assert.doesNotMatch(form, /DEFAULT_ANFRAGEEINGANG_KANAL/);
});

test("34 RPC-Erfolg und Redirect", () => {
  const outcome = mapCreateAnfrageeingangRpcResult({
    ok: true,
    code: "created",
    anfrageeingang_id: VALID_ID,
    eingangsnummer: "AE-2026-0001",
  });
  assert.equal(outcome.kind, "success");
  const source = readFileSync(ACTION_PATH, "utf8");
  assert.match(
    source,
    /redirect\(`\/anfrageeingang\/\$\{rpcOutcome\.anfrageeingangId\}\?hinweis=erstellt`\)/,
  );
  assert.equal(
    getAnfrageeingangDetailCreateHintMessage("erstellt"),
    CREATE_ANFRAGEEINGANG_SUCCESS_MESSAGE,
  );
});

test("Systemfehler bei ungültiger RPC-Antwort", () => {
  assert.equal(
    mapCreateAnfrageeingangRpcResult(null).message,
    CREATE_ANFRAGEEINGANG_SYSTEM_ERROR_MESSAGE,
  );
});

console.log(`\n${passed} Tests bestanden.`);
