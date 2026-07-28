export const CREATE_ANFRAGEEINGANG_KANAL_REQUIRED_MESSAGE =
  "Bitte wählen Sie einen Eingangskanal.";

export const CREATE_ANFRAGEEINGANG_INHALT_REQUIRED_MESSAGE =
  "Bitte geben Sie mindestens Betreff, Inhalt oder Kontaktdaten an.";

export const CREATE_ANFRAGEEINGANG_EMAIL_INVALID_MESSAGE =
  "Bitte geben Sie eine gültige E-Mail-Adresse an.";

export const CREATE_ANFRAGEEINGANG_DATUM_INVALID_MESSAGE =
  "Bitte geben Sie ein gültiges Empfangsdatum an.";

export const CREATE_ANFRAGEEINGANG_SUCCESS_MESSAGE =
  "Die Anfrage wurde angelegt.";

export const CREATE_ANFRAGEEINGANG_SYSTEM_ERROR_MESSAGE =
  "Die Anfrage konnte nicht angelegt werden. Bitte versuchen Sie es später erneut.";

export type CreateAnfrageeingangRpcOutcome =
  | {
      kind: "success";
      anfrageeingangId: string;
      eingangsnummer: string;
    }
  | { kind: "error"; message: string };

export function mapCreateAnfrageeingangRpcResult(result: unknown): CreateAnfrageeingangRpcOutcome {
  if (!result || typeof result !== "object") {
    return { kind: "error", message: CREATE_ANFRAGEEINGANG_SYSTEM_ERROR_MESSAGE };
  }

  const payload = result as {
    ok?: boolean;
    code?: string;
    field?: string;
    anfrageeingang_id?: string;
    eingangsnummer?: string;
  };

  if (payload.ok === true && payload.code === "created") {
    if (
      typeof payload.anfrageeingang_id !== "string" ||
      typeof payload.eingangsnummer !== "string"
    ) {
      return { kind: "error", message: CREATE_ANFRAGEEINGANG_SYSTEM_ERROR_MESSAGE };
    }
    return {
      kind: "success",
      anfrageeingangId: payload.anfrageeingang_id,
      eingangsnummer: payload.eingangsnummer,
    };
  }

  if (payload.ok === false) {
    switch (payload.field) {
      case "kanal":
        return { kind: "error", message: CREATE_ANFRAGEEINGANG_KANAL_REQUIRED_MESSAGE };
      case "inhalt":
        return { kind: "error", message: CREATE_ANFRAGEEINGANG_INHALT_REQUIRED_MESSAGE };
      case "absender_email":
        return { kind: "error", message: CREATE_ANFRAGEEINGANG_EMAIL_INVALID_MESSAGE };
      case "empfangen_am":
        return { kind: "error", message: CREATE_ANFRAGEEINGANG_DATUM_INVALID_MESSAGE };
      default:
        return { kind: "error", message: CREATE_ANFRAGEEINGANG_SYSTEM_ERROR_MESSAGE };
    }
  }

  return { kind: "error", message: CREATE_ANFRAGEEINGANG_SYSTEM_ERROR_MESSAGE };
}

export function getAnfrageeingangDetailCreateHintMessage(
  hinweis: string | undefined | null,
): string | null {
  if (hinweis === "erstellt") {
    return CREATE_ANFRAGEEINGANG_SUCCESS_MESSAGE;
  }
  return null;
}
