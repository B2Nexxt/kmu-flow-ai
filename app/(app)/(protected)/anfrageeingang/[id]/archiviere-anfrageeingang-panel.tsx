"use client";

import { useActionState, useState } from "react";

import {
  archiviereAnfrageeingangAction,
  type ArchiviereAnfrageeingangActionState,
} from "./actions/archiviere-anfrageeingang-action";

const initialState: ArchiviereAnfrageeingangActionState = {};

type ArchiviereAnfrageeingangPanelProps = {
  anfrageeingangId: string;
};

export function ArchiviereAnfrageeingangPanel({
  anfrageeingangId,
}: ArchiviereAnfrageeingangPanelProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    archiviereAnfrageeingangAction,
    initialState,
  );

  return (
    <section className="mt-8 rounded-lg border border-zinc-200 bg-zinc-50/80 p-5 dark:border-zinc-800 dark:bg-zinc-900/50">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
        Archivierung
      </h2>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Archivierte Anfragen werden aus der aktiven Liste ausgeblendet. Der fachliche
        Status bleibt erhalten.
      </p>

      {!confirmOpen ? (
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="mt-4 inline-flex rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          Anfrage archivieren
        </button>
      ) : (
        <div
          role="region"
          aria-labelledby="archiviere-dialog-title"
          className="mt-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900"
        >
          <h3
            id="archiviere-dialog-title"
            className="text-base font-semibold text-zinc-900 dark:text-zinc-50"
          >
            Anfrage archivieren?
          </h3>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Die Anfrage wird aus der aktiven Liste ausgeblendet. Sie kann später wieder
            reaktiviert werden.
          </p>

          {state.error ? (
            <div
              role="alert"
              className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200"
            >
              {state.error}
            </div>
          ) : null}

          <form action={formAction} className="mt-4">
            <input type="hidden" name="anfrageeingangId" value={anfrageeingangId} />
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirmOpen(false)}
                className="inline-flex rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex rounded-lg border border-zinc-300 bg-zinc-800 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {pending ? "Wird archiviert …" : "Anfrage archivieren"}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
