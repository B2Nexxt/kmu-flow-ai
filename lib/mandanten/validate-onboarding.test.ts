/**
 * Validierungstests für den Mandanten-Onboarding-Speicherprozess.
 * Ausführen: npx tsx lib/mandanten/validate-onboarding.test.ts
 */

import assert from "node:assert/strict";
import type { MandantenOnboardingData } from "../../app/admin/mandanten/neu/mandanten-onboarding-context";
import { initialMandantenOnboardingData } from "../../app/admin/mandanten/neu/mandanten-onboarding-context";
import { buildOnboardingPayload } from "./build-onboarding-payload";
import { validateFullOnboarding } from "./validate-onboarding";
import { isBankverbindungPartiallyFilled } from "./validators";

function cloneData(): MandantenOnboardingData {
  return structuredClone(initialMandantenOnboardingData);
}

function fillMinimum(data: MandantenOnboardingData) {
  data.status = "interessent";
  data.unternehmensdaten.firmenname = "Muster GmbH";
  data.unternehmensdaten.rechtsform = "GmbH";
  data.unternehmensdaten.strasse = "Musterstraße 1";
  data.unternehmensdaten.postleitzahl = "10115";
  data.unternehmensdaten.ort = "Berlin";
  data.unternehmensdaten.land = "DE";
  data.hauptansprechpartner.vorname = "Anna";
  data.hauptansprechpartner.nachname = "Beispiel";
  data.hauptansprechpartner.position = "Leitung";
  data.hauptansprechpartner.email = "anna@muster.de";
  data.hauptansprechpartner.telefonNummer = "301234567";
  data.bestaetigung.angabenGeprueft = true;
}

let passed = 0;

function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

test("Interessent vollständig ist gültig", () => {
  const data = cloneData();
  fillMinimum(data);
  assert.equal(validateFullOnboarding(data).valid, true);
});

test("Aktiver Mandant vollständig ist gültig", () => {
  const data = cloneData();
  fillMinimum(data);
  data.status = "aktiver_mandant";
  assert.equal(validateFullOnboarding(data).valid, true);
});

test("GF als HA erzeugt einen Kontakt mit beiden Rollen", () => {
  const data = cloneData();
  fillMinimum(data);
  data.hauptansprechpartner.gleicherWieGeschaeftsfuehrer = true;
  data.geschaeftsfuehrer.vorname = "Max";
  data.geschaeftsfuehrer.nachname = "Chef";
  data.geschaeftsfuehrer.email = "max@muster.de";
  data.geschaeftsfuehrer.telefonNummer = "309876543";
  data.hauptansprechpartner.vorname = "";
  const payload = buildOnboardingPayload(data);
  assert.equal(payload.contacts.length, 1);
  assert.equal(payload.contacts[0]?.ist_geschaeftsfuehrer, true);
  assert.equal(payload.contacts[0]?.ist_hauptansprechpartner, true);
  assert.equal(payload.contacts[0]?.position, "Geschäftsführer");
});

test("Separater HA und optionaler GF erzeugt zwei Kontakte", () => {
  const data = cloneData();
  fillMinimum(data);
  data.geschaeftsfuehrer.vorname = "Max";
  data.geschaeftsfuehrer.nachname = "Chef";
  const payload = buildOnboardingPayload(data);
  assert.equal(payload.contacts.length, 2);
  assert.equal(payload.contacts[1]?.position, "Geschäftsführer");
});

test("Teilweise Bankdaten sind ungültig", () => {
  const data = cloneData();
  fillMinimum(data);
  data.bankverbindung.iban = "DE89370400440532013000";
  assert.equal(isBankverbindungPartiallyFilled(data.bankverbindung), true);
  assert.equal(validateFullOnboarding(data).valid, false);
});

test("Ungültige E-Mail ist ungültig", () => {
  const data = cloneData();
  fillMinimum(data);
  data.hauptansprechpartner.email = "ungueltig";
  assert.equal(validateFullOnboarding(data).valid, false);
});

test("Ohne Bestätigung ist ungültig", () => {
  const data = cloneData();
  fillMinimum(data);
  data.bestaetigung.angabenGeprueft = false;
  assert.equal(validateFullOnboarding(data).valid, false);
});

console.log(`\n${passed} Tests bestanden.`);
