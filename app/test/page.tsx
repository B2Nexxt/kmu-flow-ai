import { supabase } from "@/lib/supabase/client";

export default async function TestPage() {
  let connected = false;
  let errorMessage: string | null = null;

  try {
    const { error } = await supabase.auth.getSession();

    if (error) {
      errorMessage = error.message;
    } else {
      connected = true;
    }
  } catch (error) {
    errorMessage =
      error instanceof Error
        ? error.message
        : "Ein unbekannter Fehler ist aufgetreten.";
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 dark:bg-zinc-950">
      <main className="max-w-lg rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Supabase-Verbindungstest
        </h1>

        {connected ? (
          <p className="mt-4 text-base font-medium text-green-600 dark:text-green-400">
            Verbindung zu Supabase erfolgreich
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            <p className="text-base font-medium text-red-600 dark:text-red-400">
              Verbindung zu Supabase fehlgeschlagen
            </p>
            {errorMessage && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-left text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
                {errorMessage}
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
