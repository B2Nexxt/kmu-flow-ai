import Link from "next/link";
import { buildAngeboteListUrl } from "@/lib/angebote/build-angebote-list-url";
import {
  getNextAngebotListSort,
  type AngebotListSort,
  type AngebotListSortField,
} from "@/lib/angebote/angebote-list-sort";
import type { AngebotListStatusFilter } from "@/lib/angebote/angebot-status";

type AngeboteSortableHeaderLinkProps = {
  column: AngebotListSortField;
  label: string;
  currentSort: AngebotListSort;
  statusFilter?: AngebotListStatusFilter;
  searchQuery?: string;
};

const headerLinkClassName =
  "flex w-full items-center justify-between gap-2 rounded-sm text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 transition-colors hover:text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:text-zinc-400 dark:hover:text-zinc-50 dark:focus:ring-zinc-50/10";

function getSortIndicator(
  isActive: boolean,
  order: AngebotListSort["order"],
): string {
  if (!isActive) {
    return "⇅";
  }

  return order === "asc" ? "↑" : "↓";
}

export function AngeboteSortableHeaderLink({
  column,
  label,
  currentSort,
  statusFilter = "all",
  searchQuery,
}: AngeboteSortableHeaderLinkProps) {
  const nextSort = getNextAngebotListSort(column, currentSort);
  const isActive = currentSort.sort === column;
  const sortIndicator = getSortIndicator(isActive, currentSort.order);

  return (
    <Link
      href={buildAngeboteListUrl({
        status: statusFilter,
        q: searchQuery,
        sort: nextSort.sort,
        order: nextSort.order,
      })}
      className={headerLinkClassName}
      aria-sort={
        isActive
          ? currentSort.order === "asc"
            ? "ascending"
            : "descending"
          : "none"
      }
    >
      <span>{label}</span>
      <span
        aria-hidden="true"
        className={`shrink-0 text-[0.7rem] leading-none ${
          isActive ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-400 dark:text-zinc-500"
        }`}
      >
        {sortIndicator}
      </span>
    </Link>
  );
}
