"use client";

import { useActionState, useState } from "react";

import {
  verwerfeAnfrageeingangAction,
  type VerwerfeAnfrageeingangActionState,
} from "./actions/verwerfe-anfrageeingang-action";

const initialState: VerwerfeAnfrageeingangActionState = {};

type VerwerfeAnfrageeingangPanelProps = {
  anfrageeingangId: string;
};

export function VerwerfeAnfrageeingangPanel({
  anfrageeingangId,
}: VerwerfeAnfrageeingangPanelProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    verwerfeAnfrageeingangAction,
    initialState,
  );

  return (
    <section className="mt-8 rounded-lg border border-red-200 bg-red-50/50 p-5 dark:border-red-900/40 dark:bg-red-950/20">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-red-800 dark:text-red-200">
        Gefahrzone
      </h2>
      <p className="mt-2 text-sm text-red-900/80 dark:text-red-100/80">
        Verworfene Anfragen bleiben zur Nachvollziehbarkeit erhalten und können nicht
        wieder geöffnet werden.
      </p>

      {!confirmOpen ? (
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="mt-4 inline-flex rounded-lg border border-red-300 bg-white px-4 py-2.5 text-sm font-medium text-red-800 transition-colors hover:bg-red-50 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100 dark:hover:bg-red-950/60"
        >
          Anfrage verwerfen
        </button>
      ) : (
        <div
          role="region"
          aria-labelledby="verwerfe-dialog-title"
          className="mt-4 rounded-lg border border-red-200 bg-white p-4 dark:border-red-900/50 dark:bg-zinc-900"
        >
          <h3
            id="verwerfe-dialog-title"
            className="text-base font-semibold text-zinc-900 dark:text-zinc-50"
          >
            Anfrage verwerfen?
          </h3>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Die Anfrage wird als verworfen markiert. Sie bleibt zur Nachvollziehbarkeit
            erhalten.
          </p>

          {state.error ? (
            <div
              role="alert"
              className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200"
            >
              {state.error}
            </div>
          ) : null}

          <form action={formAction} className="mt-4 space-y-4">
            <input type="hidden" name="anfrageeingangId" value={anfrageeingangId} />
            <div>
              <label
                htmlFor="verwerfe-grund"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Begründung
              </label>
              <textarea
                id="verwerfe-grund"
                name="grund"
                required
                rows={3}
                disabled={pending}
                placeholder="Warum wird diese Anfrage verworfen?"
                className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setConfirmOpen(false);
                }}
                className="inline-flex rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex rounded-lg border border-red-300 bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-800 dark:bg-red-800 dark:hover:bg-red-700"
              >
                {pending ? "Wird verworfen …" : "Anfrage verwerfen"}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
