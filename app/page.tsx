import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 dark:bg-zinc-950">
      <main className="flex max-w-2xl flex-col items-center text-center">
        <h1 className="text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-6xl">
          KMU Flow AI
        </h1>
        <p className="mt-6 text-xl text-zinc-600 dark:text-zinc-400 sm:text-2xl">
          Prozesse vereinfachen. Arbeit automatisieren.
        </p>
        <Link
          href="/dashboard"
          className="mt-10 inline-flex h-12 items-center justify-center rounded-lg bg-zinc-900 px-8 text-base font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Zum Dashboard
        </Link>
      </main>
    </div>
  );
}
