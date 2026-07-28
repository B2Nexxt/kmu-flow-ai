import type { AnfrageeingangKpis } from "@/lib/anfrageeingang/types";
import { getAnfrageeingangListArchiveHintMessage } from "@/lib/anfrageeingang/archiviere-anfrageeingang-messages";

const statClassName =
  "rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900";

const kpiConfig: Array<{ key: keyof AnfrageeingangKpis; label: string }> = [
  { key: "neu", label: "Neu" },
  { key: "manuellePruefung", label: "Manuelle Prüfung" },
  { key: "wartetAufInformationen", label: "Wartet auf Informationen" },
  { key: "bereitFuerVorgang", label: "Bereit für Vorgang" },
];

export function AnfrageeingangKpiCards({ kpis }: { kpis: AnfrageeingangKpis }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {kpiConfig.map(({ key, label }) => (
        <div key={key} className={statClassName}>
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
          <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {kpis[key]}
          </p>
        </div>
      ))}
    </div>
  );
}

export function AnfrageeingangLoadError() {
  return (
    <div
      role="alert"
      className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200"
    >
      Die Anfrageeingänge konnten nicht geladen werden.
    </div>
  );
}

export function AnfrageeingangListSuccessHint({ hinweis }: { hinweis?: string | null }) {
  const message = getAnfrageeingangListArchiveHintMessage(hinweis);
  if (!message) return null;

  return (
    <div
      role="status"
      className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100"
    >
      {message}
    </div>
  );
}

export function AnfrageeingangSearchFilterPlaceholder() {
  return (
    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
      <label className="sr-only" htmlFor="anfrageeingang-suche">
        Anfrageeingänge durchsuchen
      </label>
      <input
        id="anfrageeingang-suche"
        type="search"
        placeholder="Suchen …"
        readOnly
        className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 sm:max-w-md"
      />
      <button
        type="button"
        className="inline-flex shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800/50"
      >
        Filter
      </button>
    </div>
  );
}
