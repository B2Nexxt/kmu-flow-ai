import {
  ANREDE_LABELS,
  AUFTRAGGEBER_TYP_LABELS,
  isAnrede,
  isAuftraggeberTyp,
  type AuftraggeberTyp,
} from "./auftraggeber-options";

export const KUNDENDATEN_EMPTY_LABEL = "—";

export type KundendatenContactValue = {
  display: string;
  href: string | null;
};

export type KundendatenAnsprechpartnerDisplay = {
  vorname: string;
  nachname: string;
  telefon: KundendatenContactValue;
  mobil: KundendatenContactValue;
  email: KundendatenContactValue;
};

export type AnfrageeingangKundendatenDisplay = {
  layout: "privatperson" | "unternehmen" | "unbekannt" | "fallback";
  typ: string;
  anrede: string;
  vorname: string;
  nachname: string;
  name: string;
  firmenname: string;
  strasse: string;
  hausnummer: string;
  plz: string;
  ort: string;
  telefon: KundendatenContactValue;
  mobil: KundendatenContactValue;
  email: KundendatenContactValue;
  ansprechpartner: KundendatenAnsprechpartnerDisplay | null;
};

function readString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function readObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function emptyLabel(value: string | null | undefined): string {
  return value?.trim() ? value.trim() : KUNDENDATEN_EMPTY_LABEL;
}

function contactValue(value: string | null, hrefPrefix?: "mailto" | "tel"): KundendatenContactValue {
  if (!value) {
    return { display: KUNDENDATEN_EMPTY_LABEL, href: null };
  }
  return {
    display: value,
    href: hrefPrefix ? `${hrefPrefix}:${value}` : null,
  };
}

function typLabel(value: string | null): string {
  if (value && isAuftraggeberTyp(value)) {
    return AUFTRAGGEBER_TYP_LABELS[value];
  }
  return emptyLabel(value);
}

function anredeLabel(value: string | null): string {
  if (value && isAnrede(value)) {
    return ANREDE_LABELS[value];
  }
  return emptyLabel(value);
}

function emptyKundendaten(): AnfrageeingangKundendatenDisplay {
  const empty = contactValue(null);
  return {
    layout: "fallback",
    typ: KUNDENDATEN_EMPTY_LABEL,
    anrede: KUNDENDATEN_EMPTY_LABEL,
    vorname: KUNDENDATEN_EMPTY_LABEL,
    nachname: KUNDENDATEN_EMPTY_LABEL,
    name: KUNDENDATEN_EMPTY_LABEL,
    firmenname: KUNDENDATEN_EMPTY_LABEL,
    strasse: KUNDENDATEN_EMPTY_LABEL,
    hausnummer: KUNDENDATEN_EMPTY_LABEL,
    plz: KUNDENDATEN_EMPTY_LABEL,
    ort: KUNDENDATEN_EMPTY_LABEL,
    telefon: empty,
    mobil: empty,
    email: empty,
    ansprechpartner: null,
  };
}

function mapAdresse(adresse: Record<string, unknown> | null) {
  return {
    strasse: emptyLabel(readString(adresse?.strasse)),
    hausnummer: emptyLabel(readString(adresse?.hausnummer)),
    plz: emptyLabel(readString(adresse?.plz)),
    ort: emptyLabel(readString(adresse?.ort)),
  };
}

function mapAnsprechpartner(
  ansprechpartner: Record<string, unknown> | null,
): KundendatenAnsprechpartnerDisplay | null {
  if (!ansprechpartner) return null;

  const vorname = readString(ansprechpartner.vorname);
  const nachname = readString(ansprechpartner.nachname);
  const telefon = readString(ansprechpartner.telefon);
  const mobil = readString(ansprechpartner.mobil);
  const email = readString(ansprechpartner.email);

  if (!vorname && !nachname && !telefon && !mobil && !email) {
    return null;
  }

  return {
    vorname: emptyLabel(vorname),
    nachname: emptyLabel(nachname),
    telefon: contactValue(telefon, "tel"),
    mobil: contactValue(mobil, "tel"),
    email: contactValue(email, "mailto"),
  };
}

