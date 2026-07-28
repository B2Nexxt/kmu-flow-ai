export const ARCHIVIERE_ANFRAGEEINGANG_VALIDATION_MESSAGE =
  "Der Anfrageeingang konnte nicht archiviert werden.";

export const ARCHIVIERE_ANFRAGEEINGANG_NOT_FOUND_MESSAGE =
  "Der Anfrageeingang wurde nicht gefunden.";

export const ARCHIVIERE_ANFRAGEEINGANG_SUCCESS_MESSAGE =
  "Die Anfrage wurde archiviert.";

export const ARCHIVIERE_ANFRAGEEINGANG_ALREADY_ARCHIVED_MESSAGE =
  "Der Anfrageeingang war bereits archiviert.";

export const ARCHIVIERE_ANFRAGEEINGANG_SYSTEM_ERROR_MESSAGE =
  "Der Anfrageeingang konnte nicht archiviert werden. Bitte versuchen Sie es später erneut.";

export type ArchiviereAnfrageeingangRpcOutcome =
  | { kind: "success"; code: "archived" | "already_archived"; message: string }
  | { kind: "error"; message: string };

export function mapArchiviereAnfrageeingangRpcResult(
  result: unknown,
): ArchiviereAnfrageeingangRpcOutcome {
  if (!result || typeof result !== "object") {
    return { kind: "error", message: ARCHIVIERE_ANFRAGEEINGANG_SYSTEM_ERROR_MESSAGE };
  }

  const payload = result as { ok?: boolean; code?: string };

  if (payload.ok === true) {
    if (payload.code === "already_archived") {
      return {
        kind: "success",
        code: "already_archived",
        message: ARCHIVIERE_ANFRAGEEINGANG_ALREADY_ARCHIVED_MESSAGE,
      };
    }
    if (payload.code === "archived") {
      return {
        kind: "success",
        code: "archived",
        message: ARCHIVIERE_ANFRAGEEINGANG_SUCCESS_MESSAGE,
      };
    }
    return { kind: "error", message: ARCHIVIERE_ANFRAGEEINGANG_SYSTEM_ERROR_MESSAGE };
  }

  switch (payload.code) {
    case "validation_error":
      return {
        kind: "error",
        message: ARCHIVIERE_ANFRAGEEINGANG_VALIDATION_MESSAGE,
      };
    case "not_found":
    case "cross_tenant_reference":
      return {
        kind: "error",
        message: ARCHIVIERE_ANFRAGEEINGANG_NOT_FOUND_MESSAGE,
      };
    default:
      return {
        kind: "error",
        message: ARCHIVIERE_ANFRAGEEINGANG_SYSTEM_ERROR_MESSAGE,
      };
  }
}

export function getAnfrageeingangListArchiveHintMessage(
  hinweis: string | undefined | null,
): string | null {
  if (hinweis === "archiviert") {
    return ARCHIVIERE_ANFRAGEEINGANG_SUCCESS_MESSAGE;
  }
  if (hinweis === "bereits-archiviert") {
    return ARCHIVIERE_ANFRAGEEINGANG_ALREADY_ARCHIVED_MESSAGE;
  }
  return null;
}
