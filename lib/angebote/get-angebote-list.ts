import { calculateAngebotTotals } from "@/lib/angebote/calculate-angebot-summen";
import {
  getAngebotStatusLabel,
  isAngebotStatusCode,
  type AngebotListStatusFilter,
} from "@/lib/angebote/angebot-status";
import {
  DEFAULT_ANGEBOT_LIST_ORDER,
  DEFAULT_ANGEBOT_LIST_SORT,
  type AngebotListSort,
} from "@/lib/angebote/angebote-list-sort";
import { formatAngebotDateLabel } from "@/lib/angebote/get-angebot-akte";
import { pickRelevantAngebotVersion } from "@/lib/angebote/pick-relevant-angebot-version";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type AngebotListItem = {
  angebotId: string;
  angebotsnummer: string | null;
  angebotsnummerLabel: string;
  status: string;
  statusLabel: string;
  organizationId: string;
  mandantenname: string;
  angebotDatum: string;
  angebotDatumLabel: string;
  gueltigBis: string;
  gueltigBisLabel: string;
  betreff: string | null;
  betreffLabel: string;
  versionNr: number;
  gesamtBruttoCents: number;
  updatedAt: string;
};

type VersionRow = {
  id: string;
  angebot_id: string;
  version_nr: number;
  angebot_datum: string;
  gueltig_bis: string;
  betreff: string | null;
  ist_eingefroren: boolean;
};

function displayBetreff(value: string | null) {
  const trimmed = value?.trim() ?? "";
  return trimmed || "—";
}

function formatAngebotsnummerLabel(value: string | null) {
  return value?.trim() || "Entwurf";
}