function mapFallbackKundendaten(input: {
  absender_name: string | null;
  absender_email: string | null;
  absender_telefon: string | null;
}): AnfrageeingangKundendatenDisplay {
  const base = emptyKundendaten();
  return {
    ...base,
    layout: "fallback",
    typ: KUNDENDATEN_EMPTY_LABEL,
    name: emptyLabel(input.absender_name),
    telefon: contactValue(input.absender_telefon, "tel"),
    email: contactValue(input.absender_email, "mailto"),
  };
}

function mapUnbekanntKundendaten(
  absender: Record<string, unknown> | null,
): AnfrageeingangKundendatenDisplay {
  const base = emptyKundendaten();
  return {
    ...base,
    layout: "unbekannt",
    typ: AUFTRAGGEBER_TYP_LABELS.unbekannt,
    name: emptyLabel(readString(absender?.name)),
    telefon: contactValue(readString(absender?.telefon), "tel"),
    mobil: contactValue(readString(absender?.mobil), "tel"),
    email: contactValue(readString(absender?.email), "mailto"),
  };
}

function mapPrivatpersonKundendaten(
  privatperson: Record<string, unknown> | null,
  adresse: Record<string, unknown> | null,
): AnfrageeingangKundendatenDisplay {
  const addr = mapAdresse(adresse);
  const base = emptyKundendaten();

  return {
    ...base,
    layout: "privatperson",
    typ: AUFTRAGGEBER_TYP_LABELS.privatperson,
    anrede: anredeLabel(readString(privatperson?.anrede)),
    vorname: emptyLabel(readString(privatperson?.vorname)),
    nachname: emptyLabel(readString(privatperson?.nachname)),
    ...addr,
    telefon: contactValue(readString(privatperson?.telefon), "tel"),
    mobil: contactValue(readString(privatperson?.mobil), "tel"),
    email: contactValue(readString(privatperson?.email), "mailto"),
  };
}

function mapUnternehmenKundendaten(
  unternehmen: Record<string, unknown> | null,
  adresse: Record<string, unknown> | null,
  ansprechpartner: Record<string, unknown> | null,
): AnfrageeingangKundendatenDisplay {
  const addr = mapAdresse(adresse);
  const base = emptyKundendaten();

  return {
    ...base,
    layout: "unternehmen",
    typ: AUFTRAGGEBER_TYP_LABELS.unternehmen,
    firmenname: emptyLabel(readString(unternehmen?.firmenname)),
    ...addr,
    telefon: contactValue(readString(unternehmen?.telefon), "tel"),
    email: contactValue(readString(unternehmen?.email), "mailto"),
    ansprechpartner: mapAnsprechpartner(ansprechpartner),
  };
}

function isEmptyJsonObject(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value as Record<string, unknown>).length === 0
  );
}

export function mapAnfrageeingangKundendaten(input: {
  strukturierte_daten: unknown;
  absender_name: string | null;
  absender_email: string | null;
  absender_telefon: string | null;
}): AnfrageeingangKundendatenDisplay {
  if (isEmptyJsonObject(input.strukturierte_daten)) {
    return mapFallbackKundendaten(input);
  }

  const root = readObject(input.strukturierte_daten);
  const anfragender = readObject(root?.anfragender);

  if (!anfragender) {
    return mapFallbackKundendaten(input);
  }

  const typRaw = readString(anfragender.typ);
  const typ: AuftraggeberTyp | null =
    typRaw && isAuftraggeberTyp(typRaw) ? typRaw : null;

  if (typ === "privatperson") {
    return mapPrivatpersonKundendaten(
      readObject(anfragender.privatperson),
      readObject(anfragender.adresse),
    );
  }

  if (typ === "unternehmen") {
    return mapUnternehmenKundendaten(
      readObject(anfragender.unternehmen),
      readObject(anfragender.adresse),
      readObject(anfragender.ansprechpartner),
    );
  }

  if (typ === "unbekannt" || typRaw === "noch_unbekannt") {
    return mapUnbekanntKundendaten(readObject(anfragender.absender));
  }

  return mapFallbackKundendaten(input);
}
