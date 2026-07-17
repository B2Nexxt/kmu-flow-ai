import { MANDANT_STATUS } from "@/lib/mandanten/mandant-status";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type AdminDashboardStats = {
  mandanten: number;
  interessenten: number;
};

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const supabase = createSupabaseAdminClient();

  const [mandantenResult, interessentenResult] = await Promise.all([
    supabase
      .from("organizations")
      .select("*", { count: "exact", head: true })
      .eq("status", MANDANT_STATUS.AKTIVER_MANDANT),
    supabase
      .from("organizations")
      .select("*", { count: "exact", head: true })
      .eq("status", MANDANT_STATUS.INTERESSENT),
  ]);

  if (mandantenResult.error) {
    throw new Error(
      `Dashboard-Kennzahlen konnten nicht geladen werden (Mandanten): ${mandantenResult.error.message}`,
    );
  }

  if (interessentenResult.error) {
    throw new Error(
      `Dashboard-Kennzahlen konnten nicht geladen werden (Interessenten): ${interessentenResult.error.message}`,
    );
  }

  return {
    mandanten: mandantenResult.count ?? 0,
    interessenten: interessentenResult.count ?? 0,
  };
}
