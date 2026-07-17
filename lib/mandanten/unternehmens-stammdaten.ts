import type { MandantStatusCode } from "@/lib/mandanten/mandant-status";

export type UnternehmensStammdatenInput = {
  status: MandantStatusCode;
  firmenname: string;
  rechtsform: string;
  strasse: string;
  hausnummer: string;
  plz: string;
  ort: string;
  land: string;
  email: string;
  telefonVorwahl: string;
  telefonNummer: string;
  website: string;
};
