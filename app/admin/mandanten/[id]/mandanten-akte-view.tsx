"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MANDANT_STATUS } from "@/lib/mandanten/mandant-status";
import type { MandantAkte } from "@/lib/mandanten/get-mandant-akte";
import { formatContactName } from "@/lib/mandanten/get-mandant-akte";

const SUCCESS_MESSAGE = "Mandant wurde erfolgreich angelegt.";
const AUTO_DISMISS_MS = 6000;

const placeholderSections = [
  "Unternehmen und Standorte",
  "Ansprechpartner",
  "Verträge",
  "Rechnungen",
  "Dokumente",
  "Automatisierungen",
] as const;

type MandantenAkteViewProps = {
  akte: MandantAkte;
  showCreatedInitially: boolean;
};

function formatList(values: string[]) {
  return values.length > 0 ? values.join(", ") : "Nicht angegeben";
}

export function MandantenAkteView({
  akte,
  showCreatedInitially,
}: MandantenAkteViewProps) {
  const router = useRouter();
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  const isInteressent = akte.status === MANDANT_STATUS.INTERESSENT;
  const hauptansprechpartnerLabel = formatContactName(akte.hauptansprechpartner);
  const geschaeftsfuehrerLabel = formatContactName(akte.geschaeftsfuehrer);

  useEffect(() => {
    if (!showCreatedInitially) return;

    setShowSuccessMessage(true);
    router.replace(`/admin/mandanten/${akte.id}`, { scroll: false });
  }, [akte.id, router, showCreatedInitially]);

  useEffect(() => {
    if (!showSuccessMessage) return;

    const timer = window.setTimeout(() => {
      setShowSuccessMessage(false);
    }, AUTO_DISMISS_MS);

    return () => window.clearTimeout(timer);
  }, [showSuccessMessage]);

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
        <div className="mx-auto max-w-5xl">
          {showSuccessMessage && (
            <div
              role="status"
              className="mb-6 flex items-start justify-between gap-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 dark:border-green-900 dark:bg-green-950"
            >
              <p className="text-sm font-medium text-green-700 dark:text-green-300">
                {SUCCESS_MESSAGE}
              </p>
              <button
                type="button"
                onClick={() => setShowSuccessMessage(false)}
                className="shrink-0 text-sm font-medium text-green-700 transition-colors hover:text-green-900 dark:text-green-300 dark:hover:text-green-100"
                aria-label="Erfolgsmeldung schließen"
              >
                Schließen
              </button>
            </div>
          )}

          <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                Mandanten-ID: {akte.id}
              </p>
              <h2 className="mt-1 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                Mandantenakte
              </h2>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${
                    isInteressent
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                      : "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                  }`}
                >
                  {akte.statusLabel}
                </span>
                <p className="text-zinc-500 dark:text-zinc-400">
                  {akte.firmenname}
                </p>
              </div>
            </div>
            <Link
              href="/admin"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-zinc-200 px-6 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Zurück zum Dashboard
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Firmenname
              </p>
              <p className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                {akte.firmenname}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Status
              </p>
              <p className="mt-2">
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-sm font-semibold ${
                    isInteressent
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                      : "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                  }`}
                >
                  {akte.statusLabel}
                </span>
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Hauptansprechpartner
              </p>
              <p className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                {hauptansprechpartnerLabel}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Module
              </p>
              <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                {formatList(akte.module)}
              </p>
            </div>
          </div>

          <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Stammdaten
            </h3>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Rechtsform
                </dt>
                <dd className="mt-0.5 text-sm text-zinc-900 dark:text-zinc-50">
                  {akte.rechtsform}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Adresse
                </dt>
                <dd className="mt-0.5 text-sm text-zinc-900 dark:text-zinc-50">
                  {akte.adresse}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Geschäftsführer
                </dt>
                <dd className="mt-0.5 text-sm text-zinc-900 dark:text-zinc-50">
                  {geschaeftsfuehrerLabel}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Automatisierungen
                </dt>
                <dd className="mt-0.5 text-sm text-zinc-900 dark:text-zinc-50">
                  {formatList(akte.automatisierungen)}
                </dd>
              </div>
              {akte.bankverbindung && (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Bankverbindung
                  </dt>
                  <dd className="mt-0.5 text-sm text-zinc-900 dark:text-zinc-50">
                    {akte.bankverbindung.kontoinhaber} ·{" "}
                    {akte.bankverbindung.bankname} · IBAN{" "}
                    {akte.bankverbindung.iban} · BIC {akte.bankverbindung.bic}
                  </dd>
                </div>
              )}
            </dl>
          </section>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {placeholderSections.map((title) => (
              <section
                key={title}
                className="rounded-lg border border-dashed border-zinc-300 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900"
              >
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                  {title}
                </h3>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                  Dieser Bereich wird in einer späteren Ausbaustufe ergänzt.
                </p>
              </section>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
