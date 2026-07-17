"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";
import { buildMandantenListUrl } from "@/lib/mandanten/build-mandanten-list-url";
import type { MandantListSort } from "@/lib/mandanten/mandanten-list-sort";
import type { MandantListStatusFilter } from "@/lib/mandanten/mandant-status";

type MandantenNameSearchProps = {
  value?: string;
  statusFilter: MandantListStatusFilter;
  sortState: MandantListSort;
};

const inputClassName =
  "min-w-0 flex-1 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-xs font-normal normal-case tracking-normal text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 dark:focus:ring-zinc-50/10";

const clearButtonClassName =
  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-zinc-200 text-sm font-medium text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50";

export function MandantenNameSearch({
  value,
  statusFilter,
  sortState,
}: MandantenNameSearchProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const currentValue = value?.trim() ?? "";

  function navigate(nextQuery: string) {
    router.push(
      buildMandantenListUrl({
        q: nextQuery.trim() || undefined,
        status: statusFilter,
        sort: sortState.sort,
        order: sortState.order,
      }),
    );
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    navigate(String(formData.get("q") ?? ""));
  }

  function handleClear() {
    if (inputRef.current) {
      inputRef.current.value = "";
    }

    navigate("");
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 flex min-w-[10rem] items-center gap-1">
      <input
        ref={inputRef}
        key={currentValue}
        id="mandanten-name-search"
        name="q"
        type="search"
        defaultValue={currentValue}
        placeholder="Suchen …"
        aria-label="Mandanten suchen"
        className={inputClassName}
      />
      {currentValue && (
        <button
          type="button"
          onClick={handleClear}
          className={clearButtonClassName}
          aria-label="Suche löschen"
          title="Suche löschen"
        >
          ×
        </button>
      )}
    </form>
  );
}
