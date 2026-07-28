import Link from "next/link";

import type { AnfrageeingangListItem } from "@/lib/anfrageeingang/types";

const tableHeadClassName =
  "px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400";

const tableCellClassName = "px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300";

const tableColumns = [
  "Eingangsnummer",
  "Empfangen",
  "Kanal",
  "Absender",
  "Betreff",
  "Status",
  "Zuordnung",
  "Dringlichkeit",
] as const;

export function AnfrageeingangEmptyState() {
  return (
    <tr>
      <td colSpan={tableColumns.length} className="px-4 py-16 text-center">
        <p className="text-base font-medium text-zinc-900 dark:text-zinc-50">
          Noch keine Anfrageeingänge
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
          Sobald neue Anfragen eingehen, erscheinen sie hier.
        </p>
      </td>
    </tr>
  );
}

export function AnfrageeingangTable({ rows }: { rows: AnfrageeingangListItem[] }) {
  return (
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
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {rows.length === 0 ? (
              <AnfrageeingangEmptyState />
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30">
                  <td className={`${tableCellClassName} font-medium text-zinc-900 dark:text-zinc-50`}>
                    <Link
                      href={`/anfrageeingang/${row.id}`}
                      className="underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-500 dark:decoration-zinc-600"
                    >
                      {row.eingangsnummer}
                    </Link>
                  </td>
                  <td className={tableCellClassName}>{row.empfangenAmLabel}</td>
                  <td className={tableCellClassName}>{row.kanalLabel}</td>
                  <td className={tableCellClassName}>{row.absenderLabel}</td>
                  <td className={tableCellClassName}>{row.betreffLabel}</td>
                  <td className={tableCellClassName}>{row.statusLabel}</td>
                  <td className={tableCellClassName}>{row.zuordnungsstatusLabel}</td>
                  <td className={tableCellClassName}>{row.dringlichkeitLabel}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
