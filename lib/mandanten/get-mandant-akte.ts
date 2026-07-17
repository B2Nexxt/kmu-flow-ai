import { getLandLabel } from "@/lib/mandanten/land-options";
import { getMandantStatusLabel } from "@/lib/mandanten/mandant-status";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type MandantAkteContact = {
  id: string;
  vorname: string;
  nachname: string;
  position: string | null;
  email: string | null;
  telefonVorwahl: string | null;
  telefonNummer: string | null;
  istGeschaeftsfuehrer: boolean;
  istHauptansprechpartner: boolean;
};

export type MandantAkte = {
  id: string;
  status: string;
  statusLabel: string;
  firmenname: string;
  rechtsform: string;
  adresse: string;
  strasse: string | null;
  hausnummer: string | null;
  plz: string | null;
  ort: string | null;
  land: string | null;
  website: string | null;
  telefon: string | null;
  telefonVorwahl: string | null;
  telefonNummer: string | null;
  email: string | null;
  steuernummer: string | null;
  umsatzsteuerId: string | null;
  hauptansprechpartner: MandantAkteContact | null;
  geschaeftsfuehrer: MandantAkteContact | null;
  bankverbindung: {
    kontoinhaber: string;
    bankname: string;
    iban: string;
    bic: string;
  } | null;
  module: string[];
  automatisierungen: string[];
  individuelleAutomatisierungswuensche: string | null;
  einrichtungsgebuehr: string | null;
  monatlicherGrundpreis: string | null;
  rabattInProzent: string | null;
  vertragslaufzeit: string | null;
  abrechnungsbeginn: string | null;
};

function formatTelefon(vorwahl: string | null, nummer: string | null) {
  const prefix = vorwahl?.trim() ?? "";
  const number = nummer?.trim() ?? "";
  if (!prefix && !number) return null;
  if (!number) return prefix;
  if (!prefix) return number;
  return `${prefix} ${number}`;
}

function formatAdresse(organization: {
  strasse: string | null;
  hausnummer: string | null;
  plz: string | null;
  ort: string | null;
  land: string | null;
}) {
  const strasse = [organization.strasse, organization.hausnummer]
    .filter(Boolean)
    .join(" ")
    .trim();
  const ortLine = [organization.plz, organization.ort].filter(Boolean).join(" ");
  const landLabel = organization.land ? getLandLabel(organization.land) : null;

  return [strasse, ortLine, landLabel].filter(Boolean).join(", ");
}

function mapContact(row: {
  id: string;
  vorname: string;
  nachname: string;
  position: string | null;
  email: string | null;
  telefon_vorwahl: string | null;
  telefon_nummer: string | null;
  ist_geschaeftsfuehrer: boolean;
  ist_hauptansprechpartner: boolean;
}): MandantAkteContact {
  return {
    id: row.id,
    vorname: row.vorname,
    nachname: row.nachname,
    position: row.position,
    email: row.email,
    telefonVorwahl: row.telefon_vorwahl,
    telefonNummer: row.telefon_nummer,
    istGeschaeftsfuehrer: row.ist_geschaeftsfuehrer,
    istHauptansprechpartner: row.ist_hauptansprechpartner,
  };
}

export async function getMandantAkte(
  mandantenId: string,
): Promise<MandantAkte | null> {
  try {
    const supabase = createSupabaseAdminClient();

    const { data: organization, error: organizationError } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", mandantenId)
      .maybeSingle();

    if (organizationError) {
      console.error("[getMandantAkte] Organization:", organizationError);
      return null;
    }

    if (!organization) return null;

    const [
      { data: contacts, error: contactsError },
      { data: bankList, error: bankError },
      { data: moduleList, error: moduleError },
      { data: automationList, error: automationError },
    ] = await Promise.all([
      supabase
        .from("ansprechpartner")
        .select("*")
        .eq("organization_id", mandantenId),
      supabase
        .from("bankverbindungen")
        .select("*")
        .eq("organization_id", mandantenId),
      supabase
        .from("organization_modules")
        .select("modul")
        .eq("organization_id", mandantenId),
      supabase
        .from("organization_automatisierungen")
        .select("automatisierung")
        .eq("organization_id", mandantenId),
    ]);

    if (contactsError || bankError || moduleError || automationError) {
      console.error("[getMandantAkte] Verknüpfte Daten:", {
        contactsError,
        bankError,
        moduleError,
        automationError,
      });
      return null;
    }

    const mappedContacts = (contacts ?? []).map(mapContact);
    const hauptansprechpartner =
      mappedContacts.find((contact) => contact.istHauptansprechpartner) ?? null;
    const geschaeftsfuehrer =
      mappedContacts.find((contact) => contact.istGeschaeftsfuehrer) ?? null;
    const bank = bankList?.[0] ?? null;

    return {
      id: organization.id,
      status: organization.status,
      statusLabel: getMandantStatusLabel(organization.status),
      firmenname: organization.name,
      rechtsform: organization.rechtsform ?? "",
      adresse: formatAdresse(organization),
      strasse: organization.strasse,
      hausnummer: organization.hausnummer,
      plz: organization.plz,
      ort: organization.ort,
      land: organization.land,
      website: organization.website,
      telefon: formatTelefon(
        organization.telefon_vorwahl,
        organization.telefon_nummer,
      ),
      telefonVorwahl: organization.telefon_vorwahl,
      telefonNummer: organization.telefon_nummer,
      email: organization.email,
      steuernummer: organization.steuernummer,
      umsatzsteuerId: organization.umsatzsteuer_id,
      hauptansprechpartner,
      geschaeftsfuehrer,
      bankverbindung: bank
        ? {
            kontoinhaber: bank.kontoinhaber,
            bankname: bank.bankname,
            iban: bank.iban,
            bic: bank.bic,
          }
        : null,
      module: (moduleList ?? []).map((row) => row.modul),
      automatisierungen: (automationList ?? []).map(
        (row) => row.automatisierung,
      ),
      individuelleAutomatisierungswuensche:
        organization.individuelle_automatisierungswuensche,
      einrichtungsgebuehr: organization.einrichtungsgebuehr,
      monatlicherGrundpreis: organization.monatlicher_grundpreis,
      rabattInProzent: organization.rabatt_in_prozent,
      vertragslaufzeit: organization.vertragslaufzeit,
      abrechnungsbeginn: organization.abrechnungsbeginn,
    };
  } catch (error) {
    console.error("[getMandantAkte] Unerwarteter Fehler:", error);
    return null;
  }
}

export function formatContactName(contact: MandantAkteContact | null) {
  if (!contact) return "Nicht hinterlegt";
  const name = `${contact.vorname} ${contact.nachname}`.trim();
  return name || "Nicht hinterlegt";
}
