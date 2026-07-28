import type { OperativeAuthErrorCode } from "./errors";

export type MandantSelectionPageMode =
  | "show_selection"
  | "auto_select"
  | "no_membership";

/**
 * Reine Logik für Server-Redirects auf /mandant-waehlen (Unit-Tests).
 */
export function resolveMandantSelectionPageMode(
  membershipCount: number,
): MandantSelectionPageMode {
  if (membershipCount === 0) {
    return "no_membership";
  }
  if (membershipCount === 1) {
    return "auto_select";
  }
  return "show_selection";
}

export const MANDANT_SELECTION_INVALID_COOKIE_MESSAGE =
  "Der zuvor ausgewählte Betrieb ist nicht mehr verfügbar. Bitte wählen Sie einen anderen Betrieb.";

export const MANDANT_SELECTION_INVALID_CHOICE_MESSAGE =
  "Dieser Betrieb steht Ihnen nicht zur Verfügung. Bitte wählen Sie einen anderen Betrieb.";

export const MANDANT_SELECTION_TECHNICAL_ERROR_MESSAGE =
  "Die Auswahl ist derzeit nicht möglich. Bitte versuchen Sie es später erneut.";

export function mapMandantSelectionError(code: OperativeAuthErrorCode): string {
  switch (code) {
    case "invalid_mandant_context":
    case "inactive_membership":
    case "no_membership":
      return MANDANT_SELECTION_INVALID_CHOICE_MESSAGE;
    case "unauthenticated":
      return MANDANT_SELECTION_TECHNICAL_ERROR_MESSAGE;
    default:
      return MANDANT_SELECTION_TECHNICAL_ERROR_MESSAGE;
  }
}
