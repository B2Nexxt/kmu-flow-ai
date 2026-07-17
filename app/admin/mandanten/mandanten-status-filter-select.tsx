"use client";

import { useRouter } from "next/navigation";
import {
  MANDANT_STATUS_OPTIONS,
  type MandantListStatusFilter,
} from "@/lib/mandanten/mandant-status";
import { buildMandantenListUrl } from "@/lib/mandanten/build-mandanten-list-url";
import type { MandantListSort } from "@/lib/mandanten/mandanten-list-sort";

type MandantenStatusFilterSelectProps = {
  value: MandantListStatusFilter;
  searchQuery?: string;
  sortState: MandantListSort;
};

const selectClassName =
  "mt-1 w-full min-w-[8.5rem] max-w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-xs font-medium normal-case tracking-normal text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-600 dark:focus:ring-zinc-50/10";

export function MandantenStatusFilterSelect({
  value,
  searchQuery,
  sortState,
}: MandantenStatusFilterSelectProps) {
  const router = useRouter();

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const nextStatus = event.target.value as MandantListStatusFilter;

    router.push(
      buildMandantenListUrl({
        status: nextStatus,
        q: searchQuery,
        sort: sortState.sort,
        order: sortState.order,
      }),
    );
  }

  return (
    <select
      id="mandanten-status-filter"
      aria-label="Status filtern"
      value={value}
      onChange={handleChange}
      className={selectClassName}
    >
      <option value="all">Alle</option>
      {MANDANT_STATUS_OPTIONS.map((option) => (
        <option key={option.code} value={option.code}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
