import type { SupabaseClient } from "@supabase/supabase-js";

import { mapAnfrageeingangListRow } from "@/lib/anfrageeingang/format-display";
import type {
  AnfrageeingangKpis,
  AnfrageeingangListRow,
  AnfrageeingangPageData,
  AnfrageeingangStatus,
} from "@/lib/anfrageeingang/types";
import { getActiveMandantContextOrThrow } from "@/lib/operative-auth/get-active-mandant-context";
import { createSupabaseServerAuthClient } from "@/lib/supabase/server-auth";

/** Explizite Spaltenliste — keine Rohinhalte oder großen JSON-Felder. */
export const ANFRAGEEINGANG_LIST_SELECT =
  "id,eingangsnummer,empfangen_am,kanal,absender_name,absender_email,absender_telefon,betreff,status,zuordnungsstatus,dringlichkeit,manuelle_pruefung_erforderlich";

export const ANFRAGEEINGANG_LIST_LIMIT = 100;

export const ANFRAGEEINGANG_KPI_STATUS: Record<
  keyof AnfrageeingangKpis,
  AnfrageeingangStatus
> = {
  neu: "neu",
  manuellePruefung: "zur_manuellen_pruefung",
  wartetAufInformationen: "wartet_auf_informationen",
  bereitFuerVorgang: "bereit_fuer_vorgang",
};

async function countByStatus(
  supabase: SupabaseClient,
  mandantId: string,
  status: AnfrageeingangStatus,
): Promise<{ count: number; error: Error | null }> {
  const { count, error } = await supabase
    .from("anfrageeingaenge")
    .select("*", { count: "exact", head: true })
    .eq("mandant_id", mandantId)
    .eq("aktiv", true)
    .eq("status", status);

  if (error) {
    return { count: 0, error: new Error(error.message) };
  }

  return { count: count ?? 0, error: null };
}

async function loadAnfrageeingangKpis(
  supabase: SupabaseClient,
  mandantId: string,
): Promise<{ kpis: AnfrageeingangKpis | null; error: Error | null }> {
  const entries = Object.entries(ANFRAGEEINGANG_KPI_STATUS) as Array<
    [keyof AnfrageeingangKpis, AnfrageeingangStatus]
  >;

  const results = await Promise.all(
    entries.map(async ([key, status]) => {
      const result = await countByStatus(supabase, mandantId, status);
      return { key, ...result };
    }),
  );

  const failed = results.find((result) => result.error);
  if (failed?.error) {
    return { kpis: null, error: failed.error };
  }

  const kpis = {} as AnfrageeingangKpis;
  for (const result of results) {
    kpis[result.key] = result.count;
  }

  return { kpis, error: null };
}

async function loadAnfrageeingangListRows(
  supabase: SupabaseClient,
  mandantId: string,
): Promise<{ rows: AnfrageeingangListRow[] | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("anfrageeingaenge")
    .select(ANFRAGEEINGANG_LIST_SELECT)
    .eq("mandant_id", mandantId)
    .eq("aktiv", true)
    .order("empfangen_am", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(ANFRAGEEINGANG_LIST_LIMIT);

  if (error) {
    return { rows: null, error: new Error(error.message) };
  }

  return { rows: (data ?? []) as AnfrageeingangListRow[], error: null };
}

/**
 * Server-only — lädt KPI-Counts und Liste für /anfrageeingang.
 * Nutzt authenticated SSR-Client + geprüften Mandantenkontext (keine Service Role).
 */
export async function loadAnfrageeingangPageData(): Promise<AnfrageeingangPageData> {
  try {
    const context = await getActiveMandantContextOrThrow();
    const supabase = await createSupabaseServerAuthClient();
    const mandantId = context.mandantId;

    const [listResult, kpiResult] = await Promise.all([
      loadAnfrageeingangListRows(supabase, mandantId),
      loadAnfrageeingangKpis(supabase, mandantId),
    ]);

    if (listResult.error || kpiResult.error || !listResult.rows || !kpiResult.kpis) {
      if (process.env.NODE_ENV === "development") {
        console.error("[anfrageeingang] Laden fehlgeschlagen.", {
          list: listResult.error?.message,
          kpis: kpiResult.error?.message,
        });
      }
      return { ok: false };
    }

    return {
      ok: true,
      rows: listResult.rows.map(mapAnfrageeingangListRow),
      kpis: kpiResult.kpis,
    };
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[anfrageeingang] Unerwarteter Fehler beim Laden.", error);
    }
    return { ok: false };
  }
}
