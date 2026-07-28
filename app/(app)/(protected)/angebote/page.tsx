"use client";

import { useState } from "react";

type Steuersatz = 19 | 7 | 0;

type Position = {
  id: string;
  leistung: string;
  menge: string;
  einzelpreis: string;
  umsatzsteuer: Steuersatz;
};

type PositionErrors = {
  leistung?: string;
  menge?: string;
  einzelpreis?: string;
};

type FormErrors = {
  kunde?: string;
  positionen?: Record<string, PositionErrors>;
};

type PositionAmounts = {
  nettoCents: number | null;
  ustCents: number | null;
  bruttoCents: number | null;
};

type OfferTotals = {
  nettoCents: number;
  ustCents: number;
  bruttoCents: number;
};

const STEUERSATZ_OPTIONS: Steuersatz[] = [19, 7, 0];

function createEmptyPosition(): Position {
  return {
    id: crypto.randomUUID(),
    leistung: "",
    menge: "",
    einzelpreis: "",
    umsatzsteuer: 19,
  };
}

function displayValue(value: string) {
  return value.trim() || "Nicht angegeben";
}

function parseNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const cleaned = trimmed.replace(/[€\s]/g, "");

  if (cleaned.includes(",")) {
    const normalized = cleaned.replace(/\./g, "").replace(",", ".");
    const num = Number(normalized);
    return Number.isNaN(num) ? null : num;
  }

  const num = Number(cleaned);
  return Number.isNaN(num) ? null : num;
}

function calculatePositionAmounts(
  menge: string,
  einzelpreis: string,
  steuersatz: Steuersatz,
): PositionAmounts {
  const parsedMenge = parseNumber(menge);
  const parsedEinzelpreis = parseNumber(einzelpreis);

  if (
    parsedMenge === null ||
    parsedEinzelpreis === null ||
    parsedMenge <= 0 ||
    parsedEinzelpreis < 0
  ) {
    return { nettoCents: null, ustCents: null, bruttoCents: null };
  }

  const nettoCents = Math.round(parsedMenge * parsedEinzelpreis * 100);
  const ustCents = Math.round((nettoCents * steuersatz) / 100);
  const bruttoCents = nettoCents + ustCents;

  return { nettoCents, ustCents, bruttoCents };
}

