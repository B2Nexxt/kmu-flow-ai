export default function KeinZugangPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Kein Mandantenzugang</h1>
      <p className="mt-3 text-zinc-600 dark:text-zinc-400">
        Für Ihr Benutzerkonto ist derzeit keine aktive operative Mandantenmitgliedschaft
        hinterlegt. Wenden Sie sich an Ihren Administrator.
      </p>
    </div>
  );
}
