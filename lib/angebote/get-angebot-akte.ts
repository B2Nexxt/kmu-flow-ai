import { getAngebotStatusLabel } from "@/lib/angebote/angebot-status";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type AngebotAktePosition = {
  positionNr: number;
  bezeichnung: string;
  beschreibung: string | null;
  menge: number;
  einheit: string;
  einzelpreisNettoCents: number;
  rabattProzent: number;
  umsatzsteuerSatz: number;
};

export type AngebotAkteEmpfaenger = {
  firmenname: string;
  rechtsform: string | null;
  ansprechpartner: string | null;
  strasse: string | null;
  hausnummer: string | null;
  plz: string | null;
  ort: string | null;
  land: string | null;
  email: string | null;
  telefon: string | null;
  umsatzsteuerId: string | null;
};

export type AngebotAkte = {
  id: string;
  angebotsnummer: string | null;
  status: string;
  organizationId: string;
  version: {
    versionNr: number;
    updatedAt: string;
    angebotDatum: string;
    gueltigBis: string;
    betreff: string | null;
    einleitungstext: string | null;
    schlusstext: string | null;
    empfaenger: AngebotAkteEmpfaenger;
  };
  positionen: AngebotAktePosition[];
};

function formatIsoDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatAngebotDateLabel(value: string) {
  return formatIsoDate(value);
}

export { getAngebotStatusLabel };

export async function getAngebotAkte(
  angebotId: string,
): Promise<AngebotAkte | null> {
  try {
    const supabase = createSupabaseAdminClient();

    const { data: angebot, error: angebotError } = await supabase
      .from("angebote")
      .select("id, status, organization_id, angebotsnummer")
      .eq("id", angebotId)
      .maybeSingle();

    if (angebotError) {
      console.error("[getAngebotAkte] Angebot:", angebotError);
      return null;
    }

    if (!angebot) {
      return null;
    }

    const { data: version, error: versionError } = await supabase
      .from("angebot_versionen")
      .select(
        "id, version_nr, updated_at, angebot_datum, gueltig_bis, betreff, einleitungstext, schlusstext, empfaenger_firmenname, empfaenger_rechtsform, empfaenger_strasse, empfaenger_hausnummer, empfaenger_plz, empfaenger_ort, empfaenger_land, empfaenger_ansprechpartner, empfaenger_email, empfaenger_telefon, empfaenger_umsatzsteuer_id",
      )
      .eq("angebot_id", angebotId)
      .eq("ist_eingefroren", false)
      .order("version_nr", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (versionError) {
      console.error("[getAngebotAkte] Version:", versionError);
      return null;
    }

    if (!version) {
      return null;
    }

    const { data: positionen, error: positionenError } = await supabase
      .from("angebot_positionen")
      .select(
        "position_nr, bezeichnung, beschreibung, menge, einheit, einzelpreis_netto_cents, rabatt_prozent, umsatzsteuer_satz",
      )
      .eq("angebot_version_id", version.id)
      .order("position_nr", { ascending: true });

    if (positionenError) {
      console.error("[getAngebotAkte] Positionen:", positionenError);
      return null;
    }

    return {
      id: angebot.id,
      angebotsnummer: angebot.angebotsnummer,
      status: angebot.status,
      organizationId: angebot.organization_id,
      version: {
        versionNr: version.version_nr,
        updatedAt: version.updated_at,
        angebotDatum: version.angebot_datum,
        gueltigBis: version.gueltig_bis,
        betreff: version.betreff,
        einleitungstext: version.einleitungstext,
        schlusstext: version.schlusstext,
        empfaenger: {
          firmenname: version.empfaenger_firmenname,
          rechtsform: version.empfaenger_rechtsform,
          ansprechpartner: version.empfaenger_ansprechpartner,
          strasse: version.empfaenger_strasse,
          hausnummer: version.empfaenger_hausnummer,
          plz: version.empfaenger_plz,
          ort: version.empfaenger_ort,
          land: version.empfaenger_land,
          email: version.empfaenger_email,
          telefon: version.empfaenger_telefon,
          umsatzsteuerId: version.empfaenger_umsatzsteuer_id,
        },
      },
      positionen: (positionen ?? []).map((position) => ({
        positionNr: position.position_nr,
        bezeichnung: position.bezeichnung,
        beschreibung: position.beschreibung,
        menge: Number(position.menge),
        einheit: position.einheit,
        einzelpreisNettoCents: position.einzelpreis_netto_cents,
        rabattProzent: Number(position.rabatt_prozent),
        umsatzsteuerSatz: position.umsatzsteuer_satz,
      })),
    };
  } catch (error) {
    console.error("[getAngebotAkte] Unerwarteter Fehler:", error);
    return null;
  }
}
