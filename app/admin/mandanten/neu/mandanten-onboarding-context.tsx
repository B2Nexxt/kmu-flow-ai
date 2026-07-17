"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  LAENDER_OPTIONS,
  getDialCodeByLand,
  getLandLabel,
  type LandCode,
} from "@/lib/mandanten/land-options";
import {
  FUTURE_MANDANT_STATUS_CODES,
  MANDANT_STATUS,
  MANDANT_STATUS_OPTIONS,
  getMandantStatusLabel,
  type MandantStatusCode,
} from "@/lib/mandanten/mandant-status";

export {
  FUTURE_MANDANT_STATUS_CODES,
  LAENDER_OPTIONS,
  MANDANT_STATUS,
  MANDANT_STATUS_OPTIONS,
  getDialCodeByLand,
  getLandLabel,
  getMandantStatusLabel,
  type LandCode,
  type MandantStatusCode,
};

export const MODULE_OPTIONS = [
  "CRM",
  "Angebote",
  "Rechnungen",
  "KI-Assistent",
  "Automatisierungen",
  "Dokumente",
] as const;

export const AUTOMATION_OPTIONS = [
  "Kundenanfrage aus E-Mail erfassen",
  "Angebotsentwurf aus Anfrage erstellen",
  "Angebot nach Freigabe versenden",
  "Angenommenes Angebot in Rechnung umwandeln",
  "Monatliche Rechnung automatisch erstellen",
  "Zahlungserinnerung vorbereiten",
  "Dokumente automatisch zuordnen",
  "KI-Zusammenfassung für neue Vorgänge",
] as const;

export const RECHTSFORM_OPTIONS = [
  "Einzelunternehmen",
  "GbR",
  "OHG",
  "KG",
  "GmbH",
  "UG (haftungsbeschränkt)",
  "GmbH & Co. KG",
  "AG",
  "e.K.",
  "eG",
  "Verein",
  "Stiftung",
  "Sonstige",
] as const;

export const TELEFON_VORWAHN_OPTIONS = LAENDER_OPTIONS.map(
  ({ code, label, flag, dialCode }) => ({
    code,
    label,
    flag,
    dialCode,
  }),
);

export type TelefonVorwahlOption = (typeof TELEFON_VORWAHN_OPTIONS)[number];

export type TelefonFields = {
  telefonVorwahl: string;
  telefonNummer: string;
};

export type MandantenOnboardingData = {
  status: MandantStatusCode;
  unternehmensdaten: {
    firmenname: string;
    rechtsform: string;
    strasse: string;
    postleitzahl: string;
    ort: string;
    land: LandCode;
    website: string;
    telefonVorwahl: string;
    telefonNummer: string;
    email: string;
  };
  geschaeftsfuehrer: TelefonFields & {
    vorname: string;
    nachname: string;
    email: string;
  };
  hauptansprechpartner: TelefonFields & {
    vorname: string;
    nachname: string;
    position: string;
    email: string;
    gleicherWieGeschaeftsfuehrer: boolean;
  };
  steuerdaten: {
    steuernummer: string;
    umsatzsteuerId: string;
    handelsregisternummer: string;
    registergericht: string;
  };
  bankverbindung: {
    kontoinhaber: string;
    bankname: string;
    iban: string;
    bic: string;
  };
  moduleUndPreise: {
    ausgewaehlteModule: string[];
    einrichtungsgebuehr: string;
    monatlicherGrundpreis: string;
    rabattInProzent: string;
    vertragslaufzeit: string;
    abrechnungsbeginn: string;
  };
  automatisierungen: {
    ausgewaehlteAutomatisierungen: string[];
    individuelleWuensche: string;
  };
  bestaetigung: {
    angabenGeprueft: boolean;
  };
};

