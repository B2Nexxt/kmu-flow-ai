"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { erstelleNeueAngebotsversionAction } from "@/app/admin/angebote/[id]/actions/erstelle-neue-angebotsversion-action";
import { freigebenAngebotAction } from "@/app/admin/angebote/[id]/actions/freigeben-angebot-action";
import { updateAngebotEntwurfAction } from "@/app/admin/angebote/[id]/actions/update-angebot-entwurf-action";
import {
  calculateAngebotTotals,
  calculatePositionAmounts,
} from "@/lib/angebote/calculate-angebot-summen";
import {
  canCreateNeueAngebotsversion,
  canFreigebenAngebot,
  getAngebotStatusBadgeClassName,
  getAngebotStatusLabel,
  isAngebotVersionEditable,
} from "@/lib/angebote/angebot-status";
import { NEUE_ANGEBOTSVERSION_SUCCESS_MESSAGE } from "@/lib/angebote/erstelle-neue-angebotsversion-action-result";
import {
  formatAngebotDateLabel,
  type AngebotAkte,
} from "@/lib/angebote/get-angebot-akte";
import {
  buildUpdateInputFromForm,
  createEmptyEntwurfPosition,
  formPositionToAktePosition,
  mapAkteToEntwurfForm,
  parseEuroToCents,
  parseNumber,
  type EntwurfFormEmpfaenger,
  type EntwurfFormPositionRow,
  type EntwurfFormState,
} from "@/lib/angebote/map-entwurf-form";
import { validateUpdateAngebotEntwurf } from "@/lib/angebote/validate-update-angebot-entwurf";

const CREATED_SUCCESS_MESSAGE = "Angebot wurde erfolgreich angelegt.";
const UPDATED_SUCCESS_MESSAGE = "Angebot wurde erfolgreich gespeichert.";
const FREIGEGEBEN_SUCCESS_MESSAGE =
  "Das Angebot wurde erfolgreich freigegeben.";
const FREIGEBEN_CONFIRM_MESSAGE =
  "Möchten Sie dieses Angebot freigeben?\n\nNach der Freigabe erhält das Angebot seine endgültige Angebotsnummer.\n\nDer Entwurf kann anschließend nicht mehr direkt bearbeitet werden.";
const AUTO_DISMISS_MS = 6000;
const STEUERSATZ_OPTIONS = [19, 7, 0] as const;

const buttonPrimaryClassName =
  "inline-flex h-11 items-center justify-center rounded-lg bg-zinc-900 px-6 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200";

const buttonSecondaryClassName =
  "inline-flex h-11 items-center justify-center rounded-lg border border-zinc-200 px-6 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800";

const sectionClassName =
  "rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900";

const inputClassName =
  "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 dark:focus:ring-zinc-50/10";

const tableInputClassName =
  "w-full min-w-0 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 dark:focus:ring-zinc-50/10";

function getInputClassName(hasError: boolean) {
  return hasError
    ? `${inputClassName} border-red-300 focus:border-red-400 focus:ring-red-500/10 dark:border-red-800 dark:focus:border-red-700 dark:focus:ring-red-500/20`
    : inputClassName;
}

function getTableInputClassName(hasError: boolean) {
  return hasError
    ? `${tableInputClassName} border-red-300 focus:border-red-400 focus:ring-red-500/10 dark:border-red-800 dark:focus:border-red-700 dark:focus:ring-red-500/20`
    : tableInputClassName;
}

function displayValue(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed || "Nicht angegeben";
}

function formatAngebotsnummer(value: string | null) {
  return value?.trim() || "Noch nicht vergeben";
}

function formatCurrencyFromCents(cents: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function formatPercent(value: number) {
  return `${value} %`;
}

type FormFieldErrors = {
  angebotDatum?: string;
  gueltigBis?: string;
  empfaenger?: Partial<Record<keyof EntwurfFormEmpfaenger, string>>;
  positionen?: Record<string, Partial<Record<keyof EntwurfFormPositionRow, string>>>;
};

type AngebotsAkteViewProps = {
  akte: AngebotAkte;
  showCreatedInitially: boolean;
};

type DetailFieldProps = {
  label: string;
  value: string;
  className?: string;
};

function DetailField({ label, value, className }: DetailFieldProps) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-zinc-900 dark:text-zinc-50">{value}</dd>
    </div>
  );
}

