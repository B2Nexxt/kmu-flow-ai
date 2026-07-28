import { isOperativeAuthError } from "./errors";
import { getActiveMandantContext } from "./get-active-mandant-context";
import { requireAuthenticatedUser } from "./require-authenticated-user";
import type { ActiveMandantContext } from "./types";

export type OperativeAppAccessState =
  | { status: "ok"; context: ActiveMandantContext }
  | { status: "init_cookie"; mandantId: string; context: ActiveMandantContext }
  | { status: "unauthenticated" }
  | { status: "no_membership" }
  | { status: "inactive_membership" }
  | { status: "invalid_mandant_context" }
  | { status: "mandant_selection_required" };

/**
 * Route-Guard-Helfer für `(protected)`-Layout — keine Redirects, nur Zustand.
 */
export async function evaluateOperativeAppAccess(): Promise<OperativeAppAccessState> {
  try {
    await requireAuthenticatedUser();
  } catch (error) {
    if (isOperativeAuthError(error) && error.code === "unauthenticated") {
      return { status: "unauthenticated" };
    }
    throw error;
  }

  try {
    const { context, shouldPersistCookie } = await getActiveMandantContext();

    if (shouldPersistCookie) {
      return {
        status: "init_cookie",
        mandantId: context.mandantId,
        context,
      };
    }

    return { status: "ok", context };
  } catch (error) {
    if (!isOperativeAuthError(error)) {
      throw error;
    }

    switch (error.code) {
      case "no_membership":
        return { status: "no_membership" };
      case "inactive_membership":
        return { status: "inactive_membership" };
      case "invalid_mandant_context":
        return { status: "invalid_mandant_context" };
      case "mandant_selection_required":
        return { status: "mandant_selection_required" };
      default:
        throw error;
    }
  }
}