export const initialMandantenOnboardingData: MandantenOnboardingData = {
  status: MANDANT_STATUS.INTERESSENT,
  unternehmensdaten: {
    firmenname: "",
    rechtsform: "",
    strasse: "",
    postleitzahl: "",
    ort: "",
    land: "DE",
    website: "",
    telefonVorwahl: "+49",
    telefonNummer: "",
    email: "",
  },
  geschaeftsfuehrer: {
    vorname: "",
    nachname: "",
    email: "",
    telefonVorwahl: "+49",
    telefonNummer: "",
  },
  hauptansprechpartner: {
    vorname: "",
    nachname: "",
    position: "",
    email: "",
    telefonVorwahl: "+49",
    telefonNummer: "",
    gleicherWieGeschaeftsfuehrer: false,
  },
  steuerdaten: {
    steuernummer: "",
    umsatzsteuerId: "",
    handelsregisternummer: "",
    registergericht: "",
  },
  bankverbindung: {
    kontoinhaber: "",
    bankname: "",
    iban: "",
    bic: "",
  },
  moduleUndPreise: {
    ausgewaehlteModule: [],
    einrichtungsgebuehr: "",
    monatlicherGrundpreis: "",
    rabattInProzent: "",
    vertragslaufzeit: "",
    abrechnungsbeginn: "",
  },
  automatisierungen: {
    ausgewaehlteAutomatisierungen: [],
    individuelleWuensche: "",
  },
  bestaetigung: {
    angabenGeprueft: false,
  },
};

type MandantenOnboardingContextValue = {
  data: MandantenOnboardingData;
  updateMandantStatus: (status: MandantStatusCode) => void;
  updateUnternehmensdaten: (
    updates: Partial<MandantenOnboardingData["unternehmensdaten"]>,
  ) => void;
  updateGeschaeftsfuehrer: (
    updates: Partial<MandantenOnboardingData["geschaeftsfuehrer"]>,
  ) => void;
  updateHauptansprechpartner: (
    updates: Partial<MandantenOnboardingData["hauptansprechpartner"]>,
  ) => void;
  updateSteuerdaten: (
    updates: Partial<MandantenOnboardingData["steuerdaten"]>,
  ) => void;
  updateBankverbindung: (
    updates: Partial<MandantenOnboardingData["bankverbindung"]>,
  ) => void;
  updateModuleUndPreise: (
    updates: Partial<MandantenOnboardingData["moduleUndPreise"]>,
  ) => void;
  updateAutomatisierungen: (
    updates: Partial<MandantenOnboardingData["automatisierungen"]>,
  ) => void;
  updateBestaetigung: (
    updates: Partial<MandantenOnboardingData["bestaetigung"]>,
  ) => void;
  toggleModul: (modul: string) => void;
  toggleAutomatisierung: (automation: string) => void;
};

const MandantenOnboardingContext =
  createContext<MandantenOnboardingContextValue | null>(null);

export function MandantenOnboardingProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [data, setData] = useState<MandantenOnboardingData>(
    initialMandantenOnboardingData,
  );

  const updateSection = useCallback(
    <K extends Exclude<keyof MandantenOnboardingData, "status">>(
      section: K,
      updates: Partial<MandantenOnboardingData[K]>,
    ) => {
      setData((prev) => ({
        ...prev,
        [section]: { ...prev[section], ...updates },
      }));
    },
    [],
  );

  const updateUnternehmensdaten = useCallback(
    (updates: Partial<MandantenOnboardingData["unternehmensdaten"]>) =>
      updateSection("unternehmensdaten", updates),
    [updateSection],
  );

  const updateMandantStatus = useCallback((status: MandantStatusCode) => {
    setData((prev) => ({ ...prev, status }));
  }, []);

  const updateGeschaeftsfuehrer = useCallback(
    (updates: Partial<MandantenOnboardingData["geschaeftsfuehrer"]>) =>
      updateSection("geschaeftsfuehrer", updates),
    [updateSection],
  );

  const updateHauptansprechpartner = useCallback(
    (updates: Partial<MandantenOnboardingData["hauptansprechpartner"]>) =>
      updateSection("hauptansprechpartner", updates),
    [updateSection],
  );

  const updateSteuerdaten = useCallback(
    (updates: Partial<MandantenOnboardingData["steuerdaten"]>) =>
      updateSection("steuerdaten", updates),
    [updateSection],
  );

  const updateBankverbindung = useCallback(
    (updates: Partial<MandantenOnboardingData["bankverbindung"]>) =>
      updateSection("bankverbindung", updates),
    [updateSection],
  );

  const updateModuleUndPreise = useCallback(
    (updates: Partial<MandantenOnboardingData["moduleUndPreise"]>) =>
      updateSection("moduleUndPreise", updates),
    [updateSection],
  );

  const updateAutomatisierungen = useCallback(
    (updates: Partial<MandantenOnboardingData["automatisierungen"]>) =>
      updateSection("automatisierungen", updates),
    [updateSection],
  );

  const updateBestaetigung = useCallback(
    (updates: Partial<MandantenOnboardingData["bestaetigung"]>) =>
      updateSection("bestaetigung", updates),
    [updateSection],
  );

  const toggleModul = useCallback((modul: string) => {
    setData((prev) => {
      const current = prev.moduleUndPreise.ausgewaehlteModule;
      const next = current.includes(modul)
        ? current.filter((item) => item !== modul)
        : [...current, modul];

      return {
        ...prev,
        moduleUndPreise: {
          ...prev.moduleUndPreise,
          ausgewaehlteModule: next,
        },
      };
    });
  }, []);

  const toggleAutomatisierung = useCallback((automation: string) => {
    setData((prev) => {
      const current = prev.automatisierungen.ausgewaehlteAutomatisierungen;
      const next = current.includes(automation)
        ? current.filter((item) => item !== automation)
        : [...current, automation];

      return {
        ...prev,
        automatisierungen: {
          ...prev.automatisierungen,
          ausgewaehlteAutomatisierungen: next,
        },
      };
    });
  }, []);

  const value = useMemo(
    () => ({
      data,
      updateMandantStatus,
      updateUnternehmensdaten,
      updateGeschaeftsfuehrer,
      updateHauptansprechpartner,
      updateSteuerdaten,
      updateBankverbindung,
      updateModuleUndPreise,
      updateAutomatisierungen,
      updateBestaetigung,
      toggleModul,
      toggleAutomatisierung,
    }),
    [
      data,
      updateMandantStatus,
      updateUnternehmensdaten,
      updateGeschaeftsfuehrer,
      updateHauptansprechpartner,
      updateSteuerdaten,
      updateBankverbindung,
      updateModuleUndPreise,
      updateAutomatisierungen,
      updateBestaetigung,
      toggleModul,
      toggleAutomatisierung,
    ],
  );

  return (
    <MandantenOnboardingContext.Provider value={value}>
      {children}
    </MandantenOnboardingContext.Provider>
  );
}

