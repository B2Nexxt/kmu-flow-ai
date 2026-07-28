/**
 * Unit-Tests operative Auth-/Mandantenkontext-Helfer (ohne Live-Supabase).
 * Ausführen: npx tsx lib/operative-auth/operative-auth.test.ts
 */

import assert from "node:assert/strict";

import {
  ACTIVE_MANDANT_COOKIE_MAX_AGE_SECONDS,
  ACTIVE_MANDANT_COOKIE_NAME,
  getActiveMandantCookieOptions,
  isValidMandantCookieValue,
} from "./active-mandant-cookie";
import { OperativeAuthError } from "./errors";
import {
  assertOperativeRole,
  resolveActiveMandantContext,
  resolveMandantOrThrow,
} from "./resolve-mandant-context";
import type { ActiveMandantContext, ActiveMembership, OperativeRole } from "./types";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const ORG_A = "22222222-2222-4222-8222-222222222222";
const ORG_B = "33333333-3333-4333-8333-333333333333";

function membership(
  organizationId: string,
  role: OperativeRole = "buero",
): ActiveMembership {
  return { organizationId, role };
}

let passed = 0;

function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

test("T2 eine aktive Mitgliedschaft → automatischer Kontext", () => {
  const result = resolveActiveMandantContext(USER_ID, [membership(ORG_A)], null);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.context.mandantId, ORG_A);
  assert.equal(result.shouldPersistCookie, true);
});

test("T3 eine Mitgliedschaft mit passendem Cookie → kein Cookie-Nachzug", () => {
  const result = resolveActiveMandantContext(USER_ID, [membership(ORG_A)], ORG_A);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.shouldPersistCookie, false);
});

test("T4 keine Mitgliedschaft → no_membership", () => {
  const result = resolveActiveMandantContext(USER_ID, [], null);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, "no_membership");
});

test("T5 zwei aktive Mitgliedschaften ohne Cookie → mandant_selection_required", () => {
  const result = resolveActiveMandantContext(
    USER_ID,
    [membership(ORG_A), membership(ORG_B, "monteur")],
    null,
  );
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, "mandant_selection_required");
});

test("T6 gültiger Cookie bei Mehrfachmitgliedschaft → korrekter Mandant", () => {
  const result = resolveActiveMandantContext(
    USER_ID,
    [membership(ORG_A), membership(ORG_B, "monteur")],
    ORG_B,
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.context.mandantId, ORG_B);
  assert.equal(result.context.role, "monteur");
});

test("T7 Cookie auf fremden Mandant → invalid_mandant_context", () => {
  const result = resolveActiveMandantContext(
    USER_ID,
    [membership(ORG_A), membership(ORG_B)],
    "44444444-4444-4444-8444-444444444444",
  );
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, "invalid_mandant_context");
});

test("T8 einzelne Mitgliedschaft korrigiert falschen Cookie", () => {
  const result = resolveActiveMandantContext(
    USER_ID,
    [membership(ORG_A)],
    ORG_B,
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.context.mandantId, ORG_A);
  assert.equal(result.shouldPersistCookie, true);
});

test("T9 Rolle wird aus Membership übernommen", () => {
  const result = resolveActiveMandantContext(
    USER_ID,
    [membership(ORG_A, "mandanten_admin")],
    ORG_A,
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.context.role, "mandanten_admin");
});

test("T10 requireOperativeRole erlaubt passende Rolle", () => {
  const context: ActiveMandantContext = {
    userId: USER_ID,
    mandantId: ORG_A,
    role: "buero",
  };
  assert.doesNotThrow(() => assertOperativeRole(context, ["buero", "mandanten_admin"]));
});

test("T11 requireOperativeRole verweigert falsche Rolle", () => {
  const context: ActiveMandantContext = {
    userId: USER_ID,
    mandantId: ORG_A,
    role: "monteur",
  };
  assert.throws(
    () => assertOperativeRole(context, ["mandanten_admin"]),
    (error: unknown) =>
      error instanceof OperativeAuthError && error.code === "forbidden",
  );
});

test("T12 resolveMandantOrThrow wirft OperativeAuthError", () => {
  assert.throws(
    () => resolveMandantOrThrow(USER_ID, [], null),
    (error: unknown) =>
      error instanceof OperativeAuthError && error.code === "no_membership",
  );
});

test("T13 Cookie-Name und Sicherheitsoptionen", () => {
  assert.equal(ACTIVE_MANDANT_COOKIE_NAME, "kmu_flow_active_mandant");
  const options = getActiveMandantCookieOptions();
  assert.equal(options.httpOnly, true);
  assert.equal(options.sameSite, "lax");
  assert.equal(options.path, "/");
  assert.equal(options.maxAge, ACTIVE_MANDANT_COOKIE_MAX_AGE_SECONDS);
});

test("T14 Cookie-Wert validiert UUID", () => {
  assert.equal(isValidMandantCookieValue(ORG_A), true);
  assert.equal(isValidMandantCookieValue("not-a-uuid"), false);
  assert.equal(isValidMandantCookieValue(null), false);
});

console.log(`\n${passed} Tests bestanden.`);

/**
 * Manuelle Integration (nach Supabase-Login-UI):
 * - nicht angemeldet → /login
 * - angemeldet ohne Mitgliedschaft → /kein-zugang
 * - eine aktive Mitgliedschaft → Redirect init-mandant, dann Dashboard
 * - zwei Mitgliedschaften ohne Cookie → /mandant-waehlen
 * - switchActiveMandant(gültig/fremd)
 * - /admin unverändert erreichbar
 */
