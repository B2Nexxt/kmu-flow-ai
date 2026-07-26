# Unternehmenswissen und Standards

Fachliches Modell für **betriebliches Wissen**, **Standards** und **projektbezogene Ausnahmen**.

**Status:** Verbindlich (Fachkonzept) — **noch nicht implementiert**  
**Bezug:** [`docs/adr/ADR-0009-unternehmensstandards-und-ausnahmen.md`](../adr/ADR-0009-unternehmensstandards-und-ausnahmen.md), [`docs/adr/ADR-0011-unternehmenswissen-als-ki-grundlage.md`](../adr/ADR-0011-unternehmenswissen-als-ki-grundlage.md)

---

## Unternehmenswissen — Umfang

| Kategorie | Beispiele |
| --- | --- |
| Unternehmensleistungen | Leistungskatalog, Leistungstexte |
| Kalkulationsregeln | Zuschläge, Aufschläge, Rundungen |
| Standardmaterialien | Typische Produkte, Dimensionen |
| Standardhersteller | Bevorzugte Marken |
| Lieferanten | Stammdaten, Konditionen |
| Arbeitszeitansätze | Normzeiten pro Tätigkeit |
| Qualitätsstandards | Abnahmekriterien, Checklisten |
| Checklisten | Besichtigung, Abnahme, Sicherheit |
| Vorlagen | Angebot, E-Mail, Dokumente |
| Kommunikationsregeln | Anrede, Fristen, Eskalation |
| Freigabeprozesse | Wer darf was freigeben |
| Erfahrungswerte | Learnings aus Projekten ( strukturiert ) |

---

## Unternehmensstandard

| Eigenschaft | Beschreibung |
| --- | --- |
| **Definiert normale Arbeitsweise** | Default für Kalkulation, Material, Texte |
| **Vom Unternehmen gepflegt** | Keine extern vorgegebenen Pflichtkataloge |
| **Von KI genutzt** | Erste Quelle für Vorschläge und Entwürfe |
| **Keine zwingende Vorgabe** | Standard ist **Default**, nicht **Pflicht** |

---

## Projektbezogene Ausnahme

Ausnahmen vom Standard sind **erlaubt und üblich**:

| Anlass |
| --- |
| Kundenwunsch |
| Lieferengpass |
| Technische Besonderheit |
| Preis / Wettbewerb |
| Sonderlösung |

### Beispiel

| | |
| --- | --- |
| **Standard** | Dachfenster: Velux |
| **Ausnahme** | Kunde wünscht ausdrücklich Roto |
| **Angebot/Projekt** | Verwendet Roto |
| **Unternehmensstandard** | Bleibt Velux (unverändert) |

---

## Verbindliche Regeln

| # | Regel |
| --- | --- |
| 1 | **Standard ist Default, keine Pflicht** |
| 2 | **Abweichungen gelten nur für den konkreten Vorgang** (Anfrage, Besichtigung, Angebot, Projekt) |
| 3 | **Abweichungsgrund kann dokumentiert werden** — optional, empfohlen bei Material/Hersteller |
| 4 | **Historische Angebote und Projekte bleiben Snapshot** — nachträgliche Standardänderung wirkt nicht rückwirkend |
| 5 | **Standards sollen später versionierbar sein** — analog ADR-0004 (Produkt-Versionierung) auf Betriebsebene |
| 6 | **KI erfindet keine Hersteller oder Materialien** |
| 7 | **KI verwendet zuerst Wissen und Standards des Unternehmens** |
| 8 | **Unternehmenswissen einmal erfassen, mehrfach nutzen** — Angebot, Projekt, Materialplanung, Rechnung, Dokumentation |

---

## Abgrenzung: Plattform vs. Betrieb

| Ebene | Wissen |
| --- | --- |
| **Plattform-Admin** | Produktkatalog, Pakete ([`docs/produktkatalog-fachlich.md`](../produktkatalog-fachlich.md)) — Vertrieb an Mandanten |
| **Handwerksbetrieb (Mandant)** | Unternehmenswissen dieses Dokuments — operative Kalkulation und Ausführung |

---

## Änderungshistorie

| Datum | Änderung |
| --- | --- |
| 2026-07-26 | Erstversion |