export function useMandantenOnboarding() {
  const context = useContext(MandantenOnboardingContext);

  if (!context) {
    throw new Error(
      "useMandantenOnboarding muss innerhalb von MandantenOnboardingProvider verwendet werden.",
    );
  }

  return context;
}

export function displayValue(value: string) {
  return value.trim() || "Nicht angegeben";
}

export function formatTelefonAnzeige(vorwahl: string, nummer: string) {
  const prefix = vorwahl.trim();
  const number = nummer.trim();

  if (!prefix && !number) return "";
  if (!number) return prefix;
  if (!prefix) return number;

  return `${prefix} ${number}`;
}

export function displayTelefon(vorwahl: string, nummer: string) {
  return displayValue(formatTelefonAnzeige(vorwahl, nummer));
}

const DISALLOWED_EMAIL_CHARS = /[äöüÄÖÜß\s]/;

export const INVALID_EMAIL_MESSAGE =
  "Bitte geben Sie eine gültige E-Mail-Adresse ohne Leerzeichen oder Umlaute ein.";

export function isValidEmail(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (DISALLOWED_EMAIL_CHARS.test(trimmed)) return false;

  const parts = trimmed.split("@");
  if (parts.length !== 2) return false;

  const [localPart, domainPart] = parts;
  if (!localPart || !domainPart) return false;
  if (!domainPart.includes(".")) return false;

  return true;
}

export function validateEmail(
  value: string,
  options: { required: boolean },
): string | undefined {
  const trimmed = value.trim();

  if (!trimmed) {
    return options.required
      ? "Bitte geben Sie eine E-Mail-Adresse an."
      : undefined;
  }

  if (!isValidEmail(value)) {
    return INVALID_EMAIL_MESSAGE;
  }

  return undefined;
}

const IBAN_LENGTHS: Record<string, number> = {
  DE: 22,
  AT: 20,
  CH: 21,
  LU: 20,
  BE: 16,
  NL: 18,
  FR: 27,
};

const BIC_REGEX = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/;

export const BANK_INCOMPLETE_MESSAGE =
  "Bitte füllen Sie die Bankverbindung vollständig aus.";

export const INVALID_IBAN_MESSAGE = "Bitte geben Sie eine gültige IBAN ein.";

export const INVALID_BIC_MESSAGE =
  "Bitte geben Sie eine gültige BIC mit 8 oder 11 Zeichen ein.";

export type BankverbindungErrors = {
  kontoinhaber?: string;
  bankname?: string;
  iban?: string;
  bic?: string;
};

