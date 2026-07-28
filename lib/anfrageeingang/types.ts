export type AnfrageeingangStatus =
  | "neu"
  | "analysiert"
  | "wartet_auf_informationen"
  | "zur_manuellen_pruefung"
  | "bereit_fuer_vorgang"
  | "in_vorgang_ueberfuehrt"
  | "verworfen";

export type AnfrageeingangZuordnungsstatus =
  | "kein_treffer"
  | "eindeutig"
  | "moeglicher_treffer"
  | "mehrere_treffer"
  | "konflikt"
  | "bestaetigt"
  | "nicht_erforderlich";

export type AnfrageeingangDringlichkeit = "niedrig" | "normal" | "hoch" | "dringend";

export type AnfrageeingangKanal =
  | "telefon"
  | "email"
  | "kontaktformular"
  | "whatsapp"
  | "sms"
  | "persoenlich"
  | "empfehlung"
  | "sonstiges";

export type AnfrageeingangVollstaendigkeitsstatus =
  | "unbekannt"
  | "unvollstaendig"
  | "ausreichend_fuer_rueckfrage"
  | "ausreichend_fuer_vorgang"
  | "vollstaendig";

/** Rohzeile aus der Listenabfrage (nur explizit geladene Spalten). */
export type AnfrageeingangListRow = {
  id: string;
  eingangsnummer: string;
  empfangen_am: string;
  kanal: string;
  absender_name: string | null;
  absender_email: string | null;
  absender_telefon: string | null;
  betreff: string | null;
  status: string;
  zuordnungsstatus: string;
  dringlichkeit: string;
  manuelle_pruefung_erforderlich: boolean;
};

export type AnfrageeingangListItem = {
  id: string;
  eingangsnummer: string;
  empfangenAmLabel: string;
  kanalLabel: string;
  absenderLabel: string;
  betreffLabel: string;
  statusLabel: string;
  zuordnungsstatusLabel: string;
  dringlichkeitLabel: string;
};

export type AnfrageeingangKpis = {
  neu: number;
  manuellePruefung: number;
  wartetAufInformationen: number;
  bereitFuerVorgang: number;
};

export type AnfrageeingangPageData =
  | { ok: true; rows: AnfrageeingangListItem[]; kpis: AnfrageeingangKpis }
  | { ok: false };

/** Rohzeile aus der Detailabfrage. */
export type AnfrageeingangDetailRow = {
  id: string;
  eingangsnummer: string;
  kanal: string;
  status: string;
  empfangen_am: string;
  zuletzt_bearbeitet_am: string | null;
  beendet_am: string | null;
  betreff: string | null;
  rohinhalt: string | null;
  strukturierte_daten: unknown;
  absender_name: string | null;
  absender_email: string | null;
  absender_telefon: string | null;
  zuordnungsstatus: string;
  zuordnungsgrund: unknown;
  zuordnungskandidaten: unknown;
  vollstaendigkeitsstatus: string;
  fehlende_angaben: unknown;
  confidence_score: number | null;
  dringlichkeit: string;
  manuelle_pruefung_erforderlich: boolean;
  zugeordnet_kunde_id: string | null;
  zugeordnet_gebaeude_id: string | null;
  zugeordnet_einheit_id: string | null;
  zugeordneter_vorgang_id: string | null;
  kanal_externe_id: string | null;
  konversation_id: string | null;
  parent_anfrageeingang_id: string | null;
  created_at: string;
  updated_at: string;
};

export type AnfrageeingangDetailViewModel = {
  id: string;
  status: string;
  canVerwerfen: boolean;
  eingangsnummer: string;
  betreffLabel: string;
  statusLabel: string;
  dringlichkeitLabel: string;
  kanalLabel: string;
  empfangenAmLabel: string;
  zuletztBearbeitetAmLabel: string;
  beendetAmLabel: string;
  rohinhaltLabel: string;
  absenderNameLabel: string;
  absenderEmail: string | null;
  absenderTelefon: string | null;
  zuordnungsstatusLabel: string;
  vollstaendigkeitsstatusLabel: string;
  manuellePruefungLabel: string;
  confidenceScoreLabel: string | null;
  strukturierteDatenJson: string | null;
  strukturierteDatenEmpty: boolean;
  zuordnungsgrundJson: string | null;
  zuordnungskandidatenJson: string | null;
  fehlendeAngabenItems: string[];
  fehlendeAngabenEmpty: boolean;
  kundeZugeordnet: boolean;
  gebaeudeZugeordnet: boolean;
  einheitZugeordnet: boolean;
  vorgangZugeordnet: boolean;
};

export type AnfrageeingangDetailLoadResult =
  | { status: "ok"; detail: AnfrageeingangDetailViewModel }
  | { status: "not_found" }
  | { status: "error" };
