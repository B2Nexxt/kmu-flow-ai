# ADR-0010: Interne Kalkulation und externe Darstellung

**Status:** Angenommen (verbindlich)  
**Datum:** 2026-07-26  
**Bezug:** [`docs/fachkonzept/07-angebots-und-kalkulationslogik.md`](../fachkonzept/07-angebots-und-kalkulationslogik.md), ADR-0002

---

## Kontext

Handwerksangebote benötigen detaillierte interne Kalkulation (Material, Zeit, GK, Gewinn). Kunden sollen dieselbe Leistung unterschiedlich dargestellt bekommen können (detailliert, gruppiert, pauschal).

Das Plattform-Angebotsmodul V1 (Phase B) speichert Positionen mit Snapshots — **ohne** Trennung intern/extern.

---

## Entscheidung

**Interne Kalkulation und externe Kundendarstellung werden getrennt modelliert.**

| Schicht | Inhalt |
| --- | --- |
| **Intern** | Material, EK, Zeit, Maschinen, GK, Zuschläge, Gewinn, Risiken |
| **Extern** | Konfigurierbare Darstellung (A: detailliert, B: pauschal, C: gruppiert) |

Dieselbe interne Kalkulation kann in **mehreren Darstellungsformen** ausgegeben werden.  
Angebote speichern **Snapshots** — Änderungen am Katalog verändern historische Dokumente nicht (ADR-0002).

---

## Alternativen ( verworfen )

| Alternative | Grund der Ablehnung |
| --- | --- |
| Nur extern sichtbare Positionen speichern | Interne Steuerung und Marge nicht nachvollziehbar |
| Zwei getrennte Angebotsdokumente manuell pflegen | Doppelpflege, Inkonsistenz |
| Immer volle Detailpositionen für Kunden | Nicht jedes Unternehmen wünscht das |

---

## Begründung

1. **Betriebswirtschaft** — Marge und Risiko intern sichtbar.
2. **Kundenkommunikation** — Darstellungsfreiheit pro Unternehmen.
3. **Konsistenz mit ADR-0002** — Externe Darstellung snapshotbar pro Version.

---

## Konsequenzen

### Positiv

- Ein Kalkulationskern, mehrere Output-Profile.
- Rechnung kann später interne oder externe Sicht übernehmen (konfigurierbar).

### Aufwand

- Erweiterung über Angebotsmodul V1 hinaus — **noch nicht implementiert**.
- Mapping interne Positionen → Darstellungsgruppen.

### Nicht Bestandteil dieser Entscheidung

- PDF-Layout (Phase J)
- Konkrete Kalkulationsformeln
- Ist-Schema `angebot_positionen` (bleibt bis Migration unverändert)

---