export function normalizeIban(value: string) {
  return value.replace(/\s/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function formatIbanForDisplay(value: string) {
  const normalized = normalizeIban(value);
  return normalized.replace(/(.{4})/g, "$1 ").trim();
}

export function normalizeBic(value: string) {
  return value.replace(/\s/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function passesIbanMod97Check(iban: string) {
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (char) =>
    String(char.charCodeAt(0) - 55),
  );

  let remainder = 0;
  for (const digit of numeric) {
    remainder = (remainder * 10 + Number(digit)) % 97;
  }

  return remainder === 1;
}

export function isValidIban(value: string) {
  const iban = normalizeIban(value);
  if (!iban) return false;

  const countryCode = iban.slice(0, 2);
  if (!/^[A-Z]{2}$/.test(countryCode)) return false;
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(iban)) return false;

  const expectedLength = IBAN_LENGTHS[countryCode];
  if (expectedLength !== undefined && iban.length !== expectedLength) {
    return false;
  }

  return passesIbanMod97Check(iban);
}

export function isValidBic(value: string) {
  const bic = normalizeBic(value);
  return BIC_REGEX.test(bic);
}

export function isBankverbindungPartiallyFilled(
  bank: MandantenOnboardingData["bankverbindung"],
) {
  return (
    bank.kontoinhaber.trim() !== "" ||
    bank.bankname.trim() !== "" ||
    normalizeIban(bank.iban) !== "" ||
    normalizeBic(bank.bic) !== ""
  );
}

export function isBankverbindungComplete(
  bank: MandantenOnboardingData["bankverbindung"],
) {
  return (
    bank.kontoinhaber.trim() !== "" &&
    bank.bankname.trim() !== "" &&
    normalizeIban(bank.iban) !== "" &&
    normalizeBic(bank.bic) !== ""
  );
}

export function validateBankverbindung(
  bank: MandantenOnboardingData["bankverbindung"],
): BankverbindungErrors {
  const errors: BankverbindungErrors = {};

  if (!isBankverbindungPartiallyFilled(bank)) {
    return errors;
  }

  const kontoinhaber = bank.kontoinhaber.trim();
  const bankname = bank.bankname.trim();
  const iban = normalizeIban(bank.iban);
  const bic = normalizeBic(bank.bic);

  if (!kontoinhaber) errors.kontoinhaber = BANK_INCOMPLETE_MESSAGE;
  if (!bankname) errors.bankname = BANK_INCOMPLETE_MESSAGE;
  if (!iban) errors.iban = BANK_INCOMPLETE_MESSAGE;
  if (!bic) errors.bic = BANK_INCOMPLETE_MESSAGE;

  const hasIncomplete =
    !!errors.kontoinhaber ||
    !!errors.bankname ||
    !!errors.iban ||
    !!errors.bic;

  if (!hasIncomplete) {
    if (!isValidIban(iban)) errors.iban = INVALID_IBAN_MESSAGE;
    if (!isValidBic(bic)) errors.bic = INVALID_BIC_MESSAGE;
  }

  return errors;
}

function parseNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const cleaned = trimmed.replace(/[€\s%]/g, "");

  if (cleaned.includes(",")) {
    const normalized = cleaned.replace(/\./g, "").replace(",", ".");
    const num = Number(normalized);
    return Number.isNaN(num) ? null : num;
  }

  const num = Number(cleaned);
  return Number.isNaN(num) ? null : num;
}

function toCents(value: string): number | null {
  const parsed = parseNumber(value);
  if (parsed === null || parsed < 0) return null;
  return Math.round(parsed * 100);
}

export function calculateMonthlyPrices(
  grundpreis: string,
  rabatt: string,
) {
  const grundpreisCents = toCents(grundpreis);
  const rabattProzent = parseNumber(rabatt);

  if (grundpreisCents === null) {
    return {
      vorRabattCents: null,
      rabattbetragCents: null,
      nachRabattCents: null,
    };
  }

  const effectiveRabatt =
    rabattProzent !== null && rabattProzent >= 0 ? rabattProzent : 0;
  const rabattbetragCents = Math.round(
    (grundpreisCents * effectiveRabatt) / 100,
  );
  const nachRabattCents = grundpreisCents - rabattbetragCents;

  return {
    vorRabattCents: grundpreisCents,
    rabattbetragCents,
    nachRabattCents,
  };
}

export function formatCurrencyFromCents(cents: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

export function formatDate(value: string) {
  if (!value.trim()) return "Nicht angegeben";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("de-DE").format(date);
}

export function formatList(values: string[]) {
  return values.length > 0 ? values.join(", ") : "Nicht angegeben";
}
