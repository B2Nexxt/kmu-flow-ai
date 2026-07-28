import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { cookies } from "next/headers";

function getSupabaseAuthEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "Supabase-Auth-Konfiguration fehlt (NEXT_PUBLIC_SUPABASE_URL oder NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).",
    );
  }

  return { supabaseUrl, supabasePublishableKey };
}

/**
 * Cookie-gebundener Supabase-Client für authentifizierte Server-Requests (RLS).
 * Session-Cookies werden über @supabase/ssr gelesen/aktualisiert.
 *
 * Cookie-Schreiben schlägt in Server Components fehl — dort nur lesen.
 * Mandanten-Cookie setzen: Server Action oder Route Handler.
 */
export async function createSupabaseServerAuthClient() {
  const { supabaseUrl, supabasePublishableKey } = getSupabaseAuthEnv();
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component — Supabase-Session-Refresh nur in Action/Route/Middleware
        }
      },
    },
  });
}
