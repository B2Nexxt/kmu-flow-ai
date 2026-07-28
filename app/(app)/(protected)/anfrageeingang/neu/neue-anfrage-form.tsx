"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  createAnfrageeingangAction,
  type CreateAnfrageeingangActionState,
} from "./actions/create-anfrageeingang-action";
import { ANFRAGEEINGANG_KANAL_LABELS } from "@/lib/anfrageeingang/labels";
import {
  ANFRAGEEINGANG_KANAL_VALUES,
  DEFAULT_ANFRAGEEINGANG_KANAL,
} from "@/lib/anfrageeingang/kanal-options";

const initialState: CreateAnfrageeingangActionState = {};

const inputClassName =
  "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 dark:focus:ring-zinc-50/10";

const labelClassName = "mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300";

type NeueAnfrageFormProps = {
  defaultEmpfangenAm: string;
};

export function NeueAnfrageForm({ defaultEmpfangenAm }: NeueAnfrageFormProps) {
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

      <div>
        <label htmlFor="kanal" className={labelClassName}>
          Kanal
        </label>
        <select
          id="kanal"
          name="kanal"
          required
          disabled={pending}
          defaultValue={DEFAULT_ANFRAGEEINGANG_KANAL}
          className={inputClassName}
        >
          {ANFRAGEEINGANG_KANAL_VALUES.map((kanal) => (
            <option key={kanal} value={kanal}>
              {ANFRAGEEINGANG_KANAL_LABELS[kanal]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="betreff" className={labelClassName}>
          Betreff
        </label>
        <input
          id="betreff"
          name="betreff"
          type="text"
          disabled={pending}
          className={inputClassName}
          placeholder="Kurzbeschreibung der Anfrage"
        />
      </div>

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

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="absender_name" className={labelClassName}>
            Absender — Name
          </label>
          <input
            id="absender_name"
            name="absender_name"
            type="text"
            disabled={pending}
            className={inputClassName}
          />
        </div>
        <div>
          <label htmlFor="absender_email" className={labelClassName}>
            Absender — E-Mail
          </label>
          <input
            id="absender_email"
            name="absender_email"
            type="email"
            disabled={pending}
            className={inputClassName}
          />
        </div>
        <div>
          <label htmlFor="absender_telefon" className={labelClassName}>
            Absender — Telefon
          </label>
          <input
            id="absender_telefon"
            name="absender_telefon"
            type="tel"
            disabled={pending}
            className={inputClassName}
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
      </div>

      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Mindestens Betreff, Inhalt oder eine Absenderangabe ist erforderlich.
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
