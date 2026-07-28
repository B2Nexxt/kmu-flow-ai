"use server";

import { redirect } from "next/navigation";

import { clearActiveMandantCookie } from "@/lib/operative-auth/active-mandant-cookie";
import { createSupabaseServerAuthClient } from "@/lib/supabase/server-auth";

/**
 * Beendet die Supabase-Session und löscht den aktiven Mandanten-Cookie.
 * UI-Anbindung: z. B. Einstellungen oder Sidebar — noch kein Button im Layout.
 */
export async function logoutAction(): Promise<void> {
  const supabase = await createSupabaseServerAuthClient();
  await supabase.auth.signOut();
  await clearActiveMandantCookie();
  redirect("/login");
}
