const stats = [
  { label: "Neue Anfragen", value: 3 },
  { label: "Offene Angebote", value: 4 },
  { label: "Offene Rechnungen", value: 2 },
  { label: "Automatisierungen", value: 1 },
];

const activities = [
  "Angebot für Muster GmbH erstellt",
  "Neue Anfrage von Beispiel AG",
  "Rechnung RE-2026-001 als bezahlt markiert",
];

export default function DashboardPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Dashboard
        </h1>
        <p className="mt-2 text-zinc-500 dark:text-zinc-400">
          Willkommen bei KMU Flow AI
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              {stat.label}
            </p>
            <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-zinc-50">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Letzte Aktivitäten
        </h2>
        <div className="mt-4 rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {activities.map((activity) => (
              <li
                key={activity}
                className="px-5 py-4 text-sm text-zinc-700 dark:text-zinc-300"
              >
                {activity}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
