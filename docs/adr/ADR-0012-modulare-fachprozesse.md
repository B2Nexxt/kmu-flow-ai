# ADR-0012: Modulare Fachprozesse auf gemeinsamer Plattform

**Status:** Angenommen (verbindlich)  
**Datum:** 2026-07-26  
**Bezug:** [`docs/fachkonzept/09-modularitaet-und-produktstrategie.md`](../fachkonzept/09-modularitaet-und-produktstrategie.md), ADR-0001

---

## Kontext

Mandanten sollen schrittweise starten können (z. B. nur Anfrage & CRM) und später erweitern — ohne Datenmigration. Parallel existiert das SaaS-Modell mit **Produkten/Paketen** und **Plattformmodulen** (Lizenztechnik).

---

## Entscheidung

**Fachmodule sind einzeln nutzbar und arbeiten kombiniert auf einer gemeinsamen Plattform und Datenbasis.**

| Regel | Beschreibung |
| --- | --- |
| Autark | Jedes Fachmodul liefert eigenständigen Nutzen |
| Kombiniert | Gemeinsamer Prozess und Datenbestand |
| Upgrade | Nachträglich gebuchte Module nutzen vorhandene Daten |
| Keine Migration | Kein Systemwechsel beim Modul-Zukauf |

**Abgrenzung (konsistent mit ADR-0001):**

| Begriff | Ebene |
| --- | --- |
| **Fachmodule** | Operative Domänen (Projekte, Material, …) |
| **Plattformmodule** | Technische Lizenz (`organization_modules`) |
| **Produkte/Pakete** | Vertrieb an Mandanten |

---

## Alternativen ( verworfen )

| Alternative | Grund der Ablehnung |
| --- | --- |
| Monolith ohne Modultrennung | Kein schrittweiser Einstieg |
| Separate Apps pro Modul | Datenbruch, doppelte Pflege |
| Fachmodul = Plattformmodul 1:1 | Zu grob; Vermischung Verkauf und Domäne |

---

## Begründung

1. **Go-to-Market** — Problemorientierte Buchung einzelner Bereiche.
2. **Datenhoheit** — Kundenakte und Objekte bleiben beim Wechsel des Modulumfangs erhalten.
3. **Architekturklarheit** — Drei Ebenen (Fach / Lizenz / Vertrieb) ohne Widerspruch zu ADR-0001.

---

## Konsequenzen

### Positiv

- Roadmap Phase H (Kundenportal) kann modulweise wachsen.
- Lizenz-RPC (Phase G) schaltet Plattformmodule; Fachmodule folgen Feature-Gates.

### Aufwand

- Mapping Fachmodul ↔ Plattformmodul — **noch offen**.
- `leistungsmodule`-Zwischenlösung ablösen (produktarchitektur).

### Nicht Bestandteil dieser Entscheidung

- Preise der SaaS-Pakete
- Konkrete Modulliste pro Vertriebspaket
- Implementierung operativer Module

---
