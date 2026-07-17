import Link from "next/link";
import { getAdminDashboardStats } from "@/lib/mandanten/get-admin-dashboard-stats";

export const dynamic = "force-dynamic";

const quickActions = [
  { label: "Mandant anlegen", icon: "➕", href: "/admin/mandanten/neu" },
  { label: "Angebot erstellen", icon: "📄", href: null },
  { label: "Beratung planen", icon: "📅", href: null },
  { label: "Module verwalten", icon: "⚙️", href: null },
];

export default async function AdminPage() {
  const { mandanten, interessenten } = await getAdminDashboardStats();

  const stats = [
    { label: "Mandanten", value: mandanten },
    { label: "Interessenten", value: interessenten },
    { label: "Angebote", value: 0 },
    { label: "Verträge", value: 0 },
    { label: "Aktive Abonnements", value: 0 },
  ];

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
        <div className="mb-8">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Dashboard
          </h2>
          <p className="mt-2 text-zinc-500 dark:text-zinc-400">
            Übersicht über Mandanten nach Status und Plattformaktivitäten.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
            Schnellaktionen
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {quickActions.map((action) => {
              const className =
                "flex min-h-32 flex-col items-center justify-center gap-3 rounded-lg border border-zinc-200 bg-white p-6 text-center transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800/50";

              if (action.href) {
                return (
                  <Link
                    key={action.label}
                    href={action.href}
                    className={className}
                  >
                    <span className="text-2xl" aria-hidden="true">
                      {action.icon}
                    </span>
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {action.label}
                    </span>
                  </Link>
                );
              }

              return (
                <button key={action.label} type="button" className={className}>
                  <span className="text-2xl" aria-hidden="true">
                    {action.icon}
                  </span>
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {action.label}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
