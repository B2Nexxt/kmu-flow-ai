export type AngebotListSortField =
  | "updated_at"
  | "angebot_datum"
  | "angebotsnummer"
  | "mandant"
  | "gesamtbetrag";

export type AngebotListSortOrder = "asc" | "desc";

export const DEFAULT_ANGEBOT_LIST_SORT: AngebotListSortField = "updated_at";
export const DEFAULT_ANGEBOT_LIST_ORDER: AngebotListSortOrder = "desc";

export type AngebotListSort = {
  sort: AngebotListSortField;
  order: AngebotListSortOrder;
};

export function parseAngebotListSort(value: string | undefined): AngebotListSortField {
  if (
    value === "updated_at" ||
    value === "angebot_datum" ||
    value === "angebotsnummer" ||
    value === "mandant" ||
    value === "gesamtbetrag"
  ) {
    return value;
  }

  return DEFAULT_ANGEBOT_LIST_SORT;
}

export function parseAngebotListOrder(
  value: string | undefined,
): AngebotListSortOrder {
  if (value === "asc" || value === "desc") {
    return value;
  }

  return DEFAULT_ANGEBOT_LIST_ORDER;
}

export function parseAngebotListSortState(
  sort: string | undefined,
  order: string | undefined,
): AngebotListSort {
  return {
    sort: parseAngebotListSort(sort),
    order: parseAngebotListOrder(order),
  };
}

export function getNextAngebotListSort(
  column: AngebotListSortField,
  current: AngebotListSort,
): AngebotListSort {
  if (current.sort !== column) {
    return { sort: column, order: "asc" };
  }

  return {
    sort: column,
    order: current.order === "asc" ? "desc" : "asc",
  };
}

export function isDefaultAngebotListSort({ sort, order }: AngebotListSort) {
  return sort === DEFAULT_ANGEBOT_LIST_SORT && order === DEFAULT_ANGEBOT_LIST_ORDER;
}
