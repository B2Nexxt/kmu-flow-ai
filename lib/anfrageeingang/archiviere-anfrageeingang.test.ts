/**
 * Unit-Tests Archivieren-Anfrageeingang (Sichtbarkeit, Validierung, RPC-Mapping, Action-Sicherheit).
 * Ausführen: npx tsx lib/anfrageeingang/archiviere-anfrageeingang.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  getAnfrageeingangListArchiveHintMessage,
  mapArchiviereAnfrageeingangRpcResult,
  ARCHIVIERE_ANFRAGEEINGANG_NOT_FOUND_MESSAGE,
  ARCHIVIERE_ANFRAGEEINGANG_SUCCESS_MESSAGE,
  ARCHIVIERE_ANFRAGEEINGANG_ALREADY_ARCHIVED_MESSAGE,
  ARCHIVIERE_ANFRAGEEINGANG_SYSTEM_ERROR_MESSAGE,
  ARCHIVIERE_ANFRAGEEINGANG_VALIDATION_MESSAGE,
} from "./archiviere-anfrageeingang-messages";
import { canShowArchiviereAnfrageeingangAction } from "./can-archiviere-anfrageeingang";
import { validateArchiviereAnfrageeingangInput } from "./validate-archiviere-anfrageeingang-input";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ACTION_PATH = join(
  __dirname,
  "../../app/(app)/(protected)/anfrageeingang/[id]/actions/archiviere-anfrageeingang-action.ts",
);
const PANEL_PATH = join(
  __dirname,
  "../../app/(app)/(protected)/anfrageeingang/[id]/archiviere-anfrageeingang-panel.tsx",
);
const DETAIL_VIEW_PATH = join(
  __dirname,
  "../../app/(app)/(protected)/anfrageeingang/[id]/anfrageeingang-detail-view.tsx",
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

test("T1 Archivieren-Button auf aktiver Detailseite sichtbar", () => {
  assert.equal(canShowArchiviereAnfrageeingangAction({ status: "neu", aktiv: true }), true);
  const detailView = readFileSync(DETAIL_VIEW_PATH, "utf8");
  assert.match(detailView, /ArchiviereAnfrageeingangPanel/);
});

test("T2 Button auch bei verworfen sichtbar", () => {
  assert.equal(canShowArchiviereAnfrageeingangAction({ status: "verworfen" }), true);
});

test("T3 Button auch bei in_vorgang_ueberfuehrt sichtbar", () => {
  assert.equal(
    canShowArchiviereAnfrageeingangAction({ status: "in_vorgang_ueberfuehrt" }),
    true,
  );
});

test("T4 gültige ID wird akzeptiert", () => {
  const result = validateArchiviereAnfrageeingangInput(VALID_ID);
  assert.equal(result.valid, true);
});

test("T5 Erfolg archived wird verarbeitet", () => {
  const outcome = mapArchiviereAnfrageeingangRpcResult({ ok: true, code: "archived" });
  assert.equal(outcome.kind, "success");
  if (outcome.kind === "success") {
    assert.equal(outcome.message, ARCHIVIERE_ANFRAGEEINGANG_SUCCESS_MESSAGE);
  }
});

test("T6 already_archived idempotent als Erfolg", () => {
  const outcome = mapArchiviereAnfrageeingangRpcResult({
    ok: true,
    code: "already_archived",
    idempotent: true,
  });
  assert.equal(outcome.kind, "success");
  if (outcome.kind === "success") {
    assert.equal(outcome.code, "already_archived");
  }
});

test("T7 not_found/cross_tenant neutral", () => {
  assert.equal(
    mapArchiviereAnfrageeingangRpcResult({ ok: false, code: "not_found" }).message,
    ARCHIVIERE_ANFRAGEEINGANG_NOT_FOUND_MESSAGE,
  );
  assert.equal(
    mapArchiviereAnfrageeingangRpcResult({ ok: false, code: "cross_tenant_reference" })
      .message,
    ARCHIVIERE_ANFRAGEEINGANG_NOT_FOUND_MESSAGE,
  );
});

test("T8 Systemfehler generisch", () => {
  assert.equal(
    mapArchiviereAnfrageeingangRpcResult(null).message,
    ARCHIVIERE_ANFRAGEEINGANG_SYSTEM_ERROR_MESSAGE,
  );
  assert.equal(
    mapArchiviereAnfrageeingangRpcResult({ ok: false, code: "validation_error" }).message,
    ARCHIVIERE_ANFRAGEEINGANG_VALIDATION_MESSAGE,
  );
});

test("T9 Erfolg redirect auf /anfrageeingang", () => {
  const source = readFileSync(ACTION_PATH, "utf8");
  assert.match(source, /redirect\(`\/anfrageeingang\?hinweis=\$\{hint\}`\)/);
  assert.match(source, /bereits-archiviert/);
  assert.match(source, /archiviert/);
});

test("T10 Liste zeigt Erfolgshinweis", () => {
  assert.equal(
    getAnfrageeingangListArchiveHintMessage("archiviert"),
    ARCHIVIERE_ANFRAGEEINGANG_SUCCESS_MESSAGE,
  );
  assert.equal(
    getAnfrageeingangListArchiveHintMessage("bereits-archiviert"),
    ARCHIVIERE_ANFRAGEEINGANG_ALREADY_ARCHIVED_MESSAGE,
  );
  const listPage = readFileSync(LIST_PAGE_PATH, "utf8");
  assert.match(listPage, /AnfrageeingangListSuccessHint/);
});

test("T12 fachlicher Status wird durch Action nicht geändert", () => {
  const source = readFileSync(ACTION_PATH, "utf8");
  assert.doesNotMatch(source, /status/);
  assert.doesNotMatch(source, /formData\.get\("status"\)/);
});

test("T13 Pending-Zustand im Panel", () => {
  const panel = readFileSync(PANEL_PATH, "utf8");
  assert.match(panel, /Wird archiviert …/);
  assert.match(panel, /disabled=\{pending\}/);
});

test("T14 keine Service Role im Client", () => {
  const panel = readFileSync(PANEL_PATH, "utf8");
  assert.doesNotMatch(panel, /createSupabaseAdminClient/);
  assert.match(panel, /archiviereAnfrageeingangAction/);
});

test("T4b Action nutzt Mandantenkontext und RPC", () => {
  const source = readFileSync(ACTION_PATH, "utf8");
  assert.match(source, /getActiveMandantContextOrThrow/);
  assert.match(source, /p_mandant_id:\s*mandantId/);
  assert.match(source, /archiviere_anfrageeingang/);
  assert.match(source, /revalidatePath\("\/anfrageeingang"\)/);
  assert.doesNotMatch(source, /formData\.get\("mandantId"\)/);
});

console.log(`\n${passed} Tests bestanden.`);

console.log(`
Manuelle Browser-Checkliste:
  1. Detailseite → Archivieren → Redirect zur Liste mit grünem Hinweis
  2. Archivierte Anfrage erscheint nicht mehr in aktiver Liste
  3. Direktlink auf archivierte ID → 404
  4. Button auch bei Status „Verworfen“ sichtbar
  5. /admin unverändert
`);
