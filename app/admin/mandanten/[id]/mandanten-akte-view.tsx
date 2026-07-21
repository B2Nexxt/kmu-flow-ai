"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { updateMandantAnsprechpartnerAction } from "@/app/admin/mandanten/[id]/actions/update-mandant-ansprechpartner-action";
import { updateMandantStammdatenAction } from "@/app/admin/mandanten/[id]/actions/update-mandant-stammdaten-action";
import { PhoneInput } from "@/app/admin/mandanten/neu/phone-input";
import { RECHTSFORM_OPTIONS } from "@/app/admin/mandanten/neu/mandanten-onboarding-context";
import { LAENDER_OPTIONS } from "@/lib/mandanten/land-options";
import {
  getMandantStatusBadgeClassName,
  MANDANT_STATUS,
  MANDANT_STATUS_OPTIONS,
  isValidMandantStatus,
  type MandantStatusCode,
} from "@/lib/mandanten/mandant-status";
import type { AnsprechpartnerInput } from "@/lib/mandanten/ansprechpartner-input";
import type { MandantAkte, MandantAkteContact } from "@/lib/mandanten/get-mandant-akte";
import { formatContactName } from "@/lib/mandanten/get-mandant-akte";
import { mapAkteToAnsprechpartnerInput } from "@/lib/mandanten/map-akte-to-ansprechpartner-input";
import type { UnternehmensStammdatenInput } from "@/lib/mandanten/unternehmens-stammdaten";
import {
  getAnsprechpartnerFieldErrors,
  type AnsprechpartnerFieldErrors,
} from "@/lib/mandanten/validate-onboarding";
import type { AngebotListItem } from "@/lib/angebote/get-angebote-list";
import { MandantenAngeboteSection } from "./mandanten-angebote-section";

const CREATED_SUCCESS_MESSAGE = "Mandant wurde erfolgreich angelegt.";
const UPDATED_SUCCESS_MESSAGE = "Stammdaten wurden erfolgreich gespeichert.";
const CONTACTS_UPDATED_SUCCESS_MESSAGE =
  "Ansprechpartner wurden erfolgreich gespeichert.";
const AUTO_DISMISS_MS = 6000;

const inputClassName =
  "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 dark:focus:ring-zinc-50/10";

const buttonPrimaryClassName =
  "inline-flex h-11 items-center justify-center rounded-lg bg-zinc-900 px-6 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200";

const buttonSecondaryClassName =
  "inline-flex h-11 items-center justify-center rounded-lg border border-zinc-200 px-6 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800";

const placeholderSections = [
  "Unternehmen und Standorte",
  "Verträge",
  "Rechnungen",
  "Dokumente",
  "Automatisierungen",
] as const;

type MandantenAkteViewProps = {
  akte: MandantAkte;
  showCreatedInitially: boolean;
  angebote: AngebotListItem[];
};

type UnternehmensStammdatenForm = UnternehmensStammdatenInput;

function createFormFromAkte(akte: MandantAkte): UnternehmensStammdatenForm {
  const status: MandantStatusCode = isValidMandantStatus(akte.status)
    ? akte.status
    : MANDANT_STATUS.INTERESSENT;

  return {
    status,
    firmenname: akte.firmenname,
    rechtsform: akte.rechtsform,
    strasse: akte.strasse ?? "",
    hausnummer: akte.hausnummer ?? "",
    plz: akte.plz ?? "",
    ort: akte.ort ?? "",
    land: akte.land ?? "",
    website: akte.website ?? "",
    telefonVorwahl: akte.telefonVorwahl ?? "",
    telefonNummer: akte.telefonNummer ?? "",
    email: akte.email ?? "",
  };
}

function getInputClassName(hasError: boolean) {
  return hasError
    ? `${inputClassName} border-red-300 focus:border-red-400 focus:ring-red-500/10 dark:border-red-800 dark:focus:border-red-700 dark:focus:ring-red-500/20`
    : inputClassName;
}

