"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  formatIbanForDisplay,
  normalizeBic,
  useMandantenOnboarding,
  validateBankverbindung,
  type BankverbindungErrors,
} from "../mandanten-onboarding-context";

const TOTAL_STEPS = 6;
const CURRENT_STEP = 3;

const inputClassName =
  "w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500";

function getInputClassName(hasError: boolean) {
  return hasError
    ? `${inputClassName} border-red-300 focus:border-red-400 focus:ring-red-500/10 dark:border-red-800 dark:focus:border-red-700 dark:focus:ring-red-500/20`
    : `${inputClassName} border-zinc-200 focus:border-zinc-400 focus:ring-zinc-900/10 dark:border-zinc-700 dark:focus:border-zinc-600 dark:focus:ring-zinc-50/10`;
}

const buttonSecondaryClassName =
  "inline-flex h-11 items-center justify-center rounded-lg border border-zinc-200 px-6 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800";

export default function FinanzenPage() {
  const router = useRouter();
  const { data, updateSteuerdaten, updateBankverbindung } =
    useMandantenOnboarding();
  const [errors, setErrors] = useState<BankverbindungErrors>({});

  const steuer = data.steuerdaten;
  const bank = data.bankverbindung;

  function clearError(field: keyof BankverbindungErrors) {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function handleBankFieldChange(
    field: keyof BankverbindungErrors,
    value: string,
  ) {
    updateBankverbindung({ [field]: value });
    clearError(field);
  }

  function handleWeiter() {
    const validationErrors = validateBankverbindung(bank);

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    router.push("/admin/mandanten/neu/module");
  }

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
              Schritt 3 von 6 – Bank- und Steuerdaten
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
            <div className="mb-6 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Diese Daten werden später für Verträge, Rechnungen und Dokumente
                verwendet.
              </p>
            </div>

            <div className="space-y-8">
              <section>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  Steuerdaten
                </h3>
                <div className="mt-4 grid gap-5 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="steuernummer"
                      className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                    >
                      Steuernummer
                    </label>
                    <input
                      id="steuernummer"
                      name="steuernummer"
                      type="text"
                      value={steuer.steuernummer}
                      onChange={(e) =>
                        updateSteuerdaten({ steuernummer: e.target.value })
                      }
                      placeholder="z. B. 12/345/67890"
                      className={getInputClassName(false)}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="umsatzsteuer-id"
                      className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                    >
                      Umsatzsteuer-ID
                    </label>
                    <input
                      id="umsatzsteuer-id"
                      name="umsatzsteuer-id"
                      type="text"
                      value={steuer.umsatzsteuerId}
                      onChange={(e) =>
                        updateSteuerdaten({ umsatzsteuerId: e.target.value })
                      }
                      placeholder="z. B. DE123456789"
                      className={getInputClassName(false)}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="handelsregisternummer"
                      className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                    >
                      Handelsregisternummer
                    </label>
                    <input
                      id="handelsregisternummer"
                      name="handelsregisternummer"
                      type="text"
                      value={steuer.handelsregisternummer}
                      onChange={(e) =>
                        updateSteuerdaten({
                          handelsregisternummer: e.target.value,
                        })
                      }
                      placeholder="z. B. HRB 123456"
                      className={getInputClassName(false)}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="registergericht"
                      className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                    >
                      Registergericht
                    </label>
                    <input
                      id="registergericht"
                      name="registergericht"
                      type="text"
                      value={steuer.registergericht}
                      onChange={(e) =>
                        updateSteuerdaten({ registergericht: e.target.value })
                      }
                      placeholder="z. B. Amtsgericht Berlin"
                      className={getInputClassName(false)}
                    />
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  Bankverbindung
                </h3>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Optional – wenn ausgefüllt, müssen alle Felder vollständig
                  sein.
                </p>
                <div className="mt-4 grid gap-5 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="kontoinhaber"
                      className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                    >
                      Kontoinhaber
                    </label>
                    <input
                      id="kontoinhaber"
                      name="kontoinhaber"
                      type="text"
                      value={bank.kontoinhaber}
                      onChange={(e) =>
                        handleBankFieldChange("kontoinhaber", e.target.value)
                      }
                      placeholder="z. B. Muster GmbH"
                      className={getInputClassName(!!errors.kontoinhaber)}
                    />
                    {errors.kontoinhaber && (
                      <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                        {errors.kontoinhaber}
                      </p>
                    )}
                  </div>
                  <div>
                    <label
                      htmlFor="bankname"
                      className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                    >
                      Bankname
                    </label>
                    <input
                      id="bankname"
                      name="bankname"
                      type="text"
                      value={bank.bankname}
                      onChange={(e) =>
                        handleBankFieldChange("bankname", e.target.value)
                      }
                      placeholder="z. B. Musterbank"
                      className={getInputClassName(!!errors.bankname)}
                    />
                    {errors.bankname && (
                      <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                        {errors.bankname}
                      </p>
                    )}
                  </div>
                  <div>
                    <label
                      htmlFor="iban"
                      className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                    >
                      IBAN
                    </label>
                    <input
                      id="iban"
                      name="iban"
                      type="text"
                      value={bank.iban}
                      onChange={(e) => {
                        updateBankverbindung({
                          iban: formatIbanForDisplay(e.target.value),
                        });
                        clearError("iban");
                      }}
                      placeholder="z. B. DE89 3704 0044 0532 0130 00"
                      className={getInputClassName(!!errors.iban)}
                    />
                    {errors.iban && (
                      <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                        {errors.iban}
                      </p>
                    )}
                  </div>
                  <div>
                    <label
                      htmlFor="bic"
                      className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                    >
                      BIC
                    </label>
                    <input
                      id="bic"
                      name="bic"
                      type="text"
                      value={bank.bic}
                      onChange={(e) => {
                        updateBankverbindung({
                          bic: normalizeBic(e.target.value),
                        });
                        clearError("bic");
                      }}
                      placeholder="z. B. COBADEFFXXX"
                      className={getInputClassName(!!errors.bic)}
                    />
                    {errors.bic && (
                      <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                        {errors.bic}
                      </p>
                    )}
                  </div>
                </div>
              </section>
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-zinc-200 pt-6 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <Link
                  href="/admin/mandanten/neu/ansprechpartner"
                  className={buttonSecondaryClassName}
                >
                  Zurück
                </Link>
                <Link href="/admin" className={buttonSecondaryClassName}>
                  Abbrechen
                </Link>
              </div>
              <button
                type="button"
                onClick={handleWeiter}
                className="inline-flex h-11 items-center justify-center rounded-lg bg-zinc-900 px-6 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Weiter
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
