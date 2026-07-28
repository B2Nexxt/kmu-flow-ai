import { cookies } from "next/headers";

/** HttpOnly-Cookie — nur organization_id, keine Rolle/Berechtigung. */
export const ACTIVE_MANDANT_COOKIE_NAME = "kmu_flow_active_mandant";

/** 30 Tage */
export const ACTIVE_MANDANT_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidMandantCookieValue(value: string | undefined | null): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export async function readActiveMandantCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(ACTIVE_MANDANT_COOKIE_NAME)?.value ?? null;
  return isValidMandantCookieValue(value) ? value : null;
}

/**
 * Nur in Server Actions oder Route Handlers aufrufen — nicht in Server Components.
 */
export async function writeActiveMandantCookie(mandantId: string): Promise<void> {
  if (!isValidMandantCookieValue(mandantId)) {
    throw new Error("Ungültige Mandanten-ID für Cookie.");
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_MANDANT_COOKIE_NAME, mandantId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ACTIVE_MANDANT_COOKIE_MAX_AGE_SECONDS,
  });
}

export async function clearActiveMandantCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_MANDANT_COOKIE_NAME);
}

export function getActiveMandantCookieOptions() {
  return {
    name: ACTIVE_MANDANT_COOKIE_NAME,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ACTIVE_MANDANT_COOKIE_MAX_AGE_SECONDS,
  };
}
