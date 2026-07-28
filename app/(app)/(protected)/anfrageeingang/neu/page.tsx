import Link from "next/link";

import { NeueAnfrageForm } from "./neue-anfrage-form";
import { formatDatetimeLocalValue } from "@/lib/anfrageeingang/format-datetime-local";

export default function NeueAnfragePage() {
  const defaultEmpfangenAm = formatDatetimeLocalValue(new Date());

  return (
    <div className="p-4 sm:p-8">
      <Link
        href="/anfrageeingang"
        className="text-sm font-medium text-zinc-600 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← Zurück zum Anfrageeingang
      </Link>

      <div className="mt-6 max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Neue Anfrage
        </h1>
        <p className="mt-2 text-zinc-500 dark:text-zinc-400">
          Erfassen Sie eine neue telefonische, schriftliche oder persönliche Anfrage.
        </p>

        <div className="mt-8 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <NeueAnfrageForm defaultEmpfangenAm={defaultEmpfangenAm} />
        </div>
      </div>
    </div>
  );
}
