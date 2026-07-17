import type { UnternehmensStammdatenInput } from "@/lib/mandanten/unternehmens-stammdaten";

function nullIfEmpty(value: string) {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function buildUpdateStammdatenPayload(input: UnternehmensStammdatenInput) {
  return {
    status: input.status,
    name: input.firmenname.trim(),
    rechtsform: input.rechtsform.trim(),
    strasse: input.strasse.trim(),
    hausnummer: nullIfEmpty(input.hausnummer),
    plz: input.plz.trim(),
    ort: input.ort.trim(),
    land: input.land.trim(),
    email: nullIfEmpty(input.email),
    telefon_vorwahl: nullIfEmpty(input.telefonVorwahl),
    telefon_nummer: nullIfEmpty(input.telefonNummer),
    website: nullIfEmpty(input.website),
  };
}