function matchesSearch(item: AngebotListItem, searchQuery: string) {
  const haystack = [
    item.angebotsnummer ?? "",
    item.angebotsnummerLabel,
    item.mandantenname,
    item.betreff ?? "",
    item.betreffLabel,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(searchQuery);
}

function compareNullableString(
  left: string | null,
  right: string | null,
  order: AngebotListSort["order"],
) {
  const leftValue = left?.trim() ?? "";
  const rightValue = right?.trim() ?? "";

  if (!leftValue && !rightValue) return 0;
  if (!leftValue) return order === "asc" ? -1 : 1;
  if (!rightValue) return order === "asc" ? 1 : -1;

  return leftValue.localeCompare(rightValue, "de-DE", {
    numeric: true,
    sensitivity: "base",
  });
}

function sortAngebote(items: AngebotListItem[], sortState: AngebotListSort) {
  const direction = sortState.order === "asc" ? 1 : -1;

  return [...items].sort((left, right) => {
    switch (sortState.sort) {
      case "angebot_datum":
        return (
          left.angebotDatum.localeCompare(right.angebotDatum) * direction ||
          left.updatedAt.localeCompare(right.updatedAt) * -1
        );
      case "angebotsnummer":
        return compareNullableString(
          left.angebotsnummer,
          right.angebotsnummer,
          sortState.order,
        );
      case "mandant":
        return (
          left.mandantenname.localeCompare(right.mandantenname, "de-DE", {
            sensitivity: "base",
          }) * direction
        );
      case "gesamtbetrag":
        return (left.gesamtBruttoCents - right.gesamtBruttoCents) * direction;
      case "updated_at":
      default:
        return left.updatedAt.localeCompare(right.updatedAt) * direction;
    }
  });
}

export async function getAngeboteList(
  statusFilter: AngebotListStatusFilter = "all",
  sortState: AngebotListSort = {
    sort: DEFAULT_ANGEBOT_LIST_SORT,
    order: DEFAULT_ANGEBOT_LIST_ORDER,
  },
  searchQuery?: string,
  organizationId?: string,
): Promise<AngebotListItem[]> {
  const supabase = createSupabaseAdminClient();
  const normalizedSearch = searchQuery?.trim().toLowerCase() ?? "";
  const normalizedOrganizationId = organizationId?.trim();

  let angeboteQuery = supabase
    .from("angebote")
    .select("id, organization_id, angebotsnummer, status, updated_at");

  if (normalizedOrganizationId) {
    angeboteQuery = angeboteQuery.eq("organization_id", normalizedOrganizationId);
  }

  if (isAngebotStatusCode(statusFilter)) {
    angeboteQuery = angeboteQuery.eq("status", statusFilter);
  }

  const { data: angebote, error: angeboteError } = await angeboteQuery;

  if (angeboteError) {
    throw new Error(
      `Angebote konnten nicht geladen werden: ${angeboteError.message}`,
    );
  }

  const angebotRows = angebote ?? [];
  if (angebotRows.length === 0) {
    return [];
  }

  const angebotIds = angebotRows.map((angebot) => angebot.id);
  const organizationIds = [
    ...new Set(angebotRows.map((angebot) => angebot.organization_id)),
  ];

  const [
    { data: organizations, error: organizationsError },
    { data: versionen, error: versionenError },
  ] = await Promise.all([
    supabase.from("organizations").select("id, name").in("id", organizationIds),
    supabase
      .from("angebot_versionen")
      .select(
        "id, angebot_id, version_nr, angebot_datum, gueltig_bis, betreff, ist_eingefroren",
      )
      .in("angebot_id", angebotIds),
  ]);

  if (organizationsError || versionenError) {
    throw new Error(
      `Angebotsdaten konnten nicht geladen werden: ${
        organizationsError?.message ?? versionenError?.message
      }`,
    );
  }

  const organizationNameById = new Map(
    (organizations ?? []).map((organization) => [organization.id, organization.name]),
  );

  const versionsByAngebotId = new Map<string, VersionRow[]>();
  for (const version of versionen ?? []) {
    const existing = versionsByAngebotId.get(version.angebot_id) ?? [];
    existing.push(version);
    versionsByAngebotId.set(version.angebot_id, existing);
  }

  const selectedVersions = new Map<string, VersionRow>();
  for (const angebot of angebotRows) {
    const relevantVersion = pickRelevantAngebotVersion(
      versionsByAngebotId.get(angebot.id) ?? [],
    );
    if (relevantVersion) {
      selectedVersions.set(angebot.id, relevantVersion);
    }
  }

  const versionIds = [...selectedVersions.values()].map((version) => version.id);
  const positionenByVersionId = new Map<
    string,
    Array<{
      position_nr: number;
      bezeichnung: string;
      beschreibung: string | null;
      menge: number;
      einheit: string;
      einzelpreis_netto_cents: number;
      rabatt_prozent: number;
      umsatzsteuer_satz: number;
    }>
  >();

  if (versionIds.length > 0) {
    const { data: positionen, error: positionenError } = await supabase
      .from("angebot_positionen")
      .select(
        "angebot_version_id, position_nr, bezeichnung, beschreibung, menge, einheit, einzelpreis_netto_cents, rabatt_prozent, umsatzsteuer_satz",
      )
      .in("angebot_version_id", versionIds);

    if (positionenError) {
      throw new Error(
        `Angebotspositionen konnten nicht geladen werden: ${positionenError.message}`,
      );
    }

    for (const position of positionen ?? []) {
      const existing = positionenByVersionId.get(position.angebot_version_id) ?? [];
      existing.push(position);
      positionenByVersionId.set(position.angebot_version_id, existing);
    }
  }

  let items: AngebotListItem[] = angebotRows
    .map((angebot) => {
      const version = selectedVersions.get(angebot.id);
      if (!version) {
        return null;
      }

      const positionRows = positionenByVersionId.get(version.id) ?? [];
      const totals = calculateAngebotTotals(
        positionRows.map((position) => ({
          positionNr: position.position_nr,
          bezeichnung: position.bezeichnung,
          beschreibung: position.beschreibung,
          menge: Number(position.menge),
          einheit: position.einheit,
          einzelpreisNettoCents: position.einzelpreis_netto_cents,
          rabattProzent: Number(position.rabatt_prozent),
          umsatzsteuerSatz: position.umsatzsteuer_satz,
        })),
      );

      return {
        angebotId: angebot.id,
        angebotsnummer: angebot.angebotsnummer,
        angebotsnummerLabel: formatAngebotsnummerLabel(angebot.angebotsnummer),
        status: angebot.status,
        statusLabel: getAngebotStatusLabel(angebot.status),
        organizationId: angebot.organization_id,
        mandantenname:
          organizationNameById.get(angebot.organization_id) ?? "Unbekannter Mandant",
        angebotDatum: version.angebot_datum,
        angebotDatumLabel: formatAngebotDateLabel(version.angebot_datum),
        gueltigBis: version.gueltig_bis,
        gueltigBisLabel: formatAngebotDateLabel(version.gueltig_bis),
        betreff: version.betreff,
        betreffLabel: displayBetreff(version.betreff),
        versionNr: version.version_nr,
        gesamtBruttoCents: totals.bruttoCents,
        updatedAt: angebot.updated_at,
      };
    })
    .filter((item): item is AngebotListItem => item !== null);

  if (normalizedSearch) {
    items = items.filter((item) => matchesSearch(item, normalizedSearch));
  }

  return sortAngebote(items, sortState);
}
