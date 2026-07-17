import type { CreateAngebotInput } from "@/lib/angebote/create-angebot-input";

function optionalText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function buildCreateAngebotPayload(input: CreateAngebotInput) {
  const empfaenger = input.version.empfaenger;

  return {
    organization_id: input.organizationId.trim(),
    version: {
      ...(input.version.angebotDatum?.trim()
        ? { angebot_datum: input.version.angebotDatum.trim() }
        : {}),
      ...(input.version.gueltigBis?.trim()
        ? { gueltig_bis: input.version.gueltigBis.trim() }
        : {}),
      betreff: optionalText(input.version.betreff),
      einleitungstext: optionalText(input.version.einleitungstext),
      schlusstext: optionalText(input.version.schlusstext),
      empfaenger: {
        firmenname: empfaenger.firmenname.trim(),
        rechtsform: optionalText(empfaenger.rechtsform),
        strasse: optionalText(empfaenger.strasse),
        hausnummer: optionalText(empfaenger.hausnummer),
        plz: optionalText(empfaenger.plz),
        ort: optionalText(empfaenger.ort),
        land: optionalText(empfaenger.land),
        ansprechpartner: optionalText(empfaenger.ansprechpartner),
        email: optionalText(empfaenger.email),
        telefon: optionalText(empfaenger.telefon),
        umsatzsteuer_id: optionalText(empfaenger.umsatzsteuerId),
      },
    },
    positionen: input.positionen.map((position) => ({
      position_nr: position.positionNr,
      bezeichnung: position.bezeichnung.trim(),
      beschreibung: optionalText(position.beschreibung),
      menge: position.menge,
      einheit: optionalText(position.einheit) ?? "Stk.",
      einzelpreis_netto_cents: position.einzelpreisNettoCents,
      rabatt_prozent: position.rabattProzent ?? 0,
      umsatzsteuer_satz: position.umsatzsteuerSatz,
    })),
  };
}
