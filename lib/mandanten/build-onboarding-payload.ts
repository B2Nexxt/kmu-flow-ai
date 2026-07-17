import type { MandantenOnboardingData } from "@/app/admin/mandanten/neu/mandanten-onboarding-context";
import type { AnsprechpartnerInput } from "@/lib/mandanten/ansprechpartner-input";
import {
  isBankverbindungComplete,
  normalizeBic,
  normalizeIban,
} from "@/lib/mandanten/validators";

type ContactPayload = {
  vorname: string;
  nachname: string;
  position: string | null;
  email: string | null;
  telefon_vorwahl: string | null;
  telefon_nummer: string | null;
  ist_geschaeftsfuehrer: boolean;
  ist_hauptansprechpartner: boolean;
};

function hasOptionalGeschaeftsfuehrerData(
  gf: AnsprechpartnerInput["geschaeftsfuehrer"],
) {
  return (
    gf.vorname.trim() !== "" ||
    gf.nachname.trim() !== "" ||
    gf.email.trim() !== "" ||
    gf.telefonNummer.trim() !== ""
  );
}

export function buildContacts(data: AnsprechpartnerInput): ContactPayload[] {
  const gf = data.geschaeftsfuehrer;
  const ap = data.hauptansprechpartner;
  const contacts: ContactPayload[] = [];

  if (ap.gleicherWieGeschaeftsfuehrer) {
    contacts.push({
      vorname: gf.vorname.trim(),
      nachname: gf.nachname.trim(),
      position: "Geschäftsführer",
      email: gf.email.trim() || null,
      telefon_vorwahl: gf.telefonVorwahl.trim() || null,
      telefon_nummer: gf.telefonNummer.trim() || null,
      ist_geschaeftsfuehrer: true,
      ist_hauptansprechpartner: true,
    });
    return contacts;
  }

  contacts.push({
    vorname: ap.vorname.trim(),
    nachname: ap.nachname.trim(),
    position: ap.position.trim() || null,
    email: ap.email.trim() || null,
    telefon_vorwahl: ap.telefonVorwahl.trim() || null,
    telefon_nummer: ap.telefonNummer.trim() || null,
    ist_geschaeftsfuehrer: false,
    ist_hauptansprechpartner: true,
  });

  if (hasOptionalGeschaeftsfuehrerData(gf)) {
    contacts.push({
      vorname: gf.vorname.trim(),
      nachname: gf.nachname.trim(),
      position: "Geschäftsführer",
      email: gf.email.trim() || null,
      telefon_vorwahl: gf.telefonVorwahl.trim() || null,
      telefon_nummer: gf.telefonNummer.trim() || null,
      ist_geschaeftsfuehrer: true,
      ist_hauptansprechpartner: false,
    });
  }

  return contacts;
}

export function buildOnboardingPayload(data: MandantenOnboardingData) {
  const unternehmen = data.unternehmensdaten;
  const bank = data.bankverbindung;

  return {
    status: data.status,
    einrichtungsgebuehr: data.moduleUndPreise.einrichtungsgebuehr,
    monatlicher_grundpreis: data.moduleUndPreise.monatlicherGrundpreis,
    rabatt_in_prozent: data.moduleUndPreise.rabattInProzent,
    vertragslaufzeit: data.moduleUndPreise.vertragslaufzeit,
    abrechnungsbeginn: data.moduleUndPreise.abrechnungsbeginn || null,
    individuelle_automatisierungswuensche:
      data.automatisierungen.individuelleWuensche,
    unternehmen: {
      firmenname: unternehmen.firmenname.trim(),
      rechtsform: unternehmen.rechtsform.trim(),
      strasse: unternehmen.strasse.trim(),
      hausnummer: null,
      plz: unternehmen.postleitzahl.trim(),
      ort: unternehmen.ort.trim(),
      land: unternehmen.land.trim(),
      website: unternehmen.website.trim() || null,
      telefon_vorwahl: unternehmen.telefonVorwahl.trim() || null,
      telefon_nummer: unternehmen.telefonNummer.trim() || null,
      email: unternehmen.email.trim() || null,
    },
    steuerdaten: {
      steuernummer: data.steuerdaten.steuernummer.trim() || null,
      umsatzsteuer_id: data.steuerdaten.umsatzsteuerId.trim() || null,
      handelsregisternummer:
        data.steuerdaten.handelsregisternummer.trim() || null,
      registergericht: data.steuerdaten.registergericht.trim() || null,
    },
    contacts: buildContacts(data),
    bankverbindung: isBankverbindungComplete(bank)
      ? {
          kontoinhaber: bank.kontoinhaber.trim(),
          bankname: bank.bankname.trim(),
          iban: normalizeIban(bank.iban),
          bic: normalizeBic(bank.bic),
        }
      : null,
    module: data.moduleUndPreise.ausgewaehlteModule,
    automatisierungen: data.automatisierungen.ausgewaehlteAutomatisierungen,
  };
}
