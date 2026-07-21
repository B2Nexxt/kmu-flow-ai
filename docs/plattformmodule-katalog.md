# Plattformmodul-Katalog (fachlich, verbindlich)

Verbindlicher **Phase-0-Katalog** der sechs Plattformmodule von KMU Flow AI. Diese Module sind **Funktions-/Lizenzstamm** — sie haben **keine Verkaufspreise** und erscheinen nicht als Angebots- oder Rechnungspositionen.

**Status:** Fachlich freigegeben für Phase 1 (Schema/Seed) — **noch keine Migration**  
**Bezug:** [`docs/produktarchitektur.md`](./produktarchitektur.md), [`docs/produktkatalog-fachlich.md`](./produktkatalog-fachlich.md)

---

## Geltungsbereich

| In Scope | Out of Scope |
| --- | --- |
| Stammdaten der 6 Plattformfunktionen | Listenpreise, `preisart`, Umsatzsteuer |
| Mapping aus bestehendem Onboarding (`MODULE_OPTIONS`) | Verkaufbare Produkte/Pakete |
| `technischer_schluessel` für Feature-Gates | SQL, Seed, RPC, UI |

---

## Verbindliche Katalogtabelle

| code | technischer_schluessel | name | beschreibung | aktiv | sortierung |
| --- | --- | --- | --- | --- | ---: |
| `PLT-CRM` | `crm` | CRM | Kunden-, Kontakt- und Beziehungsverwaltung im Mandantenportal. Grundlage für Anfragen, Angebote und Kundenkommunikation. | ja | 10 |
| `PLT-ANGEBOTE` | `angebote` | Angebote | Angebotsfunktion im Mandantenportal: Entwürfe, Versionen, Versand und Nachverfolgung eigener Kundenangebote. | ja | 20 |
| `PLT-RECHNUNGEN` | `rechnungen` | Rechnungen | Rechnungsfunktion für den Mandanten: Erstellung, Verwaltung und Nachverfolgung ausgehender Rechnungen. | ja | 30 |
| `PLT-KI-ASSISTENT` | `ki_assistent` | KI-Assistent | KI-gestützte Assistenzfunktionen: Entwürfe, Zusammenfassungen und Vorschläge im Arbeitsalltag. Endgültige Entscheidungen trifft der Mensch. | ja | 40 |
| `PLT-AUTOMATISIERUNGEN` | `automatisierungen` | Automatisierungen | Workflow- und Automatisierungsfunktionen für wiederkehrende Aufgaben. Nicht zu verwechseln mit mandantenspezifischen `organization_automatisierungen`. | ja | 50 |
| `PLT-DOKUMENTE` | `dokumente` | Dokumente | Zentrale Dokumentenverwaltung mit rollenbasierter Zugriffssteuerung im Mandantenkontext. | ja | 60 |

---

## Pflege-Regeln

| Regel | Beschreibung |
| --- | --- |
| Kein Preis | Plattformmodule haben kein `einzelpreis_netto_cents` und keine `preisart` |
| Stabile Schlüssel | `technischer_schluessel` und `code` nach Go-Live nicht änderbar |
| Deaktivierung | `aktiv = nein` — Modul nicht mehr in neuen Paket-Zuordnungen wählbar; bestehende Lizenzen bleiben historisch gültig |
| Kein Hard-Delete | Bei Verwendung in `organization_modules` oder `produkt_plattformmodule` nur deaktivieren |
| Sortierung | Auswahllisten und Admin-UI nach `sortierung`, dann `name` |

---

## Herkunft aus Ist-System

Die Spalte `name` entspricht 1:1 den bisherigen Freitextwerten in `MODULE_OPTIONS` / `organization_modules.modul`:

| Bisheriger Freitext (`modul`) | code | technischer_schluessel |
| --- | --- | --- |
| `CRM` | `PLT-CRM` | `crm` |
| `Angebote` | `PLT-ANGEBOTE` | `angebote` |
| `Rechnungen` | `PLT-RECHNUNGEN` | `rechnungen` |
| `KI-Assistent` | `PLT-KI-ASSISTENT` | `ki_assistent` |
| `Automatisierungen` | `PLT-AUTOMATISIERUNGEN` | `automatisierungen` |
| `Dokumente` | `PLT-DOKUMENTE` | `dokumente` |

Backfill-Mapping für Phase 4: [`docs/module-zusammenfuehrung-mapping.md`](./module-zusammenfuehrung-mapping.md) (wird auf `plattformmodul_id` angepasst, sobald Schema steht).

---

## Änderungshistorie

| Datum | Änderung |
| --- | --- |
| 2026-07-21 | Phase 0 — verbindlicher Katalog (6 Module) |
