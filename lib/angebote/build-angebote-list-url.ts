import type { AngebotListStatusFilter } from "@/lib/angebote/angebot-status";
import {
  DEFAULT_ANGEBOT_LIST_ORDER,
  DEFAULT_ANGEBOT_LIST_SORT,
  isDefaultAngebotListSort,
  type AngebotListSort,
  type AngebotListSortField,
  type AngebotListSortOrder,
} from "@/lib/angebote/angebote-list-sort";

export function buildAngeboteListUrl(options?: {
  status?: AngebotListStatusFilter;
  q?: string;
  sort?: AngebotListSortField;
  order?: AngebotListSortOrder;
}): string {
  const params = new URLSearchParams();
  const searchQuery = options?.q?.trim();

  if (searchQuery) {
    params.set("q", searchQuery);
  }

  if (options?.status && options.status !== "all") {
    params.set("status", options.status);
  }

  const sortState: AngebotListSort = {
    sort: options?.sort ?? DEFAULT_ANGEBOT_LIST_SORT,
    order: options?.order ?? DEFAULT_ANGEBOT_LIST_ORDER,
  };

  if (!isDefaultAngebotListSort(sortState)) {
    params.set("sort", sortState.sort);
    params.set("order", sortState.order);
  }

  const query = params.toString();
  return query ? `/admin/angebote?${query}` : "/admin/angebote";
}
