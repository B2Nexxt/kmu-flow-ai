"use client";

import { useActionState } from "react";

import { loginAction, type LoginActionState } from "./actions/login-action";

const initialState: LoginActionState = {};

const inputClassName =
  "w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500";

function fieldClassName(hasError: boolean) {
  return hasError
    ? `${inputClassName} border-red-300 focus:border-red-400 focus:ring-red-500/10 dark:border-red-800 dark:focus:border-red-700 dark:focus:ring-red-500/20`
    : `${inputClassName} border-zinc-200 focus:border-zinc-400 focus:ring-zinc-900/10 dark:border-zinc-700 dark:focus:border-zinc-600 dark:focus:ring-zinc-50/10`;
}

export default function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-16">
      <div className="rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-8 text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            KMU Flow AI
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Anmelden
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Operative Plattform für Ihren Handwerksbetrieb
          </p>
        </div>

        <form action={formAction} className="space-y-5" noValidate>
          {state.formError ? (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100"
            >
              {state.formError}
            </div>
          ) : null}

          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              E-Mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              disabled={pending}
              aria-invalid={Boolean(state.fieldErrors?.email)}
              aria-describedby={state.fieldErrors?.email ? "email-error" : undefined}
              className={fieldClassName(Boolean(state.fieldErrors?.email))}
              placeholder="name@beispiel.de"
            />
            {state.fieldErrors?.email ? (
              <p id="email-error" className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                {state.fieldErrors.email}
              </p>
            ) : null}
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Passwort
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              disabled={pending}
              aria-invalid={Boolean(state.fieldErrors?.password)}
              aria-describedby={
                state.fieldErrors?.password ? "password-error" : undefined
              }
              className={fieldClassName(Boolean(state.fieldErrors?.password))}
            />
            {state.fieldErrors?.password ? (
              <p id="password-error" className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                {state.fieldErrors.password}
              </p>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={pending}
            className="flex w-full items-center justify-center rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {pending ? "Wird angemeldet…" : "Anmelden"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            disabled
            className="cursor-not-allowed text-sm text-zinc-400 dark:text-zinc-500"
            aria-disabled="true"
            title="Passwort zurücksetzen folgt in einem späteren Schritt"
          >
            Passwort vergessen
          </button>
        </div>
      </div>
    </div>
  );
}
