export type MandantListSortField = "name" | "created_at";
export type MandantListSortOrder = "asc" | "desc";

export const DEFAULT_MANDANT_LIST_SORT: MandantListSortField = "created_at";
export const DEFAULT_MANDANT_LIST_ORDER: MandantListSortOrder = "desc";

export type MandantListSort = {
  sort: MandantListSortField;
  order: MandantListSortOrder;
};

export function parseMandantListSort(value: string | undefined): MandantListSortField {
  if (value === "name" || value === "created_at") {
    return value;
  }

  return DEFAULT_MANDANT_LIST_SORT;
}

export function parseMandantListOrder(value: string | undefined): MandantListSortOrder {
  if (value === "asc" || value === "desc") {
    return value;
  }

  return DEFAULT_MANDANT_LIST_ORDER;
}

export function parseMandantListSortState(
  sort: string | undefined,
  order: string | undefined,
): MandantListSort {
  return {
    sort: parseMandantListSort(sort),
    order: parseMandantListOrder(order),
  };
}

export function getNextMandantListSort(
  column: MandantListSortField,
  current: MandantListSort,
): MandantListSort {
  if (current.sort !== column) {
    return { sort: column, order: "asc" };
  }

  return {
    sort: column,
    order: current.order === "asc" ? "desc" : "asc",
  };
}

export function isDefaultMandantListSort({ sort, order }: MandantListSort) {
  return sort === DEFAULT_MANDANT_LIST_SORT && order === DEFAULT_MANDANT_LIST_ORDER;
}
