"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  getDialCodeByLand,
  LAENDER_OPTIONS,
  MANDANT_STATUS_OPTIONS,
  RECHTSFORM_OPTIONS,
  validateEmail,
  type LandCode,
  type MandantStatusCode,
  useMandantenOnboarding,
} from "./mandanten-onboarding-context";
import { PhoneInput } from "./phone-input";

const TOTAL_STEPS = 6;
const CURRENT_STEP = 1;

type Step1Errors = {
  status?: string;
  firmenname?: string;
  rechtsform?: string;
  strasse?: string;
  postleitzahl?: string;
  ort?: string;
  land?: string;
  email?: string;
};

const inputClassName =
  "w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500";

function getInputClassName(hasError: boolean) {
  return hasError
    ? `${inputClassName} border-red-300 focus:border-red-400 focus:ring-red-500/10 dark:border-red-800 dark:focus:border-red-700 dark:focus:ring-red-500/20`
    : `${inputClassName} border-zinc-200 focus:border-zinc-400 focus:ring-zinc-900/10 dark:border-zinc-700 dark:focus:border-zinc-600 dark:focus:ring-zinc-50/10`;
}

function validateStep1(
  data: ReturnType<typeof useMandantenOnboarding>["data"],
): Step1Errors {
  const errors: Step1Errors = {};
  const unternehmen = data.unternehmensdaten;

  if (!data.status) {
    errors.status = "Bitte wählen Sie einen Status.";
  }

  if (!unternehmen.firmenname.trim()) {
    errors.firmenname = "Bitte geben Sie einen Firmennamen an.";
  }
  if (!unternehmen.rechtsform.trim()) {
    errors.rechtsform = "Bitte geben Sie eine Rechtsform an.";
  }
  if (!unternehmen.strasse.trim()) {
    errors.strasse = "Bitte geben Sie Straße und Hausnummer an.";
  }
  if (!unternehmen.postleitzahl.trim()) {
    errors.postleitzahl = "Bitte geben Sie eine Postleitzahl an.";
  }
  if (!unternehmen.ort.trim()) {
    errors.ort = "Bitte geben Sie einen Ort an.";
  }
  if (!unternehmen.land.trim()) {
    errors.land = "Bitte geben Sie ein Land an.";
  }

  const emailError = validateEmail(unternehmen.email, { required: false });
  if (emailError) {
    errors.email = emailError;
  }

  return errors;
}

