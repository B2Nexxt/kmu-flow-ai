"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import {
  createAnfrageeingangAction,
  type CreateAnfrageeingangActionState,
} from "./actions/create-anfrageeingang-action";
import {
  ANREDE_LABELS,
  ANREDE_VALUES,
  AUFTRAGGEBER_TYP_LABELS,
  AUFTRAGGEBER_TYP_VALUES,
  DEFAULT_AUFTRAGGEBER_TYP,
  type AuftraggeberTyp,
} from "@/lib/anfrageeingang/auftraggeber-options";
import { ANFRAGEEINGANG_KANAL_LABELS } from "@/lib/anfrageeingang/labels";
import { ANFRAGEEINGANG_KANAL_VALUES } from "@/lib/anfrageeingang/kanal-options";

const initialState: CreateAnfrageeingangActionState = {};

const inputClassName =
  "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 dark:focus:ring-zinc-50/10";

const labelClassName = "mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300";

const sectionTitleClassName =
  "text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400";

const subsectionTitleClassName =
  "text-sm font-medium text-zinc-800 dark:text-zinc-200";

type NeueAnfrageFormProps = {
  defaultEmpfangenAm: string;
};

function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 border-t border-zinc-200 pt-6 first:border-t-0 first:pt-0 dark:border-zinc-800">
      <h2 className={sectionTitleClassName}>{title}</h2>
      {children}
    </section>
  );
}

function TextField({
  id,
  name,
  label,
  type = "text",
  disabled,
  placeholder,
}: {
  id: string;
  name: string;
  label: string;
  type?: string;
  disabled: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className={labelClassName}>
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        disabled={disabled}
        placeholder={placeholder}
        className={inputClassName}
      />
    </div>
  );
}

function UnbekanntFelder({ disabled }: { disabled: boolean }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField id="uk_name" name="uk_name" label="Name" disabled={disabled} />
      <TextField
        id="uk_telefon"
        name="uk_telefon"
        label="Telefonnummer"
        type="tel"
        disabled={disabled}
      />
      <TextField
        id="uk_mobil"
        name="uk_mobil"
        label="Handynummer"
        type="tel"
        disabled={disabled}
      />
      <TextField
        id="uk_email"
        name="uk_email"
        label="E-Mail-Adresse"
        type="email"
        disabled={disabled}
      />
    </div>
  );
}

function PrivatpersonFelder({ disabled }: { disabled: boolean }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="pp_anrede" className={labelClassName}>
            Anrede
          </label>
          <select
            id="pp_anrede"
            name="pp_anrede"
            disabled={disabled}
            defaultValue=""
            className={inputClassName}
          >
            <option value="">Keine Auswahl</option>
            {ANREDE_VALUES.map((anrede) => (
              <option key={anrede} value={anrede}>
                {ANREDE_LABELS[anrede]}
              </option>
            ))}
          </select>
        </div>
        <TextField
          id="pp_vorname"
          name="pp_vorname"
          label="Vorname"
          disabled={disabled}
        />
        <TextField
          id="pp_nachname"
          name="pp_nachname"
          label="Nachname"
          disabled={disabled}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <TextField
            id="pp_strasse"
            name="pp_strasse"
            label="Straße"
            disabled={disabled}
          />
        </div>
        <TextField
          id="pp_hausnummer"
          name="pp_hausnummer"
          label="Hausnummer"
          disabled={disabled}
        />
        <TextField id="pp_plz" name="pp_plz" label="PLZ" disabled={disabled} />
        <div className="sm:col-span-2">
          <TextField id="pp_ort" name="pp_ort" label="Ort" disabled={disabled} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="pp_telefon"
          name="pp_telefon"
          label="Telefonnummer"
          type="tel"
          disabled={disabled}
        />
        <TextField
          id="pp_mobil"
          name="pp_mobil"
          label="Handynummer"
          type="tel"
          disabled={disabled}
        />
        <TextField
          id="pp_email"
          name="pp_email"
          label="E-Mail-Adresse"
          type="email"
          disabled={disabled}
        />
      </div>
    </div>
  );
}

