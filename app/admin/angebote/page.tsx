import Link from "next/link";
import { AngeboteListRow } from "@/app/admin/angebote/angebote-list-row";
import { AngeboteSearch } from "@/app/admin/angebote/angebote-search";
import { AngeboteSortableHeaderLink } from "@/app/admin/angebote/angebote-sortable-header-link";
import { AngeboteStatusFilterSelect } from "@/app/admin/angebote/angebote-status-filter-select";
import { buildAngeboteListUrl } from "@/lib/angebote/build-angebote-list-url";
import { getAngeboteList } from "@/lib/angebote/get-angebote-list";
import { parseAngebotListSortState } from "@/lib/angebote/angebote-list-sort";
import { parseAngebotListStatusFilter } from "@/lib/angebote/angebot-status";

export const dynamic = "force-dynamic";

const buttonPrimaryClassName =
  "inline-flex h-11 items-center justify-center rounded-lg bg-zinc-900 px-6 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200";

const buttonSecondaryClassName =
  "inline-flex h-11 items-center justify-center rounded-lg border border-zinc-200 px-6 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800";

type AngebotePageProps = {
  searchParams: Promise<{ status?: string; q?: string; sort?: string; order?: string }>;
};

export default async function AngebotePage({ searchParams }: AngebotePageProps) {
  const { status, q, sort, order } = await searchParams;
  const statusFilter = parseAngebotListStatusFilter(status);
  const sortState = parseAngebotListSortState(sort, order);
  const angebote = await getAngeboteList(statusFilter, sortState, q);
  const hasStatusFilter = statusFilter !== "all";
  const hasSearchQuery = Boolean(q?.trim());
  const hasActiveFilter = hasSearchQuery || hasStatusFilter;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white px-8 py-5 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          KMU Flow AI
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Plattform-Admin
        </h1>
      </header>

      <main className="p-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                Angebote
              </h2>
              <p className="mt-2 text-zinc-500 dark:text-zinc-400">
                Übersicht aller Angebote mit Navigation zur Angebotsakte.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/admin" className={buttonSecondaryClassName}>
                Zurück zum Dashboard
              </Link>
              <Link href="/admin/angebote/neu" className={buttonPrimaryClassName}>
                Neues Angebot
              </Link>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <table className="min-w-[56rem] w-full divide-y divide-zinc-200 dark:divide-zinc-800">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-950/50">
                  <th
                    scope="col"
                    className="px-4 py-3 text-left align-top text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
                  >
                    <AngeboteSortableHeaderLink
                      column="angebotsnummer"
                      label="Angebotsnummer"
                      currentSort={sortState}
                      statusFilter={statusFilter}
                      searchQuery={q}
                    />
                    <AngeboteSearch
                      value={q}
                      statusFilter={statusFilter}
                      sortState={sortState}
                    />
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left align-top text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
                  >
                    <AngeboteSortableHeaderLink
                      column="mandant"
                      label="Mandant"
                      currentSort={sortState}
                      statusFilter={statusFilter}
                      searchQuery={q}
                    />
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
                  >
                    Betreff
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left align-top text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
                  >
                    <AngeboteSortableHeaderLink
                      column="angebot_datum"
                      label="Angebotsdatum"
                      currentSort={sortState}
                      statusFilter={statusFilter}
                      searchQuery={q}
                    />
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
                  >
                    Gültig bis
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left align-top text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
                  >
                    <span className="block">Status</span>
                    <AngeboteStatusFilterSelect
                      value={statusFilter}
                      searchQuery={q}
                      sortState={sortState}
                    />
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left align-top text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
                  >
                    <AngeboteSortableHeaderLink
                      column="gesamtbetrag"
                      label="Gesamtbetrag brutto"
                      currentSort={sortState}
                      statusFilter={statusFilter}
                      searchQuery={q}
                    />
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
                  >
                    Aktion
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {angebote.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center">
                      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                        {hasActiveFilter
                          ? "Keine Angebote für die aktuelle Suche oder Filterung gefunden."
                          : "Noch keine Angebote vorhanden."}
                      </h3>
                      {hasActiveFilter ? (
                        <Link
                          href={buildAngeboteListUrl({
                            sort: sortState.sort,
                            order: sortState.order,
                          })}
                          className={`${buttonSecondaryClassName} mt-6`}
                        >
                          Suche und Filter zurücksetzen
                        </Link>
                      ) : (
                        <Link
                          href="/admin/angebote/neu"
                          className={`${buttonPrimaryClassName} mt-6`}
                        >
                          Neues Angebot
                        </Link>
                      )}
                    </td>
                  </tr>
                ) : (
                  angebote.map((angebot) => (
                    <AngeboteListRow key={angebot.angebotId} angebot={angebot} />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
