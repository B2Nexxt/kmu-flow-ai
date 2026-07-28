export const OPERATIVE_AUTH_ERROR_CODES = [
  "unauthenticated",
  "no_membership",
  "inactive_membership",
  "invalid_mandant_context",
  "mandant_selection_required",
  "forbidden",
] as const;

export type OperativeAuthErrorCode = (typeof OPERATIVE_AUTH_ERROR_CODES)[number];

export class OperativeAuthError extends Error {
  readonly code: OperativeAuthErrorCode;

  constructor(code: OperativeAuthErrorCode, message?: string) {
    super(message ?? code);
    this.name = "OperativeAuthError";
    this.code = code;
  }
}

export function isOperativeAuthError(error: unknown): error is OperativeAuthError {
  return error instanceof OperativeAuthError;
}