function calculateOfferTotals(positionen: Position[]): OfferTotals {
  return positionen.reduce(
    (totals, position) => {
      const amounts = calculatePositionAmounts(
        position.menge,
        position.einzelpreis,
        position.umsatzsteuer,
      );

      if (amounts.nettoCents !== null) {
        totals.nettoCents += amounts.nettoCents;
        totals.ustCents += amounts.ustCents ?? 0;
        totals.bruttoCents += amounts.bruttoCents ?? 0;
      }

      return totals;
    },
    { nettoCents: 0, ustCents: 0, bruttoCents: 0 },
  );
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function formatCurrencyFromCents(cents: number): string {
  return formatCurrency(cents / 100);
}

function formatSteuersatz(steuersatz: Steuersatz): string {
  return `${steuersatz} %`;
}

function validateForm(kunde: string, positionen: Position[]): FormErrors {
  const errors: FormErrors = {};

  if (!kunde.trim()) {
    errors.kunde = "Bitte geben Sie einen Kunden an.";
  }

  const positionErrors: Record<string, PositionErrors> = {};

  for (const position of positionen) {
    const fieldErrors: PositionErrors = {};

    if (!position.leistung.trim()) {
      fieldErrors.leistung = "Bitte geben Sie eine Leistung an.";
    }

    if (!position.menge.trim()) {
      fieldErrors.menge = "Bitte geben Sie eine Menge an.";
    } else {
      const parsedMenge = parseNumber(position.menge);
      if (parsedMenge === null) {
        fieldErrors.menge = "Bitte geben Sie eine gültige Menge an.";
      } else if (parsedMenge <= 0) {
        fieldErrors.menge = "Die Menge muss größer als 0 sein.";
      }
    }

    if (!position.einzelpreis.trim()) {
      fieldErrors.einzelpreis = "Bitte geben Sie einen Einzelpreis an.";
    } else {
      const parsedEinzelpreis = parseNumber(position.einzelpreis);
      if (parsedEinzelpreis !== null && parsedEinzelpreis < 0) {
        fieldErrors.einzelpreis = "Der Einzelpreis darf nicht negativ sein.";
      }
    }

    if (Object.keys(fieldErrors).length > 0) {
      positionErrors[position.id] = fieldErrors;
    }
  }

  if (Object.keys(positionErrors).length > 0) {
    errors.positionen = positionErrors;
  }

  return errors;
}

function hasFormErrors(errors: FormErrors): boolean {
  return (
    !!errors.kunde ||
    !!(errors.positionen && Object.keys(errors.positionen).length > 0)
  );
}

const inputClassName =
  "w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500";

function getInputClassName(hasError: boolean) {
  return hasError
    ? `${inputClassName} border-red-300 focus:border-red-400 focus:ring-red-500/10 dark:border-red-800 dark:focus:border-red-700 dark:focus:ring-red-500/20`
    : `${inputClassName} border-zinc-200 focus:border-zinc-400 focus:ring-zinc-900/10 dark:border-zinc-700 dark:focus:border-zinc-600 dark:focus:ring-zinc-50/10`;
}

export default function AngebotePage() {
  const [kunde, setKunde] = useState("");
  const [positionen, setPositionen] = useState<Position[]>([
    createEmptyPosition(),
  ]);
  const [beschreibung, setBeschreibung] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [showPreview, setShowPreview] = useState(false);

  const offerTotals = calculateOfferTotals(positionen);

  function clearKundeError() {
    setErrors((prev) => {
      if (!prev.kunde) return prev;
      const next = { ...prev };
      delete next.kunde;
      return next;
    });
  }

  function clearPositionError(
    positionId: string,
    field: keyof PositionErrors,
  ) {
    setErrors((prev) => {
      const positionErrors = prev.positionen?.[positionId];
      if (!positionErrors?.[field]) return prev;

      const nextPositionErrors = { ...prev.positionen };
      const nextFieldErrors = { ...positionErrors };
      delete nextFieldErrors[field];

      if (Object.keys(nextFieldErrors).length === 0) {
        delete nextPositionErrors[positionId];
      } else {
        nextPositionErrors[positionId] = nextFieldErrors;
      }

      const next = { ...prev };
      if (Object.keys(nextPositionErrors).length === 0) {
        delete next.positionen;
      } else {
        next.positionen = nextPositionErrors;
      }

      return next;
    });
  }

  function updatePosition(
    positionId: string,
    field: keyof Omit<Position, "id">,
    value: string | Steuersatz,
  ) {
    setPositionen((prev) =>
      prev.map((position) =>
        position.id === positionId
          ? { ...position, [field]: value }
          : position,
      ),
    );

    if (field !== "umsatzsteuer") {
      clearPositionError(positionId, field);
    }
  }

  function addPosition() {
    setPositionen((prev) => [...prev, createEmptyPosition()]);
  }

  function removePosition(positionId: string) {
    setPositionen((prev) =>
      prev.filter((position) => position.id !== positionId),
    );
    setErrors((prev) => {
      if (!prev.positionen?.[positionId]) return prev;
      const nextPositionErrors = { ...prev.positionen };
      delete nextPositionErrors[positionId];
      const next = { ...prev };
      if (Object.keys(nextPositionErrors).length === 0) {
        delete next.positionen;
      } else {
        next.positionen = nextPositionErrors;
      }
      return next;
    });
  }

  function handleCreateOffer() {
    const validationErrors = validateForm(kunde, positionen);

    if (hasFormErrors(validationErrors)) {
      setErrors(validationErrors);
      setShowPreview(false);
      return;
    }

    setErrors({});
    setShowPreview(true);
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Neues Angebot
        </h1>
        <p className="mt-2 text-zinc-500 dark:text-zinc-400">
          Erstellen Sie ein neues Angebot für Ihren Kunden.
        </p>
      </div>

      <form
        className="max-w-2xl rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
        onSubmit={(e) => e.preventDefault()}
      >
        <div className="space-y-5">
          <div>
            <label
              htmlFor="kunde"
              className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Kunde
            </label>
            <input
              id="kunde"
              name="kunde"
              type="text"
              value={kunde}
              onChange={(e) => {
                setKunde(e.target.value);
                clearKundeError();
              }}
              placeholder="z. B. Muster GmbH"
              className={getInputClassName(!!errors.kunde)}
            />
            {errors.kunde && (
              <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                {errors.kunde}
              </p>
            )}
          </div>

          <div className="space-y-4">
            <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Positionen
            </h2>

            {positionen.map((position, index) => {
              const positionErrors = errors.positionen?.[position.id];
              const amounts = calculatePositionAmounts(
                position.menge,
                position.einzelpreis,
                position.umsatzsteuer,
              );

              return (
                <div
                  key={position.id}
                  className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      Position {index + 1}
                    </h3>
                    {index > 0 && (
                      <button
                        type="button"
                        onClick={() => removePosition(position.id)}
                        className="text-sm font-medium text-zinc-500 transition-colors hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400"
                      >
                        Entfernen
                      </button>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label
                        htmlFor={`leistung-${position.id}`}
                        className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                      >
                        Leistung
                      </label>
                      <input
                        id={`leistung-${position.id}`}
                        type="text"
                        value={position.leistung}
                        onChange={(e) =>
                          updatePosition(
                            position.id,
                            "leistung",
                            e.target.value,
                          )
                        }
                        placeholder="z. B. Website-Relaunch"
                        className={getInputClassName(!!positionErrors?.leistung)}
                      />
                      {positionErrors?.leistung && (
                        <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                          {positionErrors.leistung}
                        </p>
                      )}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor={`menge-${position.id}`}
                          className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                        >
                          Menge
                        </label>
                        <input
                          id={`menge-${position.id}`}
                          type="text"
                          value={position.menge}
                          onChange={(e) =>
                            updatePosition(
                              position.id,
                              "menge",
                              e.target.value,
                            )
                          }
                          placeholder="z. B. 1"
                          className={getInputClassName(!!positionErrors?.menge)}
                        />
                        {positionErrors?.menge && (
                          <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                            {positionErrors.menge}
                          </p>
                        )}
                      </div>

                      <div>
                        <label
                          htmlFor={`einzelpreis-${position.id}`}
                          className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                        >
                          Einzelpreis
                        </label>
                        <input
                          id={`einzelpreis-${position.id}`}
                          type="text"
                          value={position.einzelpreis}
                          onChange={(e) =>
                            updatePosition(
                              position.id,
                              "einzelpreis",
                              e.target.value,
                            )
                          }
                          placeholder="z. B. 1.500,00 €"
                          className={getInputClassName(
                            !!positionErrors?.einzelpreis,
                          )}
                        />
                        {positionErrors?.einzelpreis && (
                          <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                            {positionErrors.einzelpreis}
                          </p>
                        )}
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor={`umsatzsteuer-${position.id}`}
                        className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                      >
                        Umsatzsteuer
                      </label>
                      <select
                        id={`umsatzsteuer-${position.id}`}
                        value={position.umsatzsteuer}
                        onChange={(e) =>
                          updatePosition(
                            position.id,
                            "umsatzsteuer",
                            Number(e.target.value) as Steuersatz,
                          )
                        }
                        className={getInputClassName(false)}
                      >
                        {STEUERSATZ_OPTIONS.map((steuersatz) => (
                          <option key={steuersatz} value={steuersatz}>
                            {formatSteuersatz(steuersatz)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1 text-sm text-zinc-500 dark:text-zinc-400">
                      <p>
                        Nettobetrag:{" "}
                        <span className="font-medium text-zinc-900 dark:text-zinc-50">
                          {amounts.nettoCents !== null
                            ? formatCurrencyFromCents(amounts.nettoCents)
                            : "—"}
                        </span>
                      </p>
                      <p>
                        Umsatzsteuer ({formatSteuersatz(position.umsatzsteuer)}
                        ):{" "}
                        <span className="font-medium text-zinc-900 dark:text-zinc-50">
                          {amounts.ustCents !== null
                            ? formatCurrencyFromCents(amounts.ustCents)
                            : "—"}
                        </span>
                      </p>
                      <p>
                        Bruttobetrag:{" "}
                        <span className="font-medium text-zinc-900 dark:text-zinc-50">
                          {amounts.bruttoCents !== null
                            ? formatCurrencyFromCents(amounts.bruttoCents)
                            : "—"}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              onClick={addPosition}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-200 px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Position hinzufügen
            </button>

            <div className="space-y-2 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  Nettosumme
                </span>
                <span className="text-zinc-900 dark:text-zinc-50">
                  {formatCurrencyFromCents(offerTotals.nettoCents)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  Umsatzsteuer
                </span>
                <span className="text-zinc-900 dark:text-zinc-50">
                  {formatCurrencyFromCents(offerTotals.ustCents)}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-zinc-200 pt-2 dark:border-zinc-800">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Bruttosumme
                </span>
                <span className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                  {formatCurrencyFromCents(offerTotals.bruttoCents)}
                </span>
              </div>
            </div>
          </div>

          <div>
            <label
              htmlFor="beschreibung"
              className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Beschreibung
            </label>
            <textarea
              id="beschreibung"
              name="beschreibung"
              rows={6}
              value={beschreibung}
              onChange={(e) => setBeschreibung(e.target.value)}
              placeholder="Beschreiben Sie die angebotene Leistung im Detail …"
              className="w-full resize-y rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 dark:focus:ring-zinc-50/10"
            />
          </div>
        </div>

        <div className="mt-6 border-t border-zinc-200 pt-6 dark:border-zinc-800">
          <button
            type="button"
            onClick={handleCreateOffer}
            className="inline-flex h-11 items-center justify-center rounded-lg bg-zinc-900 px-6 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Angebot erstellen
          </button>
        </div>
      </form>

      {showPreview && (
        <section className="mt-8 max-w-2xl rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Angebotsvorschau
          </h2>
          <dl className="mt-5 space-y-4">
            <div>
              <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                Kunde
              </dt>
              <dd className="mt-1 text-sm text-zinc-900 dark:text-zinc-50">
                {displayValue(kunde)}
              </dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                Positionen
              </dt>
              <dd className="mt-2 space-y-3">
                {positionen.map((position, index) => {
                  const amounts = calculatePositionAmounts(
                    position.menge,
                    position.einzelpreis,
                    position.umsatzsteuer,
                  );

                  return (
                    <div
                      key={position.id}
                      className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
                    >
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                        Position {index + 1}
                      </p>
                      <dl className="mt-3 space-y-2">
                        <div>
                          <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                            Leistung
                          </dt>
                          <dd className="mt-0.5 text-sm text-zinc-900 dark:text-zinc-50">
                            {displayValue(position.leistung)}
                          </dd>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div>
                            <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                              Menge
                            </dt>
                            <dd className="mt-0.5 text-sm text-zinc-900 dark:text-zinc-50">
                              {displayValue(position.menge)}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                              Einzelpreis
                            </dt>
                            <dd className="mt-0.5 text-sm text-zinc-900 dark:text-zinc-50">
                              {displayValue(position.einzelpreis)}
                            </dd>
                          </div>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div>
                            <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                              Nettobetrag
                            </dt>
                            <dd className="mt-0.5 text-sm font-medium text-zinc-900 dark:text-zinc-50">
                              {amounts.nettoCents !== null
                                ? formatCurrencyFromCents(amounts.nettoCents)
                                : "Nicht angegeben"}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                              Steuersatz
                            </dt>
                            <dd className="mt-0.5 text-sm text-zinc-900 dark:text-zinc-50">
                              {formatSteuersatz(position.umsatzsteuer)}
                            </dd>
                          </div>
                        </div>
                      </dl>
                    </div>
                  );
                })}
              </dd>
            </div>

            <div className="space-y-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <div className="flex items-center justify-between text-sm">
                <dt className="font-medium text-zinc-500 dark:text-zinc-400">
                  Nettosumme
                </dt>
                <dd className="text-zinc-900 dark:text-zinc-50">
                  {formatCurrencyFromCents(offerTotals.nettoCents)}
                </dd>
              </div>
              <div className="flex items-center justify-between text-sm">
                <dt className="font-medium text-zinc-500 dark:text-zinc-400">
                  Umsatzsteuer
                </dt>
                <dd className="text-zinc-900 dark:text-zinc-50">
                  {formatCurrencyFromCents(offerTotals.ustCents)}
                </dd>
              </div>
              <div className="flex items-center justify-between border-t border-zinc-200 pt-2 dark:border-zinc-800">
                <dt className="font-medium text-zinc-500 dark:text-zinc-400">
                  Bruttosumme
                </dt>
                <dd className="font-semibold text-zinc-900 dark:text-zinc-50">
                  {formatCurrencyFromCents(offerTotals.bruttoCents)}
                </dd>
              </div>
            </div>

            <div>
              <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                Beschreibung
              </dt>
              <dd className="mt-1 whitespace-pre-wrap text-sm text-zinc-900 dark:text-zinc-50">
                {displayValue(beschreibung)}
              </dd>
            </div>
          </dl>
        </section>
      )}
    </div>
  );
}
