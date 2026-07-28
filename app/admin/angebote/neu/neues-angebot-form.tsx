"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { createAngebotAction } from "@/app/(app)/(protected)/angebote/actions/create-angebot-action";
import { OrganizationSelect } from "@/app/admin/angebote/neu/organization-select";
import { buildEmpfaengerFromOrganization } from "@/lib/angebote/build-empfaenger-from-organization";
import type { CreateAngebotInput } from "@/lib/angebote/create-angebot-input";
import type { OrganizationSelectOption } from "@/lib/angebote/get-organization-select-options";
import { validateCreateAngebot } from "@/lib/angebote/validate-create-angebot";

type Steuersatz = 0 | 7 | 19;

type PositionFormRow = {
  id: string;
  bezeichnung: string;
  beschreibung: string;
  menge: string;
  einheit: string;
  einzelpreisNetto: string;
  rabattProzent: string;
  umsatzsteuerSatz: Steuersatz;
};

type FormErrors = {
  organizationId?: string;
  angebotDatum?: string;
  gueltigBis?: string;
  positionen?: Record<string, Partial<Record<keyof PositionFormRow, string>>>;
  general?: string[];
};

const STEUERSATZ_OPTIONS: Steuersatz[] = [19, 7, 0];

const buttonPrimaryClassName =
  "inline-flex h-11 items-center justify-center rounded-lg bg-zinc-900 px-6 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200";

const buttonSecondaryClassName =
  "inline-flex h-11 items-center justify-center rounded-lg border border-zinc-200 px-6 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800";

const inputClassName =
  "w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500";

const tableInputClassName =
  "w-full min-w-0 rounded-md border bg-white px-2 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500";

function getInputClassName(hasError: boolean) {
  return hasError
    ? `${inputClassName} border-red-300 focus:border-red-400 focus:ring-red-500/10 dark:border-red-800 dark:focus:border-red-700 dark:focus:ring-red-500/20`
    : `${inputClassName} border-zinc-200 focus:border-zinc-400 focus:ring-zinc-900/10 dark:border-zinc-700 dark:focus:border-zinc-600 dark:focus:ring-zinc-50/10`;
}

function getTableInputClassName(hasError: boolean) {
  return hasError
    ? `${tableInputClassName} border-red-300 focus:border-red-400 focus:ring-red-500/10 dark:border-red-800 dark:focus:border-red-700 dark:focus:ring-red-500/20`
    : `${tableInputClassName} border-zinc-200 focus:border-zinc-400 focus:ring-zinc-900/10 dark:border-zinc-700 dark:focus:border-zinc-600 dark:focus:ring-zinc-50/10`;
}

