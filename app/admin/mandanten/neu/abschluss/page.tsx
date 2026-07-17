"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  calculateMonthlyPrices,
  displayTelefon,
  displayValue,
  formatCurrencyFromCents,
  formatDate,
  formatList,
  getLandLabel,
  getMandantStatusLabel,
  isBankverbindungComplete,
  useMandantenOnboarding,
} from "../mandanten-onboarding-context";
import {
  CreateMandantError,
  createMandant,
} from "@/lib/mandanten/create-mandant";

const TOTAL_STEPS = 6;
const CURRENT_STEP = 6;

const buttonSecondaryClassName =
  "inline-flex h-11 items-center justify-center rounded-lg border border-zinc-200 px-6 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800";

function formatPersonName(vorname: string, nachname: string) {
  const fullName = `${vorname.trim()} ${nachname.trim()}`.trim();
  return fullName || "Nicht angegeben";
}

export default function AbschlussPage() {
  const router = useRouter();
  const { data, updateBestaetigung } = useMandantenOnboarding();
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const summarySections = useMemo(() => {
    const unternehmen = data.unternehmensdaten;
    const gf = data.geschaeftsfuehrer;
    const ap = data.hauptansprechpartner;
    const steuer = data.steuerdaten;
    const bank = data.bankverbindung;
    const moduleUndPreise = data.moduleUndPreise;
    const automatisierungen = data.automatisierungen;

    const adresse = [
      unternehmen.strasse,
      [unternehmen.postleitzahl, unternehmen.ort].filter(Boolean).join(" "),
      getLandLabel(unternehmen.land),
    ]
      .filter((part) => part.trim())
      .join(", ");

    const hauptansprechpartnerName = ap.gleicherWieGeschaeftsfuehrer
      ? `${formatPersonName(gf.vorname, gf.nachname)} (Geschäftsführer)`
      : formatPersonName(ap.vorname, ap.nachname);

    const hauptansprechpartnerPosition = ap.gleicherWieGeschaeftsfuehrer
      ? "Geschäftsführer"
      : displayValue(ap.position);

    const prices = calculateMonthlyPrices(
      moduleUndPreise.monatlicherGrundpreis,
      moduleUndPreise.rabattInProzent,
    );

    const steuerItems = [
      {
        label: "Steuernummer",
        value: displayValue(steuer.steuernummer),
      },
      {
        label: "Umsatzsteuer-ID",
        value: displayValue(steuer.umsatzsteuerId),
      },
      {
        label: "Handelsregisternummer",
        value: displayValue(steuer.handelsregisternummer),
      },
      {
        label: "Registergericht",
        value: displayValue(steuer.registergericht),
      },
    ];

    const bankItems = isBankverbindungComplete(bank)
      ? [
          {
            label: "Kontoinhaber",
            value: displayValue(bank.kontoinhaber),
          },
          { label: "Bankname", value: displayValue(bank.bankname) },
          { label: "IBAN", value: displayValue(bank.iban) },
          { label: "BIC", value: displayValue(bank.bic) },
        ]
      : [];

    return [
      {
        title: "Mandant",
        items: [
          { label: "Status", value: getMandantStatusLabel(data.status) },
        ],
      },
      {
        title: "Unternehmensdaten",
        items: [
          { label: "Firmenname", value: displayValue(unternehmen.firmenname) },
          { label: "Rechtsform", value: displayValue(unternehmen.rechtsform) },
          { label: "Adresse", value: displayValue(adresse) },
          { label: "Website", value: displayValue(unternehmen.website) },
          { label: "Telefon", value: displayTelefon(unternehmen.telefonVorwahl, unternehmen.telefonNummer) },
          { label: "E-Mail", value: displayValue(unternehmen.email) },
        ],
      },
      {
        title: "Geschäftsführer und Ansprechpartner",
        items: [
          {
            label: "Geschäftsführer",
            value: formatPersonName(gf.vorname, gf.nachname),
          },
          {
            label: "E-Mail Geschäftsführer",
            value: displayValue(gf.email),
          },
          {
            label: "Telefon Geschäftsführer",
            value: displayTelefon(gf.telefonVorwahl, gf.telefonNummer),
          },
          {
            label: "Hauptansprechpartner",
            value: hauptansprechpartnerName,
          },
          {
            label: "Position",
            value: hauptansprechpartnerPosition,
          },
          {
            label: "E-Mail Hauptansprechpartner",
            value: ap.gleicherWieGeschaeftsfuehrer
              ? displayValue(gf.email)
              : displayValue(ap.email),
          },
          {
            label: "Telefon Hauptansprechpartner",
            value: ap.gleicherWieGeschaeftsfuehrer
              ? displayTelefon(gf.telefonVorwahl, gf.telefonNummer)
              : displayTelefon(ap.telefonVorwahl, ap.telefonNummer),
          },
        ],
      },
      {
        title: "Bank- und Steuerdaten",
        items: [...steuerItems, ...bankItems],
      },
      {
        title: "Ausgewählte Module",
        items: [
          {
            label: "Module",
            value: formatList(moduleUndPreise.ausgewaehlteModule),
          },
        ],
      },
      {
        title: "Preise und Vertragsdaten",
        items: [
          {
            label: "Einrichtungsgebühr",
            value: displayValue(moduleUndPreise.einrichtungsgebuehr),
          },
          {
            label: "Monatlicher Grundpreis",
            value: displayValue(moduleUndPreise.monatlicherGrundpreis),
          },
          {
            label: "Rabatt",
            value: moduleUndPreise.rabattInProzent.trim()
              ? `${moduleUndPreise.rabattInProzent.trim()} %`
              : "Nicht angegeben",
          },
          {
            label: "Monatspreis nach Rabatt",
            value:
              prices.nachRabattCents !== null
                ? formatCurrencyFromCents(prices.nachRabattCents)
                : "Nicht angegeben",
          },
          {
            label: "Vertragslaufzeit",
            value: moduleUndPreise.vertragslaufzeit.trim()
              ? `${moduleUndPreise.vertragslaufzeit.trim()} Monate`
              : "Nicht angegeben",
          },
          {
            label: "Abrechnungsbeginn",
            value: formatDate(moduleUndPreise.abrechnungsbeginn),
          },
        ],
      },
      {
        title: "Ausgewählte Automatisierungen",
        items: [
          {
            label: "Automatisierungen",
            value: formatList(
              automatisierungen.ausgewaehlteAutomatisierungen,
            ),
          },
        ],
      },
      {
        title: "Individuelle Automatisierungswünsche",
        items: [
          {
            label: "Wünsche",
            value: displayValue(automatisierungen.individuelleWuensche),
          },
        ],
      },
    ];
  }, [data]);

  async function handleCreateTenant() {
    if (isSaving) return;

    setSaveError(null);
    setIsSaving(true);

    try {
      const { mandantenId } = await createMandant(data);
      router.push(`/admin/mandanten/${mandantenId}?created=true`);
    } catch (error) {
      console.error("[Abschluss] Mandantenanlage fehlgeschlagen:", error);

      const message =
        error instanceof CreateMandantError
          ? error.message
          : "Der Mandant konnte nicht angelegt werden. Bitte versuchen Sie es erneut.";

      setSaveError(message);
      setIsSaving(false);
    }
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
              Schritt 6 von 6 – Prüfen und anlegen
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

          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Zusammenfassung Ihrer Eingaben aus allen sechs Schritten. Die
              dauerhafte Speicherung in Supabase folgt als Nächstes.
            </p>
          </div>

          <div className="mt-6 space-y-4">
            {summarySections.map((section) => (
              <section
                key={section.title}
                className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                  {section.title}
                </h3>
                <dl className="mt-4 space-y-3">
                  {section.items.map((item) => (
                    <div key={item.label}>
                      <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        {item.label}
                      </dt>
                      <dd className="mt-0.5 text-sm text-zinc-900 dark:text-zinc-50">
                        {item.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>

          <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={data.bestaetigung.angabenGeprueft}
                onChange={(e) =>
                  updateBestaetigung({ angabenGeprueft: e.target.checked })
                }
                className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900/10 dark:border-zinc-600 dark:bg-zinc-950"
              />
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Ich habe die Angaben geprüft und bestätige die Anlage des
                Mandanten.
              </span>
            </label>

            {saveError && (
              <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
                {saveError}
              </p>
            )}

            <div className="mt-6 flex items-center justify-between border-t border-zinc-200 pt-6 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <Link
                  href="/admin/mandanten/neu/automatisierungen"
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
                onClick={handleCreateTenant}
                disabled={!data.bestaetigung.angabenGeprueft || isSaving}
                className="inline-flex h-11 items-center justify-center rounded-lg bg-zinc-900 px-6 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:disabled:opacity-50"
              >
                {isSaving ? "Mandant wird angelegt …" : "Mandanten anlegen"}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