type DetailTextBlockProps = {
  label: string;
  value: string | null;
};

function DetailTextBlock({ label, value }: DetailTextBlockProps) {
  return (
    <div className="sm:col-span-2">
      <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {label}
      </dt>
      <dd className="mt-0.5 whitespace-pre-wrap text-sm text-zinc-900 dark:text-zinc-50">
        {displayValue(value)}
      </dd>
    </div>
  );
}

function validateClientForm(form: EntwurfFormState): FormFieldErrors {
  const errors: FormFieldErrors = {};

  if (!form.angebotDatum.trim()) {
    errors.angebotDatum = "Pflichtfeld";
  }

  if (!form.gueltigBis.trim()) {
    errors.gueltigBis = "Pflichtfeld";
  }

  if (!form.empfaenger.firmenname.trim()) {
    errors.empfaenger = {
      ...errors.empfaenger,
      firmenname: "Pflichtfeld",
    };
  }

  const positionErrors: FormFieldErrors["positionen"] = {};

  for (const position of form.positionen) {
    const fieldErrors: Partial<Record<keyof EntwurfFormPositionRow, string>> = {};

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
    } else if (parseEuroToCents(position.einzelpreisNetto) === null) {
      fieldErrors.einzelpreisNetto = "Ungültig";
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

  if (form.positionen.length === 0) {
    errors.positionen = {};
  } else if (Object.keys(positionErrors).length > 0) {
    errors.positionen = positionErrors;
  }

  return errors;
}

function hasFormFieldErrors(errors: FormFieldErrors) {
  return (
    !!errors.angebotDatum ||
    !!errors.gueltigBis ||
    !!(errors.empfaenger && Object.keys(errors.empfaenger).length > 0) ||
    !!(errors.positionen && Object.keys(errors.positionen).length > 0)
  );
}

export function AngebotsAkteView({
  akte,
  showCreatedInitially,
}: AngebotsAkteViewProps) {
  const router = useRouter();
  const canEdit = isAngebotVersionEditable(akte.version.istEingefroren);
  const canFreigeben = canFreigebenAngebot(akte.version.istEingefroren);
  const canCreateNeueVersion = canCreateNeueAngebotsversion(
    akte.status,
    akte.version.istEingefroren,
  );
  const statusLabel = getAngebotStatusLabel(akte.status);
  const empfaenger = akte.version.empfaenger;

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showFreigebenDialog, setShowFreigebenDialog] = useState(false);
  const [isFreigeben, setIsFreigeben] = useState(false);
  const [isCreatingNeueVersion, setIsCreatingNeueVersion] = useState(false);
  const [freigebenError, setFreigebenError] = useState<string | null>(null);
  const [neueVersionError, setNeueVersionError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [validationMessages, setValidationMessages] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<FormFieldErrors>({});
  const [formData, setFormData] = useState<EntwurfFormState>(() =>
    mapAkteToEntwurfForm(akte),
  );

  const readPositionRows = useMemo(
    () =>
      akte.positionen.map((position) => ({
        position,
        amounts: calculatePositionAmounts(position),
      })),
    [akte.positionen],
  );

  const readTotals = useMemo(
    () => calculateAngebotTotals(akte.positionen),
    [akte.positionen],
  );

  const editPositionRows = useMemo(
    () =>
      formData.positionen
        .map((position, index) => {
          const aktePosition = formPositionToAktePosition(position, index + 1);
          if (!aktePosition) return null;
          return {
            row: position,
            position: aktePosition,
            amounts: calculatePositionAmounts(aktePosition),
          };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null),
    [formData.positionen],
  );

  const editTotals = useMemo(
    () =>
      calculateAngebotTotals(
        editPositionRows.map(({ position }) => position),
      ),
    [editPositionRows],
  );

  useEffect(() => {
    if (!showCreatedInitially) return;

    setSuccessMessage(CREATED_SUCCESS_MESSAGE);
    router.replace(`/admin/angebote/${akte.id}`, { scroll: false });
  }, [akte.id, router, showCreatedInitially]);

  useEffect(() => {
    if (!isEditing) {
      setFormData(mapAkteToEntwurfForm(akte));
    }
  }, [akte, isEditing]);

  useEffect(() => {
    if (!successMessage) return;

    const timeoutId = window.setTimeout(() => {
      setSuccessMessage(null);
    }, AUTO_DISMISS_MS);

    return () => window.clearTimeout(timeoutId);
  }, [successMessage]);

  function handleStartEditing() {
    setSaveError(null);
    setValidationMessages([]);
    setFieldErrors({});
    setFormData(mapAkteToEntwurfForm(akte));
    setIsEditing(true);
  }

  function handleCancelEditing() {
    setSaveError(null);
    setValidationMessages([]);
    setFieldErrors({});
    setFormData(mapAkteToEntwurfForm(akte));
    setIsEditing(false);
  }

  function updateFormField<K extends keyof EntwurfFormState>(
    field: K,
    value: EntwurfFormState[K],
  ) {
    setFormData((current) => ({ ...current, [field]: value }));
  }

  function updateEmpfaengerField<K extends keyof EntwurfFormEmpfaenger>(
    field: K,
    value: EntwurfFormEmpfaenger[K],
  ) {
    setFormData((current) => ({
      ...current,
      empfaenger: { ...current.empfaenger, [field]: value },
    }));

    setFieldErrors((current) => {
      if (!current.empfaenger?.[field]) return current;
      const nextEmpfaenger = { ...current.empfaenger };
      delete nextEmpfaenger[field];
      const next = { ...current };
      if (Object.keys(nextEmpfaenger).length === 0) {
        delete next.empfaenger;
      } else {
        next.empfaenger = nextEmpfaenger;
      }
      return next;
    });
  }

  function updatePosition(
    positionId: string,
    field: keyof EntwurfFormPositionRow,
    value: string | EntwurfFormPositionRow["umsatzsteuerSatz"],
  ) {
    setFormData((current) => ({
      ...current,
      positionen: current.positionen.map((position) =>
        position.id === positionId ? { ...position, [field]: value } : position,
      ),
    }));

    setFieldErrors((current) => {
      const positionError = current.positionen?.[positionId];
      if (!positionError?.[field as keyof EntwurfFormPositionRow]) return current;

      const nextPositionErrors = { ...current.positionen };
      const nextFieldErrors = { ...positionError };
      delete nextFieldErrors[field as keyof EntwurfFormPositionRow];

      if (Object.keys(nextFieldErrors).length === 0) {
        delete nextPositionErrors[positionId];
      } else {
        nextPositionErrors[positionId] = nextFieldErrors;
      }

      const next = { ...current };
      if (Object.keys(nextPositionErrors).length === 0) {
        delete next.positionen;
      } else {
        next.positionen = nextPositionErrors;
      }

      return next;
    });
  }

  function addPosition() {
    setFormData((current) => ({
      ...current,
      positionen: [...current.positionen, createEmptyEntwurfPosition()],
    }));
  }

  function removePosition(positionId: string) {
    if (formData.positionen.length <= 1) return;

    setFormData((current) => ({
      ...current,
      positionen: current.positionen.filter((position) => position.id !== positionId),
    }));

    setFieldErrors((current) => {
      if (!current.positionen?.[positionId]) return current;
      const nextPositionErrors = { ...current.positionen };
      delete nextPositionErrors[positionId];
      const next = { ...current };
      if (Object.keys(nextPositionErrors).length === 0) {
        delete next.positionen;
      } else {
        next.positionen = nextPositionErrors;
      }
      return next;
    });
  }

  async function handleSave() {
    if (isSaving) return;

    setSaveError(null);
    setValidationMessages([]);

    const clientErrors = validateClientForm(formData);
    if (hasFormFieldErrors(clientErrors)) {
      setFieldErrors(clientErrors);
      return;
    }

    const input = buildUpdateInputFromForm(akte, formData);
    const serverValidation = validateUpdateAngebotEntwurf(input);
    if (!serverValidation.valid) {
      setValidationMessages(serverValidation.errors);
      return;
    }

    setFieldErrors({});
    setIsSaving(true);

    try {
      const result = await updateAngebotEntwurfAction(input);

      if (!result.success) {
        setSaveError(result.error);
        if (result.validationErrors?.length) {
          setValidationMessages(result.validationErrors);
        }
        if (result.conflict) {
          setIsEditing(false);
          router.refresh();
        }
        return;
      }

      setIsEditing(false);
      setSuccessMessage(UPDATED_SUCCESS_MESSAGE);
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  function handleOpenFreigebenDialog() {
    setFreigebenError(null);
    setShowFreigebenDialog(true);
  }

  function handleCloseFreigebenDialog() {
    if (isFreigeben) return;
    setFreigebenError(null);
    setShowFreigebenDialog(false);
  }

  async function handleConfirmFreigeben() {
    if (isFreigeben) return;

    setFreigebenError(null);
    setIsFreigeben(true);

    try {
      const result = await freigebenAngebotAction(akte.id);

      if (!result.success) {
        setFreigebenError(result.error);
        return;
      }

      setShowFreigebenDialog(false);
      setIsEditing(false);
      setSuccessMessage(FREIGEGEBEN_SUCCESS_MESSAGE);
      router.refresh();
    } finally {
      setIsFreigeben(false);
    }
  }

  async function handleCreateNeueVersion() {
    if (isCreatingNeueVersion) return;

    setNeueVersionError(null);
    setIsCreatingNeueVersion(true);

    try {
      const result = await erstelleNeueAngebotsversionAction(akte.id);

      if (!result.success) {
        setNeueVersionError(result.error);
        return;
      }

      setIsEditing(false);
      setSuccessMessage(NEUE_ANGEBOTSVERSION_SUCCESS_MESSAGE);
      router.refresh();
    } finally {
      setIsCreatingNeueVersion(false);
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
        <div className="mx-auto max-w-5xl">
          {successMessage && (
            <div
              role="status"
              className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 dark:border-green-900 dark:bg-green-950"
            >
              <p className="text-sm font-medium text-green-700 dark:text-green-300">
                {successMessage}
              </p>
            </div>
          )}

          {neueVersionError && (
            <div
              role="alert"
              className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900 dark:bg-red-950/40"
            >
              <p className="text-sm font-medium text-red-700 dark:text-red-300">
                {neueVersionError}
              </p>
            </div>
          )}

          <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                Angebots-ID: {akte.id}
              </p>
              <h2 className="mt-1 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                Angebotsakte
              </h2>
              <div className="mt-3">
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${getAngebotStatusBadgeClassName(akte.status)}`}
                >
                  {statusLabel}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {canCreateNeueVersion && !isEditing && !isSaving && (
                <button
                  type="button"
                  onClick={handleCreateNeueVersion}
                  className={buttonPrimaryClassName}
                  disabled={isFreigeben || isCreatingNeueVersion}
                >
                  {isCreatingNeueVersion
                    ? "Neue Version …"
                    : "Neue Version erstellen"}
                </button>
              )}
              {canEdit &&
                !isEditing &&
                !isSaving && (
                  <>
                    <button
                      type="button"
                      onClick={handleStartEditing}
                      className={buttonPrimaryClassName}
                      disabled={isFreigeben || isCreatingNeueVersion}
                    >
                      Bearbeiten
                    </button>
                    {canFreigeben && (
                      <button
                        type="button"
                        onClick={handleOpenFreigebenDialog}
                        className={buttonSecondaryClassName}
                        disabled={isFreigeben || isCreatingNeueVersion}
                      >
                        Freigeben
                      </button>
                    )}
                  </>
                )}
              {canEdit && isEditing && (
                <>
                  <button
                    type="button"
                    onClick={handleCancelEditing}
                    disabled={isSaving}
                    className={buttonSecondaryClassName}
                  >
                    Abbrechen
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving}
                    className={buttonPrimaryClassName}
                  >
                    {isSaving ? "Speichern …" : "Speichern"}
                  </button>
                </>
              )}
              <Link href="/admin/angebote" className={buttonSecondaryClassName}>
                Zur Angebotsliste
              </Link>
            </div>
          </div>

          {showFreigebenDialog && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
              role="presentation"
              onClick={handleCloseFreigebenDialog}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="freigeben-dialog-title"
                className="w-full max-w-lg rounded-lg border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
                onClick={(event) => event.stopPropagation()}
              >
                <h3
                  id="freigeben-dialog-title"
                  className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
                >
                  Angebot freigeben
                </h3>
                <p className="mt-3 whitespace-pre-line text-sm text-zinc-600 dark:text-zinc-300">
                  {FREIGEBEN_CONFIRM_MESSAGE}
                </p>
                {freigebenError && (
                  <p
                    role="alert"
                    className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                  >
                    {freigebenError}
                  </p>
                )}
                <div className="mt-6 flex flex-wrap justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleCloseFreigebenDialog}
                    disabled={isFreigeben}
                    className={buttonSecondaryClassName}
                  >
                    Abbrechen
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmFreigeben}
                    disabled={isFreigeben}
                    className={buttonPrimaryClassName}
                  >
                    {isFreigeben ? "Freigeben …" : "Freigeben"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {(saveError || validationMessages.length > 0) && (
            <div
              role="alert"
              className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
            >
              {saveError && <p>{saveError}</p>}
              {validationMessages.map((message) => (
                <p key={message}>{message}</p>
              ))}
            </div>
          )}

          <div className="space-y-6">
            <section className={sectionClassName}>
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                Kopf
              </h3>
              {isEditing ? (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="angebot-datum"
                      className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400"
                    >
                      Angebotsdatum
                    </label>
                    <input
                      id="angebot-datum"
                      type="date"
                      value={formData.angebotDatum}
                      onChange={(event) =>
                        updateFormField("angebotDatum", event.target.value)
                      }
                      className={getInputClassName(!!fieldErrors.angebotDatum)}
                      disabled={isSaving}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="gueltig-bis"
                      className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400"
                    >
                      Gültig bis
                    </label>
                    <input
                      id="gueltig-bis"
                      type="date"
                      value={formData.gueltigBis}
                      onChange={(event) =>
                        updateFormField("gueltigBis", event.target.value)
                      }
                      className={getInputClassName(!!fieldErrors.gueltigBis)}
                      disabled={isSaving}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      Angebotsnummer
                    </p>
                    <p className="mt-0.5 text-sm text-zinc-900 dark:text-zinc-50">
                      {formatAngebotsnummer(akte.angebotsnummer)}
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      Status
                    </p>
                    <p className="mt-0.5 text-sm text-zinc-900 dark:text-zinc-50">
                      {statusLabel}
                    </p>
                  </div>
                </div>
              ) : (
                <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                  <DetailField
                    label="Angebotsnummer"
                    value={formatAngebotsnummer(akte.angebotsnummer)}
                  />
                  <DetailField label="Status" value={statusLabel} />
                  <DetailField
                    label="Angebotsdatum"
                    value={formatAngebotDateLabel(akte.version.angebotDatum)}
                  />
                  <DetailField
                    label="Gültig bis"
                    value={formatAngebotDateLabel(akte.version.gueltigBis)}
                  />
                </dl>
              )}
            </section>

            <section className={sectionClassName}>
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                Empfänger
              </h3>
              {isEditing ? (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {(
                    [
                      ["firmenname", "Firmenname"],
                      ["rechtsform", "Rechtsform"],
                      ["ansprechpartner", "Ansprechpartner"],
                      ["strasse", "Straße"],
                      ["hausnummer", "Hausnummer"],
                      ["plz", "PLZ"],
                      ["ort", "Ort"],
                      ["land", "Land"],
                      ["email", "E-Mail"],
                      ["telefon", "Telefon"],
                      ["umsatzsteuerId", "Umsatzsteuer-ID"],
                    ] as const
                  ).map(([field, label]) => (
                    <div key={field}>
                      <label
                        htmlFor={`empfaenger-${field}`}
                        className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400"
                      >
                        {label}
                      </label>
                      <input
                        id={`empfaenger-${field}`}
                        type="text"
                        value={formData.empfaenger[field]}
                        onChange={(event) =>
                          updateEmpfaengerField(field, event.target.value)
                        }
                        className={getInputClassName(
                          !!fieldErrors.empfaenger?.[field],
                        )}
                        disabled={isSaving}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                  <DetailField label="Firmenname" value={empfaenger.firmenname} />
                  <DetailField
                    label="Rechtsform"
                    value={displayValue(empfaenger.rechtsform)}
                  />
                  <DetailField
                    label="Ansprechpartner"
                    value={displayValue(empfaenger.ansprechpartner)}
                  />
                  <DetailField
                    label="Straße"
                    value={displayValue(empfaenger.strasse)}
                  />
                  <DetailField
                    label="Hausnummer"
                    value={displayValue(empfaenger.hausnummer)}
                  />
                  <DetailField label="PLZ" value={displayValue(empfaenger.plz)} />
                  <DetailField label="Ort" value={displayValue(empfaenger.ort)} />
                  <DetailField label="Land" value={displayValue(empfaenger.land)} />
                  <DetailField
                    label="E-Mail"
                    value={displayValue(empfaenger.email)}
                  />
                  <DetailField
                    label="Telefon"
                    value={displayValue(empfaenger.telefon)}
                  />
                  {empfaenger.umsatzsteuerId?.trim() && (
                    <DetailField
                      label="Umsatzsteuer-ID"
                      value={empfaenger.umsatzsteuerId.trim()}
                    />
                  )}
                </dl>
              )}
            </section>

            <section className={sectionClassName}>
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                Angebot
              </h3>
              {isEditing ? (
                <div className="mt-4 space-y-4">
                  <div>
                    <label
                      htmlFor="betreff"
                      className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400"
                    >
                      Betreff
                    </label>
                    <input
                      id="betreff"
                      type="text"
                      value={formData.betreff}
                      onChange={(event) =>
                        updateFormField("betreff", event.target.value)
                      }
                      className={inputClassName}
                      disabled={isSaving}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="einleitungstext"
                      className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400"
                    >
                      Einleitung
                    </label>
                    <textarea
                      id="einleitungstext"
                      rows={4}
                      value={formData.einleitungstext}
                      onChange={(event) =>
                        updateFormField("einleitungstext", event.target.value)
                      }
                      className={inputClassName}
                      disabled={isSaving}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="schlusstext"
                      className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400"
                    >
                      Schlusstext
                    </label>
                    <textarea
                      id="schlusstext"
                      rows={4}
                      value={formData.schlusstext}
                      onChange={(event) =>
                        updateFormField("schlusstext", event.target.value)
                      }
                      className={inputClassName}
                      disabled={isSaving}
                    />
                  </div>
                </div>
              ) : (
                <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                  <DetailField
                    label="Betreff"
                    value={displayValue(akte.version.betreff)}
                    className="sm:col-span-2"
                  />
                  <DetailTextBlock
                    label="Einleitung"
                    value={akte.version.einleitungstext}
                  />
                  <DetailTextBlock
                    label="Schlusstext"
                    value={akte.version.schlusstext}
                  />
                </dl>
              )}
            </section>

            <section className={sectionClassName}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                  Positionen
                </h3>
                {isEditing && (
                  <button
                    type="button"
                    onClick={addPosition}
                    className={buttonSecondaryClassName}
                    disabled={isSaving}
                  >
                    Position hinzufügen
                  </button>
                )}
              </div>

              {isEditing ? (
                <>
                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-[72rem] w-full divide-y divide-zinc-200 dark:divide-zinc-800">
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
                            "Positionsgesamt netto",
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
                        {formData.positionen.map((position, index) => {
                          const positionError = fieldErrors.positionen?.[position.id];
                          const preview = formPositionToAktePosition(
                            position,
                            index + 1,
                          );
                          const amounts = preview
                            ? calculatePositionAmounts(preview)
                            : null;

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
                                  className={getTableInputClassName(
                                    !!positionError?.bezeichnung,
                                  )}
                                  disabled={isSaving}
                                />
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
                                  className={tableInputClassName}
                                  disabled={isSaving}
                                />
                              </td>
                              <td className="px-3 py-3 align-top">
                                <input
                                  type="text"
                                  value={position.menge}
                                  onChange={(event) =>
                                    updatePosition(
                                      position.id,
                                      "menge",
                                      event.target.value,
                                    )
                                  }
                                  className={getTableInputClassName(
                                    !!positionError?.menge,
                                  )}
                                  disabled={isSaving}
                                />
                              </td>
                              <td className="px-3 py-3 align-top">
                                <input
                                  type="text"
                                  value={position.einheit}
                                  onChange={(event) =>
                                    updatePosition(
                                      position.id,
                                      "einheit",
                                      event.target.value,
                                    )
                                  }
                                  className={tableInputClassName}
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
                                  className={getTableInputClassName(
                                    !!positionError?.einzelpreisNetto,
                                  )}
                                  disabled={isSaving}
                                />
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
                                    !!positionError?.rabattProzent,
                                  )}
                                  disabled={isSaving}
                                />
                              </td>
                              <td className="px-3 py-3 align-top">
                                <select
                                  value={position.umsatzsteuerSatz}
                                  onChange={(event) =>
                                    updatePosition(
                                      position.id,
                                      "umsatzsteuerSatz",
                                      Number(
                                        event.target.value,
                                      ) as EntwurfFormPositionRow["umsatzsteuerSatz"],
                                    )
                                  }
                                  className={tableInputClassName}
                                  disabled={isSaving}
                                >
                                  {STEUERSATZ_OPTIONS.map((satz) => (
                                    <option key={satz} value={satz}>
                                      {satz} %
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-3 py-3 align-top text-sm text-zinc-900 dark:text-zinc-50">
                                {amounts
                                  ? formatCurrencyFromCents(
                                      amounts.nettoNachRabattCents,
                                    )
                                  : "–"}
                              </td>
                              <td className="px-3 py-3 align-top">
                                <button
                                  type="button"
                                  onClick={() => removePosition(position.id)}
                                  className="text-sm font-medium text-zinc-500 transition-colors hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-400 dark:hover:text-red-400"
                                  disabled={
                                    isSaving || formData.positionen.length <= 1
                                  }
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

                  <dl className="mt-6 ml-auto max-w-sm space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                        Zwischensumme netto
                      </dt>
                      <dd className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                        {formatCurrencyFromCents(editTotals.nettoCents)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                        MwSt.
                      </dt>
                      <dd className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                        {formatCurrencyFromCents(editTotals.ustCents)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-4 border-t border-zinc-200 pt-3 dark:border-zinc-800">
                      <dt className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                        Gesamtbetrag brutto
                      </dt>
                      <dd className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                        {formatCurrencyFromCents(editTotals.bruttoCents)}
                      </dd>
                    </div>
                  </dl>
                </>
              ) : (
                <>
                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-[72rem] w-full divide-y divide-zinc-200 dark:divide-zinc-800">
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
                            "Positionsgesamt netto",
                          ].map((label) => (
                            <th
                              key={label}
                              scope="col"
                              className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
                            >
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                        {readPositionRows.map(({ position, amounts }) => (
                          <tr key={position.positionNr}>
                            <td className="px-4 py-3 text-sm text-zinc-900 dark:text-zinc-50">
                              {position.positionNr}
                            </td>
                            <td className="px-4 py-3 text-sm text-zinc-900 dark:text-zinc-50">
                              {position.bezeichnung}
                            </td>
                            <td className="px-4 py-3 text-sm text-zinc-900 dark:text-zinc-50">
                              {displayValue(position.beschreibung)}
                            </td>
                            <td className="px-4 py-3 text-sm text-zinc-900 dark:text-zinc-50">
                              {position.menge}
                            </td>
                            <td className="px-4 py-3 text-sm text-zinc-900 dark:text-zinc-50">
                              {position.einheit}
                            </td>
                            <td className="px-4 py-3 text-sm text-zinc-900 dark:text-zinc-50">
                              {formatCurrencyFromCents(
                                position.einzelpreisNettoCents,
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-zinc-900 dark:text-zinc-50">
                              {formatPercent(position.rabattProzent)}
                            </td>
                            <td className="px-4 py-3 text-sm text-zinc-900 dark:text-zinc-50">
                              {formatPercent(position.umsatzsteuerSatz)}
                            </td>
                            <td className="px-4 py-3 text-sm text-zinc-900 dark:text-zinc-50">
                              {formatCurrencyFromCents(
                                amounts.nettoNachRabattCents,
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <dl className="mt-6 ml-auto max-w-sm space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                        Zwischensumme netto
                      </dt>
                      <dd className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                        {formatCurrencyFromCents(readTotals.nettoCents)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                        MwSt.
                      </dt>
                      <dd className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                        {formatCurrencyFromCents(readTotals.ustCents)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-4 border-t border-zinc-200 pt-3 dark:border-zinc-800">
                      <dt className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                        Gesamtbetrag brutto
                      </dt>
                      <dd className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                        {formatCurrencyFromCents(readTotals.bruttoCents)}
                      </dd>
                    </div>
                  </dl>
                </>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
