import { NextResponse } from "next/server";

import { writeActiveMandantCookie } from "@/lib/operative-auth/active-mandant-cookie";
import { evaluateOperativeAppAccess } from "@/lib/operative-auth/evaluate-operative-app-access";

function safeReturnPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }
  if (value.startsWith("/admin") || value.startsWith("/api")) {
    return "/dashboard";
  }
  return value;
}

/**
 * Setzt kmu_flow_active_mandant nach serverseitiger Mitgliedschaftsprüfung.
 * Wird vom Route Guard bei genau einer aktiven Mitgliedschaft aufgerufen
 * (Cookie-Schreiben in Server Components ist nicht erlaubt).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const returnTo = safeReturnPath(searchParams.get("returnTo"));

  const access = await evaluateOperativeAppAccess();

  if (access.status === "unauthenticated") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (
    access.status === "no_membership" ||
    access.status === "inactive_membership"
  ) {
    return NextResponse.redirect(new URL("/kein-zugang", request.url));
  }

  if (access.status === "mandant_selection_required") {
    return NextResponse.redirect(new URL("/mandant-waehlen", request.url));
  }

  if (access.status === "invalid_mandant_context") {
    return NextResponse.redirect(new URL("/mandant-waehlen?fehler=ungueltig", request.url));
  }

  if (access.status === "init_cookie") {
    await writeActiveMandantCookie(access.mandantId);
    return NextResponse.redirect(new URL(returnTo, request.url));
  }

  return NextResponse.redirect(new URL(returnTo, request.url));
}
