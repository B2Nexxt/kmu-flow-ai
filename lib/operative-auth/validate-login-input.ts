import { isValidEmail } from "@/lib/mandanten/validators";

import {
  LOGIN_EMAIL_INVALID_MESSAGE,
  LOGIN_PASSWORD_REQUIRED_MESSAGE,
  LOGIN_INVALID_CREDENTIALS_MESSAGE,
  LOGIN_TECHNICAL_ERROR_MESSAGE,
} from "./login-messages";

export type LoginFieldErrors = {
  email?: string;
  password?: string;
};

export type ValidateLoginInputResult =
  | { valid: true; email: string; password: string }
  | { valid: false; fieldErrors: LoginFieldErrors; formError?: string };

export function validateLoginInput(
  emailRaw: string,
  passwordRaw: string,
): ValidateLoginInputResult {
  const email = emailRaw.trim();
  const password = passwordRaw;
  const fieldErrors: LoginFieldErrors = {};

  if (!email || !isValidEmail(email)) {
    fieldErrors.email = LOGIN_EMAIL_INVALID_MESSAGE;
  }

  if (!password) {
    fieldErrors.password = LOGIN_PASSWORD_REQUIRED_MESSAGE;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { valid: false, fieldErrors };
  }

  return { valid: true, email, password };
}

/**
 * Übersetzt Supabase-Auth-Fehler in stabile Benutzermeldungen.
 * Keine Rückschlüsse auf existierende E-Mail-Adressen.
 */
export function mapLoginAuthError(errorMessage: string | undefined): string {
  const normalized = (errorMessage ?? "").toLowerCase();

  if (
    normalized.includes("invalid login credentials") ||
    normalized.includes("invalid credentials") ||
    normalized.includes("invalid email or password")
  ) {
    return LOGIN_INVALID_CREDENTIALS_MESSAGE;
  }

  return LOGIN_TECHNICAL_ERROR_MESSAGE;
}
