import type {
  AngebotEmpfaengerInput,
  AngebotPositionInput,
} from "@/lib/angebote/create-angebot-input";

export type UpdateAngebotEntwurfInput = {
  angebotId: string;
  versionUpdatedAt: string;
  version: {
    angebotDatum: string;
    gueltigBis: string;
    betreff?: string;
    einleitungstext?: string;
    schlusstext?: string;
    empfaenger: AngebotEmpfaengerInput;
  };
  positionen: AngebotPositionInput[];
};
