import type { MandantListStatusFilter } from "@/lib/mandanten/mandant-status";
import {
  DEFAULT_MANDANT_LIST_ORDER,
  DEFAULT_MANDANT_LIST_SORT,
  isDefaultMandantListSort,
  type MandantListSort,
  type MandantListSortField,
  type MandantListSortOrder,
} from "@/lib/mandanten/mandanten-list-sort";

export function buildMandantenListUrl(options?: {
  status?: MandantListStatusFilter;
  q?: string;
  sort?: MandantListSortField;
  order?: MandantListSortOrder;
}): string {
  const params = new URLSearchParams();
  const searchQuery = options?.q?.trim();

  if (searchQuery) {
    params.set("q", searchQuery);
  }

  if (options?.status && options.status !== "all") {
    params.set("status", options.status);
  }

  const sortState: MandantListSort = {
    sort: options?.sort ?? DEFAULT_MANDANT_LIST_SORT,
    order: options?.order ?? DEFAULT_MANDANT_LIST_ORDER,
  };

  if (!isDefaultMandantListSort(sortState)) {
    params.set("sort", sortState.sort);
    params.set("order", sortState.order);
  }

  const query = params.toString();
  return query ? `/admin/mandanten?${query}` : "/admin/mandanten";
}
