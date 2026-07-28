/**
 * Unit-Tests Verwerfen-Anfrageeingang (Sichtbarkeit, Validierung, RPC-Mapping, Action-Sicherheit).
 * Ausführen: npx tsx lib/anfrageeingang/verwerfe-anfrageeingang.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { canShowVerwerfeAnfrageeingangAction } from "./can-verwerfe-anfrageeingang";
import { mapAnfrageeingangDetailRow } from "./format-detail";
import type { AnfrageeingangDetailRow } from "./types";
import { validateVerwerfeAnfrageeingangInput } from "./validate-verwerfe-anfrageeingang-input";
import {
  mapVerwerfeAnfrageeingangRpcResult,
  VERWERFE_ANFRAGEEINGANG_CONFLICT_MESSAGE,
  VERWERFE_ANFRAGEEINGANG_INVALID_STATUS_MESSAGE,
  VERWERFE_ANFRAGEEINGANG_NOT_FOUND_MESSAGE,
  VERWERFE_ANFRAGEEINGANG_SUCCESS_MESSAGE,
  VERWERFE_ANFRAGEEINGANG_SYSTEM_ERROR_MESSAGE,
  VERWERFE_ANFRAGEEINGANG_VALIDATION_MESSAGE,
} from "./verwerfe-anfrageeingang-messages";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ACTION_PATH = join(
  __dirname,
  "../../app/(app)/(protected)/anfrageeingang/[id]/actions/verwerfe-anfrageeingang-action.ts",
);
const PANEL_PATH = join(
  __dirname,
  "../../app/(app)/(protected)/anfrageeingang/[id]/verwerfe-anfrageeingang-panel.tsx",
);

const BASE_ROW: AnfrageeingangDetailRow = {
  id: "11111111-1111-4111-8111-111111111111",
  eingangsnummer: "AE-1",
  kanal: "email",
  status: "neu",
  empfangen_am: "2026-07-28T14:30:00.000Z",
  zuletzt_bearbeitet_am: null,
  beendet_am: null,
  betreff: "Test",
  rohinhalt: null,
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

test("T1 Button bei normalem aktiven Eingang sichtbar", () => {
  assert.equal(canShowVerwerfeAnfrageeingangAction({ status: "neu" }), true);
  assert.equal(mapAnfrageeingangDetailRow(BASE_ROW).canVerwerfen, true);
});

test("T2 Button bei verworfen nicht sichtbar", () => {
  assert.equal(canShowVerwerfeAnfrageeingangAction({ status: "verworfen" }), false);
});

test("T3 Button bei in_vorgang_ueberfuehrt nicht sichtbar", () => {
  assert.equal(
    canShowVerwerfeAnfrageeingangAction({ status: "in_vorgang_ueberfuehrt" }),
    false,
  );
});

test("T3b Button bei zugeordnetem Vorgang nicht sichtbar", () => {
  assert.equal(
    canShowVerwerfeAnfrageeingangAction({
      status: "bereit_fuer_vorgang",
      vorgangZugeordnet: true,
    }),
    false,
  );
});

test("T4 leerer Grund wird abgelehnt", () => {
  const result = validateVerwerfeAnfrageeingangInput(BASE_ROW.id, "   ");
  assert.equal(result.valid, false);
  if (!result.valid) {
    assert.equal(result.error, VERWERFE_ANFRAGEEINGANG_VALIDATION_MESSAGE);
  }
});

test("T5 gültiger Grund und UUID werden akzeptiert", () => {
  const result = validateVerwerfeAnfrageeingangInput(BASE_ROW.id, "  Duplikat  ");
  assert.equal(result.valid, true);
  if (result.valid) {
    assert.equal(result.grund, "Duplikat");
  }
});

test("T7 success/discarded wird korrekt behandelt", () => {
  const outcome = mapVerwerfeAnfrageeingangRpcResult({
    ok: true,
    code: "discarded",
  });
  assert.equal(outcome.kind, "success");
  if (outcome.kind === "success") {
    assert.equal(outcome.message, VERWERFE_ANFRAGEEINGANG_SUCCESS_MESSAGE);
  }
});

test("T8 already_discarded idempotent als Erfolg", () => {
  const outcome = mapVerwerfeAnfrageeingangRpcResult({
    ok: true,
    code: "already_discarded",
    idempotent: true,
  });
  assert.equal(outcome.kind, "success");
});

test("T9 conflict zeigt verständliche Meldung", () => {
  const outcome = mapVerwerfeAnfrageeingangRpcResult({ ok: false, code: "conflict" });
  assert.equal(outcome.kind, "error");
  if (outcome.kind === "error") {
    assert.equal(outcome.message, VERWERFE_ANFRAGEEINGANG_CONFLICT_MESSAGE);
  }
});

test("T10 invalid_status_transition zeigt verständliche Meldung", () => {
  const outcome = mapVerwerfeAnfrageeingangRpcResult({
    ok: false,
    code: "invalid_status_transition",
  });
  assert.equal(outcome.message, VERWERFE_ANFRAGEEINGANG_INVALID_STATUS_MESSAGE);
});

test("T11 not_found/cross_tenant neutrale Meldung", () => {
  assert.equal(
    mapVerwerfeAnfrageeingangRpcResult({ ok: false, code: "not_found" }).message,
    VERWERFE_ANFRAGEEINGANG_NOT_FOUND_MESSAGE,
  );
  assert.equal(
    mapVerwerfeAnfrageeingangRpcResult({ ok: false, code: "cross_tenant_reference" })
      .message,
    VERWERFE_ANFRAGEEINGANG_NOT_FOUND_MESSAGE,
  );
});

test("T12 technischer Fehler generische Meldung", () => {
  assert.equal(
    mapVerwerfeAnfrageeingangRpcResult(null).message,
    VERWERFE_ANFRAGEEINGANG_SYSTEM_ERROR_MESSAGE,
  );
});

test("T6 p_quelle manuell und mandantId aus Kontext in Action", () => {
  const source = readFileSync(ACTION_PATH, "utf8");
  assert.match(source, /p_quelle:\s*QUELLE_MANUELL/);
  assert.match(source, /const QUELLE_MANUELL = "manuell"/);
  assert.match(source, /getActiveMandantContextOrThrow/);
  assert.match(source, /p_mandant_id:\s*mandantId/);
  assert.match(source, /createSupabaseAdminClient/);
  assert.match(source, /revalidatePath\("\/anfrageeingang"\)/);
  assert.doesNotMatch(source, /formData\.get\("mandantId"\)/);
  assert.doesNotMatch(source, /formData\.get\("quelle"\)/);
});

test("T14 keine Service Role im Client-Panel", () => {
  const panel = readFileSync(PANEL_PATH, "utf8");
  assert.doesNotMatch(panel, /createSupabaseAdminClient/);
  assert.doesNotMatch(panel, /SUPABASE_SERVICE_ROLE/);
  assert.match(panel, /verwerfeAnfrageeingangAction/);
});

test("T14b Liste verlinkt Detailroute", () => {
  const table = readFileSync(
    join(__dirname, "../../app/(app)/(protected)/anfrageeingang/anfrageeingang-table.tsx"),
    "utf8",
  );
  assert.match(table, /href=\{`\/anfrageeingang\/\$\{row\.id\}`\}/);
});

console.log(`\n${passed} Tests bestanden.`);

console.log(`
Manuelle Browser-Checkliste:
  1. Detailseite → „Anfrage verwerfen“ → Begründung → Erfolg auf derselben Seite
  2. Verworfener Eingang → Button ausgeblendet, Status „Verworfen“
  3. RPC-Konflikt (Vorgang zugeordnet) → Meldung ohne technische Details
  4. /admin unverändert
`);
