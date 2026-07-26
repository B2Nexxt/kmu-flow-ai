# ADR-0009: Unternehmensstandards und projektbezogene Ausnahmen

**Status:** Angenommen (verbindlich)  
**Datum:** 2026-07-26  
**Bezug:** [`docs/fachkonzept/06-unternehmenswissen-und-standards.md`](../fachkonzept/06-unternehmenswissen-und-standards.md)

---

## Kontext

Handwerksbetriebe arbeiten mit Standardmaterialien, Herstellern und Kalkulationsregeln — weichen aber projektweise ab (Kundenwunsch, Engpass). Systeme erzwingen oft globale Standards oder erlauben chaotische Abweichungen ohne Nachvollziehbarkeit.

---

## Entscheidung

**Unternehmensstandards sind Defaultwerte und dürfen pro Vorgang bewusst überschrieben werden.**

| Aspekt | Regel |
| --- | --- |
| Standard | Normale Arbeitsweise; vom Unternehmen gepflegt; KI-Default |
| Ausnahme | Gilt nur für konkreten Vorgang (Anfrage, Angebot, Projekt) |
| Globaler Standard | Bleibt unverändert bei projektbezogener Abweichung |
| Historie | Angebote/Projekte als Snapshot unverändert bei späterer Standardänderung |
| Dokumentation | Abweichungsgrund kann erfasst werden |

---

## Alternativen ( verworfen )

| Alternative | Grund der Ablehnung |
| --- | --- |
| Starre Standards ohne Override | Realität Handwerk (Kundenwunsch) |
| Jede Abweichung ändert globalen Standard | Verwässert Unternehmensnorm |
| Freie Texte ohne Standardbezug | KI ohne Leitplanke, inkonsistente Kalkulation |

---

## Begründung

1. **Realitätsnah** — Velux-Standard, Roto im Projekt (Beispiel Fachkonzept 06).
2. **KI-Leitplanke** — Default aus Standards; Override explizit.
3. **Historische Integrität** — Snapshots + Standardversionierung (später).

---

## Konsequenzen

### Positiv

- Klare Trennung Stammdaten-Standard vs. Vorgangs-Ausnahme.
- Nachvollziehbare Angebotsentscheidungen.

### Aufwand

- Datenmodell: Standard + Override pro Vorgang.
- UI: Abweichung anbieten, nicht verstecken.

### Nicht Bestandteil dieser Entscheidung

- Versionierung von Standards (verwandt mit ADR-0004 auf Betriebsebene)
- Materialstammdaten-Import
- Lieferanten-APIs

---
