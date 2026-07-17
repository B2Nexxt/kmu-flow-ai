export type BankverbindungInput = {
  kontoinhaber: string;
  bankname: string;
  iban: string;
  bic: string;
};

export type BankverbindungErrors = {
  kontoinhaber?: string;
  bankname?: string;
  iban?: string;
  bic?: string;
};

const DISALLOWED_EMAIL_CHARS = /[äöüÄÖÜß\s]/;

export const INVALID_EMAIL_MESSAGE =
  "Bitte geben Sie eine gültige E-Mail-Adresse ohne Leerzeichen oder Umlaute ein.";

export const BANK_INCOMPLETE_MESSAGE =
  "Bitte füllen Sie die Bankverbindung vollständig aus.";

export const INVALID_IBAN_MESSAGE = "Bitte geben Sie eine gültige IBAN ein.";

export const INVALID_BIC_MESSAGE =
  "Bitte geben Sie eine gültige BIC mit 8 oder 11 Zeichen ein.";

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

export function normalizeIban(value: string) {
  return value.replace(/\s/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
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

export function isBankverbindungPartiallyFilled(bank: BankverbindungInput) {
  return (
    bank.kontoinhaber.trim() !== "" ||
    bank.bankname.trim() !== "" ||
    normalizeIban(bank.iban) !== "" ||
    normalizeBic(bank.bic) !== ""
  );
}

export function isBankverbindungComplete(bank: BankverbindungInput) {
  return (
    bank.kontoinhaber.trim() !== "" &&
    bank.bankname.trim() !== "" &&
    normalizeIban(bank.iban) !== "" &&
    normalizeBic(bank.bic) !== ""
  );
}

export function validateBankverbindung(
  bank: BankverbindungInput,
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
