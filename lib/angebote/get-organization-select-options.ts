import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type OrganizationSelectOption = {
  id: string;
  firmenname: string;
  rechtsform: string | null;
  strasse: string | null;
  hausnummer: string | null;
  plz: string | null;
  ort: string | null;
  land: string | null;
  email: string | null;
  telefonVorwahl: string | null;
  telefonNummer: string | null;
  umsatzsteuerId: string | null;
  hauptansprechpartnerName: string | null;
};

function formatContactName(vorname: string, nachname: string) {
  const name = `${vorname} ${nachname}`.trim();
  return name || null;
}

export async function getOrganizationSelectOptions(): Promise<
  OrganizationSelectOption[]
> {
  const supabase = createSupabaseAdminClient();

  const { data: organizations, error: organizationsError } = await supabase
    .from("organizations")
    .select(
      "id, name, rechtsform, strasse, hausnummer, plz, ort, land, email, telefon_vorwahl, telefon_nummer, umsatzsteuer_id",
    )
    .order("name", { ascending: true });

  if (organizationsError) {
    throw new Error(
      `Mandanten konnten nicht geladen werden: ${organizationsError.message}`,
    );
  }

  const organizationRows = organizations ?? [];
  if (organizationRows.length === 0) {
    return [];
  }

  const organizationIds = organizationRows.map((organization) => organization.id);

  const { data: contacts, error: contactsError } = await supabase
    .from("ansprechpartner")
    .select("organization_id, vorname, nachname")
    .in("organization_id", organizationIds)
    .eq("ist_hauptansprechpartner", true);

  if (contactsError) {
    throw new Error(
      `Ansprechpartner konnten nicht geladen werden: ${contactsError.message}`,
    );
  }

  const hauptansprechpartnerByOrganizationId = new Map<string, string>();

  for (const contact of contacts ?? []) {
    const name = formatContactName(contact.vorname, contact.nachname);
    if (name) {
      hauptansprechpartnerByOrganizationId.set(contact.organization_id, name);
    }
  }

  return organizationRows.map((organization) => ({
    id: organization.id,
    firmenname: organization.name,
    rechtsform: organization.rechtsform,
    strasse: organization.strasse,
    hausnummer: organization.hausnummer,
    plz: organization.plz,
    ort: organization.ort,
    land: organization.land,
    email: organization.email,
    telefonVorwahl: organization.telefon_vorwahl,
    telefonNummer: organization.telefon_nummer,
    umsatzsteuerId: organization.umsatzsteuer_id,
    hauptansprechpartnerName:
      hauptansprechpartnerByOrganizationId.get(organization.id) ?? null,
  }));
}