function UnternehmenFelder({ disabled }: { disabled: boolean }) {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className={subsectionTitleClassName}>Unternehmen</h3>
        <TextField
          id="un_firmenname"
          name="un_firmenname"
          label="Firmenname"
          disabled={disabled}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <TextField
              id="un_strasse"
              name="un_strasse"
              label="Straße"
              disabled={disabled}
            />
          </div>
          <TextField
            id="un_hausnummer"
            name="un_hausnummer"
            label="Hausnummer"
            disabled={disabled}
          />
          <TextField id="un_plz" name="un_plz" label="PLZ" disabled={disabled} />
          <div className="sm:col-span-2">
            <TextField id="un_ort" name="un_ort" label="Ort" disabled={disabled} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="un_telefon"
            name="un_telefon"
            label="Telefonnummer"
            type="tel"
            disabled={disabled}
          />
          <TextField
            id="un_email"
            name="un_email"
            label="E-Mail-Adresse"
            type="email"
            disabled={disabled}
          />
        </div>
      </div>

      <div className="space-y-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
        <h3 className={subsectionTitleClassName}>Ansprechpartner</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="ap_vorname"
            name="ap_vorname"
            label="Vorname"
            disabled={disabled}
          />
          <TextField
            id="ap_nachname"
            name="ap_nachname"
            label="Nachname"
            disabled={disabled}
          />
          <TextField
            id="ap_telefon"
            name="ap_telefon"
            label="Telefonnummer"
            type="tel"
            disabled={disabled}
          />
          <TextField
            id="ap_mobil"
            name="ap_mobil"
            label="Handynummer"
            type="tel"
            disabled={disabled}
          />
          <TextField
            id="ap_email"
            name="ap_email"
            label="E-Mail-Adresse"
            type="email"
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}

export function NeueAnfrageForm({ defaultEmpfangenAm }: NeueAnfrageFormProps) {
  const [auftraggeberTyp, setAuftraggeberTyp] = useState<AuftraggeberTyp>(
    DEFAULT_AUFTRAGGEBER_TYP,
  );
  const [state, formAction, pending] = useActionState(
    createAnfrageeingangAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {state.error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200"
        >
          {state.error}
        </div>
      ) : null}

      <FormSection title="Anfrage">
        <div>
          <label htmlFor="kanal" className={labelClassName}>
            Eingangskanal <span className="text-red-600 dark:text-red-400">*</span>
          </label>
          <select
            id="kanal"
            name="kanal"
            required
            disabled={pending}
            defaultValue=""
            className={inputClassName}
          >
            <option value="">Bitte auswählen…</option>
            {ANFRAGEEINGANG_KANAL_VALUES.map((kanal) => (
              <option key={kanal} value={kanal}>
                {ANFRAGEEINGANG_KANAL_LABELS[kanal]}
              </option>
            ))}
          </select>
        </div>

        <TextField
          id="betreff"
          name="betreff"
          label="Betreff"
          disabled={pending}
          placeholder="Kurzbeschreibung der Anfrage"
        />

        <div>
          <label htmlFor="rohinhalt" className={labelClassName}>
            Inhalt
          </label>
          <textarea
            id="rohinhalt"
            name="rohinhalt"
            rows={6}
            disabled={pending}
            className={inputClassName}
            placeholder="Notizen, Gesprächsinhalt oder Nachrichtentext"
          />
        </div>

        <div>
          <label htmlFor="empfangen_am" className={labelClassName}>
            Empfangen am
          </label>
          <input
            id="empfangen_am"
            name="empfangen_am"
            type="datetime-local"
            disabled={pending}
            defaultValue={defaultEmpfangenAm}
            className={inputClassName}
          />
        </div>
      </FormSection>

      <FormSection title="Auftraggeber">
        <div>
          <label htmlFor="auftraggeber_typ" className={labelClassName}>
            Wer hat die Anfrage gestellt?
          </label>
          <select
            id="auftraggeber_typ"
            name="auftraggeber_typ"
            disabled={pending}
            value={auftraggeberTyp}
            onChange={(event) =>
              setAuftraggeberTyp(event.target.value as AuftraggeberTyp)
            }
            className={inputClassName}
          >
            {AUFTRAGGEBER_TYP_VALUES.map((typ) => (
              <option key={typ} value={typ}>
                {AUFTRAGGEBER_TYP_LABELS[typ]}
              </option>
            ))}
          </select>
        </div>

        {auftraggeberTyp === "unbekannt" ? (
          <UnbekanntFelder disabled={pending} />
        ) : null}
        {auftraggeberTyp === "privatperson" ? (
          <PrivatpersonFelder disabled={pending} />
        ) : null}
        {auftraggeberTyp === "unternehmen" ? (
          <UnternehmenFelder disabled={pending} />
        ) : null}
      </FormSection>

      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Mindestens Betreff, Inhalt oder Kontaktdaten sind erforderlich.
      </p>

      <div className="flex flex-wrap gap-3 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <Link
          href="/anfrageeingang"
          className="inline-flex rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Abbrechen
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {pending ? "Wird gespeichert …" : "Anfrage speichern"}
        </button>
      </div>
    </form>
  );
}
