export const dynamic = "force-dynamic";

export default function AngebotePage() {
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
          <div className="mb-8">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Angebote
            </h2>
            <p className="mt-2 text-zinc-500 dark:text-zinc-400">
              Übersicht aller Angebote.
            </p>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white px-6 py-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Angebotsliste folgt in einer späteren Phase
            </h3>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Angebote können derzeit über die Angebotsakte geöffnet werden.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
