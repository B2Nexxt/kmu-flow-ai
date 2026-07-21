import Link from "next/link";
import { getAngebotStatusBadgeClassName } from "@/lib/angebote/angebot-status";
import type { AngebotListItem } from "@/lib/angebote/get-angebote-list";

type MandantenAngeboteSectionProps = {
  organizationId: string;
  angebote: AngebotListItem[];
};

const buttonPrimaryClassName =
  "inline-flex h-11 items-center justify-center rounded-lg bg-zinc-900 px-6 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200";

const actionLinkClassName =
  "inline-flex items-center rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800";

function formatCurrencyFromCents(cents: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

export function MandantenAngeboteSection({
  organizationId,
  angebote,
}: MandantenAngeboteSectionProps) {
  const neuesAngebotHref = `/admin/angebote/neu?organizationId=${encodeURIComponent(organizationId)}`;

  return (
    <section className="mt-8 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            Angebote
          </h3>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Alle Angebote dieses Mandanten.
          </p>
        </div>
        <Link href={neuesAngebotHref} className={buttonPrimaryClassName}>
          Neues Angebot
        </Link>
      </div>

      {angebote.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 px-6 py-10 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Für diesen Mandanten wurden noch keine Angebote angelegt.
          </p>
          <Link href={neuesAngebotHref} className={`${buttonPrimaryClassName} mt-6`}>
            Erstes Angebot erstellen
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[40rem] w-full divide-y divide-zinc-200 dark:divide-zinc-800">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-950/50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Angebotsnummer
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Betreff
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Angebotsdatum
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Gesamtbetrag brutto
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Aktion
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {angebote.map((angebot) => (
                <tr key={angebot.angebotId}>
                  <td className="px-4 py-3 text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {angebot.angebotsnummerLabel}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300">
                    {angebot.betreffLabel}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${getAngebotStatusBadgeClassName(angebot.status)}`}
                    >
                      {angebot.statusLabel}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300">
                    {angebot.angebotDatumLabel}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300">
                    {formatCurrencyFromCents(angebot.gesamtBruttoCents)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <Link
                      href={`/admin/angebote/${angebot.angebotId}`}
                      className={actionLinkClassName}
                    >
                      Öffnen
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
