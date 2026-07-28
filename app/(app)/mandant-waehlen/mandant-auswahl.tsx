"use client";

import { useActionState } from "react";

import { logoutAction } from "@/app/(app)/login/actions/logout-action";

import {
  MANDANT_SELECTION_INVALID_COOKIE_MESSAGE,
  MANDANT_SELECTION_TECHNICAL_ERROR_MESSAGE,
} from "@/lib/operative-auth/mandant-selection-messages";

import {
  selectActiveMandantAction,
  type SelectMandantActionState,
} from "./actions/select-mandant-action";

export type MandantAuswahlItem = {
  organizationId: string;
  organizationName: string;
  roleLabel: string;
  isCurrent: boolean;
};

type MandantAuswahlProps = {
  memberships: MandantAuswahlItem[];
  showInvalidHint: boolean;
  loadError?: boolean;
};

const initialState: SelectMandantActionState = {};

export default function MandantAuswahl({
  memberships,
  showInvalidHint,
  loadError = false,
}: MandantAuswahlProps) {
  const [state, formAction, pending] = useActionState(
    selectActiveMandantAction,
    initialState,
  );

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-6 py-16">
      <div className="mb-8 text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          KMU Flow AI
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Betrieb auswählen
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Wählen Sie den Handwerksbetrieb aus, in dem Sie arbeiten möchten.
        </p>
      </div>

      {showInvalidHint ? (
        <div
          role="status"
          className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100"
        >
          {MANDANT_SELECTION_INVALID_COOKIE_MESSAGE}
        </div>
      ) : null}

      {loadError ? (
        <div
          role="alert"
          className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100"
        >
          {MANDANT_SELECTION_TECHNICAL_ERROR_MESSAGE}
        </div>
      ) : null}

      {state.error ? (
        <div
          role="alert"
          className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100"
        >
          {state.error}
        </div>
      ) : null}

      <ul className="space-y-4">
        {memberships.map((membership) => (
          <li
            key={membership.organizationId}
            className={`rounded-xl border bg-white p-5 shadow-sm dark:bg-zinc-900 ${
              membership.isCurrent
                ? "border-zinc-900 ring-1 ring-zinc-900/10 dark:border-zinc-100 dark:ring-zinc-100/10"
                : "border-zinc-200 dark:border-zinc-800"
            }`}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                    {membership.organizationName}
                  </h2>
                  {membership.isCurrent ? (
                    <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      Aktuell ausgewählt
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Rolle: {membership.roleLabel}
                </p>
              </div>

              <form action={formAction} className="shrink-0">
                <input
                  type="hidden"
                  name="organizationId"
                  value={membership.organizationId}
                />
                <button
                  type="submit"
                  disabled={pending || loadError}
                  className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  {pending ? "Wird geöffnet…" : "Diesen Betrieb öffnen"}
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-10 border-t border-zinc-200 pt-6 text-center dark:border-zinc-800">
        <form action={logoutAction}>
          <button
            type="submit"
            className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            Abmelden
          </button>
        </form>
      </div>
    </div>
  );
}
