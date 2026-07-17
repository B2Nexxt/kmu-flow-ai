import type { MandantenOnboardingData } from "@/app/admin/mandanten/neu/mandanten-onboarding-context";
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

function validateStep2(data: MandantenOnboardingData): string[] {
  const errors: string[] = [];
  const gf = data.geschaeftsfuehrer;
  const ap = data.hauptansprechpartner;

  if (ap.gleicherWieGeschaeftsfuehrer) {
    if (!gf.vorname.trim()) {
      errors.push("Bitte geben Sie einen Vornamen für den Geschäftsführer an.");
    }
    if (!gf.nachname.trim()) {
      errors.push("Bitte geben Sie einen Nachnamen für den Geschäftsführer an.");
    }

    const gfEmailError = validateEmail(gf.email, { required: true });
    if (gfEmailError) errors.push(gfEmailError);

    if (!gf.telefonVorwahl.trim() || !gf.telefonNummer.trim()) {
      errors.push(
        "Bitte geben Sie Vorwahl und Telefonnummer für den Geschäftsführer an.",
      );
    }

    return errors;
  }

  const gfEmailError = validateEmail(gf.email, { required: false });
  if (gfEmailError) errors.push(gfEmailError);

  if (!ap.vorname.trim()) {
    errors.push("Bitte geben Sie einen Vornamen für den Hauptansprechpartner an.");
  }
  if (!ap.nachname.trim()) {
    errors.push(
      "Bitte geben Sie einen Nachnamen für den Hauptansprechpartner an.",
    );
  }
  if (!ap.position.trim()) {
    errors.push("Bitte geben Sie eine Position für den Hauptansprechpartner an.");
  }

  const apEmailError = validateEmail(ap.email, { required: true });
  if (apEmailError) errors.push(apEmailError);

  if (!ap.telefonVorwahl.trim() || !ap.telefonNummer.trim()) {
    errors.push(
      "Bitte geben Sie Vorwahl und Telefonnummer für den Hauptansprechpartner an.",
    );
  }

  return errors;
}

export function validateFullOnboarding(
  data: MandantenOnboardingData,
): OnboardingValidationResult {
  const errors = [
    ...validateStep1(data),
    ...validateStep2(data),
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
