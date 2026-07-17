import type { AnsprechpartnerInput, AnsprechpartnerPersonInput } from "@/lib/mandanten/ansprechpartner-input";
import type { MandantAkte, MandantAkteContact } from "@/lib/mandanten/get-mandant-akte";

function emptyPerson(): AnsprechpartnerPersonInput {
  return {
    vorname: "",
    nachname: "",
    email: "",
    telefonVorwahl: "",
    telefonNummer: "",
  };
}

function contactToPerson(contact: MandantAkteContact | null): AnsprechpartnerPersonInput {
  return {
    vorname: contact?.vorname ?? "",
    nachname: contact?.nachname ?? "",
    email: contact?.email ?? "",
    telefonVorwahl: contact?.telefonVorwahl ?? "",
    telefonNummer: contact?.telefonNummer ?? "",
  };
}

export function mapAkteToAnsprechpartnerInput(
  akte: Pick<MandantAkte, "hauptansprechpartner" | "geschaeftsfuehrer">,
): AnsprechpartnerInput {
  const hauptansprechpartner = akte.hauptansprechpartner;
  const geschaeftsfuehrer = akte.geschaeftsfuehrer;
  const gleicherWieGeschaeftsfuehrer = Boolean(
    hauptansprechpartner &&
      geschaeftsfuehrer &&
      hauptansprechpartner.id === geschaeftsfuehrer.id,
  );

  if (gleicherWieGeschaeftsfuehrer && hauptansprechpartner) {
    const person = contactToPerson(hauptansprechpartner);

    return {
      geschaeftsfuehrer: person,
      hauptansprechpartner: {
        ...person,
        position: "Geschäftsführer",
        gleicherWieGeschaeftsfuehrer: true,
      },
    };
  }

  return {
    geschaeftsfuehrer: contactToPerson(geschaeftsfuehrer),
    hauptansprechpartner: {
      ...contactToPerson(hauptansprechpartner),
      position: hauptansprechpartner?.position ?? "",
      gleicherWieGeschaeftsfuehrer: false,
    },
  };
}

export function createEmptyAnsprechpartnerInput(): AnsprechpartnerInput {
  return {
    geschaeftsfuehrer: emptyPerson(),
    hauptansprechpartner: {
      ...emptyPerson(),
      position: "",
      gleicherWieGeschaeftsfuehrer: false,
    },
  };
}
