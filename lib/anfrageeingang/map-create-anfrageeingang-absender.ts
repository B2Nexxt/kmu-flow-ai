import type {
  AnsprechpartnerKontakt,
  PrivatpersonKontakt,
  UnbekanntKontakt,
  UnternehmenKontakt,
} from "./build-create-anfrageeingang-strukturierte-daten";
import type { AuftraggeberTyp } from "./auftraggeber-options";

export type AbsenderSpalten = {
  absender_name: string | null;
  absender_email: string | null;
  absender_telefon: string | null;
};

function joinName(parts: Array<string | null>): string | null {
  const combined = parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" ");
  return combined || null;
}

function preferMobilThenTelefon(mobil: string | null, telefon: string | null): string | null {
  return mobil ?? telefon ?? null;
}

export function mapCreateAnfrageeingangAbsender(input: {
  auftraggeberTyp: AuftraggeberTyp;
  unbekannt?: UnbekanntKontakt;
  privatperson?: PrivatpersonKontakt;
  unternehmen?: UnternehmenKontakt;
  ansprechpartner?: AnsprechpartnerKontakt;
}): AbsenderSpalten {
  if (input.auftraggeberTyp === "unbekannt" && input.unbekannt) {
    return {
      absender_name: input.unbekannt.name,
      absender_email: input.unbekannt.email,
      absender_telefon: preferMobilThenTelefon(
        input.unbekannt.mobil,
        input.unbekannt.telefon,
      ),
    };
  }

  if (input.auftraggeberTyp === "privatperson" && input.privatperson) {
    return {
      absender_name: joinName([
        input.privatperson.vorname,
        input.privatperson.nachname,
      ]),
      absender_email: input.privatperson.email,
      absender_telefon: preferMobilThenTelefon(
        input.privatperson.mobil,
        input.privatperson.telefon,
      ),
    };
  }

  if (input.auftraggeberTyp === "unternehmen") {
    const ap = input.ansprechpartner;
    const apName = ap
      ? joinName([ap.vorname, ap.nachname])
      : null;

    return {
      absender_name: apName ?? input.unternehmen?.firmenname ?? null,
      absender_email: ap?.email ?? input.unternehmen?.email ?? null,
      absender_telefon: preferMobilThenTelefon(
        ap?.mobil ?? null,
        ap?.telefon ?? input.unternehmen?.telefon ?? null,
      ),
    };
  }

  return {
    absender_name: null,
    absender_email: null,
    absender_telefon: null,
  };
}
