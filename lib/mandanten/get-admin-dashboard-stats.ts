import { MANDANT_STATUS } from "@/lib/mandanten/mandant-status";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type AdminDashboardStats = {
  gesamt: number;
  mandanten: number;
  interessenten: number;
  inaktiv: number;
};

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const supabase = createSupabaseAdminClient();

  const [gesamtResult, mandantenResult, interessentenResult, inaktivResult] =
    await Promise.all([
    supabase
      .from("organizations")
      .select("*", { count: "exact", head: true }),
    supabase
      .from("organizations")
      .select("*", { count: "exact", head: true })
      .eq("status", MANDANT_STATUS.AKTIVER_MANDANT),
    supabase
      .from("organizations")
      .select("*", { count: "exact", head: true })
      .eq("status", MANDANT_STATUS.INTERESSENT),
    supabase
      .from("organizations")
      .select("*", { count: "exact", head: true })
      .eq("status", MANDANT_STATUS.INAKTIV),
  ]);

  if (gesamtResult.error) {
    throw new Error(
      `Dashboard-Kennzahlen konnten nicht geladen werden (Gesamt): ${gesamtResult.error.message}`,
    );
  }

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

  if (inaktivResult.error) {
    throw new Error(
      `Dashboard-Kennzahlen konnten nicht geladen werden (Inaktiv): ${inaktivResult.error.message}`,
    );
  }

  return {
    gesamt: gesamtResult.count ?? 0,
    mandanten: mandantenResult.count ?? 0,
    interessenten: interessentenResult.count ?? 0,
    inaktiv: inaktivResult.count ?? 0,
  };
}
