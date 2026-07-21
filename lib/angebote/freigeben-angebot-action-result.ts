export type FreigebenAngebotActionResult =
  | { success: true; angebotsnummer: string }
  | { success: false; error: string; validationErrors?: string[] };

export const FREIGEBEN_ANGEBOT_USER_ERROR_MESSAGE =
  "Das Angebot konnte nicht freigegeben werden. Bitte versuchen Sie es erneut.";
