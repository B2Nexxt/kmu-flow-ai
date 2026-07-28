import { mapAnfrageeingangDetailRow } from "@/lib/anfrageeingang/format-detail";
import type {
  AnfrageeingangDetailLoadResult,
  AnfrageeingangDetailRow,
} from "@/lib/anfrageeingang/types";
import { isValidAnfrageeingangId } from "@/lib/anfrageeingang/validate-anfrageeingang-id";
import { getActiveMandantContextOrThrow } from "@/lib/operative-auth/get-active-mandant-context";
import { createSupabaseServerAuthClient } from "@/lib/supabase/server-auth";

export const ANFRAGEEINGANG_DETAIL_SELECT = [
  "id",
  "eingangsnummer",
  "kanal",
  "status",
  "empfangen_am",
  "zuletzt_bearbeitet_am",
  "beendet_am",
  "betreff",
  "rohinhalt",
  "strukturierte_daten",
  "absender_name",
  "absender_email",
  "absender_telefon",
  "zuordnungsstatus",
  "zuordnungsgrund",
  "zuordnungskandidaten",
  "vollstaendigkeitsstatus",
  "fehlende_angaben",
  "confidence_score",
  "dringlichkeit",
  "manuelle_pruefung_erforderlich",
  "zugeordnet_kunde_id",
  "zugeordnet_gebaeude_id",
  "zugeordnet_einheit_id",
  "zugeordneter_vorgang_id",
  "kanal_externe_id",
  "konversation_id",
  "parent_anfrageeingang_id",
  "created_at",
  "updated_at",
].join(",");

/**
 * Server-only — lädt einen Anfrageeingang für die Detailseite.
 * Keine Service Role; Mandant und aktiv werden serverseitig gefiltert.
 */
export async function loadAnfrageeingangDetail(
  id: string,
): Promise<AnfrageeingangDetailLoadResult> {
  if (!isValidAnfrageeingangId(id)) {
    return { status: "not_found" };
  }

  try {
    const context = await getActiveMandantContextOrThrow();
    const supabase = await createSupabaseServerAuthClient();

    const { data, error } = await supabase
      .from("anfrageeingaenge")
      .select(ANFRAGEEINGANG_DETAIL_SELECT)
      .eq("id", id)
      .eq("mandant_id", context.mandantId)
      .eq("aktiv", true)
      .maybeSingle();

    if (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("[anfrageeingang/detail] Query fehlgeschlagen.", error.message);
      }
      return { status: "error" };
    }

    if (!data) {
      return { status: "not_found" };
    }

    return {
      status: "ok",
      detail: mapAnfrageeingangDetailRow(data as unknown as AnfrageeingangDetailRow),
    };
  } catch (loadError) {
    if (process.env.NODE_ENV === "development") {
      console.error("[anfrageeingang/detail] Unerwarteter Fehler.", loadError);
    }
    return { status: "error" };
  }
}
