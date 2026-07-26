# Angebots- und Kalkulationslogik

Fachliche Logik für **Angebotserstellung**, **interne Kalkulation** und **externe Darstellung** im Handwerksbetrieb.

**Status:** Verbindlich (Fachkonzept) — **teilweise überlappt mit Plattform-Angebotsmodul V1 (Ist)**  
**Bezug:** [`docs/adr/ADR-0010-interne-kalkulation-und-externe-darstellung.md`](../adr/ADR-0010-interne-kalkulation-und-externe-darstellung.md), [`docs/angebote-datenmodell.md`](../angebote-datenmodell.md), [`docs/produktarchitektur.md`](../produktarchitektur.md)

---

## Prozess (Zielbild operativ)

```
Bauleiter empfiehlt fachliche Lösung
    ↓ (Bestätigung)
KI übersetzt in Unternehmensleistungen und Angebotsbausteine
    ↓
Unternehmen nutzt freigegebene Katalogwerte (Positionen, Preise, Standards)
    ↓
Interne Kalkulation (vollständig)
    ↓
Externe Angebotsdarstellung (konfigurierbar)
```

---

## Rollen

| Rolle | Aufgabe |
| --- | --- |
| **Bauleiter** | Fachliche Lösung, Risiko, Machbarkeit |
| **KI** | Übersetzung in Leistungen/Bausteine — nur aus **freigegebenem** Unternehmenswissen |
| **Unternehmen** | Feste Positionen, Preise, Standards, Darstellungsform |
| **Büro/GF** | Freigabe, Anpassung, Kundenkommunikation |

---

## KI und Katalog

| Regel | Beschreibung |
| --- | --- |
| **Nur freigegebene Katalogwerte** | KI nutzt ausschließlich vom Unternehmen freigegebene Leistungen, Materialien und Preise |
| **Individuelle Abweichungen** | Bleiben möglich — dokumentiert als Ausnahme (siehe Fachkonzept 06) |
| **Keine erfundenen Preise** | Konsistent mit [`docs/produktarchitektur.md`](../produktarchitektur.md) — keine 0-Cent-Platzhalter |

---

## Interne Kalkulation (getrennt)

Interne Kalkulation kann enthalten — **nicht zwingend sichtbar für den Kunden**:

| Bestandteil |
| --- |
| Material |
| Einkaufspreise |
| Lieferanten |
| Arbeitszeit |
| Maschinen |
| Gemeinkosten |
| Zuschläge |
| Gewinn |
| Risiken |

---

## Externe Darstellung (konfigurierbar)

| Variante | Beschreibung |
| --- | --- |
| **A — Detailliert** | Jede Einzelposition sichtbar |
| **B — Pauschal** | Nur Gesamtleistung sichtbar |
| **C — Gruppiert** | Mittelweg mit Leistungsgruppen |

**Ein Unternehmen darf seine Darstellungsform wählen.**  
**Dieselbe interne Kalkulation** kann unterschiedlich dargestellt werden.

---

## Verbindliche Regeln

| # | Regel |
| --- | --- |
| 1 | **Interne Kalkulation und externe Darstellung sind getrennt modelliert** (ADR-0010) |
| 2 | **Angebote speichern unveränderliche Snapshots** — ADR-0002; im Plattform-Admin **Ist** für [`angebot_positionen`](../angebote-datenmodell.md) |
| 3 | **Alte Angebote bei Folgeanfragen wiederverwendbar** — fachliche Daten und Ausnahmen nicht stillschweigend überschreiben |
| 4 | **Preise bei Wiederverwendung aktualisierbar** — aus aktuellem Katalog; Snapshot erst bei neuer Version/Freigabe |
| 5 | **Rechnung kann später Angebotsstruktur übernehmen** — Positionen/Snapshots kopieren |

---

## Ist-Zustand Plattform-Admin (Phase B ✅)

| Aspekt | Ist | Ziel operativ / Produktmodell |
| --- | --- | --- |
| Angebote | `angebote`, Versionen, Positionen, Freigabe | Erweiterung um Produktkatalog, Kalkulationsschicht |
| Positionen | Freitext + optional `leistungsmodul_id` (Zwischenlösung) | `produkt_id` + operative Kalkulationsschicht |
| Interne/externe Trennung | Nicht implementiert | Fachkonzept — geplant |
| KI-Kalkulation | Nicht implementiert | Fachkonzept — geplant |

**Keine Implementierungsbehauptung** über den dokumentierten Ist-Stand von Phase B hinaus.

---

## Änderungshistorie

| Datum | Änderung |
| --- | --- |
| 2026-07-26 | Erstversion |
