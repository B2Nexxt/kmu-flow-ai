"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  useMandantenOnboarding,
  validateEmail,
} from "../mandanten-onboarding-context";
import { PhoneInput } from "../phone-input";

const TOTAL_STEPS = 6;
const CURRENT_STEP = 2;

type AnsprechpartnerErrors = {
  gfVorname?: string;
  gfNachname?: string;
  gfEmail?: string;
  gfTelefon?: string;
  vorname?: string;
  nachname?: string;
  position?: string;
  email?: string;
  telefon?: string;
};

const inputClassName =
  "w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500";

function getInputClassName(hasError: boolean) {
  return hasError
    ? `${inputClassName} border-red-300 focus:border-red-400 focus:ring-red-500/10 dark:border-red-800 dark:focus:border-red-700 dark:focus:ring-red-500/20`
    : `${inputClassName} border-zinc-200 focus:border-zinc-400 focus:ring-zinc-900/10 dark:border-zinc-700 dark:focus:border-zinc-600 dark:focus:ring-zinc-50/10`;
}

const buttonSecondaryClassName =
  "inline-flex h-11 items-center justify-center rounded-lg border border-zinc-200 px-6 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800";

function validateAnsprechpartner(
  gf: ReturnType<typeof useMandantenOnboarding>["data"]["geschaeftsfuehrer"],
  ap: ReturnType<typeof useMandantenOnboarding>["data"]["hauptansprechpartner"],
): AnsprechpartnerErrors {
  const errors: AnsprechpartnerErrors = {};

  if (ap.gleicherWieGeschaeftsfuehrer) {
    if (!gf.vorname.trim()) {
      errors.gfVorname = "Bitte geben Sie einen Vornamen an.";
    }
    if (!gf.nachname.trim()) {
      errors.gfNachname = "Bitte geben Sie einen Nachnamen an.";
    }

    const gfEmailError = validateEmail(gf.email, { required: true });
    if (gfEmailError) {
      errors.gfEmail = gfEmailError;
    }

    if (!gf.telefonVorwahl.trim() || !gf.telefonNummer.trim()) {
      errors.gfTelefon = "Bitte geben Sie Vorwahl und Telefonnummer an.";
    }

    return errors;
  }

  const gfEmailError = validateEmail(gf.email, { required: false });
  if (gfEmailError) {
    errors.gfEmail = gfEmailError;
  }

  if (!ap.vorname.trim()) {
    errors.vorname = "Bitte geben Sie einen Vornamen an.";
  }
  if (!ap.nachname.trim()) {
    errors.nachname = "Bitte geben Sie einen Nachnamen an.";
  }
  if (!ap.position.trim()) {
    errors.position = "Bitte geben Sie eine Position an.";
  }

  const apEmailError = validateEmail(ap.email, { required: true });
  if (apEmailError) {
    errors.email = apEmailError;
  }

  if (!ap.telefonVorwahl.trim() || !ap.telefonNummer.trim()) {
    errors.telefon = "Bitte geben Sie Vorwahl und Telefonnummer an.";
  }

  return errors;
}

