import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function getAdminDashboardAngeboteCount(): Promise<number> {
  const supabase = createSupabaseAdminClient();

  const { count, error } = await supabase
    .from("angebote")
    .select("*", { count: "exact", head: true });

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[getAdminDashboardAngeboteCount] Angebote:", error);
    }

    throw new Error(
      `Dashboard-Kennzahlen konnten nicht geladen werden (Angebote): ${error.message}`,
    );
  }

  return count ?? 0;
}
