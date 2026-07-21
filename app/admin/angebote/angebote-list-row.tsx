"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { getAngebotStatusBadgeClassName } from "@/lib/angebote/angebot-status";
import type { AngebotListItem } from "@/lib/angebote/get-angebote-list";

type AngeboteListRowProps = {
  angebot: AngebotListItem;
};

const actionLinkClassName =
  "inline-flex items-center rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800";

function formatCurrencyFromCents(cents: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

export function AngeboteListRow({ angebot }: AngeboteListRowProps) {
  const router = useRouter();
  const href = `/admin/angebote/${angebot.angebotId}`;

  function openAngebotsAkte() {
    router.push(href);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTableRowElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openAngebotsAkte();
    }
  }

  return (
    <tr
      role="link"
      tabIndex={0}
      aria-label={`Angebot ${angebot.angebotsnummerLabel} öffnen`}
      onClick={openAngebotsAkte}
      onKeyDown={handleKeyDown}
      className="cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-950/50"
    >
      <td className="px-4 py-3 text-sm font-medium text-zinc-900 dark:text-zinc-50">
        {angebot.angebotsnummerLabel}
      </td>
      <td className="px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300">
        {angebot.mandantenname}
      </td>
      <td className="px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300">
        {angebot.betreffLabel}
      </td>
      <td className="px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300">
        {angebot.angebotDatumLabel}
      </td>
      <td className="px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300">
        {angebot.gueltigBisLabel}
      </td>
      <td className="px-4 py-3 text-sm">
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${getAngebotStatusBadgeClassName(angebot.status)}`}
        >
          {angebot.statusLabel}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300">
        {formatCurrencyFromCents(angebot.gesamtBruttoCents)}
      </td>
      <td className="px-4 py-3 text-sm">
        <Link
          href={href}
          onClick={(event) => event.stopPropagation()}
          className={actionLinkClassName}
        >
          Öffnen
        </Link>
      </td>
    </tr>
  );
}
