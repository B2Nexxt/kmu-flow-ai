/**
 * Unit-Tests Login-Validierung und Fehler-Mapping (ohne Live-Supabase).
 * Ausführen: npx tsx lib/operative-auth/login.test.ts
 */

import assert from "node:assert/strict";

import {
  LOGIN_EMAIL_INVALID_MESSAGE,
  LOGIN_INVALID_CREDENTIALS_MESSAGE,
  LOGIN_PASSWORD_REQUIRED_MESSAGE,
  LOGIN_TECHNICAL_ERROR_MESSAGE,
} from "./login-messages";
import { mapLoginAuthError, validateLoginInput } from "./validate-login-input";

let passed = 0;

function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

test("T2 leere E-Mail wird abgelehnt", () => {
  const result = validateLoginInput("", "secret");
  assert.equal(result.valid, false);
  if (result.valid) return;
  assert.equal(result.fieldErrors.email, LOGIN_EMAIL_INVALID_MESSAGE);
});

test("T3 ungültige E-Mail wird abgelehnt", () => {
  const result = validateLoginInput("not-an-email", "secret");
  assert.equal(result.valid, false);
  if (result.valid) return;
  assert.equal(result.fieldErrors.email, LOGIN_EMAIL_INVALID_MESSAGE);
});

test("T4 leeres Passwort wird abgelehnt", () => {
  const result = validateLoginInput("user@example.com", "");
  assert.equal(result.valid, false);
  if (result.valid) return;
  assert.equal(result.fieldErrors.password, LOGIN_PASSWORD_REQUIRED_MESSAGE);
});

test("T5 gültige Eingabe wird akzeptiert", () => {
  const result = validateLoginInput("user@example.com", "secret");
  assert.equal(result.valid, true);
  if (!result.valid) return;
  assert.equal(result.email, "user@example.com");
});

test("T5 falsche Zugangsdaten — generische Meldung", () => {
  assert.equal(
    mapLoginAuthError("Invalid login credentials"),
    LOGIN_INVALID_CREDENTIALS_MESSAGE,
  );
});

test("T5 technischer Fehler — stabile Meldung", () => {
  assert.equal(mapLoginAuthError("Network timeout"), LOGIN_TECHNICAL_ERROR_MESSAGE);
});

console.log(`\n${passed} Tests bestanden.`);

/**
 * Manuelle Integration (Supabase Auth + Test-User):
 * 1. /login rendert Formular ohne Sidebar
 * 2. Erfolgreicher Login → /dashboard (Session-Cookies via @supabase/ssr)
 * 3. Bereits angemeldet → /login redirect /dashboard
 * 4. logoutAction() → Session beendet, kmu_flow_active_mandant gelöscht, /login
 * 5. Unauthenticated /dashboard → /login
 * 6. /admin unverändert erreichbar
 */
