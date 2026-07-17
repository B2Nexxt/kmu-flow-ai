"use client";

import Link from "next/link";
import {
  calculateMonthlyPrices,
  formatCurrencyFromCents,
  MODULE_OPTIONS,
  useMandantenOnboarding,
} from "../mandanten-onboarding-context";

const TOTAL_STEPS = 6;
const CURRENT_STEP = 4;

const inputClassName =
  "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 dark:focus:ring-zinc-50/10";

const buttonSecondaryClassName =
  "inline-flex h-11 items-center justify-center rounded-lg border border-zinc-200 px-6 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800";

export default function ModulePage() {
  const { data, updateModuleUndPreise, toggleModul } = useMandantenOnboarding();
  const moduleUndPreise = data.moduleUndPreise;

  const prices = calculateMonthlyPrices(
    moduleUndPreise.monatlicherGrundpreis,
    moduleUndPreise.rabattInProzent,
  );

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
              Schritt 4 von 6 – Module und Preis
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
                Module
              </h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {MODULE_OPTIONS.map((module) => {
                  const isSelected =
                    moduleUndPreise.ausgewaehlteModule.includes(module);

                  return (
                    <label
                      key={module}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                        isSelected
                          ? "border-zinc-900 bg-zinc-50 dark:border-zinc-50 dark:bg-zinc-800/50"
                          : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/30"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleModul(module)}
                        className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900/10 dark:border-zinc-600 dark:bg-zinc-950"
                      />
                      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                        {module}
                      </span>
                    </label>
                  );
                })}
              </div>
            </section>

            <section className="mt-8">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Preis
              </h3>
              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="einrichtungsgebuehr"
                    className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    Einmalige Einrichtungsgebühr
                  </label>
                  <input
                    id="einrichtungsgebuehr"
                    type="text"
                    value={moduleUndPreise.einrichtungsgebuehr}
                    onChange={(e) =>
                      updateModuleUndPreise({
                        einrichtungsgebuehr: e.target.value,
                      })
                    }
                    placeholder="z. B. 500,00 €"
                    className={inputClassName}
                  />
                </div>
                <div>
                  <label
                    htmlFor="grundpreis"
                    className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    Monatlicher Grundpreis
                  </label>
                  <input
                    id="grundpreis"
                    type="text"
                    value={moduleUndPreise.monatlicherGrundpreis}
                    onChange={(e) =>
                      updateModuleUndPreise({
                        monatlicherGrundpreis: e.target.value,
                      })
                    }
                    placeholder="z. B. 99,00 €"
                    className={inputClassName}
                  />
                </div>
                <div>
                  <label
                    htmlFor="rabatt"
                    className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    Rabatt in Prozent
                  </label>
                  <input
                    id="rabatt"
                    type="text"
                    value={moduleUndPreise.rabattInProzent}
                    onChange={(e) =>
                      updateModuleUndPreise({
                        rabattInProzent: e.target.value,
                      })
                    }
                    placeholder="z. B. 10"
                    className={inputClassName}
                  />
                </div>
                <div>
                  <label
                    htmlFor="vertragslaufzeit"
                    className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    Vertragslaufzeit in Monaten
                  </label>
                  <input
                    id="vertragslaufzeit"
                    type="text"
                    value={moduleUndPreise.vertragslaufzeit}
                    onChange={(e) =>
                      updateModuleUndPreise({
                        vertragslaufzeit: e.target.value,
                      })
                    }
                    placeholder="z. B. 12"
                    className={inputClassName}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label
                    htmlFor="abrechnungsbeginn"
                    className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    Abrechnungsbeginn
                  </label>
                  <input
                    id="abrechnungsbeginn"
                    type="date"
                    value={moduleUndPreise.abrechnungsbeginn}
                    onChange={(e) =>
                      updateModuleUndPreise({
                        abrechnungsbeginn: e.target.value,
                      })
                    }
                    className={inputClassName}
                  />
                </div>
              </div>
            </section>

            <div className="mt-6 space-y-2 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">
                  Monatspreis vor Rabatt
                </span>
                <span className="font-medium text-zinc-900 dark:text-zinc-50">
                  {prices.vorRabattCents !== null
                    ? formatCurrencyFromCents(prices.vorRabattCents)
                    : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">
                  Rabattbetrag
                </span>
                <span className="font-medium text-zinc-900 dark:text-zinc-50">
                  {prices.rabattbetragCents !== null
                    ? formatCurrencyFromCents(prices.rabattbetragCents)
                    : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-zinc-200 pt-2 text-sm dark:border-zinc-800">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  Monatspreis nach Rabatt
                </span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                  {prices.nachRabattCents !== null
                    ? formatCurrencyFromCents(prices.nachRabattCents)
                    : "—"}
                </span>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Die endgültigen Preise können später im Vertrag und im
                Abonnement angepasst werden.
              </p>
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-zinc-200 pt-6 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <Link
                  href="/admin/mandanten/neu/finanzen"
                  className={buttonSecondaryClassName}
                >
                  Zurück
                </Link>
                <Link href="/admin" className={buttonSecondaryClassName}>
                  Abbrechen
                </Link>
              </div>
              <Link
                href="/admin/mandanten/neu/automatisierungen"
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
