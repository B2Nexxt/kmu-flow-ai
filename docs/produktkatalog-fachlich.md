# Produktkatalog (fachliche Vorlage, Phase 0)

Fachliche **Vorlage und Kandidatenliste** für verkaufbare Produkte — Pakete und Dienstleistungen. Noch **keine Migration**, **keine Seed-Daten**, **keine erfundenen Preise**.

**Status:** Freigabevorbereitung (Phase 0) — Preise und Paketbestandteile teilweise offen  
**Bezug:** [`docs/produktarchitektur.md`](./produktarchitektur.md), [`docs/plattformmodule-katalog.md`](./plattformmodule-katalog.md)

---

## Katalogschema (Fachvorlage)

Jedes Produkt wird später in der Tabelle `produkte` abgebildet. Pflichtfelder vor Seed/Migration:

| Feld | Typ / Werte | Beschreibung |
| --- | --- | --- |
| `code` | text, UNIQUE | Global eindeutiger fachlicher Code |
| `name` | text | Anzeigename in Angeboten und Admin |
| `beschreibung` | text, nullable | Ausführliche Produktbeschreibung |
| `produkttyp` | `paket` \| `dienstleistung` | Paket aktiviert Plattformmodule; Dienstleistung nicht |
| `preisart` | `einmalig` \| `monatlich` | V1: monatlich = Preis pro Monat |
| `einzelpreis_netto_cents` | bigint, ≥ 0 | Listenpreis netto in Cent — **Pflicht vor Seed; keine 0-Cent-Platzhalter** |
| `einheit` | text | z. B. `Stk.`, `Monat`, `Tag` |
| `umsatzsteuer_satz` | 0 \| 7 \| 19 | Umsatzsteuer-Satz in Prozent |
| `aktiv` | boolean | Steuert Auswählbarkeit in neuen Angeboten |
| `sortierung` | integer ≥ 0 | Reihenfolge in Auswahllisten |
| `enthaltene_plattformmodule` | nur bei `produkttyp = paket` | Liste von `plattformmodule.code` über `produkt_plattformmodule` |

**Hinweis Schema:** In [`docs/produktarchitektur.md`](./produktarchitektur.md) heißt das DB-Feld `produkttyp` analog zu dieser Fachvorlage.

---

## Produktkandidaten — Pakete

| code | name | beschreibung | produkttyp | preisart | einzelpreis_netto_cents | einheit | umsatzsteuer_satz | aktiv | sortierung | enthaltene Plattformmodule |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- |
| `PAK-BASIS` | Basispaket | Einstiegspaket mit grundlegenden Plattformfunktionen für operative Mandantenarbeit. | `paket` | noch festzulegen | noch festzulegen | noch festzulegen | noch festzulegen | ja | 10 | **offen** |
| `PAK-KI` | KI-Paket | Paket mit Schwerpunkt KI-gestützter Assistenz und zugehöriger Plattformfunktionen. | `paket` | noch festzulegen | noch festzulegen | noch festzulegen | noch festzulegen | ja | 20 | **offen** |
| `PAK-ENTERPRISE` | Enterprise-Paket | Vollständiges oder erweitertes Funktionspaket für Mandanten mit höherem Digitalisierungsbedarf. | `paket` | noch festzulegen | noch festzulegen | noch festzulegen | noch festzulegen | ja | 30 | **offen** |

---

## Produktkandidaten — Dienstleistungen

Dienstleistungen aktivieren **keine** Plattformmodule. Sie sind **immer zusätzlich** zu Paketen wählbar.

| code | name | beschreibung | produkttyp | preisart | einzelpreis_netto_cents | einheit | umsatzsteuer_satz | aktiv | sortierung | enthaltene Plattformmodule |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- |
| `DL-EINRICHTUNG` | Einrichtung | Technische und organisatorische Einrichtung des Mandantenkontos nach Vertragsannahme. | `dienstleistung` | noch festzulegen | noch festzulegen | noch festzulegen | noch festzulegen | ja | 110 | — |
| `DL-SCHULUNG` | Schulung | Benutzer- und Prozessschulung für Mandantenmitarbeiter. | `dienstleistung` | noch festzulegen | noch festzulegen | noch festzulegen | noch festzulegen | ja | 120 | — |
| `DL-DATENMIGRATION` | Datenmigration | Übernahme und Aufbereitung bestehender Stammdaten oder Dokumente in die Plattform. | `dienstleistung` | noch festzulegen | noch festzulegen | noch festzulegen | noch festzulegen | ja | 130 | — |
| `DL-ENTWICKLUNG` | Individuelle Entwicklung | Mandantenspezifische Anpassungen, Integrationen oder Erweiterungen. | `dienstleistung` | noch festzulegen | noch festzulegen | noch festzulegen | noch festzulegen | ja | 140 | — |