export default function NeuerMandantPage() {
  const router = useRouter();
  const { data, updateMandantStatus, updateUnternehmensdaten } =
    useMandantenOnboarding();
  const unternehmen = data.unternehmensdaten;
  const [errors, setErrors] = useState<Step1Errors>({});

  function clearError(field: keyof Step1Errors) {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function handleFieldChange(field: keyof Step1Errors, value: string) {
    updateUnternehmensdaten({ [field]: value });
    clearError(field);
  }

  function handleLandChange(code: LandCode) {
    updateUnternehmensdaten({
      land: code,
      telefonVorwahl: getDialCodeByLand(code),
    });
    clearError("land");
  }

  function handleWeiter() {
    const validationErrors = validateStep1(data);

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    router.push("/admin/mandanten/neu/ansprechpartner");
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
              Schritt 1 von 6 – Unternehmensdaten
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
            <div className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label
                    htmlFor="status"
                    className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    Status
                  </label>
                  <select
                    id="status"
                    name="status"
                    value={data.status}
                    onChange={(e) => {
                      updateMandantStatus(e.target.value as MandantStatusCode);
                      clearError("status");
                    }}
                    className={getInputClassName(!!errors.status)}
                  >
                    {MANDANT_STATUS_OPTIONS.map((option) => (
                      <option key={option.code} value={option.code}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {errors.status && (
                    <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                      {errors.status}
                    </p>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="firmenname"
                    className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    Firmenname
                  </label>
                  <input
                    id="firmenname"
                    name="firmenname"
                    type="text"
                    value={unternehmen.firmenname}
                    onChange={(e) =>
                      handleFieldChange("firmenname", e.target.value)
                    }
                    placeholder="z. B. Muster GmbH"
                    className={getInputClassName(!!errors.firmenname)}
                  />
                  {errors.firmenname && (
                    <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                      {errors.firmenname}
                    </p>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="rechtsform"
                    className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    Rechtsform
                  </label>
                  <select
                    id="rechtsform"
                    name="rechtsform"
                    value={unternehmen.rechtsform}
                    onChange={(e) =>
                      handleFieldChange("rechtsform", e.target.value)
                    }
                    className={getInputClassName(!!errors.rechtsform)}
                  >
                    <option value="">Bitte wählen …</option>
                    {RECHTSFORM_OPTIONS.map((rechtsform) => (
                      <option key={rechtsform} value={rechtsform}>
                        {rechtsform}
                      </option>
                    ))}
                  </select>
                  {errors.rechtsform && (
                    <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                      {errors.rechtsform}
                    </p>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="strasse"
                    className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    Straße und Hausnummer
                  </label>
                  <input
                    id="strasse"
                    name="strasse"
                    type="text"
                    value={unternehmen.strasse}
                    onChange={(e) =>
                      handleFieldChange("strasse", e.target.value)
                    }
                    placeholder="z. B. Musterstraße 12"
                    className={getInputClassName(!!errors.strasse)}
                  />
                  {errors.strasse && (
                    <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                      {errors.strasse}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="postleitzahl"
                    className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    Postleitzahl
                  </label>
                  <input
                    id="postleitzahl"
                    name="postleitzahl"
                    type="text"
                    value={unternehmen.postleitzahl}
                    onChange={(e) =>
                      handleFieldChange("postleitzahl", e.target.value)
                    }
                    placeholder="z. B. 10115"
                    className={getInputClassName(!!errors.postleitzahl)}
                  />
                  {errors.postleitzahl && (
                    <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                      {errors.postleitzahl}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="ort"
                    className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    Ort
                  </label>
                  <input
                    id="ort"
                    name="ort"
                    type="text"
                    value={unternehmen.ort}
                    onChange={(e) => handleFieldChange("ort", e.target.value)}
                    placeholder="z. B. Berlin"
                    className={getInputClassName(!!errors.ort)}
                  />
                  {errors.ort && (
                    <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                      {errors.ort}
                    </p>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="land"
                    className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    Land
                  </label>
                  <select
                    id="land"
                    name="land"
                    value={unternehmen.land}
                    onChange={(e) =>
                      handleLandChange(e.target.value as LandCode)
                    }
                    className={getInputClassName(!!errors.land)}
                  >
                    {LAENDER_OPTIONS.map((land) => (
                      <option key={land.code} value={land.code}>
                        {land.flag} {land.label}
                      </option>
                    ))}
                  </select>
                  {errors.land && (
                    <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                      {errors.land}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="website"
                    className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    Website
                  </label>
                  <input
                    id="website"
                    name="website"
                    type="text"
                    value={unternehmen.website}
                    onChange={(e) =>
                      updateUnternehmensdaten({ website: e.target.value })
                    }
                    placeholder="z. B. https://www.muster.de"
                    className={getInputClassName(false)}
                  />
                </div>

                <div>
                  <PhoneInput
                    id="telefon"
                    label="Telefon"
                    vorwahl={unternehmen.telefonVorwahl}
                    nummer={unternehmen.telefonNummer}
                    onVorwahlChange={(value) =>
                      updateUnternehmensdaten({ telefonVorwahl: value })
                    }
                    onNummerChange={(value) =>
                      updateUnternehmensdaten({ telefonNummer: value })
                    }
                  />
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="email"
                    className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    Allgemeine E-Mail-Adresse
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={unternehmen.email}
                    onChange={(e) =>
                      handleFieldChange("email", e.target.value)
                    }
                    placeholder="z. B. info@muster.de"
                    className={getInputClassName(!!errors.email)}
                  />
                  {errors.email && (
                    <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                      {errors.email}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-zinc-200 pt-6 dark:border-zinc-800">
              <Link
                href="/admin"
                className="inline-flex h-11 items-center justify-center rounded-lg border border-zinc-200 px-6 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Abbrechen
              </Link>
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
