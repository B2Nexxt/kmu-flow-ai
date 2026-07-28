/**
 * Unit-Tests manuelle Anlage Anfrageeingang (Validierung, RPC-Mapping, Action-Sicherheit).
 * Ausführen: npx tsx lib/anfrageeingang/create-anfrageeingang.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CREATE_ANFRAGEEINGANG_EMAIL_INVALID_MESSAGE,
  CREATE_ANFRAGEEINGANG_INHALT_REQUIRED_MESSAGE,
  CREATE_ANFRAGEEINGANG_KANAL_REQUIRED_MESSAGE,
  CREATE_ANFRAGEEINGANG_SUCCESS_MESSAGE,
  CREATE_ANFRAGEEINGANG_SYSTEM_ERROR_MESSAGE,
  getAnfrageeingangDetailCreateHintMessage,
  mapCreateAnfrageeingangRpcResult,
} from "./create-anfrageeingang-messages";
import { parseEmpfangenAmInput } from "./format-datetime-local";
import { DEFAULT_ANFRAGEEINGANG_KANAL } from "./kanal-options";
import {
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
const LIST_PAGE_PATH = join(
  __dirname,
  "../../app/(app)/(protected)/anfrageeingang/page.tsx",
);

const VALID_ID = "11111111-1111-4111-8111-111111111111";

let passed = 0;

function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

test("T1 Button „Neue Anfrage“ in Liste", () => {
  const listPage = readFileSync(LIST_PAGE_PATH, "utf8");
  assert.match(listPage, /Neue Anfrage/);
  assert.match(listPage, /href="\/anfrageeingang\/neu"/);
});

test("T4 Kanalpflicht", () => {
  const result = validateCreateAnfrageeingangInput({
    kanal: "",
    betreff: "Test",
    rohinhalt: "",
    absender_name: "",
    absender_email: "",
    absender_telefon: "",
    empfangen_am: "",
  });
  assert.equal(result.valid, false);
  if (!result.valid) {
    assert.equal(result.error, CREATE_ANFRAGEEINGANG_KANAL_REQUIRED_MESSAGE);
  }
});

test("T5 Mindestinhaltspflicht", () => {
  const result = validateCreateAnfrageeingangInput({
    kanal: "telefon",
    betreff: "",
    rohinhalt: "",
    absender_name: "",
    absender_email: "",
    absender_telefon: "",
    empfangen_am: "",
  });
  assert.equal(result.valid, false);
  if (!result.valid) {
    assert.equal(result.error, CREATE_ANFRAGEEINGANG_INHALT_REQUIRED_MESSAGE);
  }
});

test("T6 ungültige E-Mail abgelehnt", () => {
  const result = validateCreateAnfrageeingangInput({
    kanal: "email",
    betreff: "",
    rohinhalt: "",
    absender_name: "",
    absender_email: "keine-email",
    absender_telefon: "",
    empfangen_am: "",
  });
  assert.equal(result.valid, false);
  if (!result.valid) {
    assert.equal(result.error, CREATE_ANFRAGEEINGANG_EMAIL_INVALID_MESSAGE);
  }
});

test("T7 gültige Anfrage wird validiert", () => {
  const result = validateCreateAnfrageeingangInput({
    kanal: "telefon",
    betreff: " Fenster ",
    rohinhalt: "",
    absender_name: "",
    absender_email: "",
    absender_telefon: "",
    empfangen_am: "",
  });
  assert.equal(result.valid, true);
  if (result.valid) {
    assert.equal(result.input.betreff, "Fenster");
    assert.equal(result.input.kanal, "telefon");
  }
});

test("T8 Mandant aus Kontext in Action", () => {
  const source = readFileSync(ACTION_PATH, "utf8");
  assert.match(source, /getActiveMandantContextOrThrow/);
  assert.match(source, /p_mandant_id:\s*mandantId/);
  assert.doesNotMatch(source, /formData\.get\("mandant_id"\)/);
});

test("T9 eingangsnummer aus RPC", () => {
  const outcome = mapCreateAnfrageeingangRpcResult({
    ok: true,
    code: "created",
    anfrageeingang_id: VALID_ID,
    eingangsnummer: "AE-2026-0001",
  });
  assert.equal(outcome.kind, "success");
  if (outcome.kind === "success") {
    assert.equal(outcome.eingangsnummer, "AE-2026-0001");
  }
});

test("T10 Redirect auf Detailseite", () => {
  const source = readFileSync(ACTION_PATH, "utf8");
  assert.match(source, /redirect\(`\/anfrageeingang\/\$\{rpcOutcome\.anfrageeingangId\}\?hinweis=erstellt`\)/);
});

test("T11 Erfolgshinweis sichtbar", () => {
  assert.equal(
    getAnfrageeingangDetailCreateHintMessage("erstellt"),
    CREATE_ANFRAGEEINGANG_SUCCESS_MESSAGE,
  );
});

test("T12 keine Service Role im Client", () => {
  const form = readFileSync(FORM_PATH, "utf8");
  assert.doesNotMatch(form, /createSupabaseAdminClient/);
  assert.match(form, /createAnfrageeingangAction/);
});

test("Standard kanal telefon im Formular", () => {
  const form = readFileSync(FORM_PATH, "utf8");
  assert.match(form, new RegExp(`defaultValue=\\{DEFAULT_ANFRAGEEINGANG_KANAL\\}`));
  assert.equal(DEFAULT_ANFRAGEEINGANG_KANAL, "telefon");
});

test("Systemfehler bei ungültiger RPC-Antwort", () => {
  assert.equal(
    mapCreateAnfrageeingangRpcResult(null).message,
    CREATE_ANFRAGEEINGANG_SYSTEM_ERROR_MESSAGE,
  );
});

test("Ungültiges Empfangsdatum", () => {
  assert.equal(parseEmpfangenAmInput("unbekannt").ok, false);
});

console.log(`\n${passed} Tests bestanden.`);

console.log(`
Manuelle Browser-Checkliste:
  1. /anfrageeingang → „Neue Anfrage“ → Formular ausfüllen → Detail mit Hinweis
  2. Ohne Login → /login
  3. Neue Zeile erscheint in aktiver Liste
  4. /admin unverändert
`);
