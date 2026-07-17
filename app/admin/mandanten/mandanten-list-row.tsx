"use client";

import { useRouter } from "next/navigation";
import { getMandantStatusBadgeClassName } from "@/lib/mandanten/mandant-status";
import type { MandantListItem } from "@/lib/mandanten/get-mandanten-list";

type MandantenListRowProps = {
  mandant: MandantListItem;
};

function displayOrt(ort: string | null) {
  const trimmed = ort?.trim() ?? "";
  return trimmed || "—";
}

export function MandantenListRow({ mandant }: MandantenListRowProps) {
  const router = useRouter();
  const href = `/admin/mandanten/${mandant.id}`;

  function openMandantAkte() {
    router.push(href);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTableRowElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openMandantAkte();
    }
  }

  return (
    <tr
      role="link"
      tabIndex={0}
      aria-label={`Mandant ${mandant.firmenname} öffnen`}
      onClick={openMandantAkte}
      onKeyDown={handleKeyDown}
      className="cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-950/50"
    >
      <td className="px-4 py-3 text-sm font-medium text-zinc-900 dark:text-zinc-50">
        {mandant.firmenname}
      </td>
      <td className="px-4 py-3 text-sm">
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${getMandantStatusBadgeClassName(mandant.status)}`}
        >
          {mandant.statusLabel}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300">
        {mandant.hauptansprechpartner}
      </td>
      <td className="px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300">
        {displayOrt(mandant.ort)}
      </td>
      <td className="px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300">
        {mandant.createdAtLabel}
      </td>
    </tr>
  );
}