function contactsAreSamePerson(akte: MandantAkte) {
  const hauptansprechpartner = akte.hauptansprechpartner;
  const geschaeftsfuehrer = akte.geschaeftsfuehrer;

  return Boolean(
    hauptansprechpartner &&
      geschaeftsfuehrer &&
      hauptansprechpartner.id === geschaeftsfuehrer.id,
  );
}

function formatContactTelefon(contact: MandantAkteContact | null) {
  if (!contact) return "Nicht angegeben";

  const telefon = [contact.telefonVorwahl, contact.telefonNummer]
    .filter((value) => value?.trim())
    .join(" ")
    .trim();

  return telefon || "Nicht angegeben";
}
function formatList(values: string[]) {
  return values.length > 0 ? values.join(", ") : "Nicht angegeben";
}

function displayValue(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed || "Nicht angegeben";
}

export function MandantenAkteView({
  akte,
  showCreatedInitially,
  angebote,
}: MandantenAkteViewProps) {
  const router = useRouter();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [formData, setFormData] = useState<UnternehmensStammdatenForm>(() =>
    createFormFromAkte(akte),
  );
  const [isEditingContacts, setIsEditingContacts] = useState(false);
  const [isSavingContacts, setIsSavingContacts] = useState(false);
  const [contactsSaveError, setContactsSaveError] = useState<string | null>(
    null,
  );
  const [contactsFieldErrors, setContactsFieldErrors] =
    useState<AnsprechpartnerFieldErrors>({});
  const [contactsFormData, setContactsFormData] = useState<AnsprechpartnerInput>(
    () => mapAkteToAnsprechpartnerInput(akte),
  );

  const hauptansprechpartnerLabel = formatContactName(akte.hauptansprechpartner);
  const geschaeftsfuehrerLabel = formatContactName(akte.geschaeftsfuehrer);
  const gleicherAnsprechpartner =
    contactsFormData.hauptansprechpartner.gleicherWieGeschaeftsfuehrer;
  const contactsGf = contactsFormData.geschaeftsfuehrer;
  const contactsAp = contactsFormData.hauptansprechpartner;
  const sameContactPerson = contactsAreSamePerson(akte);

  useEffect(() => {
    if (!showCreatedInitially) return;

    setSuccessMessage(CREATED_SUCCESS_MESSAGE);
    router.replace(`/admin/mandanten/${akte.id}`, { scroll: false });
  }, [akte.id, router, showCreatedInitially]);

  useEffect(() => {
    if (!isEditing) {
      setFormData(createFormFromAkte(akte));
    }
  }, [akte, isEditing]);

  useEffect(() => {
    if (!isEditingContacts) {
      setContactsFormData(mapAkteToAnsprechpartnerInput(akte));
    }
  }, [akte, isEditingContacts]);

  useEffect(() => {
    if (!successMessage) return;

    const timer = window.setTimeout(() => {
      setSuccessMessage(null);
    }, AUTO_DISMISS_MS);

    return () => window.clearTimeout(timer);
  }, [successMessage]);

  function handleStartEditing() {
    setSaveError(null);
    setFormData(createFormFromAkte(akte));
    setIsEditing(true);
  }

  function handleCancelEditing() {
    setSaveError(null);
    setFormData(createFormFromAkte(akte));
    setIsEditing(false);
  }

  async function handleSave() {
    if (isSaving) return;

    setSaveError(null);
    setIsSaving(true);

    try {
      const result = await updateMandantStammdatenAction(akte.id, formData);

      if (!result.success) {
        setSaveError(result.error);
        return;
      }

      setIsEditing(false);
      setSuccessMessage(UPDATED_SUCCESS_MESSAGE);
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  function updateFormField<K extends keyof UnternehmensStammdatenForm>(
    field: K,
    value: UnternehmensStammdatenForm[K],
  ) {
    setFormData((current) => ({ ...current, [field]: value }));
  }

  function clearContactsFieldError(field: keyof AnsprechpartnerFieldErrors) {
    setContactsFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function updateGeschaeftsfuehrerField<
    K extends keyof AnsprechpartnerInput["geschaeftsfuehrer"],
  >(field: K, value: AnsprechpartnerInput["geschaeftsfuehrer"][K]) {
    setContactsFormData((current) => ({
      ...current,
      geschaeftsfuehrer: {
        ...current.geschaeftsfuehrer,
        [field]: value,
      },
    }));

    if (field === "vorname") clearContactsFieldError("gfVorname");
    if (field === "nachname") clearContactsFieldError("gfNachname");
    if (field === "email") clearContactsFieldError("gfEmail");
    if (field === "telefonVorwahl" || field === "telefonNummer") {
      clearContactsFieldError("gfTelefon");
    }
  }

  function updateHauptansprechpartnerField<
    K extends keyof AnsprechpartnerInput["hauptansprechpartner"],
  >(field: K, value: AnsprechpartnerInput["hauptansprechpartner"][K]) {
    setContactsFormData((current) => ({
      ...current,
      hauptansprechpartner: {
        ...current.hauptansprechpartner,
        [field]: value,
      },
    }));

    if (field === "vorname") clearContactsFieldError("vorname");
    if (field === "nachname") clearContactsFieldError("nachname");
    if (field === "position") clearContactsFieldError("position");
    if (field === "email") clearContactsFieldError("email");
    if (field === "telefonVorwahl" || field === "telefonNummer") {
      clearContactsFieldError("telefon");
    }
  }

  function handleStartEditingContacts() {
    setContactsSaveError(null);
    setContactsFieldErrors({});
    setContactsFormData(mapAkteToAnsprechpartnerInput(akte));
    setIsEditingContacts(true);
  }

  function handleCancelEditingContacts() {
    setContactsSaveError(null);
    setContactsFieldErrors({});
    setContactsFormData(mapAkteToAnsprechpartnerInput(akte));
    setIsEditingContacts(false);
  }

  function handleGleicherAnsprechpartnerChange(checked: boolean) {
    if (checked) {
      setContactsFormData((current) => ({
        ...current,
        hauptansprechpartner: {
          ...current.hauptansprechpartner,
          gleicherWieGeschaeftsfuehrer: true,
          position: "Geschäftsführer",
        },
      }));
      setContactsFieldErrors((current) => {
        const next = { ...current };
        delete next.vorname;
        delete next.nachname;
        delete next.position;
        delete next.email;
        delete next.telefon;
        return next;
      });
      return;
    }

    setContactsFormData((current) => ({
      ...current,
      hauptansprechpartner: {
        ...current.hauptansprechpartner,
        gleicherWieGeschaeftsfuehrer: false,
      },
    }));
    setContactsFieldErrors((current) => {
      const next = { ...current };
      delete next.gfVorname;
      delete next.gfNachname;
      delete next.gfEmail;
      delete next.gfTelefon;
      return next;
    });
  }

  async function handleSaveContacts() {
    if (isSavingContacts) return;

    setContactsSaveError(null);

    const fieldErrors = getAnsprechpartnerFieldErrors(contactsFormData);
    if (Object.keys(fieldErrors).length > 0) {
      setContactsFieldErrors(fieldErrors);
      return;
    }

    setContactsFieldErrors({});
    setIsSavingContacts(true);

    try {
      const result = await updateMandantAnsprechpartnerAction(
        akte.id,
        contactsFormData,
      );

      if (!result.success) {
        if (result.validationErrors?.length) {
          setContactsFieldErrors(getAnsprechpartnerFieldErrors(contactsFormData));
        }
        setContactsSaveError(result.error);
        return;
      }

      setIsEditingContacts(false);
      setSuccessMessage(CONTACTS_UPDATED_SUCCESS_MESSAGE);
      router.refresh();
    } finally {
      setIsSavingContacts(false);
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
              className="mb-6 flex items-start justify-between gap-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 dark:border-green-900 dark:bg-green-950"
            >
              <p className="text-sm font-medium text-green-700 dark:text-green-300">
                {successMessage}
              </p>
              <button
                type="button"
                onClick={() => setSuccessMessage(null)}
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
                  className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${getMandantStatusBadgeClassName(akte.status)}`}
                >
                  {akte.statusLabel}
                </span>
                <p className="text-zinc-500 dark:text-zinc-400">
                  {akte.firmenname}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/admin/mandanten" className={buttonPrimaryClassName}>
                Zur Mandantenliste
              </Link>
              <Link href="/admin" className={buttonSecondaryClassName}>
                Zurück zum Dashboard
              </Link>
            </div>
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
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-sm font-semibold ${getMandantStatusBadgeClassName(akte.status)}`}
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
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                Stammdaten
              </h3>
              {isEditing ? (
                <div className="flex flex-wrap gap-3">
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
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleStartEditing}
                  className={buttonPrimaryClassName}
                >
                  Bearbeiten
                </button>
              )}
            </div>

            {isEditing ? (
              <div className="mt-4">
                {saveError && (
                  <p
                    role="alert"
                    className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
                  >
                    {saveError}
                  </p>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="status"
                    className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400"
                  >
                    Status
                  </label>
                  <select
                    id="status"
                    value={formData.status}
                    onChange={(event) =>
                      updateFormField(
                        "status",
                        event.target.value as MandantStatusCode,
                      )
                    }
                    disabled={isSaving}
                    className={inputClassName}
                  >
                    {MANDANT_STATUS_OPTIONS.map((option) => (
                      <option key={option.code} value={option.code}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2 sm:col-start-1">
                  <label
                    htmlFor="firmenname"
                    className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400"
                  >
                    Firmenname
                  </label>
                  <input
                    id="firmenname"
                    type="text"
                    value={formData.firmenname}
                    onChange={(event) =>
                      updateFormField("firmenname", event.target.value)
                    }
                    className={inputClassName}
                  />
                </div>
                <div>
                  <label
                    htmlFor="rechtsform"
                    className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400"
                  >
                    Rechtsform
                  </label>
                  <select
                    id="rechtsform"
                    value={formData.rechtsform}
                    onChange={(event) =>
                      updateFormField("rechtsform", event.target.value)
                    }
                    className={inputClassName}
                  >
                    <option value="">Bitte wählen</option>
                    {RECHTSFORM_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                    {formData.rechtsform &&
                      !RECHTSFORM_OPTIONS.includes(
                        formData.rechtsform as (typeof RECHTSFORM_OPTIONS)[number],
                      ) && (
                        <option value={formData.rechtsform}>
                          {formData.rechtsform}
                        </option>
                      )}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="email"
                    className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400"
                  >
                    E-Mail
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(event) =>
                      updateFormField("email", event.target.value)
                    }
                    className={inputClassName}
                  />
                </div>
                <div className="sm:col-span-2 grid gap-4 sm:grid-cols-[1fr_auto]">
                  <div>
                    <label
                      htmlFor="strasse"
                      className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400"
                    >
                      Straße
                    </label>
                    <input
                      id="strasse"
                      type="text"
                      value={formData.strasse}
                      onChange={(event) =>
                        updateFormField("strasse", event.target.value)
                      }
                      className={inputClassName}
                    />
                  </div>
                  <div className="sm:w-32">
                    <label
                      htmlFor="hausnummer"
                      className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400"
                    >
                      Hausnummer
                    </label>
                    <input
                      id="hausnummer"
                      type="text"
                      value={formData.hausnummer}
                      onChange={(event) =>
                        updateFormField("hausnummer", event.target.value)
                      }
                      className={inputClassName}
                    />
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="plz"
                    className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400"
                  >
                    PLZ
                  </label>
                  <input
                    id="plz"
                    type="text"
                    value={formData.plz}
                    onChange={(event) =>
                      updateFormField("plz", event.target.value)
                    }
                    className={inputClassName}
                  />
                </div>
                <div>
                  <label
                    htmlFor="ort"
                    className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400"
                  >
                    Ort
                  </label>
                  <input
                    id="ort"
                    type="text"
                    value={formData.ort}
                    onChange={(event) =>
                      updateFormField("ort", event.target.value)
                    }
                    className={inputClassName}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label
                    htmlFor="land"
                    className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400"
                  >
                    Land
                  </label>
                  <select
                    id="land"
                    value={formData.land}
                    onChange={(event) =>
                      updateFormField("land", event.target.value)
                    }
                    className={inputClassName}
                  >
                    <option value="">Bitte wählen</option>
                    {LAENDER_OPTIONS.map((landOption) => (
                      <option key={landOption.code} value={landOption.code}>
                        {landOption.flag} {landOption.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <PhoneInput
                    id="telefon"
                    label="Telefon"
                    vorwahl={formData.telefonVorwahl}
                    nummer={formData.telefonNummer}
                    onVorwahlChange={(value) =>
                      updateFormField("telefonVorwahl", value)
                    }
                    onNummerChange={(value) =>
                      updateFormField("telefonNummer", value)
                    }
                    disabled={isSaving}
                  />
                </div>
                <div>
                  <label
                    htmlFor="website"
                    className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400"
                  >
                    Website
                  </label>
                  <input
                    id="website"
                    type="url"
                    value={formData.website}
                    onChange={(event) =>
                      updateFormField("website", event.target.value)
                    }
                    className={inputClassName}
                  />
                </div>
              </div>
              </div>
            ) : (
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Firmenname
                  </dt>
                  <dd className="mt-0.5 text-sm text-zinc-900 dark:text-zinc-50">
                    {akte.firmenname}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Rechtsform
                  </dt>
                  <dd className="mt-0.5 text-sm text-zinc-900 dark:text-zinc-50">
                    {displayValue(akte.rechtsform)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Adresse
                  </dt>
                  <dd className="mt-0.5 text-sm text-zinc-900 dark:text-zinc-50">
                    {displayValue(akte.adresse)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    E-Mail
                  </dt>
                  <dd className="mt-0.5 text-sm text-zinc-900 dark:text-zinc-50">
                    {displayValue(akte.email)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Telefon
                  </dt>
                  <dd className="mt-0.5 text-sm text-zinc-900 dark:text-zinc-50">
                    {displayValue(akte.telefon)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Website
                  </dt>
                  <dd className="mt-0.5 text-sm text-zinc-900 dark:text-zinc-50">
                    {displayValue(akte.website)}
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
            )}
          </section>

          <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                Ansprechpartner
              </h3>
              {isEditingContacts ? (
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleCancelEditingContacts}
                    disabled={isSavingContacts}
                    className={buttonSecondaryClassName}
                  >
                    Abbrechen
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveContacts}
                    disabled={isSavingContacts}
                    className={buttonPrimaryClassName}
                  >
                    {isSavingContacts ? "Speichern …" : "Speichern"}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleStartEditingContacts}
                  className={buttonPrimaryClassName}
                >
                  Bearbeiten
                </button>
              )}
            </div>

            {isEditingContacts ? (
              <div className="mt-4 space-y-8">
                {contactsSaveError && (
                  <p
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
                  >
                    {contactsSaveError}
                  </p>
                )}

                <section>
                  <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    Geschäftsführer
                  </h4>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    {gleicherAnsprechpartner
                      ? "Pflichtfeld – der Geschäftsführer wird als Hauptansprechpartner verwendet."
                      : "Optional – kann leer bleiben, wenn kein separater Geschäftsführer hinterlegt ist."}
                  </p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="akte-gf-vorname"
                        className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400"
                      >
                        Vorname
                      </label>
                      <input
                        id="akte-gf-vorname"
                        type="text"
                        value={contactsGf.vorname}
                        onChange={(event) =>
                          updateGeschaeftsfuehrerField("vorname", event.target.value)
                        }
                        disabled={isSavingContacts}
                        className={getInputClassName(!!contactsFieldErrors.gfVorname)}
                      />
                      {contactsFieldErrors.gfVorname && (
                        <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                          {contactsFieldErrors.gfVorname}
                        </p>
                      )}
                    </div>
                    <div>
                      <label
                        htmlFor="akte-gf-nachname"
                        className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400"
                      >
                        Nachname
                      </label>
                      <input
                        id="akte-gf-nachname"
                        type="text"
                        value={contactsGf.nachname}
                        onChange={(event) =>
                          updateGeschaeftsfuehrerField("nachname", event.target.value)
                        }
                        disabled={isSavingContacts}
                        className={getInputClassName(!!contactsFieldErrors.gfNachname)}
                      />
                      {contactsFieldErrors.gfNachname && (
                        <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                          {contactsFieldErrors.gfNachname}
                        </p>
                      )}
                    </div>
                    <div>
                      <label
                        htmlFor="akte-gf-email"
                        className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400"
                      >
                        E-Mail
                      </label>
                      <input
                        id="akte-gf-email"
                        type="email"
                        value={contactsGf.email}
                        onChange={(event) =>
                          updateGeschaeftsfuehrerField("email", event.target.value)
                        }
                        disabled={isSavingContacts}
                        className={getInputClassName(!!contactsFieldErrors.gfEmail)}
                      />
                      {contactsFieldErrors.gfEmail && (
                        <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                          {contactsFieldErrors.gfEmail}
                        </p>
                      )}
                    </div>
                    <div>
                      <PhoneInput
                        id="akte-gf-telefon"
                        label="Telefon"
                        vorwahl={contactsGf.telefonVorwahl}
                        nummer={contactsGf.telefonNummer}
                        onVorwahlChange={(value) =>
                          updateGeschaeftsfuehrerField("telefonVorwahl", value)
                        }
                        onNummerChange={(value) =>
                          updateGeschaeftsfuehrerField("telefonNummer", value)
                        }
                        disabled={isSavingContacts}
                        hasError={!!contactsFieldErrors.gfTelefon}
                        errorMessage={contactsFieldErrors.gfTelefon}
                      />
                    </div>
                  </div>
                </section>

                <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
                  <input
                    id="akte-gleicher-ansprechpartner"
                    type="checkbox"
                    checked={gleicherAnsprechpartner}
                    onChange={(event) =>
                      handleGleicherAnsprechpartnerChange(event.target.checked)
                    }
                    disabled={isSavingContacts}
                    className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900/10 dark:border-zinc-600 dark:bg-zinc-950"
                  />
                  <label
                    htmlFor="akte-gleicher-ansprechpartner"
                    className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    Geschäftsführer ist auch Hauptansprechpartner
                  </label>
                </div>

                {!gleicherAnsprechpartner && (
                  <section>
                    <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      Hauptansprechpartner
                    </h4>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor="akte-ap-vorname"
                          className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400"
                        >
                          Vorname
                        </label>
                        <input
                          id="akte-ap-vorname"
                          type="text"
                          value={contactsAp.vorname}
                          onChange={(event) =>
                            updateHauptansprechpartnerField("vorname", event.target.value)
                          }
                          disabled={isSavingContacts}
                          className={getInputClassName(!!contactsFieldErrors.vorname)}
                        />
                        {contactsFieldErrors.vorname && (
                          <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                            {contactsFieldErrors.vorname}
                          </p>
                        )}
                      </div>
                      <div>
                        <label
                          htmlFor="akte-ap-nachname"
                          className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400"
                        >
                          Nachname
                        </label>
                        <input
                          id="akte-ap-nachname"
                          type="text"
                          value={contactsAp.nachname}
                          onChange={(event) =>
                            updateHauptansprechpartnerField("nachname", event.target.value)
                          }
                          disabled={isSavingContacts}
                          className={getInputClassName(!!contactsFieldErrors.nachname)}
                        />
                        {contactsFieldErrors.nachname && (
                          <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                            {contactsFieldErrors.nachname}
                          </p>
                        )}
                      </div>
                      <div className="sm:col-span-2">
                        <label
                          htmlFor="akte-ap-position"
                          className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400"
                        >
                          Position
                        </label>
                        <input
                          id="akte-ap-position"
                          type="text"
                          value={contactsAp.position}
                          onChange={(event) =>
                            updateHauptansprechpartnerField("position", event.target.value)
                          }
                          disabled={isSavingContacts}
                          className={getInputClassName(!!contactsFieldErrors.position)}
                        />
                        {contactsFieldErrors.position && (
                          <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                            {contactsFieldErrors.position}
                          </p>
                        )}
                      </div>
                      <div>
                        <label
                          htmlFor="akte-ap-email"
                          className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400"
                        >
                          E-Mail
                        </label>
                        <input
                          id="akte-ap-email"
                          type="email"
                          value={contactsAp.email}
                          onChange={(event) =>
                            updateHauptansprechpartnerField("email", event.target.value)
                          }
                          disabled={isSavingContacts}
                          className={getInputClassName(!!contactsFieldErrors.email)}
                        />
                        {contactsFieldErrors.email && (
                          <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                            {contactsFieldErrors.email}
                          </p>
                        )}
                      </div>
                      <div>
                        <PhoneInput
                          id="akte-ap-telefon"
                          label="Telefon"
                          vorwahl={contactsAp.telefonVorwahl}
                          nummer={contactsAp.telefonNummer}
                          onVorwahlChange={(value) =>
                            updateHauptansprechpartnerField("telefonVorwahl", value)
                          }
                          onNummerChange={(value) =>
                            updateHauptansprechpartnerField("telefonNummer", value)
                          }
                          disabled={isSavingContacts}
                          hasError={!!contactsFieldErrors.telefon}
                          errorMessage={contactsFieldErrors.telefon}
                        />
                      </div>
                    </div>
                  </section>
                )}
              </div>
            ) : (
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                {sameContactPerson && akte.hauptansprechpartner ? (
                  <>
                    <div className="sm:col-span-2">
                      <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        Geschäftsführer / Hauptansprechpartner
                      </dt>
                      <dd className="mt-0.5 text-sm text-zinc-900 dark:text-zinc-50">
                        {formatContactName(akte.hauptansprechpartner)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        E-Mail
                      </dt>
                      <dd className="mt-0.5 text-sm text-zinc-900 dark:text-zinc-50">
                        {displayValue(akte.hauptansprechpartner.email)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        Telefon
                      </dt>
                      <dd className="mt-0.5 text-sm text-zinc-900 dark:text-zinc-50">
                        {formatContactTelefon(akte.hauptansprechpartner)}
                      </dd>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="sm:col-span-2">
                      <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        Hauptansprechpartner
                      </dt>
                      <dd className="mt-0.5 text-sm text-zinc-900 dark:text-zinc-50">
                        {hauptansprechpartnerLabel}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        Position
                      </dt>
                      <dd className="mt-0.5 text-sm text-zinc-900 dark:text-zinc-50">
                        {displayValue(akte.hauptansprechpartner?.position)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        E-Mail
                      </dt>
                      <dd className="mt-0.5 text-sm text-zinc-900 dark:text-zinc-50">
                        {displayValue(akte.hauptansprechpartner?.email)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        Telefon
                      </dt>
                      <dd className="mt-0.5 text-sm text-zinc-900 dark:text-zinc-50">
                        {formatContactTelefon(akte.hauptansprechpartner)}
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        Geschäftsführer
                      </dt>
                      <dd className="mt-0.5 text-sm text-zinc-900 dark:text-zinc-50">
                        {geschaeftsfuehrerLabel}
                      </dd>
                    </div>
                    {akte.geschaeftsfuehrer && (
                      <>
                        <div>
                          <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                            E-Mail (Geschäftsführer)
                          </dt>
                          <dd className="mt-0.5 text-sm text-zinc-900 dark:text-zinc-50">
                            {displayValue(akte.geschaeftsfuehrer.email)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                            Telefon (Geschäftsführer)
                          </dt>
                          <dd className="mt-0.5 text-sm text-zinc-900 dark:text-zinc-50">
                            {formatContactTelefon(akte.geschaeftsfuehrer)}
                          </dd>
                        </div>
                      </>
                    )}
                  </>
                )}
              </dl>
            )}
          </section>

          <MandantenAngeboteSection
            organizationId={akte.id}
            angebote={angebote}
          />

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
