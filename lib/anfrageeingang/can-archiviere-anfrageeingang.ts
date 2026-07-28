/**
 * Archivierung ist orthogonal zum Prozessstatus.
 * Die Detailseite lädt nur aktiv=true — dort ist die Aktion immer sichtbar.
 */
export function canShowArchiviereAnfrageeingangAction(input?: {
  status?: string;
  aktiv?: boolean;
}): boolean {
  if (input?.aktiv === false) return false;
  return true;
}
