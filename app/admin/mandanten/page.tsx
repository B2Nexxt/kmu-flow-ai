import Link from "next/link";
import { MandantenListRow } from "@/app/admin/mandanten/mandanten-list-row";
import { MandantenNameSearch } from "@/app/admin/mandanten/mandanten-name-search";
import { MandantenSortableHeaderLink } from "@/app/admin/mandanten/mandanten-sortable-header-link";
import { MandantenStatusFilterSelect } from "@/app/admin/mandanten/mandanten-status-filter-select";
import { buildMandantenListUrl } from "@/lib/mandanten/build-mandanten-list-url";
import { getMandantenList } from "@/lib/mandanten/get-mandanten-list";
import { parseMandantListSortState } from "@/lib/mandanten/mandanten-list-sort";
import {
  MANDANT_STATUS_OPTIONS,
  parseMandantListStatusFilter,
  type MandantListStatusFilter,
} from "@/lib/mandanten/mandant-status";

export const dynamic = "force-dynamic";

const buttonPrimaryClassName =
  "inline-flex h-11 items-center justify-center rounded-lg bg-zinc-900 px-6 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200";

const buttonSecondaryClassName =
  "inline-flex h-11 items-center justify-center rounded-lg border border-zinc-200 px-6 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800";

type MandantenPageProps = {
  searchParams: Promise<{ status?: string; q?: string; sort?: string; order?: string }>;
};

function getStatusFilterLabel(statusFilter: MandantListStatusFilter) {
  if (statusFilter === "all") {
    return "Alle";
  }

  return (
    MANDANT_STATUS_OPTIONS.find((option) => option.code === statusFilter)?.label ??
    "Alle"
  );
}

export default async function MandantenPage({ searchParams }: MandantenPageProps) {
  const { status, q, sort, order } = await searchParams;
  const statusFilter = parseMandantListStatusFilter(status);
  const sortState = parseMandantListSortState(sort, order);
  const mandanten = await getMandantenList(statusFilter, sortState, q);
  const hasStatusFilter = statusFilter !== "all";
  const hasSearchQuery = Boolean(q?.trim());

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
                Mandanten
              </h2>
              <p className="mt-2 text-zinc-500 dark:text-zinc-400">
                Übersicht aller angelegten Mandanten und Interessenten.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/admin" className={buttonSecondaryClassName}>
                Zurück zum Dashboard
              </Link>
              <Link href="/admin/mandanten/neu" className={buttonPrimaryClassName}>
                Mandant anlegen
              </Link>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <table className="min-w-[40rem] w-full divide-y divide-zinc-200 dark:divide-zinc-800">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-950/50">
                  <th
                    scope="col"
                    className="px-4 py-3 text-left align-top text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
                  >
                    <MandantenSortableHeaderLink
                      column="name"
                      label="Firmenname"
                      currentSort={sortState}
                      statusFilter={statusFilter}
                      searchQuery={q}
                    />
                    <MandantenNameSearch
                      value={q}
                      statusFilter={statusFilter}
                      sortState={sortState}
                    />
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left align-top text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
                  >
                    <span className="block">Status</span>
                    <MandantenStatusFilterSelect
                      value={statusFilter}
                      searchQuery={q}
                      sortState={sortState}
                    />
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
                  >
                    Hauptansprechpartner
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
                  >
                    Ort
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
                  >
                    <MandantenSortableHeaderLink
                      column="created_at"
                      label="Erstellt am"
                      currentSort={sortState}
                      statusFilter={statusFilter}
                      searchQuery={q}
                    />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {mandanten.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                        {hasSearchQuery && hasStatusFilter
                          ? `Keine Treffer für „${q?.trim()}“ mit Status „${getStatusFilterLabel(statusFilter)}“`
                          : hasSearchQuery
                            ? `Keine Treffer für „${q?.trim()}“`
                            : hasStatusFilter
                              ? `Keine Mandanten mit Status „${getStatusFilterLabel(statusFilter)}“`
                              : "Noch keine Mandanten vorhanden"}
                      </h3>
                      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                        {hasSearchQuery || hasStatusFilter
                          ? "Passen Sie Suche oder Filter an oder legen Sie einen neuen Mandanten an."
                          : "Legen Sie den ersten Mandanten an, um ihn hier in der Übersicht zu sehen."}
                      </p>
                      {hasSearchQuery || hasStatusFilter ? (
                        <Link
                          href={buildMandantenListUrl({
                            sort: sortState.sort,
                            order: sortState.order,
                          })}
                          className={`${buttonSecondaryClassName} mt-6`}
                        >
                          {hasSearchQuery && hasStatusFilter
                            ? "Suche und Filter zurücksetzen"
                            : hasSearchQuery
                              ? "Suche zurücksetzen"
                              : "Filter zurücksetzen"}
                        </Link>
                      ) : (
                        <Link
                          href="/admin/mandanten/neu"
                          className={`${buttonPrimaryClassName} mt-6`}
                        >
                          Mandant anlegen
                        </Link>
                      )}
                    </td>
                  </tr>
                ) : (
                  mandanten.map((mandant) => (
                    <MandantenListRow key={mandant.id} mandant={mandant} />
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
