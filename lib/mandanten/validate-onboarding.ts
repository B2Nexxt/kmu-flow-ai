import type { MandantenOnboardingData } from "@/app/admin/mandanten/neu/mandanten-onboarding-context";
import type { AnsprechpartnerInput } from "@/lib/mandanten/ansprechpartner-input";
import {
  validateBankverbindung,
  validateEmail,
} from "@/lib/mandanten/validators";

export type OnboardingValidationResult = {
  valid: boolean;
  errors: string[];
};

function collectBankErrors(
  bank: MandantenOnboardingData["bankverbindung"],
): string[] {
  return Object.values(validateBankverbindung(bank)).filter(
    (message): message is string => Boolean(message),
  );
}

function validateStep1(data: MandantenOnboardingData): string[] {
  const errors: string[] = [];
  const unternehmen = data.unternehmensdaten;

  if (!data.status) {
    errors.push("Bitte wählen Sie einen Status.");
  }

  if (!unternehmen.firmenname.trim()) {
    errors.push("Bitte geben Sie einen Firmennamen an.");
  }
  if (!unternehmen.rechtsform.trim()) {
    errors.push("Bitte geben Sie eine Rechtsform an.");
  }
  if (!unternehmen.strasse.trim()) {
    errors.push("Bitte geben Sie Straße und Hausnummer an.");
  }
  if (!unternehmen.postleitzahl.trim()) {
    errors.push("Bitte geben Sie eine Postleitzahl an.");
  }
  if (!unternehmen.ort.trim()) {
    errors.push("Bitte geben Sie einen Ort an.");
  }
  if (!unternehmen.land.trim()) {
    errors.push("Bitte geben Sie ein Land an.");
  }

  const emailError = validateEmail(unternehmen.email, { required: false });
  if (emailError) errors.push(emailError);

  return errors;
}

export type AnsprechpartnerFieldErrors = {
  gfVorname?: string;
  gfNachname?: string;
  gfEmail?: string;
  gfTelefon?: string;
  vorname?: string;
  nachname?: string;
  position?: string;
  email?: string;
  telefon?: string;
};

export function getAnsprechpartnerFieldErrors(
  data: AnsprechpartnerInput,
): AnsprechpartnerFieldErrors {
  const errors: AnsprechpartnerFieldErrors = {};
  const gf = data.geschaeftsfuehrer;
  const ap = data.hauptansprechpartner;

  if (ap.gleicherWieGeschaeftsfuehrer) {
    if (!gf.vorname.trim()) {
      errors.gfVorname = "Bitte geben Sie einen Vornamen für den Geschäftsführer an.";
    }
    if (!gf.nachname.trim()) {
      errors.gfNachname =
        "Bitte geben Sie einen Nachnamen für den Geschäftsführer an.";
    }

    const gfEmailError = validateEmail(gf.email, { required: true });
    if (gfEmailError) errors.gfEmail = gfEmailError;

    if (!gf.telefonVorwahl.trim() || !gf.telefonNummer.trim()) {
      errors.gfTelefon =
        "Bitte geben Sie Vorwahl und Telefonnummer für den Geschäftsführer an.";
    }

    return errors;
  }

  const gfEmailError = validateEmail(gf.email, { required: false });
  if (gfEmailError) errors.gfEmail = gfEmailError;

  if (!ap.vorname.trim()) {
    errors.vorname =
      "Bitte geben Sie einen Vornamen für den Hauptansprechpartner an.";
  }
  if (!ap.nachname.trim()) {
    errors.nachname =
      "Bitte geben Sie einen Nachnamen für den Hauptansprechpartner an.";
  }
  if (!ap.position.trim()) {
    errors.position =
      "Bitte geben Sie eine Position für den Hauptansprechpartner an.";
  }

  const apEmailError = validateEmail(ap.email, { required: true });
  if (apEmailError) errors.email = apEmailError;

  if (!ap.telefonVorwahl.trim() || !ap.telefonNummer.trim()) {
    errors.telefon =
      "Bitte geben Sie Vorwahl und Telefonnummer für den Hauptansprechpartner an.";
  }

  return errors;
}

export function validateAnsprechpartner(data: AnsprechpartnerInput): string[] {
  return Object.values(getAnsprechpartnerFieldErrors(data)).filter(
    (message): message is string => Boolean(message),
  );
}

export function validateFullOnboarding(
  data: MandantenOnboardingData,
): OnboardingValidationResult {
  const errors = [
    ...validateStep1(data),
    ...validateAnsprechpartner(data),
    ...collectBankErrors(data.bankverbindung),
  ];

  if (!data.bestaetigung.angabenGeprueft) {
    errors.push("Bitte bestätigen Sie die Angaben vor der Anlage.");
  }

  if (
    data.status !== "interessent" &&
    data.status !== "aktiver_mandant"
  ) {
    errors.push("Der gewählte Status ist ungültig.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
