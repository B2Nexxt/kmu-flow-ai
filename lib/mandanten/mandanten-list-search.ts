import type { SupabaseClient } from "@supabase/supabase-js";

function toIlikePattern(searchQuery: string) {
  return `%${searchQuery.trim()}%`;
}

export async function findOrganizationIdsForMandantenSearch(
  supabase: SupabaseClient,
  searchQuery: string,
): Promise<string[]> {
  const normalizedSearch = searchQuery.trim();

  if (!normalizedSearch) {
    return [];
  }

  const pattern = toIlikePattern(normalizedSearch);

  const [
    { data: organizationsByName, error: organizationsByNameError },
    { data: contactsByVorname, error: contactsByVornameError },
    { data: contactsByNachname, error: contactsByNachnameError },
  ] = await Promise.all([
    supabase.from("organizations").select("id").ilike("name", pattern),
    supabase
      .from("ansprechpartner")
      .select("organization_id")
      .eq("ist_hauptansprechpartner", true)
      .ilike("vorname", pattern),
    supabase
      .from("ansprechpartner")
      .select("organization_id")
      .eq("ist_hauptansprechpartner", true)
      .ilike("nachname", pattern),
  ]);

  if (organizationsByNameError) {
    throw new Error(
      `Mandanten-Suche fehlgeschlagen (Firmenname): ${organizationsByNameError.message}`,
    );
  }

  if (contactsByVornameError) {
    throw new Error(
      `Mandanten-Suche fehlgeschlagen (Vorname): ${contactsByVornameError.message}`,
    );
  }

  if (contactsByNachnameError) {
    throw new Error(
      `Mandanten-Suche fehlgeschlagen (Nachname): ${contactsByNachnameError.message}`,
    );
  }

  const organizationIds = new Set<string>();

  for (const organization of organizationsByName ?? []) {
    organizationIds.add(organization.id);
  }

  for (const contact of contactsByVorname ?? []) {
    organizationIds.add(contact.organization_id);
  }

  for (const contact of contactsByNachname ?? []) {
    organizationIds.add(contact.organization_id);
  }

  return Array.from(organizationIds);
}
