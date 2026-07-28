/**
 * Unit-Tests Mandantenauswahl (ohne Live-Supabase).
 * Ausführen: npx tsx lib/operative-auth/mandant-selection.test.ts
 */

import assert from "node:assert/strict";

import {
  MANDANT_SELECTION_INVALID_COOKIE_MESSAGE,
  MANDANT_SELECTION_INVALID_CHOICE_MESSAGE,
  mapMandantSelectionError,
  resolveMandantSelectionPageMode,
} from "./mandant-selection-messages";
import {
  getOperativeRoleLabel,
  getOrganizationDisplayName,
  DEFAULT_ORGANIZATION_DISPLAY_NAME,
} from "./operative-role-labels";

let passed = 0;

function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

test("T3 genau eine Mitgliedschaft → auto_select", () => {
  assert.equal(resolveMandantSelectionPageMode(1), "auto_select");
});

test("T2 keine Mitgliedschaft → no_membership", () => {
  assert.equal(resolveMandantSelectionPageMode(0), "no_membership");
});

test("T4 zwei Mitgliedschaften → show_selection", () => {
  assert.equal(resolveMandantSelectionPageMode(2), "show_selection");
});

test("T6 Rollenlabels deutsch", () => {
  assert.equal(getOperativeRoleLabel("mandanten_admin"), "Administrator");
  assert.equal(getOperativeRoleLabel("buero"), "Büro");
  assert.equal(getOperativeRoleLabel("bauleiter"), "Bauleitung");
  assert.equal(getOperativeRoleLabel("monteur"), "Monteur");
});

test("T5 Organisationsname ohne Join — Fallback ohne UUID", () => {
  assert.equal(getOrganizationDisplayName(undefined), DEFAULT_ORGANIZATION_DISPLAY_NAME);
  assert.equal(getOrganizationDisplayName("Muster GmbH"), "Muster GmbH");
});

test("T9 fremde organizationId — Fehlermeldung", () => {
  assert.equal(
    mapMandantSelectionError("invalid_mandant_context"),
    MANDANT_SELECTION_INVALID_CHOICE_MESSAGE,
  );
});

test("T12 ungültiger Cookie — Meldungstext", () => {
  assert.match(
    MANDANT_SELECTION_INVALID_COOKIE_MESSAGE,
    /nicht mehr verfügbar/i,
  );
});

console.log(`\n${passed} Tests bestanden.`);

/**
 * Manuelle Integration (Supabase Auth + Test-User mit 2+ Mitgliedschaften):
 * 1. Nicht angemeldet → /mandant-waehlen → /login
 * 2. Keine Mitgliedschaft → /kein-zugang
 * 3. Eine Mitgliedschaft → Redirect init-mandant → /dashboard
 * 4. Zwei Mitgliedschaften → Auswahlseite, Namen + Rollen sichtbar
 * 7–8. Auswahl → Cookie gesetzt → /dashboard
 * 9. Manipulierte organizationId → Fehlermeldung
 * 11. Gültiger Cookie → „Aktuell ausgewählt“
 * 12. ?fehler=ungueltig → neutrale Meldung
 * 13. Abmelden → /login
 * 15. /admin unverändert
 */
