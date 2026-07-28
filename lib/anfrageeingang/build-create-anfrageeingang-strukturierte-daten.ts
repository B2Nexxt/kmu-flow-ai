import type { Anrede, AuftraggeberTyp } from "./auftraggeber-options";

export const MANUELLE_ANFRAGE_FORMULARVERSION = "manuelle_anfrage_v1";

export const DEFAULT_ADRESSE_LAND = "Deutschland";

export type UnbekanntKontakt = {
  name: string | null;
  telefon: string | null;
  mobil: string | null;
  email: string | null;
};

export type PrivatpersonKontakt = {
  anrede: Anrede | null;
  vorname: string | null;
  nachname: string | null;
  telefon: string | null;
  mobil: string | null;
  email: string | null;
};

export type UnternehmenKontakt = {
  firmenname: string | null;
  telefon: string | null;
  email: string | null;
};

export type AnsprechpartnerKontakt = {
  vorname: string | null;
  nachname: string | null;
  telefon: string | null;
  mobil: string | null;
  email: string | null;
};

export type AdresseKontakt = {
  strasse: string | null;
  hausnummer: string | null;
  plz: string | null;
  ort: string | null;
};

function omitEmpty<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && value !== undefined && value !== "") {
      result[key as keyof T] = value as T[keyof T];
    }
  }
  return result;
}

function buildAdresse(adresse: AdresseKontakt): Record<string, string> | null {
  const partial = omitEmpty({
    strasse: adresse.strasse,
    hausnummer: adresse.hausnummer,
    plz: adresse.plz,
    ort: adresse.ort,
  });

  if (Object.keys(partial).length === 0) {
    return null;
  }

  return {
    ...partial,
    land: DEFAULT_ADRESSE_LAND,
  } as Record<string, string>;
}

export function buildCreateAnfrageeingangStrukturierteDaten(input: {
  auftraggeberTyp: AuftraggeberTyp;
  unbekannt?: UnbekanntKontakt;
  privatperson?: PrivatpersonKontakt;
  privatpersonAdresse?: AdresseKontakt;
  unternehmen?: UnternehmenKontakt;
  ansprechpartner?: AnsprechpartnerKontakt;
  unternehmenAdresse?: AdresseKontakt;
}): Record<string, unknown> {
  const anfragender: Record<string, unknown> = {
    typ: input.auftraggeberTyp,
  };

  if (input.auftraggeberTyp === "unbekannt" && input.unbekannt) {
    const absender = omitEmpty({
      name: input.unbekannt.name,
      telefon: input.unbekannt.telefon,
      mobil: input.unbekannt.mobil,
      email: input.unbekannt.email,
    });
    if (Object.keys(absender).length > 0) {
      anfragender.absender = absender;
    }
  }

  if (input.auftraggeberTyp === "privatperson" && input.privatperson) {
    const privatperson = omitEmpty({
      anrede: input.privatperson.anrede,
      vorname: input.privatperson.vorname,
      nachname: input.privatperson.nachname,
      telefon: input.privatperson.telefon,
      mobil: input.privatperson.mobil,
      email: input.privatperson.email,
    });
    if (Object.keys(privatperson).length > 0) {
      anfragender.privatperson = privatperson;
    }

    const adresse = buildAdresse(input.privatpersonAdresse ?? {
      strasse: null,
      hausnummer: null,
      plz: null,
      ort: null,
    });
    if (adresse) {
      anfragender.adresse = adresse;
    }
  }

  if (input.auftraggeberTyp === "unternehmen") {
    if (input.unternehmen) {
      const unternehmen = omitEmpty({
        firmenname: input.unternehmen.firmenname,
        telefon: input.unternehmen.telefon,
        email: input.unternehmen.email,
      });
      if (Object.keys(unternehmen).length > 0) {
        anfragender.unternehmen = unternehmen;
      }
    }

    if (input.ansprechpartner) {
      const ansprechpartner = omitEmpty({
        vorname: input.ansprechpartner.vorname,
        nachname: input.ansprechpartner.nachname,
        telefon: input.ansprechpartner.telefon,
        mobil: input.ansprechpartner.mobil,
        email: input.ansprechpartner.email,
      });
      if (Object.keys(ansprechpartner).length > 0) {
        anfragender.ansprechpartner = ansprechpartner;
      }
    }

    const adresse = buildAdresse(input.unternehmenAdresse ?? {
      strasse: null,
      hausnummer: null,
      plz: null,
      ort: null,
    });
    if (adresse) {
      anfragender.adresse = adresse;
    }
  }

  return {
    formularversion: MANUELLE_ANFRAGE_FORMULARVERSION,
    anfragender,
  };
}
