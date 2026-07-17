export type AngebotEmpfaengerInput = {
  firmenname: string;
  rechtsform?: string;
  strasse?: string;
  hausnummer?: string;
  plz?: string;
  ort?: string;
  land?: string;
  ansprechpartner?: string;
  email?: string;
  telefon?: string;
  umsatzsteuerId?: string;
};

export type AngebotPositionInput = {
  positionNr: number;
  bezeichnung: string;
  beschreibung?: string;
  menge: number;
  einheit?: string;
  einzelpreisNettoCents: number;
  rabattProzent?: number;
  umsatzsteuerSatz: 0 | 7 | 19;
};

export type CreateAngebotInput = {
  organizationId: string;
  version: {
    angebotDatum?: string;
    gueltigBis?: string;
    betreff?: string;
    einleitungstext?: string;
    schlusstext?: string;
    empfaenger: AngebotEmpfaengerInput;
  };
  positionen: AngebotPositionInput[];
};