---

## Paketbeziehungen — voraussichtliche Plattformmodule

**Status:** Noch **nicht verbindlich** freigegeben. Die Spalte „voraussichtlich“ dient der fachlichen Diskussion; Seed und Migration erst nach expliziter Freigabe.

### Basispaket (`PAK-BASIS`)

| Plattformmodul (`code`) | voraussichtlich | Status |
| --- | --- | --- |
| `PLT-CRM` | ja | **offen** |
| `PLT-DOKUMENTE` | ja | **offen** |
| `PLT-ANGEBOTE` | nein | **offen** |
| `PLT-RECHNUNGEN` | nein | **offen** |
| `PLT-KI-ASSISTENT` | nein | **offen** |
| `PLT-AUTOMATISIERUNGEN` | nein | **offen** |

### KI-Paket (`PAK-KI`)

| Plattformmodul (`code`) | voraussichtlich | Status |
| --- | --- | --- |
| `PLT-KI-ASSISTENT` | ja | **offen** |
| `PLT-CRM` | unklar | **offen** |
| `PLT-DOKUMENTE` | unklar | **offen** |
| `PLT-ANGEBOTE` | unklar | **offen** |
| `PLT-RECHNUNGEN` | unklar | **offen** |
| `PLT-AUTOMATISIERUNGEN` | unklar | **offen** |

**Hinweis:** Ob das KI-Paket ein reines Add-on (nur KI-Assistent) oder ein Bundle mit Basisfunktionen ist, ist **noch nicht festgelegt**.

### Enterprise-Paket (`PAK-ENTERPRISE`)

| Plattformmodul (`code`) | voraussichtlich | Status |
| --- | --- | --- |
| `PLT-CRM` | ja | **offen** |
| `PLT-ANGEBOTE` | ja | **offen** |
| `PLT-RECHNUNGEN` | ja | **offen** |
| `PLT-KI-ASSISTENT` | ja | **offen** |
| `PLT-AUTOMATISIERUNGEN` | ja | **offen** |
| `PLT-DOKUMENTE` | ja | **offen** |

**Hinweis:** „Alle sechs Module“ ist eine **Arbeitshypothese**, bis die fachliche Freigabe erfolgt. Abgrenzung zu Basispaket + KI-Paket ist **offen**.

### Beziehung zwischen Paketen (Übersicht)

```
                    ┌─────────────────┐
                    │  Basispaket     │  Inhalt: offen
                    └────────┬────────┘
                             │  Teilüberschneidung in V1 erlaubt
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
       ┌────────────┐ ┌────────────┐ ┌──────────────────┐
       │  KI-Paket  │ │ (Add-on?)  │ │ Enterprise-Paket│
       │  Inhalt:   │ │            │ │  Inhalt: offen    │
       │  offen     │ │            │ │  (evtl. alle 6)   │
       └────────────┘ └────────────┘ └──────────────────┘
```

Teilüberschneidungen zwischen Paketen sind in **V1 erlaubt** (z. B. Basispaket + KI-Paket im selben Angebot). Redundanz wird **pro Angebot** geprüft (siehe [`docs/produktarchitektur.md`](./produktarchitektur.md) Abschnitt 5.2).

---

## Freigabe-Checkliste (Phase 0 → Phase 1)

| # | Punkt | Status |
| --- | --- | --- |
| P0-1 | Plattformmodul-Katalog (6 Module) | **erledigt** — [`docs/plattformmodule-katalog.md`](./plattformmodule-katalog.md) |
| P0-2 | Produktkandidaten benannt | **erledigt** — diese Datei |
| P0-3 | Paketbestandteile verbindlich | **offen** |
| P0-4 | Preisart je Produkt | **offen** |
| P0-5 | Listenpreise netto (Cent) | **offen** |
| P0-6 | Einheit und Umsatzsteuer je Produkt | **offen** |
| P0-7 | Org-Gesamtpreis vs. Produktlistenpreis | **offen** |
| P0-8 | Fachliche Freigabe durch Produktverantwortung | **ausstehend** |

**Phase 1 (Schema/Seed) startet erst**, wenn P0-3 bis P0-6 für alle aktiven Produkte abgeschlossen und P0-8 erteilt ist.

---

## Änderungshistorie

| Datum | Änderung |
| --- | --- |
| 2026-07-21 | Phase 0 — Fachvorlage und Produktkandidaten ohne Preise |
