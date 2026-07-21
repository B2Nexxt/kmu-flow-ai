import {
  DEFAULT_ANGEBOT_LIST_ORDER,
  DEFAULT_ANGEBOT_LIST_SORT,
} from "@/lib/angebote/angebote-list-sort";
import { getAngeboteList } from "@/lib/angebote/get-angebote-list";

export async function getMandantAngeboteList(organizationId: string) {
  const normalizedOrganizationId = organizationId.trim();

  if (!normalizedOrganizationId) {
    return [];
  }

  return getAngeboteList(
    "all",
    { sort: DEFAULT_ANGEBOT_LIST_SORT, order: DEFAULT_ANGEBOT_LIST_ORDER },
    undefined,
    normalizedOrganizationId,
  );
}

export type { AngebotListItem } from "@/lib/angebote/get-angebote-list";
