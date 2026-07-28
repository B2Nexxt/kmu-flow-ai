import { createSupabaseServerAuthClient } from "@/lib/supabase/server-auth";

import { OperativeAuthError } from "./errors";

export type AuthenticatedUser = {
  userId: string;
};

/**
 * Server-only — verifiziert die Supabase-Auth-Session über getUser().
 */
export async function requireAuthenticatedUser(): Promise<AuthenticatedUser> {
  const supabase = await createSupabaseServerAuthClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new OperativeAuthError("unauthenticated");
  }

  return { userId: user.id };
}
