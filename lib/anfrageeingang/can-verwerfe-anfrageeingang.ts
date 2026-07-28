export function canShowVerwerfeAnfrageeingangAction(input: {
  status: string;
  vorgangZugeordnet?: boolean;
  aktiv?: boolean;
}): boolean {
  if (input.aktiv === false) return false;
  if (input.status === "verworfen") return false;
  if (input.status === "in_vorgang_ueberfuehrt") return false;
  if (input.vorgangZugeordnet) return false;
  return true;
}
