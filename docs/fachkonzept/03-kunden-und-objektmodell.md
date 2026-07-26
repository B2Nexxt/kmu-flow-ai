# Kunden- und Objektmodell

Fachliches Modell für **Kundenakte** und **Objekte** in der operativen Handwerksplattform.

**Status:** Verbindlich (Fachkonzept) — **noch keine technische Tabellenstruktur, keine Implementierung**  
**Bezug:** [`docs/adr/ADR-0007-kunden-und-objektmodell.md`](../adr/ADR-0007-kunden-und-objektmodell.md), [`10-technisches-kunden-und-objektmodell.md`](./10-technisches-kunden-und-objektmodell.md), [`../adr/ADR-0016-operative-objektgrundlagen-rls-archivierung.md`](../adr/ADR-0016-operative-objektgrundlagen-rls-archivierung.md)

---

## Kundenakte als zentraler Einstieg

Die **Kundenakte** ist der zentrale Navigations- und Kontexteinstieg im operativen Alltag.

Von hier aus sind sichtbar und erreichbar:

- zugeordnete **Objekte**
- **Vorgänge** (Anfragen, Besichtigungen, Angebote, Projekte, …)
- **Kommunikation** und **Dokumente** — nur im erlaubten Kontext

---

## Kunde und Objekt

| Begriff | Bedeutung |
| --- | --- |
| **Kunde** | Auftraggeber, Eigentümer, Mieter oder Ansprechpartner — natürliche oder juristische Person |
| **Objekt** | Physischer Ort oder Bauteil, an dem Leistungen erbracht werden |

**Ein Kunde kann mehrere Objekte besitzen oder beauftragen.**

---

## Objektangaben

| Feld | Pflicht | Beschreibung |
| --- | --- | --- |
| **Adresse** | ja | Straße, Hausnummer, PLZ, Ort — mandantenbezogen |
| **Gebäudeart** | ja | V1-Werteset (ADR-0016): z. B. `einfamilienhaus`, `mehrfamilienhaus`, `gewerbeobjekt`, `nebengebaeude` |
| **Gebäudebezeichnung** | optional | z. B. Haus A, Hinterhaus, Halle 2 — Pflicht bei mehreren Gebäuden pro Adresse |
| **Einheit / Bereich** | bei MFH **verpflichtend** (Wohnung); bei Gemeinschaftsauftrag passender Typ |

### Gebäudearten (V1, allgemein — keine Gewerke-Spezialwerte)

`einfamilienhaus`, `mehrfamilienhaus`, `wohn_und_geschaeftshaus`, `gewerbeobjekt`, `industrieobjekt`, `oeffentliches_gebaeude`, `nebengebaeude`, `sonstiges`

### Einheitstypen (V1)

`wohnung`, `gewerbeeinheit`, `gemeinschaftsbereich`, `funktionsbereich`, `gebaeudeteil`, `sonstiges`

### Bei Mehrfamilienhäusern (verpflichtend für Wohnungsvorgänge)

Mindestens eines von:

- **Wohnung** / **Einheit** (z. B. EG links, 1. OG rechts) — Typ `wohnung`
- **Gemeinschaftsbereich** (z. B. Treppenhaus, Dach, Keller) — Typ `gemeinschaftsbereich` oder `gebaeudeteil`

**Gesamtes Gebäude:** Vorgang ohne konkrete Einheit zulässig.

---

## Beispiele

| Objektbezeichnung (fachlich) |
| --- |
| Einfamilienhaus — Musterstraße 12 |
| Mehrfamilienhaus — Erdgeschoss links |
| Mehrfamilienhaus — 1. Obergeschoss rechts |
| Mehrfamilienhaus — Dach (Gemeinschaftsbereich) |
| Mehrfamilienhaus — Treppenhaus |
| Gewerbeobjekt — Halle 2 (als eigenes Gebäude an Adresse) |
| Nebengebäude — Garage |

---

## Verbindliche Regeln

| # | Regel |
| --- | --- |
| 1 | **Gleiche Adresse bedeutet niemals automatisch gleicher Kunde.** |
| 2 | **Kunden und Objekte werden nicht allein aufgrund einer Adresse verbunden.** |
| 3 | **Verschiedene Wohnungen derselben Adresse bleiben getrennt** — als eigene Einheiten. |
| 4 | **Ein Mieterwechsel verändert nicht die physische Einheit** — Beziehung wechseln, Einheit **nicht** archivieren. |
| 5 | **Frühere personenbezogene Vorgänge** dürfen **nicht automatisch** einem neuen Mieter zugeordnet oder zugänglich gemacht werden. |
| 6 | **Technische Objektinformationen** und **personenbezogene Vorgangsdaten** müssen **getrennt** behandelt werden. |
| 7 | **Neue Vorgänge** gehören zu einem **eindeutig bestimmten** Kunden- und Objektkontext. |
| 8 | **Bestehende Informationen** nur bei **fachlich und datenschutzrechtlich zulässigem** Kontext wiederverwenden. |
| 9 | **Kundenakte zeigt nur ausdrücklich zugeordnete** Objekte und Vorgänge. |
| 10 | **Archivierung statt Löschen** — historische Vorgänge bleiben referenzierbar (ADR-0016). |
| 11 | **Einheitsbezeichnung eindeutig** pro Gebäude (solange aktiv) — keine Auto-Verknüpfung bei gleichem Namen. |

---

## Datenschutz (fachlich)

| Situation | Verhalten |
| --- | --- |
| Neuer Mieter in bekannter Wohnung | Neuer Kundenkontext; alte Vorgänge des Vormieters nicht automatisch sichtbar |
| Eigentümer vs. Mieter | Rollen und Auftraggeberbeziehung explizit klären |
| Gemeinschaftsbereich | Vorgänge können mehrere Ansprechpartner betreffen — Zuordnung dokumentieren |

Technische Umsetzung: [`10-technisches-kunden-und-objektmodell.md`](./10-technisches-kunden-und-objektmodell.md), ADR-0013, ADR-0016 (RLS-Zielbild).

---

## Änderungshistorie

| Datum | Änderung |
| --- | --- |
| 2026-07-26 | Verweis technisches Zielmodell (Dokument 10, ADR-0013) |
| 2026-07-26 | Gebäudearten, Einheitstypen, Archivierung — ADR-0016 |
