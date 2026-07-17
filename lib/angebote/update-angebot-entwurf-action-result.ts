export type UpdateAngebotEntwurfActionResult =
  | { success: true }
  | {
      success: false;
      error: string;
      validationErrors?: string[];
      conflict?: boolean;
    };

export const UPDATE_ANGEBOT_ENTWURF_USER_ERROR_MESSAGE =
  "Das Angebot konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.";

export const VERSION_CONFLICT_ERROR_MESSAGE =
  "Die Angebotsversion wurde zwischenzeitlich geändert. Bitte laden Sie die Seite neu.";

export function isVersionConflictError(message: string) {
  return message.includes("VERSION_CONFLICT");
}
