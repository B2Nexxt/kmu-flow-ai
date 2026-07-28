export const VERWERFE_ANFRAGEEINGANG_VALIDATION_MESSAGE =
  "Bitte geben Sie einen Grund für das Verwerfen an.";

export const VERWERFE_ANFRAGEEINGANG_NOT_FOUND_MESSAGE =
  "Der Anfrageeingang wurde nicht gefunden.";

export const VERWERFE_ANFRAGEEINGANG_INVALID_STATUS_MESSAGE =
  "Der Anfrageeingang kann in seinem aktuellen Zustand nicht verworfen werden.";

export const VERWERFE_ANFRAGEEINGANG_CONFLICT_MESSAGE =
  "Der Anfrageeingang wurde bereits einem Vorgang zugeordnet und kann nicht verworfen werden.";

export const VERWERFE_ANFRAGEEINGANG_SUCCESS_MESSAGE =
  "Die Anfrage wurde verworfen.";

export const VERWERFE_ANFRAGEEINGANG_ALREADY_DISCARDED_MESSAGE =
  "Der Anfrageeingang war bereits verworfen.";

export const VERWERFE_ANFRAGEEINGANG_SYSTEM_ERROR_MESSAGE =
  "Der Anfrageeingang konnte nicht verworfen werden. Bitte versuchen Sie es später erneut.";

export type VerwerfeAnfrageeingangRpcCode =
  | "validation_error"
  | "not_found"
  | "cross_tenant_reference"
  | "invalid_status_transition"
  | "conflict"
  | "discarded"
  | "already_discarded"
  | (string & {});

export type VerwerfeAnfrageeingangRpcOutcome =
  | { kind: "success"; code: "discarded" | "already_discarded"; message: string }
  | { kind: "error"; message: string };

export function mapVerwerfeAnfrageeingangRpcResult(
  result: unknown,
): VerwerfeAnfrageeingangRpcOutcome {
  if (!result || typeof result !== "object") {
    return { kind: "error", message: VERWERFE_ANFRAGEEINGANG_SYSTEM_ERROR_MESSAGE };
  }

  const payload = result as { ok?: boolean; code?: string; field?: string };

  if (payload.ok === true) {
    if (payload.code === "already_discarded") {
      return {
        kind: "success",
        code: "already_discarded",
        message: VERWERFE_ANFRAGEEINGANG_ALREADY_DISCARDED_MESSAGE,
      };
    }
    if (payload.code === "discarded") {
      return {
        kind: "success",
        code: "discarded",
        message: VERWERFE_ANFRAGEEINGANG_SUCCESS_MESSAGE,
      };
    }
    return { kind: "error", message: VERWERFE_ANFRAGEEINGANG_SYSTEM_ERROR_MESSAGE };
  }

  switch (payload.code as VerwerfeAnfrageeingangRpcCode) {
    case "validation_error":
      return {
        kind: "error",
        message: VERWERFE_ANFRAGEEINGANG_VALIDATION_MESSAGE,
      };
    case "not_found":
    case "cross_tenant_reference":
      return {
        kind: "error",
        message: VERWERFE_ANFRAGEEINGANG_NOT_FOUND_MESSAGE,
      };
    case "invalid_status_transition":
      return {
        kind: "error",
        message: VERWERFE_ANFRAGEEINGANG_INVALID_STATUS_MESSAGE,
      };
    case "conflict":
      return {
        kind: "error",
        message: VERWERFE_ANFRAGEEINGANG_CONFLICT_MESSAGE,
      };
    default:
      return {
        kind: "error",
        message: VERWERFE_ANFRAGEEINGANG_SYSTEM_ERROR_MESSAGE,
      };
  }
}
