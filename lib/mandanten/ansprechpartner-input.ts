export type AnsprechpartnerPersonInput = {
  vorname: string;
  nachname: string;
  email: string;
  telefonVorwahl: string;
  telefonNummer: string;
};

export type AnsprechpartnerInput = {
  geschaeftsfuehrer: AnsprechpartnerPersonInput;
  hauptansprechpartner: AnsprechpartnerPersonInput & {
    position: string;
    gleicherWieGeschaeftsfuehrer: boolean;
  };
};
