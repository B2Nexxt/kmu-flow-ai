import {
  getMandantStatusLabel,
  isMandantStatusCode,
  type MandantListStatusFilter,
} from "@/lib/mandanten/mandant-status";
import {
  DEFAULT_MANDANT_LIST_ORDER,
  DEFAULT_MANDANT_LIST_SORT,
  type MandantListSort,
} from "@/lib/mandanten/mandanten-list-sort";
import { findOrganizationIdsForMandantenSearch } from "@/lib/mandanten/mandanten-list-search";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type MandantListItem = {
  id: string;
  firmenname: string;
  status: string;
  statusLabel: string;
  hauptansprechpartner: string;
  ort: string | null;
  createdAt: string;
  createdAtLabel: string;
};

function formatPersonName(vorname: string, nachname: string) {
  const name = `${vorname} ${nachname}`.trim();
  return name || "Nicht hinterlegt";
}

function formatCreatedAtLabel(createdAt: string) {
  return new Date(createdAt).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export async function getMandantenList(
  statusFilter: MandantListStatusFilter = "all",
  sortState: MandantListSort = {
    sort: DEFAULT_MANDANT_LIST_SORT,
    order: DEFAULT_MANDANT_LIST_ORDER,
  },
  searchQuery?: string,
): Promise<MandantListItem[]> {
  const supabase = createSupabaseAdminClient();
  const normalizedSearch = searchQuery?.trim() ?? "";

  let organizationsQuery = supabase
    .from("organizations")
    .select("id, name, status, ort, created_at")
    .order(sortState.sort, { ascending: sortState.order === "asc" });

  if (isMandantStatusCode(statusFilter)) {
    organizationsQuery = organizationsQuery.eq("status", statusFilter);
  }

  if (normalizedSearch) {
    const matchingOrganizationIds = await findOrganizationIdsForMandantenSearch(
      supabase,
      normalizedSearch,
    );

    if (matchingOrganizationIds.length === 0) {
      return [];
    }

    organizationsQuery = organizationsQuery.in("id", matchingOrganizationIds);
  }

  const { data: organizations, error: organizationsError } =
    await organizationsQuery;

  if (organizationsError) {
    throw new Error(
      `Mandanten konnten nicht geladen werden: ${organizationsError.message}`,
    );
  }

  const organizationIds = (organizations ?? []).map((organization) => organization.id);

  if (organizationIds.length === 0) {
    return [];
  }

  const { data: contacts, error: contactsError } = await supabase
    .from("ansprechpartner")
    .select("organization_id, vorname, nachname, ist_hauptansprechpartner")
    .eq("ist_hauptansprechpartner", true)
    .in("organization_id", organizationIds);

  if (contactsError) {
    throw new Error(
      `Ansprechpartner konnten nicht geladen werden: ${contactsError.message}`,
    );
  }

  const hauptansprechpartnerByOrganization = new Map<
    string,
    { vorname: string; nachname: string }
  >();

  for (const contact of contacts ?? []) {
    hauptansprechpartnerByOrganization.set(contact.organization_id, {
      vorname: contact.vorname,
      nachname: contact.nachname,
    });
  }

  return (organizations ?? []).map((organization) => {
    const hauptansprechpartner = hauptansprechpartnerByOrganization.get(
      organization.id,
    );

    return {
      id: organization.id,
      firmenname: organization.name,
      status: organization.status ?? "",
      statusLabel: getMandantStatusLabel(organization.status ?? ""),
      hauptansprechpartner: hauptansprechpartner
        ? formatPersonName(
            hauptansprechpartner.vorname,
            hauptansprechpartner.nachname,
          )
        : "Nicht hinterlegt",
      ort: organization.ort,
      createdAt: organization.created_at,
      createdAtLabel: formatCreatedAtLabel(organization.created_at),
    };
  });
}
