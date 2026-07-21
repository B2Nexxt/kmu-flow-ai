"use client";

import { useRouter } from "next/navigation";
import {
  ANGEBOT_STATUS_OPTIONS,
  type AngebotListStatusFilter,
} from "@/lib/angebote/angebot-status";
import { buildAngeboteListUrl } from "@/lib/angebote/build-angebote-list-url";
import type { AngebotListSort } from "@/lib/angebote/angebote-list-sort";

type AngeboteStatusFilterSelectProps = {
  value: AngebotListStatusFilter;
  searchQuery?: string;
  sortState: AngebotListSort;
};

const selectClassName =
  "mt-1 w-full min-w-[8.5rem] max-w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-xs font-medium normal-case tracking-normal text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-600 dark:focus:ring-zinc-50/10";

export function AngeboteStatusFilterSelect({
  value,
  searchQuery,
  sortState,
}: AngeboteStatusFilterSelectProps) {
  const router = useRouter();

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const nextStatus = event.target.value as AngebotListStatusFilter;

    router.push(
      buildAngeboteListUrl({
        status: nextStatus,
        q: searchQuery,
        sort: sortState.sort,
        order: sortState.order,
      }),
    );
  }

  return (
    <select
      id="angebote-status-filter"
      aria-label="Status filtern"
      value={value}
      onChange={handleChange}
      className={selectClassName}
    >
      <option value="all">Alle</option>
      {ANGEBOT_STATUS_OPTIONS.map((option) => (
        <option key={option.code} value={option.code}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
