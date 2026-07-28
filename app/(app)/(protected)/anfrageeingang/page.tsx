import Link from "next/link";

import {
  AnfrageeingangKpiCards,
  AnfrageeingangListSuccessHint,
  AnfrageeingangLoadError,
  AnfrageeingangSearchFilterPlaceholder,
} from "./anfrageeingang-list-chrome";
import { AnfrageeingangTable } from "./anfrageeingang-table";
import { loadAnfrageeingangPageData } from "@/lib/anfrageeingang/load-anfrageeingaenge";

type AnfrageeingangPageProps = {
  searchParams: Promise<{ hinweis?: string }>;
};

export default async function AnfrageeingangPage({ searchParams }: AnfrageeingangPageProps) {
  const { hinweis } = await searchParams;
  const data = await loadAnfrageeingangPageData();

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Anfrageeingang
          </h1>
          <p className="mt-2 max-w-3xl text-zinc-500 dark:text-zinc-400">
            Neue und unbearbeitete Anfragen prüfen, zuordnen und in Vorgänge überführen.
          </p>
        </div>
        <Link
          href="/anfrageeingang/neu"
          className="inline-flex shrink-0 items-center justify-center rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Neue Anfrage
        </Link>
      </div>

      <AnfrageeingangListSuccessHint hinweis={hinweis} />

      {data.ok ? (
        <>
          <AnfrageeingangKpiCards kpis={data.kpis} />
          <AnfrageeingangSearchFilterPlaceholder />
          <AnfrageeingangTable rows={data.rows} />
        </>
      ) : (
        <>
          <AnfrageeingangLoadError />
          <AnfrageeingangSearchFilterPlaceholder />
        </>
      )}
    </div>
  );
}
