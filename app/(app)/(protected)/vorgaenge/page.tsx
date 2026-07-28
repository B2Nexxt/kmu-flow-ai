const statPlaceholderClassName =
  "rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900";

const tableHeadClassName =
  "px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400";

const kpiLabels = [
  "Neu",
  "In Klärung",
  "In Bearbeitung",
  "Wartet auf extern",
  "Abgeschlossen",
] as const;

const tableColumns = [
  "Vorgangsnummer",
  "Typ",
  "Titel",
  "Objekt",
  "Beteiligte",
  "Status",
  "Priorität",
  "Eingegangen",
] as const;

export default function VorgaengePage() {
  return (
    <div className="p-4 sm:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Vorgänge
        </h1>
        <p className="mt-2 max-w-3xl text-zinc-500 dark:text-zinc-400">
          Laufende Anfragen, Servicefälle und Reklamationen bearbeiten.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {kpiLabels.map((label) => (
          <div key={label} className={statPlaceholderClassName}>
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
            <p
              className="mt-2 text-2xl font-bold text-zinc-300 dark:text-zinc-600"
              aria-hidden="true"
            >
              —
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="sr-only" htmlFor="vorgaenge-suche">
          Vorgänge durchsuchen
        </label>
        <input
          id="vorgaenge-suche"
          type="search"
          placeholder="Suchen …"
          className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 sm:max-w-md"
        />
        <button
          type="button"
          className="inline-flex shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800/50"
        >
          Filter
        </button>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
            <thead className="bg-zinc-50 dark:bg-zinc-900/50">
              <tr>
                {tableColumns.map((column) => (
                  <th key={column} scope="col" className={tableHeadClassName}>
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={tableColumns.length} className="px-4 py-16 text-center">
                  <p className="text-base font-medium text-zinc-900 dark:text-zinc-50">
                    Noch keine Vorgänge
                  </p>
                  <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
                    Aus bestätigten Anfrageeingängen entstehen hier neue Vorgänge.
                  </p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
