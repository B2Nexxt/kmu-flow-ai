import Link from "next/link";

export default function AnfrageeingangDetailNotFound() {
  return (
    <div className="p-4 sm:p-8">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        Anfrageeingang nicht gefunden
      </h1>
      <p className="mt-3 max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
        Der Anfrageeingang ist nicht vorhanden oder steht Ihnen nicht zur Verfügung.
      </p>
      <Link
        href="/anfrageeingang"
        className="mt-6 inline-flex text-sm font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-500 dark:text-zinc-50"
      >
        Zurück zum Anfrageeingang
      </Link>
    </div>
  );
}
