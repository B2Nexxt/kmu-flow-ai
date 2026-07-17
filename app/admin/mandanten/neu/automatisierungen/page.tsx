"use client";

import Link from "next/link";
import {
  AUTOMATION_OPTIONS,
  useMandantenOnboarding,
} from "../mandanten-onboarding-context";

const TOTAL_STEPS = 6;
const CURRENT_STEP = 5;

const AUTOMATISIERUNGEN = [
  {
    name: AUTOMATION_OPTIONS[0],
    description:
      "Eingehende E-Mails werden automatisch als neue Kundenanfrage erfasst.",
    typ: "Standard" as const,
  },
  {
    name: AUTOMATION_OPTIONS[1],
    description:
      "Aus einer Kundenanfrage wird automatisch ein Angebotsentwurf vorbereitet.",
    typ: "Standard" as const,
  },
  {
    name: AUTOMATION_OPTIONS[2],
    description:
      "Freigegebene Angebote werden automatisch an den Kunden versendet.",
    typ: "Standard" as const,
  },
  {
    name: AUTOMATION_OPTIONS[3],
    description:
      "Angenommene Angebote werden automatisch in Rechnungen überführt.",
    typ: "Standard" as const,
  },
  {
    name: AUTOMATION_OPTIONS[4],
    description:
      "Wiederkehrende Leistungen werden monatlich als Rechnung vorbereitet.",
    typ: "Standard" as const,
  },
  {
    name: AUTOMATION_OPTIONS[5],
    description:
      "Überfällige Rechnungen werden für eine Zahlungserinnerung vorgemerkt.",
    typ: "Standard" as const,
  },
  {
    name: AUTOMATION_OPTIONS[6],
    description:
      "Hochgeladene Dokumente werden anhand von Regeln dem passenden Vorgang zugeordnet.",
    typ: "Individuell" as const,
  },
  {
    name: AUTOMATION_OPTIONS[7],
    description:
      "Neue Vorgänge erhalten automatisch eine KI-gestützte Kurzzusammenfassung.",
    typ: "Individuell" as const,
  },
];

const inputClassName =
  "w-full resize-y rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 dark:focus:ring-zinc-50/10";

const buttonSecondaryClassName =
  "inline-flex h-11 items-center justify-center rounded-lg border border-zinc-200 px-6 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800";

export default function AutomatisierungenPage() {
  const { data, updateAutomatisierungen, toggleAutomatisierung } =
    useMandantenOnboarding();

  const automatisierungen = data.automatisierungen;

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
        <div className="mx-auto max-w-3xl">
          <div className="mb-8">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Neuen Mandanten anlegen
            </h2>
            <p className="mt-2 text-zinc-500 dark:text-zinc-400">
              Schritt 5 von 6 – Automatisierungen
            </p>
          </div>

          <div className="mb-8">
            <div className="flex items-center gap-2">
              {Array.from({ length: TOTAL_STEPS }, (_, index) => {
                const stepNumber = index + 1;
                const isActive = stepNumber === CURRENT_STEP;
                const isCompleted = stepNumber < CURRENT_STEP;

                return (
                  <div key={stepNumber} className="flex flex-1 flex-col gap-2">
                    <div
                      className={`h-2 rounded-full ${
                        isActive || isCompleted
                          ? "bg-zinc-900 dark:bg-zinc-50"
                          : "bg-zinc-200 dark:bg-zinc-800"
                      }`}
                    />
                    <span
                      className={`text-center text-xs font-medium ${
                        isActive
                          ? "text-zinc-900 dark:text-zinc-50"
                          : "text-zinc-400 dark:text-zinc-500"
                      }`}
                    >
                      {stepNumber}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <form
            className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
            onSubmit={(e) => e.preventDefault()}
          >
            <section>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Automatisierungen
              </h3>
              <div className="mt-4 grid gap-4">
                {AUTOMATISIERUNGEN.map((automation) => (
                  <label
                    key={automation.name}
                    className="flex cursor-pointer items-start gap-4 rounded-lg border border-zinc-200 p-4 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/30"
                  >
                    <input
                      type="checkbox"
                      checked={automatisierungen.ausgewaehlteAutomatisierungen.includes(
                        automation.name,
                      )}
                      onChange={() => toggleAutomatisierung(automation.name)}
                      className="mt-1 h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900/10 dark:border-zinc-600 dark:bg-zinc-950"
                    />
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                          {automation.name}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            automation.typ === "Standard"
                              ? "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          }`}
                        >
                          {automation.typ}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                        {automation.description}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </section>

            <section className="mt-8">
              <label
                htmlFor="individuelle-wuensche"
                className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Individuelle Automatisierungswünsche
              </label>
              <textarea
                id="individuelle-wuensche"
                name="individuelle-wuensche"
                rows={6}
                value={automatisierungen.individuelleWuensche}
                onChange={(e) =>
                  updateAutomatisierungen({
                    individuelleWuensche: e.target.value,
                  })
                }
                placeholder="Beschreiben Sie zusätzliche oder individuelle Automatisierungswünsche …"
                className={inputClassName}
              />
            </section>

            <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Individuelle Automatisierungen werden vor der Aktivierung
                geprüft und können zusätzliche Kosten verursachen.
              </p>
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-zinc-200 pt-6 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <Link
                  href="/admin/mandanten/neu/module"
                  className={buttonSecondaryClassName}
                >
                  Zurück
                </Link>
                <Link href="/admin" className={buttonSecondaryClassName}>
                  Abbrechen
                </Link>
              </div>
              <Link
                href="/admin/mandanten/neu/abschluss"
                className="inline-flex h-11 items-center justify-center rounded-lg bg-zinc-900 px-6 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Weiter
              </Link>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
