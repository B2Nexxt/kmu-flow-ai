# ADR-0006: Informationsaufnahme statt Dateneingabe

**Status:** Angenommen (verbindlich)  
**Datum:** 2026-07-26  
**Bezug:** [`docs/fachkonzept/02-grundprinzipien.md`](../fachkonzept/02-grundprinzipien.md), [`docs/fachkonzept/05-besichtigung-und-informationserfassung.md`](../fachkonzept/05-besichtigung-und-informationserfassung.md)

---

## Kontext

Handwerker erfassen Informationen unterwegs — oft per Sprache, WhatsApp oder Foto, nicht am Desktop-Formular. Starre Dateneingabe führt zu unvollständigen oder verzögerten Daten.

---

## Entscheidung

**Informationen können kanalunabhängig erfasst und anschließend strukturiert werden.**

- Kein Nutzer ist an einen Eingabekanal gebunden.
- KI strukturiert, extrahiert und ordnet **nach** dem Eingang.
- KI-Ergebnisse sind **prüfbar und bestätigbar**.
- Fachlich kritische Ergebnisse werden **nicht ungeprüft übernommen**.

Leitsatz: **Informationsaufnahme statt Dateneingabe.**

---

## Alternativen ( verworfen )

| Alternative | Grund der Ablehnung |
| --- | --- |
| Pflicht-Formulare für alle Kanäle | Widerspricht Arbeitsrealität auf Baustelle |
| KI übernimmt ohne Bestätigung | Widerspricht Grundprinzip „Mensch entscheidet“ |
| Nur ein Kanal (App-Formular) | Schließt Monteure und Kunden ohne App aus |

---

## Begründung

1. **Akzeptanz** — System passt sich Kommunikationswegen an.
2. **Vollständigkeit** — Lückenprüfung nach Erfassung statt Blockade während Erfassung.
3. **Qualität** — Mensch bestätigt fachlich Kritisches; KI übernimmt Strukturierung.

---

## Konsequenzen

### Positiv

- Einheitliche fachliche Objekte (Anfrage, Besichtigung) unabhängig vom Kanal.
- KI-Pipeline als Querschnitt (Extraktion, Validierung, Nachfragen).

### Aufwand

- Kanal-Ingestion (E-Mail, WhatsApp, Sprache) als Infrastruktur.
- Bestätigungs-UI für extrahierte Felder.
- Protokollierung: Rohinput vs. bestätigte Struktur.

### Nicht Bestandteil dieser Entscheidung

- Konkrete WhatsApp-/SMS-Provider-Integration
- Sprachmodell-Auswahl
- Checklisten-Inhalt pro Gewerk

---