function toIsoDateLocal(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function createEmptyPosition(): PositionFormRow {
  return {
    id: crypto.randomUUID(),
    bezeichnung: "",
    beschreibung: "",
    menge: "1",
    einheit: "Stk.",
    einzelpreisNetto: "",
    rabattProzent: "0",
    umsatzsteuerSatz: 19,
  };
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

function parseEuroToCents(value: string): number | null {
  const num = parseNumber(value);
  if (num === null || num < 0) return null;
  return Math.round(num * 100);
}

function buildCreateInput(
  organization: OrganizationSelectOption,
  angebotDatum: string,
  gueltigBis: string,
  betreff: string,
  einleitungstext: string,
  schlusstext: string,
  positionen: PositionFormRow[],
): CreateAngebotInput {
  return {
    organizationId: organization.id,
    version: {
      angebotDatum,
      gueltigBis,
      betreff,
      einleitungstext,
      schlusstext,
      empfaenger: buildEmpfaengerFromOrganization(organization),
    },
    positionen: positionen.map((position, index) => ({
      positionNr: index + 1,
      bezeichnung: position.bezeichnung,
      beschreibung: position.beschreibung || undefined,
      menge: parseNumber(position.menge) ?? 0,
      einheit: position.einheit || undefined,
      einzelpreisNettoCents: parseEuroToCents(position.einzelpreisNetto) ?? -1,
      rabattProzent: parseNumber(position.rabattProzent) ?? 0,
      umsatzsteuerSatz: position.umsatzsteuerSatz,
    })),
  };
}

function validateClientForm(
  organizationId: string,
  angebotDatum: string,
  gueltigBis: string,
  positionen: PositionFormRow[],
): FormErrors {
  const errors: FormErrors = {};

  if (!organizationId.trim()) {
    errors.organizationId = "Bitte wählen Sie einen Mandanten aus.";
  }

  if (!angebotDatum.trim()) {
    errors.angebotDatum = "Bitte geben Sie ein Angebotsdatum an.";
  }

  if (!gueltigBis.trim()) {
    errors.gueltigBis = "Bitte geben Sie ein Gültigkeitsdatum an.";
  }

  const positionErrors: FormErrors["positionen"] = {};

  for (const position of positionen) {
    const fieldErrors: Partial<Record<keyof PositionFormRow, string>> = {};

    if (!position.bezeichnung.trim()) {
      fieldErrors.bezeichnung = "Pflichtfeld";
    }

    if (!position.menge.trim()) {
      fieldErrors.menge = "Pflichtfeld";
    } else {
      const parsedMenge = parseNumber(position.menge);
      if (parsedMenge === null || parsedMenge <= 0) {
        fieldErrors.menge = "Ungültig";
      }
    }

    if (!position.einzelpreisNetto.trim()) {
      fieldErrors.einzelpreisNetto = "Pflichtfeld";
    } else {
      const parsedCents = parseEuroToCents(position.einzelpreisNetto);
      if (parsedCents === null) {
        fieldErrors.einzelpreisNetto = "Ungültig";
      }
    }

    const parsedRabatt = parseNumber(position.rabattProzent);
    if (
      position.rabattProzent.trim() &&
      (parsedRabatt === null || parsedRabatt < 0 || parsedRabatt > 100)
    ) {
      fieldErrors.rabattProzent = "0–100";
    }

    if (Object.keys(fieldErrors).length > 0) {
      positionErrors[position.id] = fieldErrors;
    }
  }

  if (positionen.length === 0) {
    errors.general = ["Bitte geben Sie mindestens eine Position an."];
  } else if (Object.keys(positionErrors).length > 0) {
    errors.positionen = positionErrors;
  }

  return errors;
}

function hasFormErrors(errors: FormErrors) {
  return (
    !!errors.organizationId ||
    !!errors.angebotDatum ||
    !!errors.gueltigBis ||
    !!(errors.positionen && Object.keys(errors.positionen).length > 0) ||
    !!(errors.general && errors.general.length > 0)
  );
}

type NeuesAngebotFormProps = {
  organizations: OrganizationSelectOption[];
  initialOrganizationId?: string;
};

export function NeuesAngebotForm({
  organizations,
  initialOrganizationId,
}: NeuesAngebotFormProps) {
  const router = useRouter();
  const today = useMemo(() => new Date(), []);
  const defaultAngebotDatum = useMemo(() => toIsoDateLocal(today), [today]);
  const defaultGueltigBis = useMemo(
    () => toIsoDateLocal(addDays(today, 30)),
    [today],
  );

  const [organizationId, setOrganizationId] = useState(initialOrganizationId ?? "");
  const [angebotDatum, setAngebotDatum] = useState(defaultAngebotDatum);
  const [gueltigBis, setGueltigBis] = useState(defaultGueltigBis);
  const [betreff, setBetreff] = useState("");
  const [einleitungstext, setEinleitungstext] = useState("");
  const [schlusstext, setSchlusstext] = useState("");
  const [positionen, setPositionen] = useState<PositionFormRow[]>([
    createEmptyPosition(),
  ]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [validationMessages, setValidationMessages] = useState<string[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const selectedOrganization = useMemo(
    () => organizations.find((organization) => organization.id === organizationId) ?? null,
    [organizationId, organizations],
  );

  function clearOrganizationError() {
    setErrors((prev) => {
      if (!prev.organizationId) return prev;
      const next = { ...prev };
      delete next.organizationId;
      return next;
    });
  }

  function updatePosition(
    positionId: string,
    field: keyof PositionFormRow,
    value: string | Steuersatz,
  ) {
    setPositionen((prev) =>
      prev.map((position) =>
        position.id === positionId ? { ...position, [field]: value } : position,
      ),
    );

    setErrors((prev) => {
      const positionErrors = prev.positionen?.[positionId];
      if (!positionErrors?.[field as keyof PositionFormRow]) return prev;

      const nextPositionErrors = { ...prev.positionen };
      const nextFieldErrors = { ...positionErrors };
      delete nextFieldErrors[field as keyof PositionFormRow];

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

  function addPosition() {
    setPositionen((prev) => [...prev, createEmptyPosition()]);
  }

  function removePosition(positionId: string) {
    if (positionen.length <= 1) {
      return;
    }

    setPositionen((prev) => prev.filter((position) => position.id !== positionId));
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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveError(null);
    setValidationMessages([]);

    const clientErrors = validateClientForm(
      organizationId,
      angebotDatum,
      gueltigBis,
      positionen,
    );

    if (hasFormErrors(clientErrors)) {
      setErrors(clientErrors);
      return;
    }

    if (!selectedOrganization) {
      setErrors({ organizationId: "Bitte wählen Sie einen Mandanten aus." });
      return;
    }

    const input = buildCreateInput(
      selectedOrganization,
      angebotDatum,
      gueltigBis,
      betreff,
      einleitungstext,
      schlusstext,
      positionen,
    );

    const serverValidation = validateCreateAngebot(input);
    if (!serverValidation.valid) {
      setValidationMessages(serverValidation.errors);
      return;
    }

    setErrors({});
    setIsSaving(true);

    const result = await createAngebotAction(input);

    if (!result.success) {
      setSaveError(result.error);
      if (result.validationErrors?.length) {
        setValidationMessages(result.validationErrors);
      }
      setIsSaving(false);
      return;
    }

    router.push(`/admin/angebote/${result.angebotId}?created=true`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Mandant
        </h3>
        <div className="mt-4">
          <OrganizationSelect
            options={organizations}
            value={organizationId}
            onChange={(nextOrganizationId) => {
              setOrganizationId(nextOrganizationId);
              clearOrganizationError();
            }}
            error={errors.organizationId}
            disabled={isSaving || organizations.length === 0}
          />
          {organizations.length === 0 && (
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Es sind noch keine Mandanten vorhanden. Legen Sie zuerst einen Mandanten an.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Angebotskopf
        </h3>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <div>
            <label
              htmlFor="angebot-datum"
              className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Angebotsdatum
            </label>
            <input
              id="angebot-datum"
              type="date"
              value={angebotDatum}
              onChange={(event) => {
                setAngebotDatum(event.target.value);
                setErrors((prev) => {
                  if (!prev.angebotDatum) return prev;
                  const next = { ...prev };
                  delete next.angebotDatum;
                  return next;
                });
              }}
              className={getInputClassName(!!errors.angebotDatum)}
              disabled={isSaving}
            />
            {errors.angebotDatum && (
              <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                {errors.angebotDatum}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="gueltig-bis"
              className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Gültig bis
            </label>
            <input
              id="gueltig-bis"
              type="date"
              value={gueltigBis}
              onChange={(event) => {
                setGueltigBis(event.target.value);
                setErrors((prev) => {
                  if (!prev.gueltigBis) return prev;
                  const next = { ...prev };
                  delete next.gueltigBis;
                  return next;
                });
              }}
              className={getInputClassName(!!errors.gueltigBis)}
              disabled={isSaving}
            />
            {errors.gueltigBis && (
              <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                {errors.gueltigBis}
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 space-y-5">
          <div>
            <label
              htmlFor="betreff"
              className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Betreff
            </label>
            <input
              id="betreff"
              type="text"
              value={betreff}
              onChange={(event) => setBetreff(event.target.value)}
              placeholder="z. B. Angebot Website-Relaunch"
              className={getInputClassName(false)}
              disabled={isSaving}
            />
          </div>

          <div>
            <label
              htmlFor="einleitungstext"
              className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Einleitung
            </label>
            <textarea
              id="einleitungstext"
              rows={4}
              value={einleitungstext}
              onChange={(event) => setEinleitungstext(event.target.value)}
              placeholder="Einleitungstext für das Angebot"
              className={getInputClassName(false)}
              disabled={isSaving}
            />
          </div>

          <div>
            <label
              htmlFor="schlusstext"
              className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Schlusstext
            </label>
            <textarea
              id="schlusstext"
              rows={4}
              value={schlusstext}
              onChange={(event) => setSchlusstext(event.target.value)}
              placeholder="Schlusstext für das Angebot"
              className={getInputClassName(false)}
              disabled={isSaving}
            />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Positionen
          </h3>
          <button
            type="button"
            onClick={addPosition}
            className={buttonSecondaryClassName}
            disabled={isSaving}
          >
            Position hinzufügen
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[64rem] w-full divide-y divide-zinc-200 dark:divide-zinc-800">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-950/50">
                {[
                  "Position",
                  "Bezeichnung",
                  "Beschreibung",
                  "Menge",
                  "Einheit",
                  "Einzelpreis netto",
                  "Rabatt %",
                  "MwSt.",
                  "Löschen",
                ].map((label) => (
                  <th
                    key={label}
                    scope="col"
                    className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {positionen.map((position, index) => {
                const positionErrors = errors.positionen?.[position.id];

                return (
                  <tr key={position.id}>
                    <td className="px-3 py-3 text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {index + 1}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <input
                        type="text"
                        value={position.bezeichnung}
                        onChange={(event) =>
                          updatePosition(
                            position.id,
                            "bezeichnung",
                            event.target.value,
                          )
                        }
                        placeholder="Bezeichnung"
                        className={getTableInputClassName(
                          !!positionErrors?.bezeichnung,
                        )}
                        disabled={isSaving}
                      />
                      {positionErrors?.bezeichnung && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                          {positionErrors.bezeichnung}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <input
                        type="text"
                        value={position.beschreibung}
                        onChange={(event) =>
                          updatePosition(
                            position.id,
                            "beschreibung",
                            event.target.value,
                          )
                        }
                        placeholder="Optional"
                        className={getTableInputClassName(false)}
                        disabled={isSaving}
                      />
                    </td>
                    <td className="px-3 py-3 align-top">
                      <input
                        type="text"
                        value={position.menge}
                        onChange={(event) =>
                          updatePosition(position.id, "menge", event.target.value)
                        }
                        className={getTableInputClassName(!!positionErrors?.menge)}
                        disabled={isSaving}
                      />
                      {positionErrors?.menge && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                          {positionErrors.menge}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <input
                        type="text"
                        value={position.einheit}
                        onChange={(event) =>
                          updatePosition(position.id, "einheit", event.target.value)
                        }
                        className={getTableInputClassName(false)}
                        disabled={isSaving}
                      />
                    </td>
                    <td className="px-3 py-3 align-top">
                      <input
                        type="text"
                        value={position.einzelpreisNetto}
                        onChange={(event) =>
                          updatePosition(
                            position.id,
                            "einzelpreisNetto",
                            event.target.value,
                          )
                        }
                        placeholder="0,00"
                        className={getTableInputClassName(
                          !!positionErrors?.einzelpreisNetto,
                        )}
                        disabled={isSaving}
                      />
                      {positionErrors?.einzelpreisNetto && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                          {positionErrors.einzelpreisNetto}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <input
                        type="text"
                        value={position.rabattProzent}
                        onChange={(event) =>
                          updatePosition(
                            position.id,
                            "rabattProzent",
                            event.target.value,
                          )
                        }
                        className={getTableInputClassName(
                          !!positionErrors?.rabattProzent,
                        )}
                        disabled={isSaving}
                      />
                      {positionErrors?.rabattProzent && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                          {positionErrors.rabattProzent}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <select
                        value={position.umsatzsteuerSatz}
                        onChange={(event) =>
                          updatePosition(
                            position.id,
                            "umsatzsteuerSatz",
                            Number(event.target.value) as Steuersatz,
                          )
                        }
                        className={getTableInputClassName(false)}
                        disabled={isSaving}
                      >
                        {STEUERSATZ_OPTIONS.map((satz) => (
                          <option key={satz} value={satz}>
                            {satz} %
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <button
                        type="button"
                        onClick={() => removePosition(position.id)}
                        className="text-sm font-medium text-zinc-500 transition-colors hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-400 dark:hover:text-red-400"
                        disabled={isSaving || positionen.length <= 1}
                      >
                        Löschen
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {(saveError || validationMessages.length > 0 || errors.general?.length) && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          {saveError && <p>{saveError}</p>}
          {[...(errors.general ?? []), ...validationMessages].map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          className={buttonPrimaryClassName}
          disabled={isSaving || organizations.length === 0}
        >
          {isSaving ? "Speichern …" : "Speichern"}
        </button>
        <Link href="/admin" className={buttonSecondaryClassName}>
          Abbrechen
        </Link>
      </div>
    </form>
  );
}