export default function AnsprechpartnerPage() {
  const router = useRouter();
  const {
    data,
    updateGeschaeftsfuehrer,
    updateHauptansprechpartner,
  } = useMandantenOnboarding();
  const [errors, setErrors] = useState<AnsprechpartnerErrors>({});

  const gf = data.geschaeftsfuehrer;
  const ap = data.hauptansprechpartner;
  const gleicherAnsprechpartner = ap.gleicherWieGeschaeftsfuehrer;

  function clearError(field: keyof AnsprechpartnerErrors) {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function handleAnsprechpartnerChange(
    field: Exclude<
      keyof AnsprechpartnerErrors,
      "gfVorname" | "gfNachname" | "gfEmail" | "gfTelefon" | "telefon"
    >,
    value: string,
  ) {
    updateHauptansprechpartner({ [field]: value });
    clearError(field);
  }

  function handleGleicherAnsprechpartnerChange(checked: boolean) {
    if (checked) {
      updateHauptansprechpartner({
        gleicherWieGeschaeftsfuehrer: true,
        position: "Geschäftsführer",
      });
      setErrors((prev) => {
        const next = { ...prev };
        delete next.vorname;
        delete next.nachname;
        delete next.position;
        delete next.email;
        delete next.telefon;
        return next;
      });
      return;
    }

    updateHauptansprechpartner({ gleicherWieGeschaeftsfuehrer: false });
    setErrors((prev) => {
      const next = { ...prev };
      delete next.gfVorname;
      delete next.gfNachname;
      delete next.gfEmail;
      delete next.gfTelefon;
      return next;
    });
  }

  function handleWeiter() {
    const validationErrors = validateAnsprechpartner(gf, ap);

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    router.push("/admin/mandanten/neu/finanzen");
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
              Schritt 2 von 6 – Geschäftsführer und Ansprechpartner
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
            <div className="space-y-8">
              <section>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  Geschäftsführer
                </h3>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {gleicherAnsprechpartner
                    ? "Pflichtfeld – der Geschäftsführer wird als Hauptansprechpartner verwendet."
                    : "Optional – kann später ergänzt werden."}
                </p>
                <div className="mt-4 grid gap-5 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="gf-vorname"
                      className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                    >
                      Vorname
                    </label>
                    <input
                      id="gf-vorname"
                      name="gf-vorname"
                      type="text"
                      value={gf.vorname}
                      onChange={(e) => {
                        updateGeschaeftsfuehrer({ vorname: e.target.value });
                        clearError("gfVorname");
                      }}
                      placeholder="z. B. Max"
                      className={getInputClassName(!!errors.gfVorname)}
                    />
                    {errors.gfVorname && (
                      <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                        {errors.gfVorname}
                      </p>
                    )}
                  </div>
                  <div>
                    <label
                      htmlFor="gf-nachname"
                      className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                    >
                      Nachname
                    </label>
                    <input
                      id="gf-nachname"
                      name="gf-nachname"
                      type="text"
                      value={gf.nachname}
                      onChange={(e) => {
                        updateGeschaeftsfuehrer({ nachname: e.target.value });
                        clearError("gfNachname");
                      }}
                      placeholder="z. B. Mustermann"
                      className={getInputClassName(!!errors.gfNachname)}
                    />
                    {errors.gfNachname && (
                      <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                        {errors.gfNachname}
                      </p>
                    )}
                  </div>
                  <div>
                    <label
                      htmlFor="gf-email"
                      className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                    >
                      E-Mail
                    </label>
                    <input
                      id="gf-email"
                      name="gf-email"
                      type="email"
                      value={gf.email}
                      onChange={(e) => {
                        updateGeschaeftsfuehrer({ email: e.target.value });
                        clearError("gfEmail");
                      }}
                      placeholder="z. B. max.mustermann@muster.de"
                      className={getInputClassName(!!errors.gfEmail)}
                    />
                    {errors.gfEmail && (
                      <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                        {errors.gfEmail}
                      </p>
                    )}
                  </div>
                  <div>
                    <PhoneInput
                      id="gf-telefon"
                      label="Telefon"
                      vorwahl={gf.telefonVorwahl}
                      nummer={gf.telefonNummer}
                      onVorwahlChange={(value) => {
                        updateGeschaeftsfuehrer({ telefonVorwahl: value });
                        clearError("gfTelefon");
                      }}
                      onNummerChange={(value) => {
                        updateGeschaeftsfuehrer({ telefonNummer: value });
                        clearError("gfTelefon");
                      }}
                      hasError={!!errors.gfTelefon}
                      errorMessage={errors.gfTelefon}
                    />
                  </div>
                </div>
              </section>

              <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
                <input
                  id="gleicher-ansprechpartner"
                  name="gleicher-ansprechpartner"
                  type="checkbox"
                  checked={gleicherAnsprechpartner}
                  onChange={(e) =>
                    handleGleicherAnsprechpartnerChange(e.target.checked)
                  }
                  className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900/10 dark:border-zinc-600 dark:bg-zinc-950"
                />
                <label
                  htmlFor="gleicher-ansprechpartner"
                  className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Geschäftsführer ist auch Hauptansprechpartner
                </label>
              </div>

              <section>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  Hauptansprechpartner
                </h3>
                {gleicherAnsprechpartner && (
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    Die Daten des Geschäftsführers werden automatisch verwendet.
                    Position: Geschäftsführer.
                  </p>
                )}
                <div
                  className={`mt-4 grid gap-5 sm:grid-cols-2 ${
                    gleicherAnsprechpartner ? "opacity-60" : ""
                  }`}
                >
                  <div>
                    <label
                      htmlFor="ap-vorname"
                      className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                    >
                      Vorname
                    </label>
                    <input
                      id="ap-vorname"
                      name="ap-vorname"
                      type="text"
                      value={ap.vorname}
                      onChange={(e) =>
                        handleAnsprechpartnerChange("vorname", e.target.value)
                      }
                      disabled={gleicherAnsprechpartner}
                      placeholder="z. B. Anna"
                      className={getInputClassName(!!errors.vorname)}
                    />
                    {errors.vorname && (
                      <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                        {errors.vorname}
                      </p>
                    )}
                  </div>
                  <div>
                    <label
                      htmlFor="ap-nachname"
                      className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                    >
                      Nachname
                    </label>
                    <input
                      id="ap-nachname"
                      name="ap-nachname"
                      type="text"
                      value={ap.nachname}
                      onChange={(e) =>
                        handleAnsprechpartnerChange("nachname", e.target.value)
                      }
                      disabled={gleicherAnsprechpartner}
                      placeholder="z. B. Beispiel"
                      className={getInputClassName(!!errors.nachname)}
                    />
                    {errors.nachname && (
                      <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                        {errors.nachname}
                      </p>
                    )}
                  </div>
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="ap-position"
                      className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                    >
                      Position
                    </label>
                    <input
                      id="ap-position"
                      name="ap-position"
                      type="text"
                      value={gleicherAnsprechpartner ? "Geschäftsführer" : ap.position}
                      onChange={(e) =>
                        handleAnsprechpartnerChange("position", e.target.value)
                      }
                      disabled={gleicherAnsprechpartner}
                      placeholder="z. B. Geschäftsführerin"
                      className={getInputClassName(!!errors.position)}
                    />
                    {errors.position && (
                      <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                        {errors.position}
                      </p>
                    )}
                  </div>
                  <div>
                    <label
                      htmlFor="ap-email"
                      className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                    >
                      E-Mail
                    </label>
                    <input
                      id="ap-email"
                      name="ap-email"
                      type="email"
                      value={ap.email}
                      onChange={(e) =>
                        handleAnsprechpartnerChange("email", e.target.value)
                      }
                      disabled={gleicherAnsprechpartner}
                      placeholder="z. B. anna.beispiel@muster.de"
                      className={getInputClassName(!!errors.email)}
                    />
                    {errors.email && (
                      <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                        {errors.email}
                      </p>
                    )}
                  </div>
                  <div>
                    <PhoneInput
                      id="ap-telefon"
                      label="Telefon"
                      vorwahl={ap.telefonVorwahl}
                      nummer={ap.telefonNummer}
                      onVorwahlChange={(value) => {
                        if (gleicherAnsprechpartner) return;
                        updateHauptansprechpartner({ telefonVorwahl: value });
                        clearError("telefon");
                      }}
                      onNummerChange={(value) => {
                        if (gleicherAnsprechpartner) return;
                        updateHauptansprechpartner({ telefonNummer: value });
                        clearError("telefon");
                      }}
                      disabled={gleicherAnsprechpartner}
                      hasError={!!errors.telefon}
                      errorMessage={errors.telefon}
                    />
                  </div>
                </div>
              </section>
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-zinc-200 pt-6 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <Link href="/admin/mandanten/neu" className={buttonSecondaryClassName}>
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
