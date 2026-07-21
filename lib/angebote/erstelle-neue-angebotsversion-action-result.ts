export type ErstelleNeueAngebotsversionActionResult =
  | { success: true; versionId: string; versionNr: number }
  | { success: false; error: string; validationErrors?: string[] };

export const ERSTELLE_NEUE_ANGEBOTSVERSION_USER_ERROR_MESSAGE =
  "Die neue Angebotsversion konnte nicht erstellt werden. Bitte versuchen Sie es erneut.";

export const NEUE_ANGEBOTSVERSION_SUCCESS_MESSAGE =
  "Neue Angebotsversion wurde erstellt. Sie können den Entwurf jetzt bearbeiten.";
